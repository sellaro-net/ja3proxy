//! Loopback-only connector regressions. No Internet, ambient proxies or global env mutation.
use super::*;
use crate::models::BrowserIdentity;
use std::{pin::Pin, sync::atomic::AtomicUsize};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

const TEST_TIMEOUT: Duration = Duration::from_secs(5);

struct FixedResolver {
    addresses: Vec<SocketAddr>,
    calls: Arc<AtomicUsize>,
}
impl Resolve for FixedResolver {
    fn resolve(&self, _: Name) -> Resolving {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let addresses = self.addresses.clone();
        Box::pin(async move { Ok(Box::new(addresses.into_iter()) as Addrs) })
    }
}
fn resolver(addresses: &[&str]) -> (Arc<dyn Resolve>, Arc<AtomicUsize>) {
    let calls = Arc::new(AtomicUsize::new(0));
    (
        Arc::new(FixedResolver {
            addresses: addresses
                .iter()
                .map(|ip| SocketAddr::new(ip.parse().unwrap(), 0))
                .collect(),
            calls: calls.clone(),
        }),
        calls,
    )
}
fn spec(egress: Egress, emulate_headers: bool) -> ConnectionSpec {
    ConnectionSpec {
        egress,
        identity: BrowserIdentity {
            tls_profile: "chrome_133".into(),
            emulate_headers,
            user_agent: None,
        },
    }
}
async fn read_head<S: AsyncRead + Unpin>(socket: &mut S) -> String {
    let mut bytes = Vec::new();
    loop {
        assert!(bytes.len() < 16384, "bounded fixture header");
        bytes.push(socket.read_u8().await.unwrap());
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    String::from_utf8(bytes).unwrap()
}
async fn reply<S: AsyncWrite + Unpin>(socket: &mut S) {
    socket
        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
        .await
        .unwrap();
    socket.flush().await.unwrap();
}
async fn response(builder: RequestBuilder) -> wreq::Response {
    builder.timeout(TEST_TIMEOUT).send().await.unwrap()
}

#[tokio::test]
async fn direct_pin_preserves_host_reuses_socket_and_sends_no_emulated_headers() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        // Exactly one accepted socket must carry both requests.
        let (mut socket, _) = listener.accept().await.unwrap();
        for path in ["/first?credential=hidden", "/second"] {
            let head = read_head(&mut socket).await.to_ascii_lowercase();
            assert!(head.starts_with(&format!("get {path} http/1.1\r\n")));
            assert!(head.contains(&format!("\r\nhost: origin.test:{port}\r\n")));
            assert!(!head.contains("user-agent:"));
            assert!(!head.contains("accept:"));
            assert!(!head.contains("accept-encoding:"));
            assert!(!head.contains("sec-ch-ua:"));
            reply(&mut socket).await;
        }
        // Closing the context must release its otherwise reusable idle socket.
        assert_eq!(
            socket.read_u8().await.unwrap_err().kind(),
            std::io::ErrorKind::UnexpectedEof
        );
    });
    let (dns, calls) = resolver(&["127.0.0.1"]);
    let client = NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        spec(Egress::Direct, false),
        dns,
    )
    .unwrap();
    for path in ["/first?credential=hidden", "/second"] {
        let builder = client
            .request(Method::GET, &format!("http://origin.test:{port}{path}"))
            .await
            .unwrap();
        assert_eq!(
            response(builder).await.bytes().await.unwrap().as_ref(),
            b"ok"
        );
    }
    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "no preflight or second socket DNS lookup"
    );
    client.close();
    assert_eq!(
        client
            .request(Method::GET, "http://origin.test/")
            .await
            .err()
            .unwrap()
            .code,
        ErrorCode::ContextNotFound
    );
    timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
}

