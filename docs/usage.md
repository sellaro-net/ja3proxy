# Usage guide

[Home](../README.md) · [API reference](api.md) · [Configuration](configuration.md)

The examples assume a running service, `JA3_PROXY_URL`, `JA3_PROXY_TOKEN` and a
checkout of this repository. Shell examples use POSIX syntax; context examples
also use `curl` and `jq`. Run `python examples/request.py --help` for all flags.

## Requests and uploads

### Read a page

```sh
python examples/request.py https://example.com/ \
  --partition demo --direct --output page.html
```

The output file is replaced atomically after a valid successful terminal frame.
An upstream non-2xx response is still a valid transport: its body is saved and the
CLI exits with code **2**. Transport failures exit with **1** and leave an
existing output file untouched. Interruption exits with **130**.

Without `--output`, raw response bytes go to stdout. They cannot be taken back
if a later terminal frame reports an error: always check the process exit code
before treating piped data as complete. Request IDs and final status summaries
go to stderr.

### Send JSON

```sh
python examples/request.py https://httpbin.org/anything \
  --partition demo --direct --method POST \
  -H 'content-type: application/json' \
  --data '{"message":"hello"}' --output response.json
```

### Upload a file without text conversion

```sh
python examples/request.py https://httpbin.org/anything \
  --partition demo --direct --method POST \
  -H 'content-type: application/octet-stream' \
  --data-file ./payload.bin --output response.json
```

`--data ''` sends an explicitly empty body. Omitting both body flags sends a
bodyless request. Files are streamed in bounded chunks, not buffered as base64.

> [!NOTE]
> These are public demonstration destinations. Do not send real credentials,
> customer data or private files to them; substitute your own test endpoint.

### Control the identity and budgets

```sh
python examples/request.py https://example.com/ \
  --partition demo --direct --profile chrome_149 \
  --timeout 15 --max-response-bytes 1048576 --output page.html
```

The profile must appear in `/capabilities`. `--no-emulate-headers` disables
profile-generated request headers; `-H` adds caller headers. `--user-agent`
sets a fixed UA. These are connection-identity choices, not a guarantee that a
target will accept the request. Never modify the identity of an existing context.

## Proxy routing

Choose **exactly one** of `--direct`, `--proxy` and `--context`:

```sh
# UPSTREAM_PROXY is your configured proxy URL, optionally with URL-encoded userinfo.
python examples/request.py https://example.com/ \
  --partition demo --proxy "$UPSTREAM_PROXY" --output page.html
```

Accepted proxy schemes: `http`, `https`, `socks4`, `socks4a`, `socks5`, `socks5h`.
The service checks both proxy and destination addresses. Proxy failure never
switches to direct egress. Keep proxy credentials out of shared shell history,
screenshots and diagnostic output; command arguments may be visible to local
process inspection.

## Connection contexts

Contexts reuse a connection pool without mixing callers or identities. Use a
stable opaque partition for one isolation boundary and a different partition
for unrelated accounts/sessions.

Create an **external-cookie** context:

```sh
CONTEXT_ID=$(curl --fail --silent --show-error "$JA3_PROXY_URL/contexts" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "partition":"demo",
    "connection":{
      "egress":{"mode":"direct"},
      "identity":{"tlsProfile":"chrome_149","emulateHeaders":true}
    },
    "cookieMode":"external",
    "allowedOrigins":[],
    "ttlMs":60000
  }' | jq -er '.contextId')

python examples/request.py https://example.com/ \
  --partition demo --context "$CONTEXT_ID" --output first.html
python examples/request.py https://example.com/ \
  --partition demo --context "$CONTEXT_ID" --output second.html
```

Close it when finished:

```sh
curl --fail --request DELETE "$JA3_PROXY_URL/contexts/$CONTEXT_ID" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' --data '{"partition":"demo"}'
```

A context fixes proxy/egress, TLS profile, header policy and UA. It has bounded
idle and absolute lifetime. Closing it also cancels active users; an ID from a
different partition cannot be used to read, mutate or cancel its state.

## Cookie sessions

Use **managed** mode when the service should own first-party cookie selection
and `Set-Cookie` ingestion. Origins must be explicit and belong to the same
schemeful first-party site.

### Create a managed context

```sh
CONTEXT_ID=$(curl --fail --silent --show-error "$JA3_PROXY_URL/contexts" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "partition":"demo",
    "connection":{
      "egress":{"mode":"direct"},
      "identity":{"tlsProfile":"chrome_149","emulateHeaders":true}
    },
    "cookieMode":"managed",
    "allowedOrigins":["https://example.com"],
    "ttlMs":60000
  }' | jq -er '.contextId')
```

### Read the current revision and selected cookies

