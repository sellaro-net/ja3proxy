//! Golden wire tests: the ClientHello and HTTP/2 frames sent for Chrome profiles,
//! compared with the sanitized capture of real Chrome in `emulation/golden`.
//! Loopback only.
use super::*;
use crate::models::{BrowserIdentity, HeaderOrder};
use futures_util::StreamExt;
use serde_json::Value;
use std::{collections::BTreeSet, pin::Pin};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::timeout,
};

const GOLDEN: &str = include_str!("../emulation/golden/chrome_155.json");
const TEST_TIMEOUT: Duration = Duration::from_secs(5);
/// JA4 of the pre-existing profiles, measured on a TLS echo before the new profiles.
const CHROME_149_JA4: &str = "t13d1516h2_8daaf6152771_d8a2da3f94cd";
const CHROME_150_JA4: &str = "t13d1516h2_8daaf6152771_806a8c22fdea";

fn golden() -> Value {
    serde_json::from_str(GOLDEN).unwrap()
}

fn golden_names(key: &str) -> Vec<String> {
    golden()["requests"][key]["headers"]
        .as_array()
        .unwrap()
        .iter()
        .map(|name| name.as_str().unwrap().to_owned())
        .collect()
}

struct Loopback;
impl Resolve for Loopback {
    fn resolve(&self, _: Name) -> Resolving {
        Box::pin(async {
            Ok(Box::new(std::iter::once(SocketAddr::from(([127, 0, 0, 1], 0)))) as Addrs)
        })
    }
}

fn network_client(profile: &str, emulate_headers: bool) -> NetworkClient {
    NetworkClient::with_resolver(
        Arc::new(NetworkPolicy::new(true)),
        ConnectionSpec {
            egress: Egress::Direct,
            identity: BrowserIdentity {
                tls_profile: profile.into(),
                emulate_headers,
                user_agent: None,
            },
        },
        Arc::new(Loopback),
    )
    .unwrap()
}

fn is_grease(value: u16) -> bool {
    value & 0x0f0f == 0x0a0a && value >> 8 == value & 0xff
}

struct Reader<'a>(&'a [u8]);
impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> &'a [u8] {
        let (head, tail) = self.0.split_at(n);
        self.0 = tail;
        head
    }
    fn u8(&mut self) -> usize {
        usize::from(self.take(1)[0])
    }
    fn u16(&mut self) -> u16 {
        let bytes = self.take(2);
        u16::from_be_bytes([bytes[0], bytes[1]])
    }
    fn u16s(bytes: &[u8]) -> Vec<u16> {
        bytes
            .chunks(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect()
    }
}

struct ClientHello {
    ciphers: Vec<u16>,
    extensions: Vec<(u16, Vec<u8>)>,
}

impl ClientHello {
    fn parse(handshake: &[u8]) -> Self {
        let mut reader = Reader(handshake);
        assert_eq!(reader.u8(), 1, "ClientHello");
        reader.take(3 + 2 + 32);
        let session = reader.u8();
        reader.take(session);
        let ciphers = usize::from(reader.u16());
        let ciphers = Reader::u16s(reader.take(ciphers));
        let compression = reader.u8();
        reader.take(compression);
        let length = usize::from(reader.u16());
        let mut extensions = Reader(reader.take(length));
        let mut parsed = Vec::new();
        while !extensions.0.is_empty() {
            let id = extensions.u16();
            let length = usize::from(extensions.u16());
            parsed.push((id, extensions.take(length).to_vec()));
        }
        Self {
            ciphers,
            extensions: parsed,
        }
    }

    fn extension(&self, id: u16) -> &[u8] {
        &self
            .extensions
            .iter()
            .find(|(candidate, _)| *candidate == id)
            .unwrap_or_else(|| panic!("extension {id} missing"))
            .1
    }

    fn extension_ids(&self) -> BTreeSet<u16> {
        self.extensions
            .iter()
            .map(|(id, _)| *id)
            .filter(|id| !is_grease(*id))
            .collect()
    }