#[tokio::test]
async fn context_close_drops_delayed_losing_proxy_connection() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_port = listener.local_addr().unwrap().port();
    let (closed, context_closed) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        let (mut pooled, _) = listener.accept().await.unwrap();
        assert!(
            read_head(&mut pooled)
                .await
                .starts_with("CONNECT 127.0.0.1:80 HTTP/1.1\r\n")
        );
        pooled
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await
            .unwrap();
        assert!(
            read_head(&mut pooled)
                .await
                .starts_with("GET /first HTTP/1.1\r\n")
        );
        // Keep the first socket busy until the second connection has actually
        // passed guarded resolution and sent its proxy handshake.
        pooled
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n")
            .await
            .unwrap();
        let (mut delayed, _) = listener.accept().await.unwrap();
        assert!(
            read_head(&mut delayed)
                .await
                .starts_with("CONNECT 127.0.0.1:80 HTTP/1.1\r\n")
        );
        // Never finish the second CONNECT. Releasing the first body forces its
        // pooled socket to win while the speculative connector is pending.
        pooled.write_all(b"ok").await.unwrap();
        assert!(
            read_head(&mut pooled)
                .await
                .starts_with("GET /second HTTP/1.1\r\n")
        );
        reply(&mut pooled).await;

        context_closed.await.unwrap();
        let mut byte = [0];
        assert_eq!(
            delayed.read(&mut byte).await.unwrap(),
            0,
            "losing connector must release its socket without completing CONNECT"
        );
        assert_eq!(
            pooled.read(&mut byte).await.unwrap(),
            0,
            "no detached connector may retain the closed context's idle pool"
        );
    });
    let (dns, _) = resolver(&["127.0.0.1"]);
    let client = NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        spec(
            Egress::Proxy {
                url: format!("http://fixture-user:fixture-password@proxy.test:{proxy_port}"),
            },
            false,
        ),
        dns,
    )
    .unwrap();
    let first = response(
        client
            .request(Method::GET, "http://origin.test/first")
            .await
            .unwrap(),
    )
    .await;
    let second = client
        .request(Method::GET, "http://origin.test/second")
        .await
        .unwrap();
    let second = tokio::spawn(async move { response(second).await.bytes().await.unwrap() });
    assert_eq!(first.bytes().await.unwrap().as_ref(), b"ok");
    assert_eq!(
        timeout(TEST_TIMEOUT, second)
            .await
            .unwrap()
            .unwrap()
            .as_ref(),
        b"ok"
    );
    client.close();
    closed.send(()).unwrap();
    timeout(TEST_TIMEOUT, server)
        .await
        .expect("context close must release both proxy sockets")
        .unwrap();
}

#[tokio::test]
async fn mixed_answers_and_literal_fast_paths_cannot_open_sockets() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    for addresses in [&["1.1.1.1", "127.0.0.1"][..], &["127.0.0.1", "1.1.1.1"][..]] {
        let (dns, _) = resolver(addresses);
        let client = NetworkClient::with_resolver(
            Arc::new(NetworkPolicy::new(false)),
            spec(Egress::Direct, false),
            dns,
        )
        .unwrap();
        let error = client
            .request(
                Method::GET,
                &format!("http://mixed.test:{}/secret?token=hidden", address.port()),
            )
            .await
            .unwrap()
            .timeout(TEST_TIMEOUT)
            .send()
            .await
            .err()
            .unwrap();
        let safe = crate::error::from_wreq(&error);
        assert_eq!(safe.code, ErrorCode::SsrfBlocked);
        let serialized = serde_json::to_string(&safe).unwrap();
        assert!(!serialized.contains("hidden"));
        assert!(!serialized.contains("mixed.test"));
    }
    // Exercise the connector directly, bypassing NetworkClient's useful early literal
    // rejection. The socket path itself must still invoke the guard.
    let (dns, calls) = resolver(&["1.1.1.1"]);
    let guard = GuardedResolver {
        policy: Arc::new(NetworkPolicy::new(false)),
        upstream: dns,
        closed: Arc::new(AtomicBool::new(false)),
    };
    let client = Client::builder()
        .no_proxy()
        .dns_resolver(guard)
        .resolver_enforced_egress(true)
        .build()
        .unwrap();
    let error = client
        .get(format!("http://{address}/"))
        .timeout(TEST_TIMEOUT)
        .send()
        .await
        .err()
        .unwrap();
    assert_eq!(crate::error::from_wreq(&error).code, ErrorCode::SsrfBlocked);
    assert_eq!(
        calls.load(Ordering::SeqCst),
        0,
        "literal policy does not delegate to DNS"
    );
    assert!(
        timeout(Duration::from_millis(50), listener.accept())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn proxy_endpoint_mixed_answers_are_rejected_before_socket_creation() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    for scheme in ["http", "https", "socks4", "socks4a", "socks5", "socks5h"] {
        let (dns, _) = resolver(&["1.1.1.1", "127.0.0.1"]);
        let client = NetworkClient::with_resolver(
            Arc::new(NetworkPolicy::new(false)),
            spec(
                Egress::Proxy {
                    url: format!("{scheme}://proxy.test:{port}"),
                },
                false,
            ),
            dns,
        )
        .unwrap();
        let error = client
            .request(Method::GET, "https://origin.test/")
            .await
            .unwrap()
            .timeout(TEST_TIMEOUT)
            .send()
            .await
            .err()
            .unwrap();
        assert_eq!(
            crate::error::from_wreq(&error).code,
            ErrorCode::SsrfBlocked,
            "{scheme}"
        );
    }
    assert!(
        timeout(Duration::from_millis(50), listener.accept())
            .await
            .is_err()
    );
}