```sh
STATE=$(curl --fail --silent --show-error \
  "$JA3_PROXY_URL/contexts/$CONTEXT_ID/cookies" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"partition":"demo","operation":"select","url":"https://example.com/"}')
REVISION=$(printf '%s' "$STATE" | jq -er '.revision')
```

`STATE` contains cookie values. Do not print it to shared logs.

### Set cookies with optimistic concurrency

```sh
jq -n --argjson revision "$REVISION" '{
  partition:"demo", operation:"set", url:"https://example.com/",
  expectedRevision:$revision,
  cookies:["demo=hello; Path=/; Secure; HttpOnly; SameSite=Lax"]
}' | curl --fail --silent --show-error \
  "$JA3_PROXY_URL/contexts/$CONTEXT_ID/cookies" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @-

python examples/request.py https://example.com/ \
  --partition demo --context "$CONTEXT_ID" --output page.html
```

Do not add a `Cookie` header in managed mode. Response ingestion can advance the
revision too; a conflict requires reading/reconciling current state, not blindly
replaying a stale mutation. To delete a cookie, set it with `Max-Age=0` and the
same scope; partitioned and ordinary cookie deletion are distinct operations.

### Export and import

```sh
umask 077
SNAPSHOT_FILE=$(mktemp)
curl --fail --silent --show-error \
  "$JA3_PROXY_URL/contexts/$CONTEXT_ID/cookies" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"partition":"demo","operation":"export"}' \
  --output "$SNAPSHOT_FILE"
```

The result contains `revision` and `snapshot`. The file is a credential: keep it
outside Git and shared logs, protect it at rest and delete it when no longer
needed. The service itself persists neither contexts nor snapshots.

For import, obtain the **target context's current revision** and set
`TARGET_REVISION` and `TARGET_CONTEXT_ID` accordingly:

```sh
jq -n --argjson revision "$TARGET_REVISION" \
  --slurpfile state "$SNAPSHOT_FILE" '{
    partition:"demo", operation:"import", expectedRevision:$revision,
    snapshot:$state[0].snapshot
  }' | curl --fail --silent --show-error \
  "$JA3_PROXY_URL/contexts/$TARGET_CONTEXT_ID/cookies" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @-
```

Imports replace the target jar atomically. The snapshot must match its
first-party partition key and pass all cookie/capacity rules. This includes
partitioned cookies; they cannot be transplanted to another site.

After successful import, remove the temporary credential file with
`rm -f "$SNAPSHOT_FILE"`.

## Identity changes

There is no in-place fingerprint or proxy mutation:

1. Stop new requests on the old context and let existing work settle or cancel it.
2. Export its managed cookie snapshot, if continuity is required.
3. Create a new context with the intended proxy/profile/UA and allowed origins.
4. Import the snapshot using the new context's current revision.
5. Switch application ownership to the new context and close the old one.

Preserve the same first-party boundary. A new proxy or TLS profile does not make
an incompatible site's snapshot importable. If creation/import fails, handle
that failure explicitly; do not silently discard login state.

## Cancellation and status

Use the request ID emitted by your client. The example prints its ID to stderr
before sending the request.

```sh
curl --fail --request DELETE "$JA3_PROXY_URL/requests/$REQUEST_ID" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' --data '{"partition":"demo"}'

curl --fail "$JA3_PROXY_URL/requests/$REQUEST_ID/status" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN" \
  -H 'Content-Type: application/json' --data '{"partition":"demo"}'
```

Dropping the response stream also cancels owned work. Cancellation acknowledgement
is not final delivery evidence: inspect the terminal outcome/status. Registry
retention is finite. If a write may already have been sent, reconcile with the
upstream system before retrying.

## Troubleshooting

| Symptom | Check |
|---|---|
| Service refuses to start | Set exactly one dedicated token source; validate positive limits and partition/registry relationships. |
| `/health` works but API returns 401 | Confirm the same service token reaches the caller and container. |
| `SSRF_BLOCKED` | Target/proxy DNS and allowed origins; do not disable protections as a generic fix. |
| `CONTEXT_NOT_FOUND` | Partition ownership, expiry, explicit close or service restart. |
| `CONTEXT_CONFLICT` | Stale cookie revision, conflicting UA/Cookie header or mismatched snapshot site. |
| `BUSY` | Global/per-partition queue or execution capacity. Apply caller-side backpressure. |
| Partial bytes followed by failure | Treat the stream as failed; inspect the terminal code and delivery state. |
| Upstream 3xx | Follow deliberately in the application, validating the next URL and header/cookie policy. |
| Upstream 4xx/5xx | The transport may have succeeded; inspect upstream status separately from transport outcome. |