    fn ciphers(&self) -> Vec<u16> {
        self.ciphers
            .iter()
            .copied()
            .filter(|cipher| !is_grease(*cipher))
            .collect()
    }

    /// u16 list behind a two-byte length (signature_algorithms, supported_groups).
    fn list16(&self, id: u16) -> Vec<u16> {
        Reader::u16s(&self.extension(id)[2..])
    }

    /// Protocol names behind a two-byte length (ALPN, ALPS).
    fn protocols(&self, id: u16) -> Vec<String> {
        let mut reader = Reader(&self.extension(id)[2..]);
        let mut names = Vec::new();
        while !reader.0.is_empty() {
            let length = reader.u8();
            names.push(String::from_utf8(reader.take(length).to_vec()).unwrap());
        }
        names
    }

    fn key_share_groups(&self) -> Vec<u16> {
        let mut reader = Reader(&self.extension(51)[2..]);
        let mut groups = Vec::new();
        while !reader.0.is_empty() {
            groups.push(reader.u16());
            let length = usize::from(reader.u16());
            reader.take(length);
        }
        groups
    }

    fn ja4(&self) -> String {
        fn hash12(text: &str) -> String {
            btls::sha::sha256(text.as_bytes())[..6]
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect()
        }
        let ciphers = self.ciphers();
        let extensions = self.extension_ids();
        let version = Reader::u16s(&self.extension(43)[1..])
            .into_iter()
            .filter(|version| !is_grease(*version))
            .max()
            .unwrap();
        let version = match version {
            0x0304 => "13",
            0x0303 => "12",
            other => panic!("unexpected TLS version {other:#x}"),
        };
        let sni = if extensions.contains(&0) { 'd' } else { 'i' };
        let alpn = &self.protocols(16)[0];
        let alpn = format!(
            "{}{}",
            alpn.chars().next().unwrap(),
            alpn.chars().last().unwrap()
        );
        let mut sorted_ciphers: Vec<String> = ciphers.iter().map(|c| format!("{c:04x}")).collect();
        sorted_ciphers.sort();
        let sorted_extensions: Vec<String> = extensions
            .iter()
            .filter(|id| !matches!(id, 0 | 16))
            .map(|id| format!("{id:04x}"))
            .collect();
        let sigalgs: Vec<String> = self
            .list16(13)
            .into_iter()
            .filter(|sigalg| !is_grease(*sigalg))
            .map(|sigalg| format!("{sigalg:04x}"))
            .collect();
        format!(
            "t{version}{sni}{:02}{:02}{alpn}_{}_{}",
            ciphers.len(),
            extensions.len(),
            hash12(&sorted_ciphers.join(",")),
            hash12(&format!(
                "{}_{}",
                sorted_extensions.join(","),
                sigalgs.join(",")
            ))
        )
    }
}

/// ClientHello the service sends for `profile` (fresh handshake, domain SNI).
async fn client_hello(profile: &str) -> ClientHello {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut header = [0u8; 5];
        socket.read_exact(&mut header).await.unwrap();
        assert_eq!(header[0], 22, "TLS handshake record");
        let mut record = vec![0; usize::from(u16::from_be_bytes([header[3], header[4]]))];
        socket.read_exact(&mut record).await.unwrap();
        record
    });
    let client = network_client(profile, false);
    let request = client
        .request(Method::GET, &format!("https://golden.test:{port}/"))
        .await
        .unwrap()
        .timeout(TEST_TIMEOUT)
        .send();
    // The fixture server closes after reading, so the handshake itself fails.
    assert!(timeout(TEST_TIMEOUT, request).await.unwrap().is_err());
    ClientHello::parse(&timeout(TEST_TIMEOUT, server).await.unwrap().unwrap())
}