async fn socks_target(socket: &mut TcpStream, scheme: &str) -> SocketAddr {
    if scheme.starts_with("socks4") {
        assert_eq!(socket.read_u8().await.unwrap(), 4);
        assert_eq!(socket.read_u8().await.unwrap(), 1);
        let port = socket.read_u16().await.unwrap();
        let mut ip = [0; 4];
        socket.read_exact(&mut ip).await.unwrap();
        assert_ne!(
            ip,
            [0, 0, 0, 1],
            "SOCKS4a must not send a remote DNS sentinel"
        );
        let mut user = Vec::new();
        loop {
            let byte = socket.read_u8().await.unwrap();
            if byte == 0 {
                break;
            }
            user.push(byte);
        }
        assert_eq!(user, b"fixture-user");
        socket.write_all(&[0, 90, 0, 0, 0, 0, 0, 0]).await.unwrap();
        SocketAddr::new(IpAddr::V4(ip.into()), port)
    } else {
        assert_eq!(socket.read_u8().await.unwrap(), 5);
        let count = socket.read_u8().await.unwrap();
        let mut methods = vec![0; count as usize];
        socket.read_exact(&mut methods).await.unwrap();
        assert!(methods.contains(&2));
        socket.write_all(&[5, 2]).await.unwrap();
        assert_eq!(socket.read_u8().await.unwrap(), 1);
        let count = socket.read_u8().await.unwrap();
        let mut user = vec![0; count as usize];
        socket.read_exact(&mut user).await.unwrap();
        let count = socket.read_u8().await.unwrap();
        let mut password = vec![0; count as usize];
        socket.read_exact(&mut password).await.unwrap();
        assert_eq!(user, b"fixture-user");
        assert_eq!(password, b"fixture-password");
        socket.write_all(&[1, 0]).await.unwrap();
        let mut header = [0; 4];
        socket.read_exact(&mut header).await.unwrap();
        assert_eq!(
            header,
            [5, 1, 0, 1],
            "SOCKS5h must send numeric IPv4, never domain ATYP"
        );
        let mut ip = [0; 4];
        socket.read_exact(&mut ip).await.unwrap();
        let port = socket.read_u16().await.unwrap();
        socket
            .write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0])
            .await
            .unwrap();
        SocketAddr::new(IpAddr::V4(ip.into()), port)
    }
}

