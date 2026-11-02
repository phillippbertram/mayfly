# Cloudflare relay concept

Status: proposed architecture for an optional feature beyond the LAN MVP.

FileHop could share selected files over the internet through Cloudflare Workers
and Durable Objects. The recipient would open a normal HTTPS link in a browser.
The desktop would stream the original file through the relay without uploading
it to permanent storage. FileHop and the sender's computer must remain online.

## Architecture

```mermaid
flowchart LR
    B[Recipient browser] <-->|HTTPS| W[Cloudflare Worker]
    W <-->|DO binding| D[Session Durable Object]
    D <-->|WSS initiated by desktop| R[Rust relay client]
    R <--> S[Rust share service]
    S --> F[Original file]
```

| Component                          | Responsibility                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cloudflare Worker                  | Serve the download page, route requests and WebSocket upgrades to the correct session, and enforce request limits. |
| Durable Object per desktop session | Hold the desktop connection, correlate transfers, and bridge binary messages to HTTP response streams.             |
| Rust relay client                  | Establish the outbound authenticated connection and stream authorized files with bounded buffers.                  |
| Rust share service                 | Own file validation, tokens, expiration, revocation, atomic download reservations, and file access.                |

Durable Objects provide a stable coordination point for the desktop connection
and incoming browser requests. The relay client belongs in Rust, with thin Tauri
commands for the UI. It must use the same share service as LAN downloads.

The relay would be a separate service from the static product website. R2, D1,
KV, and Queues are unnecessary for this live-transfer model.

## Download flow

1. The user explicitly enables internet sharing. Rust creates a temporary relay
   session and opens an authenticated outbound WSS connection through the Worker
   to its Durable Object. No inbound router port forwarding is required.
2. FileHop creates a public share link containing a session routing ID and share
   token. The UI uses that public origin for the page, download link, and QR code.
3. A browser download reaches the Worker, which forwards it to the session object.
4. The object assigns a transfer ID and sends a download request to the desktop.
5. Rust checks authorization and reserves download capacity before opening the
   validated file. It returns safe response metadata followed by binary chunks.
6. The object produces a streaming HTTP response. Completion, cancellation, and
   errors propagate back to the desktop and release transfer resources according
   to the share service's counting policy.

Use separate page and download routes, such as `/s/{session}/{token}` and
`/d/{session}/{token}`. Session IDs identify a connection; they do not authorize
downloads. Page requests must also check share availability through Rust.

## Streaming and connection lifecycle

A small versioned protocol could use `OPEN`, `HEADERS`, `DATA`, `CREDIT`, `END`,
`ERROR`, and `CANCEL` messages. Every transfer carries its own ID. Headers must be
validated before starting the HTTP response; later failures abort the stream.

Credit-based flow control would limit how much data Rust can send ahead of the
HTTP consumer. Start evaluation with 256 KiB chunks, bounded transfer windows,
and a small concurrent-download limit. A slow recipient must slow file reading
instead of growing relay buffers. Apply timeouts to stalled transfers.

Use the WebSocket Hibernation API while the session is idle. Hibernation discards
object memory, so reconstruct connection routing from minimal non-secret socket
attachments and ask the desktop for current share information. Do not persist
share tokens in object storage or attachments. Active streams keep their transfer
state in memory; a reset interrupts them.

The client must reconnect after network or Cloudflare interruptions. A full
desktop restart creates a new session and invalidates previous share tokens.
HTTP range support, retries, and resuming interrupted downloads need an explicit
policy consistent with atomic download limits before implementation.

## Security and persistence

- Internet sharing is explicit and optional. Keep LAN sharing available as the
  default mode.
- Authenticate the desktop connection with a separate temporary session
  credential. A public download token must never grant control of the session.
  Never distribute Cloudflare account credentials inside the app.
- Accept only narrowly defined share-page and download operations. Do not proxy
  arbitrary URLs or expose Tauri IPC, the development server, or the local
  management API.
- Keep shares and access tokens in memory. Do not write file contents or share
  tokens to Durable Object storage, databases, caches, or logs. Apply
  `Cache-Control: no-store` and the existing download security headers.
- Configure provider logs and traces as well as application logs to exclude full
  share URLs, tokens, private filenames, and absolute paths.
- Preserve the [security model](../security.md), including file identity checks
  and authorization on every request. Define what revocation and expiration do
  to downloads already in progress.

HTTPS and WSS terminate at Cloudflare. Cloudflare is therefore inside the trust
boundary and can technically access plaintext file contents. Excluding the
provider would require additional end-to-end encryption and a browser decryption
and saving flow, which is a separate design decision.

## Platform constraints and operating costs

Workers has a 128 MB memory limit, making bounded streaming essential. Cloudflare
does not enforce an HTTP response-body size limit; WebSocket messages are limited
to 32 MiB each. These are distinct from HTTP request upload limits. They do not
establish a verified maximum file size or throughput for this relay.

Workers currently has no separate egress-bandwidth charge. Costs depend on
requests, CPU, incoming Durable Object WebSocket messages, and active object
duration. Hibernation reduces idle duration costs. Measure realistic transfer
volume and duration before choosing quotas or making cost commitments.

## Open decisions and first validation

The main open decisions are session admission and abuse controls, transfer and
concurrency quotas, retry and range semantics, and whether provider-readable
transfers satisfy the product's privacy requirements.

First validate one Rust sender, one session object, and one real browser download
on Cloudflare. Measure memory, throughput, and cost with a multi-gigabyte file
and a slow recipient. Exercise cancellation, reconnects, object resets, expired
and revoked tokens, and concurrent requests against a download limit. Compare
downloaded bytes with the original file.

The underlying share service is tracked in [issue #2](https://github.com/phillippbertram/filehop/issues/2).
Relay implementation requires a separate issue after the concept is scoped.
No relay, deployment, or end-to-end remote transfer is implemented or verified.

## References

Cloudflare documentation reviewed on 2026-11-02:

- [Durable Object WebSockets and hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [ReadableStream with Durable Objects](https://developers.cloudflare.com/durable-objects/examples/readable-stream/)
- [Workers streaming APIs](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers WebSocket limits and connection lifecycle](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

For external tunnel and private-network alternatives, see
[Sharing beyond your local network](../remote-sharing.md).