#[tokio::test]
async fn chrome_155_client_hello_matches_real_chrome() {
    let fixture = golden();
    let tls = &fixture["tls"];
    let numbers = |key: &str| -> Vec<u16> {
        tls[key]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_u64().unwrap() as u16)
            .collect()
    };
    let strings = |value: &Value| -> Vec<String> {
        value
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_str().unwrap().to_owned())
            .collect()
    };
    for profile in ["chrome_155", "chrome_stable", "chrome_154"] {
        let hello = client_hello(profile).await;
        assert_eq!(hello.ja4(), tls["ja4"].as_str().unwrap(), "{profile}");
        assert_eq!(hello.ciphers(), numbers("cipherSuites"), "{profile}");
        assert_eq!(
            hello.extension_ids(),
            numbers("extensions").into_iter().collect::<BTreeSet<_>>()
        );
        let sigalgs = hello.list16(13);
        assert_eq!(
            is_grease(sigalgs[0]),
            tls["signatureAlgorithmsGrease"].as_bool().unwrap()
        );
        assert_eq!(
            sigalgs
                .into_iter()
                .filter(|sigalg| !is_grease(*sigalg))
                .collect::<Vec<_>>(),
            numbers("signatureAlgorithms")
        );
        let groups = hello.list16(10);
        assert!(is_grease(groups[0]));
        assert_eq!(groups[1..], numbers("supportedGroups"));
        let key_shares = hello.key_share_groups();
        assert!(is_grease(key_shares[0]));
        assert_eq!(key_shares[1..], numbers("keyShareGroups"));
        let versions = Reader::u16s(&hello.extension(43)[1..]);
        assert!(is_grease(versions[0]));
        assert_eq!(versions[1..], numbers("supportedVersions"));
        assert_eq!(hello.protocols(16), strings(&tls["alpn"]));
        let alps = tls["alps"]["extension"].as_u64().unwrap() as u16;
        assert_eq!(hello.protocols(alps), strings(&tls["alps"]["protocols"]));
        assert_eq!(
            Reader::u16s(&hello.extension(27)[1..]),
            numbers("certificateCompression")
        );
        let hex = |bytes: &[u8]| -> String { bytes.iter().map(|b| format!("{b:02x}")).collect() };
        assert_eq!(
            hex(hello.extension(0xca34)),
            tls["trustAnchors"].as_str().unwrap()
        );
        assert_eq!(
            hex(hello.extension(0x12e0)),
            tls["serverPadding"].as_str().unwrap()
        );
    }
}

#[tokio::test]
async fn existing_chrome_client_hellos_are_unchanged() {
    for (profile, ja4) in [
        ("chrome_149", CHROME_149_JA4),
        ("chrome_150", CHROME_150_JA4),
    ] {
        let hello = client_hello(profile).await;
        assert_eq!(hello.ja4(), ja4, "{profile}");
        let extensions = hello.extension_ids();
        assert!(!extensions.contains(&0xca34) && !extensions.contains(&0x12e0));
        assert!(!is_grease(hello.list16(13)[0]));
    }
}

/// First HTTP/2 request of a connection as a server sees it.
struct H2Request {
    akamai: String,
    weight: Option<u16>,
    headers: Vec<String>,
}