#[tokio::test]
async fn http_and_every_socks_scheme_pin_target_and_preserve_pooled_origin_identity() {
    for scheme in ["http", "socks4", "socks4a", "socks5", "socks5h"] {
        let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_address = target.local_addr().unwrap();
        let proxy = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_port = proxy.local_addr().unwrap().port();
        let origin_server = tokio::spawn(async move {
            let (mut socket, _) = target.accept().await.unwrap();
            for _ in 0..2 {
                let head = read_head(&mut socket).await.to_ascii_lowercase();
                assert!(head.starts_with("get /resource http/1.1\r\n"));
                assert!(head.contains(&format!(
                    "\r\nhost: origin.test:{}\r\n",
                    target_address.port()
                )));
                assert!(!head.contains("proxy-authorization"));
                reply(&mut socket).await;
            }
        });
        let proxy_server = tokio::spawn(async move {
            let (mut socket, _) = proxy.accept().await.unwrap();
            let destination = if scheme == "http" {
                let head = read_head(&mut socket).await;
                assert!(head.starts_with(&format!("CONNECT {target_address} HTTP/1.1\r\n")));
                assert!(!head.contains("origin.test"));
                socket
                    .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    .await
                    .unwrap();
                target_address
            } else {
                socks_target(&mut socket, scheme).await
            };
            assert_eq!(destination, target_address);
            let mut upstream = TcpStream::connect(destination).await.unwrap();
            let _ = tokio::io::copy_bidirectional(&mut socket, &mut upstream).await;
        });
        let credentials = if scheme.starts_with("socks4") {
            "fixture-user@"
        } else if scheme.starts_with("socks5") {
            "fixture-user:fixture-password@"
        } else {
            ""
        };
        let (dns, calls) = resolver(&["127.0.0.1"]);
        let client = NetworkClient::with_resolver(
            Arc::new(NetworkPolicy::new(true)),
            spec(
                Egress::Proxy {
                    url: format!("{scheme}://{credentials}proxy.test:{proxy_port}"),
                },
                false,
            ),
            dns,
        )
        .unwrap();
        for _ in 0..2 {
            let builder = client
                .request(
                    Method::GET,
                    &format!("http://origin.test:{}/resource", target_address.port()),
                )
                .await
                .unwrap();
            assert_eq!(
                response(builder).await.bytes().await.unwrap().as_ref(),
                b"ok"
            );
        }
        assert_eq!(
            calls.load(Ordering::SeqCst),
            2,
            "one endpoint and one numeric target resolution: {scheme}"
        );
        client.close();
        timeout(TEST_TIMEOUT, origin_server).await.unwrap().unwrap();
        timeout(TEST_TIMEOUT, proxy_server).await.unwrap().unwrap();
    }
}

#[tokio::test]
async fn rejected_connect_never_falls_back_to_forward_proxy_or_direct() {
    let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let target_port = target.local_addr().unwrap().port();
    let proxy = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_port = proxy.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = proxy.accept().await.unwrap();
        assert!(
            read_head(&mut socket)
                .await
                .starts_with("CONNECT 127.0.0.1:")
        );
        socket
            .write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
        assert!(
            timeout(Duration::from_millis(100), proxy.accept())
                .await
                .is_err()
        );
    });
    let (dns, _) = resolver(&["127.0.0.1"]);
    let client = NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        spec(
            Egress::Proxy {
                url: format!("http://proxy.test:{proxy_port}"),
            },
            false,
        ),
        dns,
    )
    .unwrap();
    assert!(
        client
            .request(
                Method::POST,
                &format!("http://origin.test:{target_port}/write")
            )
            .await
            .unwrap()
            .body("not-replayable")
            .timeout(TEST_TIMEOUT)
            .send()
            .await
            .is_err()
    );
    assert!(
        timeout(Duration::from_millis(100), target.accept())
            .await
            .is_err()
    );
    timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
}

#[tokio::test]
async fn header_emulation_and_fixed_user_agent_are_effective_on_wire() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let head = read_head(&mut socket).await.to_ascii_lowercase();
        assert!(head.contains("\r\nuser-agent: fixed-fixture-agent\r\n"));
        assert!(head.contains("\r\nsec-ch-ua:"));
        assert!(head.contains("\r\naccept-encoding:"));
        assert_eq!(head.matches("\r\nx-repeated:").count(), 2);
        reply(&mut socket).await;
    });
    let mut connection = spec(Egress::Direct, true);
    connection.identity.user_agent = Some("fixed-fixture-agent".into());
    let (dns, _) = resolver(&["127.0.0.1"]);
    let client =
        NetworkClient::with_resolver(Arc::new(NetworkPolicy::new(true)), connection, dns).unwrap();
    let url = format!("http://origin.test:{port}/");
    let inconsistent = client.apply_headers(
        client.request(Method::GET, &url).await.unwrap(),
        &[("user-agent".into(), "different-agent".into())],
    );
    assert_eq!(inconsistent.err().unwrap().code, ErrorCode::ContextConflict);
    let builder = client
        .apply_headers(
            client.request(Method::GET, &url).await.unwrap(),
            &[
                ("X-Repeated".into(), "a".into()),
                ("X-Repeated".into(), "b".into()),
            ],
        )
        .unwrap();
    response(builder).await.bytes().await.unwrap();
    timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
}

