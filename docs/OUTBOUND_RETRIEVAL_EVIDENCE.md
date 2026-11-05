# Outbound retrieval evidence — REQ-PLATFORM-016 (#98)

Date: 2026-11-05 UTC. Reviewer: Codex. Work in progress on `build/platform-016`, based on draft #235. This is not leaf completion or production acceptance.

## Reading

Read the complete #98 template; its upstream decisions #21 and #27 were confirmed closed. Read the source-retrieval row of `.manicode/secure-coding.md`, SEC-1/3/4/5/6/8/9/10 and the architecture's integration contracts, boundary table and dependency rules. No new security event is owned by this leaf; later instrumentation remains blocked separately. The Node/OWASP baseline sources and relevant control-linked sources were reviewed during this build. For this implementation, inspected the selected-runtime [HTTP request/createConnection and header-limit documentation](https://nodejs.org/api/http.html#httprequestoptions-callback), [stream pipeline destruction behavior](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-callback) and [zlib memory/decompression behavior](https://nodejs.org/api/zlib.html#memory-usage-tuning). No dependency is added.

## Current implementation

The internal budget owner validates finite integer limits at or below SEC-5 ceilings. Redirects default to disabled, with at most three when explicitly configured. A logical retrieval retains wire/decoded counters, redirect count and a monotonic total deadline across caller-owned attempts. An additional 32-attempt admission ceiling limits empty/fast responses; it is not a retry schedule or permission to retry effects. First failure is stable and aborts the signal owned by downstream I/O. Read inactivity is separately started/reset only during response work. Timers and external cancellation listeners are released on close/failure. The caller must close the budget in its operation's finally block.

The stream reader counts raw response-body bytes before decoding and decoded bytes before retention. It supports identity or one native gzip/deflate stage; unsupported/stacked encodings and corrupt/truncated streams fail closed. Pipeline cancellation destroys its owned streams. Small input chunks are packed into 64 KiB slabs so metadata allocation is bounded; output construction has bounded copies, not an unbounded array of one buffer per attacker byte. No syntax parsing, response/header projection, durable storage or logging occurs here.

## Evidence and remaining work

Local Node 24.16.0/macOS: strict checked contracts and runtime guard pass; eight focused tests pass for limit validation, cumulative counts, attempt/redirect caps, actual short deadline timers, stream cancellation, wire/decoded expansion limits, malformed gzip, tiny chunks and second-response budget exhaustion. These are native stream tests, not end-to-end HTTP evidence.

Remaining: the HTTP owner must consume only #97-approved TLS sockets, keep strict HTTP parsing and response-header limits, count real chunked/compressed bodies, repeat destination/current-authority validation for each explicitly enabled redirect, retain the same budget for retries, return closed provider-wait facts without automatic sleeping/retrying, and destroy underlying requests on failure. Add controlled native TLS/HTTP tests for malformed framing, oversized headers, credential-free redirects, provider waits, stream failures, cancellation and no forbidden destinations. Check and record the selected Linux runtime results. Production owner integration, durable job counters, cumulative change review, human review and runtime audit remain outstanding. A process-local budget or mocked owner is not durable or production authorization evidence.