/// Names of the leading pseudo headers of a HPACK block. Clients encode them
/// from the static table, so no Huffman decoding is needed for the names.
fn pseudo_order(mut block: &[u8]) -> String {
    fn integer(block: &mut &[u8], prefix: u8) -> usize {
        let mask = (1u16 << prefix) as u8 - 1;
        let mut value = usize::from(block[0] & mask);
        *block = &block[1..];
        if value == usize::from(mask) {
            let mut shift = 0;
            loop {
                let byte = block[0];
                *block = &block[1..];
                value += usize::from(byte & 0x7f) << shift;
                shift += 7;
                if byte & 0x80 == 0 {
                    break;
                }
            }
        }
        value
    }
    let mut order = Vec::new();
    while order.len() < 4 {
        let first = block[0];
        let (index, literal) = if first & 0x80 != 0 {
            (integer(&mut block, 7), false)
        } else if first & 0x40 != 0 {
            (integer(&mut block, 6), true)
        } else {
            (integer(&mut block, 4), true)
        };
        if literal {
            assert_ne!(index, 0, "pseudo header names come from the static table");
            let length = integer(&mut block, 7);
            block = &block[length..];
        }
        order.push(match index {
            1 => 'a',
            2 | 3 => 'm',
            4 | 5 => 'p',
            6 | 7 => 's',
            other => panic!("unexpected static index {other}"),
        });
    }
    order
        .iter()
        .map(char::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

async fn read_h2_request<S: AsyncRead + Unpin>(stream: &mut S) -> H2Request {
    let mut preface = [0u8; 24];
    stream.read_exact(&mut preface).await.unwrap();
    assert_eq!(&preface, b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
    let mut raw = Vec::new();
    let mut settings = String::new();
    let mut window = 0u32;
    let mut priority_frames = 0;
    loop {
        let mut header = [0u8; 9];
        stream.read_exact(&mut header).await.unwrap();
        let length = u32::from_be_bytes([0, header[0], header[1], header[2]]) as usize;
        let mut payload = vec![0; length];
        stream.read_exact(&mut payload).await.unwrap();
        raw.extend_from_slice(&header);
        raw.extend_from_slice(&payload);
        let (kind, flags) = (header[3], header[4]);
        match kind {
            // SETTINGS (not ACK)
            4 if flags & 1 == 0 => {
                settings = payload
                    .chunks(6)
                    .map(|entry| {
                        format!(
                            "{}:{}",
                            u16::from_be_bytes([entry[0], entry[1]]),
                            u32::from_be_bytes([entry[2], entry[3], entry[4], entry[5]])
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(";");
            }
            8 => window += u32::from_be_bytes(payload[..4].try_into().unwrap()) & 0x7fff_ffff,
            2 => priority_frames += 1,
            1 => {
                assert_ne!(flags & 0x4, 0, "single HEADERS frame");
                let mut block = &payload[..];
                if flags & 0x8 != 0 {
                    let pad = usize::from(block[0]);
                    block = &block[1..block.len() - pad];
                }
                let weight = (flags & 0x20 != 0).then(|| {
                    let weight = u16::from(block[4]) + 1;
                    block = &block[5..];
                    weight
                });
                let pseudo = pseudo_order(block);
                let mut codec = http2::Codec::<_, bytes::Bytes>::new(std::io::Cursor::new(raw));
                let headers = loop {
                    match codec.next().await.unwrap().unwrap() {
                        http2::frame::Frame::Headers(frame) => break frame.into_parts().1,
                        _ => continue,
                    }
                };
                return H2Request {
                    akamai: format!("{settings}|{window}|{priority_frames}|{pseudo}"),
                    weight,
                    headers: headers
                        .keys()
                        .map(|name| name.as_str().to_owned())
                        .collect(),
                };
            }
            _ => {}
        }
    }
}

/// Loopback TLS server negotiating h2; returns the first request of each connection.
async fn h2_server(
    requests: usize,
) -> (
    u16,
    wreq::tls::trust::CertStore,
    tokio::task::JoinHandle<Vec<H2Request>>,
) {
    let rcgen::CertifiedKey { cert, signing_key } =
        rcgen::generate_simple_self_signed(vec!["golden.test".into()]).unwrap();
    let cert = btls::x509::X509::from_der(cert.der()).unwrap();
    let key =
        btls::pkey::PKey::private_key_from_pem(signing_key.serialize_pem().as_bytes()).unwrap();
    let mut acceptor =
        btls::ssl::SslAcceptor::mozilla_intermediate_v5(btls::ssl::SslMethod::tls()).unwrap();
    acceptor.set_certificate(&cert).unwrap();
    acceptor.set_private_key(&key).unwrap();
    acceptor.set_alpn_select_callback(|_, client| {
        btls::ssl::select_next_proto(b"\x02h2", client).ok_or(btls::ssl::AlpnError::NOACK)
    });
    let acceptor = acceptor.build();
    let roots = wreq::tls::trust::CertStore::builder()
        .add_der_cert(&cert.to_der().unwrap())
        .build()
        .unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let mut seen = Vec::new();
        for _ in 0..requests {
            let (socket, _) = listener.accept().await.unwrap();
            let ssl = btls::ssl::Ssl::new(acceptor.context()).unwrap();
            let mut tls = tokio_btls::SslStream::new(ssl, socket).unwrap();
            Pin::new(&mut tls).accept().await.unwrap();
            seen.push(read_h2_request(&mut tls).await);
            let _ = tls.shutdown().await;
        }
        seen
    });
    (port, roots, server)
}

fn h2_client(
    profile: TlsProfile,
    emulate_headers: bool,
    roots: wreq::tls::trust::CertStore,
) -> Client {
    Client::builder()
        .emulation(profile_emulation(profile, emulate_headers))
        .auto_accept_encoding(emulate_headers)
        .no_proxy()
        .dns_resolver(Loopback)
        .tls_cert_store(roots)
        .retry(wreq::retry::Policy::never())
        .build()
        .unwrap()
}

fn alphabetical(pairs: &[(&str, &str)]) -> HeaderMap {
    let mut pairs = pairs.to_vec();
    pairs.sort_unstable();
    let mut map = HeaderMap::new();
    for (name, value) in pairs {
        map.append(
            HeaderName::from_bytes(name.as_bytes()).unwrap(),
            HeaderValue::from_str(value).unwrap(),
        );
    }
    map
}

const UA_155: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const SEC_CH_UA_155: &str =
    "\"Google Chrome\";v=\"155\", \"Chromium\";v=\"155\", \"Not(A:Brand\";v=\"24\"";

#[tokio::test]
async fn chrome_155_http2_frames_match_real_chrome() {
    let navigation = alphabetical(&[
        ("sec-ch-ua", SEC_CH_UA_155),
        ("sec-ch-ua-mobile", "?0"),
        ("sec-ch-ua-platform", "\"Windows\""),
        ("upgrade-insecure-requests", "1"),
        ("user-agent", UA_155),
        ("accept", "text/html"),
        ("sec-fetch-site", "none"),
        ("sec-fetch-mode", "navigate"),
        ("sec-fetch-user", "?1"),
        ("sec-fetch-dest", "document"),
        ("referer", "https://example.test/"),
        ("accept-encoding", "gzip, deflate, br, zstd"),
        ("accept-language", "en-US,en;q=0.9"),
        ("cookie", "a=b"),
        ("priority", "u=0, i"),
    ]);
    let fetch = alphabetical(&[
        ("sec-ch-ua", SEC_CH_UA_155),
        ("sec-ch-ua-mobile", "?0"),
        ("sec-ch-ua-platform", "\"Windows\""),
        ("user-agent", UA_155),
        ("x-probe-a", "1"),
        ("x-probe-b", "2"),
        ("accept", "*/*"),
        ("sec-fetch-site", "same-origin"),
        ("sec-fetch-mode", "cors"),
        ("sec-fetch-dest", "empty"),
        ("referer", "https://golden.test/"),
        ("accept-encoding", "gzip, deflate, br, zstd"),
        ("accept-language", "en-US,en;q=0.9"),
        ("cookie", "a=b"),
        ("priority", "u=1, i"),
    ]);
    let (port, roots, server) = h2_server(2).await;
    let profile = parse_tls_profile("chrome_155").unwrap();
    let url = format!("https://golden.test:{port}/");
    for headers in [navigation, fetch] {
        // A fresh client per request: each capture is the first stream of a connection.
        let client = h2_client(profile, false, roots.clone());
        let request = shape_request(
            client.get(&url),
            profile.shaping(),
            &HeaderMap::new(),
            &Method::GET,
            false,
            headers,
            HeaderOrder::Browser,
        );
        let _ = timeout(TEST_TIMEOUT, request.timeout(TEST_TIMEOUT).send()).await;
    }
    let seen = timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
    let fixture = golden();
    for (request, (key, weight)) in seen
        .iter()
        .zip([("navigation", 256), ("fetchGetApplicationHeaders", 220)])
    {
        assert_eq!(request.akamai, fixture["http2"]["akamai"].as_str().unwrap());
        assert_eq!(request.weight, Some(weight), "{key}");
        assert_eq!(request.headers, golden_names(key), "{key}");
    }
}

#[tokio::test]
async fn chrome_149_http2_request_with_emulated_headers_is_unchanged() {
    let (port, roots, server) = h2_server(1).await;
    let profile = parse_tls_profile("chrome_149").unwrap();
    let defaults = profile_emulation(profile, true).headers;
    let client = h2_client(profile, true, roots);
    let request = shape_request(
        client.get(format!("https://golden.test:{port}/")),
        profile.shaping(),
        &defaults,
        &Method::GET,
        false,
        HeaderMap::new(),
        HeaderOrder::Caller,
    );
    let _ = timeout(TEST_TIMEOUT, request.timeout(TEST_TIMEOUT).send()).await;
    let seen = timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
    assert_eq!(
        seen[0].akamai,
        "1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p"
    );
    assert_eq!(seen[0].weight, Some(220));
    assert_eq!(
        seen[0].headers,
        [
            "sec-ch-ua",
            "sec-ch-ua-mobile",
            "sec-ch-ua-platform",
            "upgrade-insecure-requests",
            "user-agent",
            "accept",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-user",
            "sec-fetch-dest",
            "accept-encoding",
            "accept-language",
            "priority",
        ]
    );
}

#[tokio::test]
async fn http1_requests_use_the_same_chrome_order_behind_host() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut head = Vec::new();
        while !head.ends_with(b"\r\n\r\n") {
            head.push(socket.read_u8().await.unwrap());
        }
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
        String::from_utf8(head)
            .unwrap()
            .lines()
            .skip(1)
            .filter_map(|line| {
                line.split_once(':')
                    .map(|(name, _)| name.to_ascii_lowercase())
            })
            .collect::<Vec<_>>()
    });
    let client = network_client("chrome_155", false);
    let mut pairs: Vec<(String, String)> = golden_names("navigation")
        .into_iter()
        .map(|name| {
            let value = match name.as_str() {
                "sec-fetch-mode" => "navigate",
                "priority" => "u=0, i",
                _ => "1",
            };
            (name, value.to_owned())
        })
        .collect();
    pairs.sort();
    let builder = client
        .apply_headers(
            client
                .request(Method::GET, &format!("http://golden.test:{port}/"))
                .await
                .unwrap(),
            &Method::GET,
            false,
            &pairs,
            HeaderOrder::Browser,
        )
        .unwrap();
    builder.timeout(TEST_TIMEOUT).send().await.unwrap();
    let names = timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
    let mut expected = vec!["host".to_owned()];
    expected.extend(golden_names("navigation"));
    assert_eq!(names, expected);
}

/// Header order of a real Chrome XHR (with client hints), used as an arbitrary caller order.
const XHR_ORDER: [&str; 24] = [
    "sec-ch-ua-full-version-list",
    "sec-ch-ua-platform",
    "viewport-width",
    "device-memory",
    "sec-ch-dpr",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "x-requested-with",
    "accept",
    "sec-ch-viewport-width",
    "downlink",
    "ect",
    "sec-ch-device-memory",
    "dpr",
    "user-agent",
    "rtt",
    "sec-ch-ua-platform-version",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "referer",
    "accept-encoding",
    "accept-language",
    "priority",
];

fn xhr_headers() -> Vec<(String, String)> {
    XHR_ORDER
        .iter()
        .map(|&name| {
            let value = match name {
                "sec-ch-ua" => SEC_CH_UA_155,
                "sec-ch-ua-platform" => "\"Windows\"",
                "sec-ch-ua-mobile" => "?0",
                "x-requested-with" => "XMLHttpRequest",
                "accept" => "application/json, text/javascript, */*; q=0.01",
                "user-agent" => UA_155,
                "sec-fetch-site" => "same-origin",
                "sec-fetch-mode" => "cors",
                "sec-fetch-dest" => "empty",
                "referer" => "https://golden.test/list",
                "accept-encoding" => "gzip, deflate, br, zstd",
                "accept-language" => "de-DE,de;q=0.9",
                "priority" => "u=1, i",
                _ => "8",
            };
            (name.to_owned(), value.to_owned())
        })
        .collect()
}

/// Sends one HTTP/1 GET through the full service path and returns the raw header lines.
async fn http1_header_lines(
    profile: &str,
    headers: &[(String, String)],
    header_order: HeaderOrder,
) -> (u16, Vec<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut head = Vec::new();
        while !head.ends_with(b"\r\n\r\n") {
            head.push(socket.read_u8().await.unwrap());
        }
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
        String::from_utf8(head)
            .unwrap()
            .split("\r\n")
            .skip(1)
            .filter(|line| !line.is_empty())
            .map(str::to_owned)
            .collect::<Vec<_>>()
    });
    let client = network_client(profile, false);
    let builder = client
        .apply_headers(
            client
                .request(Method::GET, &format!("http://golden.test:{port}/"))
                .await
                .unwrap(),
            &Method::GET,
            false,
            headers,
            header_order,
        )
        .unwrap();
    builder.timeout(TEST_TIMEOUT).send().await.unwrap();
    (port, timeout(TEST_TIMEOUT, server).await.unwrap().unwrap())
}