fn tls_fixture() -> (btls::ssl::SslAcceptor, wreq::tls::trust::CertStore) {
    let rcgen::CertifiedKey { cert, signing_key } =
        rcgen::generate_simple_self_signed(vec!["origin.test".into(), "proxy.test".into()])
            .unwrap();
    let cert = btls::x509::X509::from_der(cert.der()).unwrap();
    let key =
        btls::pkey::PKey::private_key_from_pem(signing_key.serialize_pem().as_bytes()).unwrap();
    let mut acceptor =
        btls::ssl::SslAcceptor::mozilla_intermediate_v5(btls::ssl::SslMethod::tls()).unwrap();
    acceptor.set_certificate(&cert).unwrap();
    acceptor.set_private_key(&key).unwrap();
    let roots = wreq::tls::trust::CertStore::builder()
        .add_der_cert(&cert.to_der().unwrap())
        .build()
        .unwrap();
    (acceptor.build(), roots)
}
async fn tls_accept(
    socket: TcpStream,
    acceptor: &btls::ssl::SslAcceptor,
) -> tokio_btls::SslStream<TcpStream> {
    let ssl = btls::ssl::Ssl::new(acceptor.context()).unwrap();
    let mut tls = tokio_btls::SslStream::new(ssl, socket).unwrap();
    Pin::new(&mut tls).accept().await.unwrap();
    tls
}

#[tokio::test]
async fn https_proxy_and_origin_verify_certificates_and_keep_original_sni() {
    let (acceptor, roots) = tls_fixture();
    let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let target_address = target.local_addr().unwrap();
    let proxy = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_port = proxy.local_addr().unwrap().port();
    let origin_acceptor = acceptor.clone();
    let origin_server = tokio::spawn(async move {
        let (socket, _) = target.accept().await.unwrap();
        let mut tls = tls_accept(socket, &origin_acceptor).await;
        assert_eq!(
            tls.ssl().servername(btls::ssl::NameType::HOST_NAME),
            Some("origin.test")
        );
        let head = read_head(&mut tls).await.to_ascii_lowercase();
        assert!(head.contains(&format!(
            "\r\nhost: origin.test:{}\r\n",
            target_address.port()
        )));
        reply(&mut tls).await;
    });
    let proxy_server = tokio::spawn(async move {
        let (socket, _) = proxy.accept().await.unwrap();
        let mut tls = tls_accept(socket, &acceptor).await;
        assert_eq!(
            tls.ssl().servername(btls::ssl::NameType::HOST_NAME),
            Some("proxy.test")
        );
        assert!(
            read_head(&mut tls)
                .await
                .starts_with(&format!("CONNECT {target_address} HTTP/1.1\r\n"))
        );
        tls.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await
            .unwrap();
        let mut upstream = TcpStream::connect(target_address).await.unwrap();
        let _ = tokio::io::copy_bidirectional(&mut tls, &mut upstream).await;
    });
    let (dns, _) = resolver(&["127.0.0.1"]);
    let guard = GuardedResolver {
        policy: Arc::new(NetworkPolicy::new(true)),
        upstream: dns,
        closed: Arc::new(AtomicBool::new(false)),
    };
    // Only test roots change. Verification and browser TLS configuration stay enabled.
    let client = Client::builder()
        .emulation(profile_emulation(
            parse_tls_profile("chrome_133").unwrap(),
            false,
        ))
        .no_proxy()
        .proxy(wreq::Proxy::all(format!("https://proxy.test:{proxy_port}")).unwrap())
        .dns_resolver(guard)
        .resolver_enforced_egress(true)
        .tls_cert_store(roots)
        .tls_cert_verification(true)
        .tls_verify_hostname(true)
        .retry(wreq::retry::Policy::never())
        .build()
        .unwrap();
    assert_eq!(
        response(client.get(format!("https://origin.test:{}/", target_address.port())))
            .await
            .bytes()
            .await
            .unwrap()
            .as_ref(),
        b"ok"
    );
    drop(client);
    timeout(TEST_TIMEOUT, origin_server).await.unwrap().unwrap();
    timeout(TEST_TIMEOUT, proxy_server).await.unwrap().unwrap();
}