/// The caller's header lines, byte for byte, followed by the client-generated `host`.
fn raw_lines(port: u16, headers: &[(String, String)]) -> Vec<String> {
    headers
        .iter()
        .map(|(name, value)| format!("{name}: {value}"))
        .chain(std::iter::once(format!("host: golden.test:{port}")))
        .collect()
}

#[tokio::test]
async fn caller_header_order_is_sent_byte_for_byte() {
    let headers = xhr_headers();
    let (port, lines) = http1_header_lines("chrome_155", &headers, HeaderOrder::Caller).await;
    assert_eq!(lines, raw_lines(port, &headers));
}

#[tokio::test]
async fn caller_header_order_is_kept_over_http2_with_priority_weight() {
    let (port, roots, server) = h2_server(1).await;
    let profile = parse_tls_profile("chrome_155").unwrap();
    let mut headers = HeaderMap::new();
    for (name, value) in xhr_headers() {
        headers.append(
            HeaderName::from_bytes(name.as_bytes()).unwrap(),
            HeaderValue::from_str(&value).unwrap(),
        );
    }
    let request = shape_request(
        h2_client(profile, false, roots).get(format!("https://golden.test:{port}/")),
        profile.shaping(),
        &HeaderMap::new(),
        &Method::GET,
        false,
        headers,
        HeaderOrder::Caller,
    );
    let _ = timeout(TEST_TIMEOUT, request.timeout(TEST_TIMEOUT).send()).await;
    let seen = timeout(TEST_TIMEOUT, server).await.unwrap().unwrap();
    assert_eq!(seen[0].headers, XHR_ORDER);
    // `priority: u=1, i` still sets Chrome's HEADERS weight.
    assert_eq!(seen[0].weight, Some(220));
}

#[tokio::test]
async fn browser_header_order_applies_the_chrome_template() {
    let headers = xhr_headers();
    let profile = parse_tls_profile("chrome_155").unwrap();
    let mut map = HeaderMap::new();
    for (name, value) in &headers {
        map.append(
            HeaderName::from_bytes(name.as_bytes()).unwrap(),
            HeaderValue::from_str(value).unwrap(),
        );
    }
    let expected: Vec<String> = profile
        .shaping()
        .shape(
            &Method::GET,
            false,
            &map,
            &HeaderMap::new(),
            HeaderOrder::Browser,
        )
        .orig_headers
        .unwrap()
        .iter()
        .map(|(name, _)| name.as_str().to_owned())
        .filter(|name| map.contains_key(name.as_str()))
        .collect();
    assert_ne!(expected, XHR_ORDER);
    let (_, lines) = http1_header_lines("chrome_155", &headers, HeaderOrder::Browser).await;
    let names: Vec<String> = lines
        .iter()
        .map(|line| line.split_once(':').unwrap().0.to_owned())
        .filter(|name| name != "host")
        .collect();
    assert_eq!(names, expected);
}

#[tokio::test]
async fn browser_header_order_is_ignored_for_non_chrome_profiles() {
    let headers = xhr_headers();
    let (port, lines) = http1_header_lines("okhttp_4.12", &headers, HeaderOrder::Browser).await;
    assert_eq!(lines, raw_lines(port, &headers));
}