#[tokio::test]
async fn untrusted_origin_certificate_is_never_bypassed() {
    let (acceptor, _) = tls_fixture();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        let ssl = btls::ssl::Ssl::new(acceptor.context()).unwrap();
        let mut tls = tokio_btls::SslStream::new(ssl, socket).unwrap();
        assert!(Pin::new(&mut tls).accept().await.is_err());
    });
    let (dns, _) = resolver(&["127.0.0.1"]);
    let client = NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        spec(Egress::Direct, false),
        dns,
    )
    .unwrap();
    let error = client
        .request(
            Method::GET,
            &format!("https://origin.test:{port}/?secret=hidden"),
        )
        .await
        .unwrap()
        .timeout(TEST_TIMEOUT)
        .send()
        .await
        .err()
        .unwrap();
    assert_eq!(crate::error::from_wreq(&error).code, ErrorCode::TlsError);
    timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
}

#[tokio::test]
async fn disabled_header_emulation_still_decodes_unsolicited_compression() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let head = read_head(&mut socket).await.to_ascii_lowercase();
        assert!(!head.contains("accept-encoding:"));
        assert!(head.contains("\r\nrange: bytes=0-11\r\n"));
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: 32\r\n\r\n")
            .await
            .unwrap();
        socket
            .write_all(&[
                31, 139, 8, 0, 0, 0, 0, 0, 0, 10, 75, 73, 77, 206, 79, 73, 77, 209, 77, 202, 79,
                169, 4, 0, 48, 229, 255, 21, 12, 0, 0, 0,
            ])
            .await
            .unwrap();
    });
    let (dns, _) = resolver(&["127.0.0.1"]);
    let client = NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        spec(Egress::Direct, false),
        dns,
    )
    .unwrap();
    let builder = client
        .request(Method::GET, &format!("http://origin.test:{port}/"))
        .await
        .unwrap()
        .header("range", "bytes=0-11");
    let response = response(builder).await;
    assert!(!response.headers().contains_key("content-encoding"));
    assert!(!response.headers().contains_key("content-length"));
    assert_eq!(response.bytes().await.unwrap().as_ref(), b"decoded-body");
    timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
}

// Trust only the fixture proxy endpoint, so the real production target guard can
// reject private answers while the test still observes a local proxy socket.
struct ProxyFixtureResolver {
    target: GuardedResolver,
}
impl Resolve for ProxyFixtureResolver {
    fn resolve(&self, name: Name) -> Resolving {
        if name.as_str() == "proxy.test" {
            Box::pin(async {
                Ok(Box::new([SocketAddr::from(([127, 0, 0, 1], 0))].into_iter()) as Addrs)
            })
        } else {
            self.target.resolve(name)
        }
    }
}

#[tokio::test]
async fn proxy_targets_cannot_escape_through_remote_dns_or_numeric_literals() {
    for scheme in ["http", "socks4", "socks4a", "socks5", "socks5h"] {
        for host in ["mixed.test", "127.0.0.1"] {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            let proxy = tokio::spawn(async move {
                if let Ok(Ok((mut socket, _))) =
                    timeout(Duration::from_millis(200), listener.accept()).await
                {
                    // A socket may open before target DNS completes, but no CONNECT
                    // authority / SOCKS destination / HTTP request may be transmitted.
                    assert_eq!(
                        socket.read_u8().await.unwrap_err().kind(),
                        std::io::ErrorKind::UnexpectedEof
                    );
                }
            });
            let (dns, calls) = resolver(&["1.1.1.1", "127.0.0.1"]);
            let dns = ProxyFixtureResolver {
                target: GuardedResolver {
                    policy: Arc::new(NetworkPolicy::new(false)),
                    upstream: dns,
                    closed: Arc::new(AtomicBool::new(false)),
                },
            };
            let client = Client::builder()
                .no_proxy()
                .proxy(wreq::Proxy::all(format!("{scheme}://proxy.test:{port}")).unwrap())
                .dns_resolver(dns)
                .resolver_enforced_egress(true)
                .retry(wreq::retry::Policy::never())
                .build()
                .unwrap();
            let error = client
                .get(format!("http://{host}/"))
                .timeout(TEST_TIMEOUT)
                .send()
                .await
                .err()
                .unwrap();
            assert_eq!(
                crate::error::from_wreq(&error).code,
                ErrorCode::SsrfBlocked,
                "{scheme}"
            );
            assert_eq!(
                calls.load(Ordering::SeqCst),
                usize::from(host == "mixed.test")
            );
            timeout(TEST_TIMEOUT, proxy).await.unwrap().unwrap();
        }
    }
}
