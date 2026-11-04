# Security and Secure Coding Rules

The Daily Dread handles private repository evidence, company context, identity claims, and integration credentials. These rules apply to application code, background jobs, browser code, tests, build tooling, and deployment configuration.

**Status:** this repository contains specifications and a static design preview, not an implemented application. The controls and verification below are implementation requirements, not claims of protection, completed testing, or supported releases.

`MUST` and `MUST NOT` are merge and release requirements. `SHOULD` requires a documented reason when not followed. [REQUIREMENTS.md](REQUIREMENTS.md) owns product behavior; [ARCHITECTURE.md](ARCHITECTURE.md) owns components and trust boundaries; this document owns secure implementation controls. Conflicts must be resolved explicitly in those documents before implementation. A code comment cannot waive a requirement. Proposed technology versions remain subject to the [dependency review](docs/DEPENDENCY_REVIEW.md) and release validation.

## Basis and applicability

The following baseline distills the two requested references, read on November 4, 2026. The subsequent sections define project-specific controls against the existing requirements and architecture. Examples or package names in external guides do not authorize adding dependencies or replacing Fastify.

### Node.js baseline

- MUST use supported, patched runtime releases; disable production inspection, including activation through `SIGUSR1`, and exclude experimental runtime features from production security controls.
- MUST keep HTTP parsing strict (`insecureHTTPParser` disabled), reject ambiguous framing across proxy/service boundaries, and configure finite header, request, idle, and keep-alive timeouts plus connection limits.
- MUST pin dependencies and retain a generated lockfile; reproducible installs use `npm ci --ignore-scripts`. Any required lifecycle script needs explicit review and isolated execution.
- MUST protect module directories from runtime writes, avoid input-controlled module resolution, and prohibit application monkey-patching of built-in prototypes.
- MUST prevent prototype pollution: avoid untrusted recursive merges, allowlist fields, use `Map` or null-prototype dictionaries, and use `Object.hasOwn` for ownership checks.
- MUST initialize new buffer storage with `Buffer.alloc`; `Buffer.from` is permitted for existing data. Application use of `Buffer.allocUnsafe` and `Buffer.allocUnsafeSlow` is prohibited. Use vetted crypto APIs; fixed-length secret comparisons require `crypto.timingSafeEqual` with length validation.
- SHOULD evaluate the Node permission model against the selected runtime. It supplements operating-system isolation; it does not authorize hostile code execution. Evaluate `--disable-proto=throw` through compatibility tests.

Source: [Node.js Security Best Practices](https://nodejs.org/learn/getting-started/security-best-practices).

### Web application baseline

- MUST validate external input, reject ambiguous parameters, and return only intended response fields.
- MUST bound parsing, request size, and CPU work; unsafe regular expressions and synchronous I/O must not stall request handling. Monitor event-loop delay and shed excess work.
- MUST apply output-context escaping, access checks, CSRF protection, secure session cookies, and browser security headers.
- MUST NOT evaluate input with `eval`, `Function`, shell commands, or `node:vm`; a VM context is not a security sandbox.
- MUST handle rejected promises and stream, socket, and EventEmitter errors. Fatal uncaught exceptions require safe termination, not continued service in an unknown state.
- MUST keep errors and activity logs useful without disclosing sensitive data. Maintain dependencies and run security linting.

Source: [OWASP NodeJS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html).

## SEC-1 — Trust boundaries and policy ownership

Applies to architecture boundaries TB-1 through TB-10 and dependency rules DR-1 through DR-10.

- Every protected use case MUST receive validated actor/company context or a recorded service/job context. Request bodies, queue payloads, model responses, and database identifiers cannot establish authority.
- Shared domain policies MUST enforce the same rules for UI, API, exports, and jobs. Route hooks alone are insufficient when a worker can invoke the operation directly.
- New routes, adapters, parsers, output channels, and configuration fields MUST identify their trust boundary, permitted data, authorization rule, resource limits, and negative tests in review.
- Admin-authored configuration, company notes, provider responses, and repository files MUST remain untrusted data. Source mappings cannot contain executable expressions, module paths, or templates that execute code.
- Missing evidence, denied access, parser failures, and skipped files MUST produce explicit coverage gaps. They cannot produce a clean assessment or overwrite a prior successful result with apparent safety.

### How we write security-sensitive code

These are project choices, not claims that one coding style prevents every vulnerability. Prefer a small, explicit implementation whose authority and failure paths a reviewer can trace.

- **One operation, one explicit flow.** Entry points MUST follow: bounded transport handling → authentication/coarse authorization → validated command → scoped resource lookup/authorization → domain operation → authorized projection. Authenticate before body parsing where the framework permits. Resource-dependent decisions MUST use a company/owner-scoped lookup or mutation, not an initial unscoped fetch. No protected mutation, disclosure, or external side effect may start before authorization succeeds; never start them concurrently with authorization. Denied/not-found responses MUST NOT reveal inaccessible resource existence.
- **Keep policy out of glue code.** Pure domain policies MUST take explicit arguments and return data or typed outcomes without environment, network, database, or HTTP-request access. Application use cases may orchestrate narrow injected owner/adapter interfaces. Only the composition boundary constructs privileged adapters; handlers and parsers do not receive the whole application container or a generic secrets lookup.
- **Use explicit JavaScript.** For consistency, new application modules SHOULD use ESM, `node:` imports for built-ins, `const` by default, strict equality, and named exports. Public boundaries MUST have checked type contracts: use checked JSDoc for JavaScript; if TypeScript is adopted through the architecture/dependency process, require strict checking. Untrusted values start as unknown data; a type assertion or annotation cannot replace runtime validation. New checking tools still require NFR-5 review.
- **Make invalid states visible.** Model allowed, denied, unavailable, and incomplete outcomes distinctly. Check authorization by an explicit allowed result, never by truthiness. `undefined`, an exception, or an unavailable policy service MUST NOT mean permission granted, an empty successful result, or no risk. Numeric identifiers/counters MUST preserve exactness; do not silently round database integers into JavaScript numbers.
- **Construct records field by field.** Request objects, database rows, and provider objects MUST NOT be spread or assigned wholesale into commands, configuration, updates, logs, or responses. Keep raw input, validated commands, domain records, and public projections distinct. Explicitly reject unsupported fields; apply business defaults only after successful validation. Shared request-independent configuration must not be mutated by a request.
- **Own every asynchronous task.** Promises representing work, I/O, cleanup, or security decisions MUST be awaited, returned, or handed to an explicit owner. Background business work belongs to the durable job owner; best-effort telemetry may use a bounded supervised sink with handled failures. No detached security decisions, `async` callbacks in `forEach`, empty catches, or unlimited `Promise.all` over external input. Cleanup belongs in `finally`; stream consumers must propagate errors, cancellation, and backpressure. Catch only failures the current layer can translate safely.
- **Centralize dangerous capabilities.** SQL is confined to persistence adapters; outbound HTTP to integration transports; cryptographic operations to reviewed modules for credentials, sessions, CSRF, hashing, or integrity; filesystem writes to the temporary-file owner; DOM construction to renderers. Runtime application code MUST NOT use shell execution, runtime code generation, or dynamically selected module paths. Fixed, reviewed build/deployment commands are permitted; untrusted data cannot construct shell command text. Reviewed framework compilation of code-owned schemas is the narrow exception to runtime code generation.

| Reject in review | Required pattern |
| --- | --- |
| `if (canEdit(actor, record))` where `canEdit` returns a promise | Await a typed authorization decision before invoking the mutation |
| `Object.assign(settings, request.body)` or `{ ...request.body }` as a command | Select approved fields from validated input and supply server-owned identity separately |
| `catch { return [] }` around evidence retrieval | Return an explicit unavailable/incomplete outcome with safe provenance |
| `Promise.race([work(), timeout])` as the only timeout control | Cancel the underlying I/O or terminate bounded worker work; fence late results |
| Returning a database row because a serializer should hide secrets | Construct the permitted response fields, then enforce a response schema |
| Removing an individual security check to make a test pass | Fix the policy or implementation and retain a regression test for the original attack |

## SEC-2 — Identity, sessions, and authorization

Implements FR-7 and TB-1/TB-2.

- OIDC MUST use the established identity adapter and authorization-code flow with PKCE S256, single-use state and nonce, exact registered callback URLs, and a five-minute login transaction lifetime. Return destinations MUST be local, allowlisted paths.
- Token validation MUST bind issuer, audience, approved algorithm, signature, expiry, and applicable time claims to the configured provider. Keys come only from that provider's validated configuration; token-supplied key URLs cannot select fetch destinations. ID tokens MUST NOT authenticate API requests. Unsupported opaque access tokens MUST be rejected unless the configured provider supports validated introspection.
- Accounts MUST be keyed by trusted `(iss, sub)`. Display claims and email domains cannot grant roles. UserInfo subject mismatches MUST fail validation.
- Browser sessions MUST use opaque, cryptographically random identifiers with at least 256 bits of entropy; PostgreSQL stores a digest and server-side session state. Use a host-only `__Host-` cookie with `Secure`, `HttpOnly`, `Path=/`, and `SameSite=Lax` for the supported top-level GET callback. Tokens and session identifiers MUST NOT enter browser persistent storage or URLs.
- Session limits MUST default to 30 minutes idle and eight hours absolute. Background status polling, token refresh, and automated retries MUST NOT extend idle time; use an explicit activity policy for user-initiated operations. Rotate the identifier after login or privilege changes. Logout invalidates server state and clears private browser views. Administrative changes may shorten these limits; increasing them requires a reviewed policy change.
- Provider-authoritative role validation MUST be refreshed within 15 minutes, including for long-lived API tokens. If freshness cannot be established, deny protected operations. Issuer/client/mapping changes MUST invalidate affected sessions and cached authorization.
- `DAILY-DREAD-ADMIN` inherits user access. All admitted users read active company repositories; personal preferences and alert history remain owner-scoped. Shared mutations, Slack routing, and archive access MUST require admin. Never accept a submitted owner ID as proof of ownership.
- Cookie-authenticated mutations MUST require a session-bound CSRF token plus validation of the request origin against the configured application origin. GET/HEAD MUST NOT change business state. SameSite is an additional defense. A bearer-only endpoint may omit CSRF tokens only if it rejects ambient cookie authentication.
- Bootstrap issuer/admin mappings MUST come from company-controlled deployment configuration. There MUST NOT be an unauthenticated setup endpoint or local-password bypass.
- Requests containing both session and bearer credentials MUST be rejected; no precedence guessing. Bind OIDC transactions to the initiating browser and consume them atomically. The provider callback is the explicit exception to the no-state-change-on-GET rule: it may complete only that validated login transaction, not business mutations. After processing, redirect to a clean local URL; ingress/application logs MUST omit callback query strings and codes.
- OIDC/client/mapping changes and credential replacement MUST initiate a new authorization-code transaction for that operation. Bind it server-side to the session, actor, operation type, target/configuration revision, state, nonce, and single-use expiry. Require verified `auth_time` within five minutes, request `max_age=300`, and use `prompt=login` where supported. Reject providers that cannot supply the required evidence during acceptance testing. Successful reauthentication authorizes only the pending operation. Validate replacement configuration before activation; atomically change its revision, audit it, and invalidate affected authorization. Failure cannot activate a permissive fallback.

Fresh authentication MUST use the established identity adapter; token issuance or refresh time is insufficient. Reauthentication does not establish MFA unless a separately approved provider-specific `acr`/`amr` policy is verified. See [OIDC authentication request and validation rules](https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest). Session validation MUST atomically check digest, expiry, revocation, authorization/configuration revision, and any activity update. Rotation invalidates the old identifier. Provider acceptance MUST demonstrate authoritative role freshness for sessions and bearer tokens through appropriately short-lived tokens, introspection, or authenticated lookup; cached role claims cannot extend the 15-minute limit.

## SEC-3 — HTTP, validation, and database access

Implements FR-6, NFR-2, and TB-1/TB-8.

- Fastify request and response schemas MUST be application-owned and reviewed. Imported source schemas and user configuration MUST NOT be compiled as executable validators. Requests MUST reject unknown writable fields, duplicate singleton parameters, invalid types, and values outside declared bounds rather than silently coercing security-relevant fields.
- Every route MUST declare its authentication policy, accepted media types, body limit, pagination bound, and response projection. Validate before domain operations; enforce byte limits while streaming, regardless of `Content-Length`. Unsupported encodings and content types MUST fail closed.
- SQL values MUST use `pg` parameters. Dynamic identifiers, sort columns, and directions require code-owned allowlists. Never interpolate request values or raw filter expressions into SQL.
- Database access MUST carry company/owner scope. Foreign keys, uniqueness constraints, and transactions MUST enforce ownership and idempotency invariants. Use a restricted application database role; schema migration privileges belong to a separate deployment identity.
- Browser access MUST remain same-origin by default. CORS cannot grant authorization. Any cross-origin configuration needs explicit allowed origins and tests; credentialed wildcard policies are prohibited.
- TLS MUST protect external traffic and database connections crossing a host trust boundary. Certificate verification cannot be disabled. Trust forwarded headers only from configured ingress peers; construct redirects and absolute links from validated application configuration, not arbitrary Host headers.
- The company ingress and Fastify service MUST agree on request framing and limits. Direct service ports cannot bypass ingress restrictions. Tests MUST cover conflicting length/transfer headers and malformed framing.
- Production routes MUST exclude development tooling, raw diagnostics, and unnecessary endpoints. Health checks expose only minimal status; detailed operational views require authorization. No inbound provider webhook is required by this release.

### Required Fastify validation profile

Fastify's baseline validator can coerce values, supply defaults, and remove extra properties. The project MUST override those behaviors so that validation observes the submitted command. Use `ajv.customOptions` with `coerceTypes: false`, `useDefaults: false`, `removeAdditional: false`, and `allErrors: false`. Set the separate Fastify server options `onProtoPoisoning` and `onConstructorPoisoning` to `error`. These choices require integration tests on the pinned release. See [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) and [server options](https://fastify.dev/docs/latest/Reference/Server/).

Body and query command schemas MUST close each object with `additionalProperties: false` and bound every string/array. HTTP header schemas MUST allow unrelated standard headers while validating the specific headers used by the application. Query/path schemas initially validate strings or arrays of strings; explicitly convert afterward with lexical, cardinality, range, and exactness checks. The query parser MUST preserve repeated occurrences for singleton rejection. JSON command routes MUST replace the default content-type parser with a bounded duplicate-aware parser that rejects repeated member names at every nesting level before returning objects. The replacement parser MUST retain the prototype/constructor poisoning protections; server flags alone do not prove a custom parser applies them. Media-type acceptance and route schema content maps MUST agree. Do not write a regex-based JSON parser; apply NFR-5 before selecting any additional parser. Tests MUST exercise the registered parsers, since schemas cannot recover discarded duplicate keys.

Code-owned example of a closed command schema; the route must separately supply authentication, CSRF, ownership, and response handling:

```js
export const updateWatchlistCommand = {
  type: 'object',
  additionalProperties: false,
  required: ['vendorId', 'enabled'],
  properties: {
    vendorId: { type: 'string', minLength: 1, maxLength: 128 },
    enabled: { type: 'boolean' },
  },
};
```

`"false"` MUST fail this boolean contract; it is not the boolean `false`. Owner, company, and role fields are intentionally absent and MUST come from validated server-side context. Route tests must verify rejection rather than silent removal of those fields.

### Transaction discipline

Transactions MUST use one checked-out `pg` client for `BEGIN`, all statements, and `COMMIT`/`ROLLBACK`; `pool.query` cannot implement a multi-statement transaction. Release the client in `finally`, discarding a broken connection if rollback fails. See [node-postgres transactions](https://node-postgres.com/features/transactions).

Authorization-sensitive writes MUST combine scope and mutation in one SQL statement or lock/version-check the relevant state in the same transaction. Checking a row in one request and updating it later without checking scope/version is prohibited. External calls MUST occur outside database transactions. Set transaction-local statement and lock deadlines, and make retries preserve the original operation identity. Never change session-wide database settings and return that connection to the pool with another caller's context.

Each database invariant MUST name its enforcement mechanism. Use `READ COMMITTED` only where a scoped statement, constraint, or explicit locks cover the invariant and conflicting writers. Decisions depending on a stable predicate, absent row, or multi-row snapshot MUST use `SERIALIZABLE` unless review establishes equivalent constraint/locking protection. `REPEATABLE READ` alone does not prevent write skew. See [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

SQLSTATE `40001` requires retrying the complete transaction and its authorization/business decisions; `40P01` is retryable for an idempotent operation. Other constraint errors require an explicit, constraint-specific concurrency policy. Preserve the operation key, start a fresh transaction, and perform no external effects during retries. Apply the existing requirement-defined retry count/schedule and operation deadline; do not add nested retry loops. An interactive deadline expiring returns a safe failure or authorized durable-job reference, never partial success. See [PostgreSQL serialization failure handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html).

## SEC-4 — Outbound requests and SSRF

Implements NFR-2.3 and TB-2/TB-3/TB-4/TB-6/TB-7.

- Only integration adapters may make outbound connections. Each adapter MUST use a destination policy for its purpose; source approval does not authorize every URL mentioned in an article.
- Source retrieval MUST allow only approved HTTPS endpoints, paths, and ports. Reject URL credentials, unsupported schemes, and local, loopback, private, link-local, metadata-service, multicast, reserved, or otherwise unapproved destinations, including IPv6 and IPv4-mapped forms.
- Resolve and validate destination addresses at connection time. Bind the connection to validated addresses while preserving TLS hostname checks; a preflight DNS lookup followed by an unrestricted fetch is insufficient. Disable automatic redirects or validate every redirect through the same gate. Reused connections MUST retain the same destination policy.
- Redirects MUST be disabled by default. An adapter may enable bounded redirects only when every hop repeats destination validation and consumes the same byte/time budget. Forward credentials only to the same approved origin when that adapter explicitly permits it. Linked articles, embedded resources, XML references, Markdown links, and model-generated URLs MUST NOT trigger automatic fetching.
- GitHub, identity, AI, and messaging adapters MUST use their configured provider endpoints. A company SMTP host, including an explicitly configured private host, is a separate restricted transport permission; it cannot become an exception for general source retrieval.
- Every request MUST have cancellation, connect/read/total deadlines, redirect and response-byte limits, and decompression limits. TLS, DNS, or policy failures MUST be visible failures, never a reason to retry with weaker validation.
- Parse each initial or redirected URL once for that hop with the WHATWG URL parser. Authorize its scheme, hostname, effective port, and path; hostname prefix/suffix matching is insufficient. A transport-controlled resolver MUST reject disallowed returned addresses and connect only to a selected permitted address, retaining the authorized hostname for TLS SNI/certificate verification. Verify the connected remote address before accepting application data. SSRF tests MUST observe actual socket destinations.
- Dynamic source URLs MUST use a transport that controls address resolution and connection establishment; an unrestricted native `fetch(url)` after a separate DNS check is prohibited. Hardcoded provider operations still use the shared transport policy. Provider activation MUST approve discovery, JWKS, API, and messaging origins, not arbitrary administrator-supplied URLs. Pools MUST be partitioned by adapter policy/configuration revision and discarded on incompatible changes. Disable proxy environment variables, custom agents, Unix sockets, and alternate transports unless explicitly included in that adapter policy.

## SEC-5 — Repository inspection and resource budgets

Implements FR-3, FR-8, NFR-4.2, and TB-4/TB-5.

- Inspection MUST read authorized immutable GitHub commits through the repository adapter. It MUST NOT run repository code, package managers, install hooks, builds, tests, Git hooks, manifest expressions, or downloaded binaries. Worker threads provide scheduling, not a hostile-code sandbox.
- Repository data MUST NOT select local filesystem paths, executable names, dynamic imports, parser plugins, or parser schemas. Submodules require independent authorization; external references remain gaps unless separately permitted.
- XML readers MUST disable external entities, DTD processing, and network/file resolution. YAML readers MUST reject custom executable tags and bound alias expansion. JSON, HTML, TOML, Markdown, and ecosystem readers MUST have adversarial nesting, malformed-input, and allocation tests.
- Configuration MUST specify finite budgets for input bytes, expanded bytes, nesting, entries, files, total job work, parser time, and export size. Each rejection MUST record the applied limit without retaining unsafe payloads. No parser or endpoint may ship with an unlimited default.
- CPU-heavy parsing and PDF work MUST use bounded workers with termination deadlines. An asynchronous wrapper around synchronous parsing does not bound execution time. Network cancellation alone does not interrupt parsing.
- Repository concurrency MUST default to one installation-wide; nested fetches, worker pools, database pools, and notification queues also require finite limits. Rate limits MUST cover login attempts, API reads/mutations, exports, and connector use without allowing one caller to exhaust shared capacity.
- Temporary files MUST use service-generated names in restricted directories outside code and web roots, reject traversal/symlink escape, and be removed after success, failure, cancellation, or restart recovery. Raw private processing copies cannot become retained history.

### Starting limits and enforcement

These are conservative project defaults to validate during implementation, not measured capacity promises. Smaller route-specific limits are encouraged. Raising a limit requires an admin-only, audited setting within a reviewed hard ceiling; changing that ceiling requires code review and adverse-load evidence. Startup MUST reject zero, negative, non-finite, or missing effective limits after applying code-owned defaults; an omitted override is permitted.

Until separately tested ceilings are recorded, the listed defaults are also the hard ceilings. Count and time units MUST be explicit in configuration, diagnostics, and gap records.

| Boundary | Initial default | Enforce at |
| --- | --- | --- |
| HTTP command body | 64 KiB; request compression disabled | Ingress and streaming body reader, before JSON parsing |
| HTTP headers / receive deadline | 16 KiB headers, 100 fields; `headersTimeout` 10 seconds, `requestTimeout` 30 seconds | Ingress and Node HTTP server; reject excess headers, do not silently truncate |
| HTTP idle / connection budget | 30 seconds socket idle, 5 seconds keep-alive; 100 requests per socket, 200 concurrent accepted sockets | Ingress and Node HTTP server; receiving deadlines do not bound handler execution |
| Interactive operation / export | 10 seconds / 60 seconds | Application deadline, downstream calls, and worker termination; longer work returns a durable job reference |
| Pagination | 50 default, 100 maximum items | Validated query and SQL limit |
| Outbound retrieval | 5 seconds connect, 10 seconds read inactivity, 30 seconds total; 3 redirects | Transport, including retries within the operation budget |
| Retrieved page / repository file | 5 MiB wire and 10 MiB decoded per page; 2 MiB decoded per repository file | Streaming counters before parsing; paginate larger feeds |
| One parser task | Depth 64, 100,000 nodes/entries, 2 seconds wall time, 64 MiB JS old-generation limit | Parser counters and bounded worker; reject formats whose expansion cannot be bounded |
| Parser/PDF worker pool | 2 workers; 100 pending tasks | Installation-wide queue admission; release evidence also records container memory and observed peak RSS |
| One repository job | 100,000 tree entries, 256 MiB decoded inspection input, 15 minutes active work | Durable job counters across retries; provider backoff excluded from active-work time |
| One export | 25 MiB produced bytes | Output writer and temporary-storage quota; larger limits require bounded memory/disk acceptance evidence |

Byte limits measure octets, not JavaScript string length; text limits measure UTF-8 bytes unless explicitly labeled otherwise. Count raw response-body bytes before decompression and decoded bytes after each decoding stage. Transparently decompressed response streams alone cannot prove a wire-byte bound. Redirect/retry chains share cumulative byte/time budgets. Counting after `response.text()` or `JSON.parse()` is too late. Job counters survive retries; pagination cannot reset the overall budget. Exclusions remain visible coverage gaps.

Worker `resourceLimits` do not bound every allocation, including `ArrayBuffer` storage, and do not prevent process-wide out-of-memory failure. Retain byte counters, bounded concurrency, and container memory limits. Send workers only the data needed for their task, never credentials or the service environment. See [Node worker resource limits](https://nodejs.org/api/worker_threads.html#new-workerfilename-options). The Node permission model also provides no malicious-code isolation guarantee; see [its documented security boundary](https://nodejs.org/api/permissions.html).

Cancellation MUST revoke the task's ability to commit results. Check the current attempt/fencing token before persistence; a late worker response cannot turn a timed-out or canceled attempt into success. A fresh retry receives a new attempt token while retaining the original logical job identity and cumulative budgets.

## SEC-6 — Secrets, retention, and external AI

Implements FR-11.5, FR-12, NFR-2.1, and TB-5/TB-6/TB-10.

- Bootstrap secrets and wrapping keys MUST be company-provisioned mounts readable only by the service identity. Credentials MUST NOT be embedded in source, fixtures, images, build arguments, or business records. Configuration APIs return credential presence/status, never stored values.
- Connector secrets stored in PostgreSQL MUST use authenticated encryption through vetted crypto APIs, with a versioned key identifier, unique nonce per key, and record/purpose binding as authenticated data. Wrapping keys remain outside PostgreSQL. Authentication-tag failures MUST deny use.
- The initial credential envelope MUST use AES-256-GCM under a durable, versioned 32-byte encryption key obtained from the restricted secret adapter and kept outside PostgreSQL. Ordinary startup MUST NOT generate a replacement key. Use a fresh 12-byte nonce from `randomBytes` and fixed 16-byte tag. Commit a non-secret `(key_id, nonce)` reservation under a database uniqueness constraint before encryption; retain reservations while that key can encrypt, even when a later credential transaction fails, and retry collisions with fresh randomness. After restore or cloning an installation, provision a new write key before creating ciphertext; retained recovery keys are decrypt-only. If wrapped per-record keys are later adopted, the versioned envelope must include the wrapped key and wrapping-key ID.
- Decryption MUST fix `authTagLength: 16`, set versioned, unambiguous associated data binding company, record, purpose, envelope version, and key ID, and call `final()` before releasing plaintext. Do not accept caller-selected algorithms or tags. Test tampering, cross-record substitution, concurrency, and recovery against the actual envelope implementation. Keep plaintext short-lived and out of error context; avoid immutable strings when practical, without claiming guaranteed JavaScript memory erasure. See [Node authenticated encryption APIs](https://nodejs.org/api/crypto.html#class-decipheriv).
- Secret rotation MUST support re-encryption, provider credential replacement, revocation, and recovery testing. Backups require encryption and separate protection of recovery keys. Company IT owns backup scheduling and restore operations.
- Database volumes and retained evidence MUST be encrypted at rest under company-managed storage controls; encrypting connector fields alone does not protect repository history. Restore starts quarantined: invalidate sessions/login transactions, pause jobs, and disable connectors. Admins MUST revalidate destinations, access, and configuration revisions, and replace or explicitly reauthorize credentials before enabling effects. Restored ciphertext alone cannot activate a connector.
- Sensitive-data detection MUST run locally before raw input becomes durable evidence or leaves the service. Combine field classification, known credential formats, and content checks; uncertain fragments MUST be withheld. Store redacted locations and safe reasons, not secret values. Preserve required original source text only subject to these protections and its reuse rights.
- AI egress MUST serialize an allowlisted factual projection, apply de-identification, and validate the final payload. Company/repository identities, personal data, internal addresses, private package names/versions, credentials, complete trees, and raw private files MUST be excluded. Placeholder mappings stay local. A model cannot decide whether a payload is safe to send.
- AI remains disabled until configured, with one approved provider active. Unsafe input or provider failure MUST fall back to local assessment with explicit limitations; it cannot activate another provider or relax the disclosure gate.
- Source and repository text MUST be treated as evidence even when it contains instructions. Model output MUST pass schema and local evidence-reference checks and safe rendering. It cannot invoke tools, select recipients, approve sources, grant permissions, execute fixes, or turn an uncertain match into a definite one.
- Verification MUST seed synthetic secrets and private identifiers into fixtures and inspect captured outbound requests, retained evidence, logs, and exports. Tests must prove those values are absent, including on error paths.
- The model receives no tools, network credentials, provider-selection authority, or delivery capability. Treat returned evidence IDs as untrusted: resolve them only within the authorized assessment's supplied evidence set. Reject cross-assessment, invented, or stale references. Label model recommendations as advisory even when their JSON shape is valid.
- AI provider activation MUST record approved API origins, model, account/project context, and verified retention/training/logging terms and settings that meet company and source-use policy. Unknown or incompatible handling blocks activation. Use local opaque evidence handles, not database IDs, in outbound projections. Audit a digest of the approved outbound bytes and safe provider metadata; do not log prompts or raw responses. Model text MUST pass the same sensitive-data classification before persistence or delivery. Captured-request tests inspect final serialized bytes on initial attempts, retries, and error paths.

## SEC-7 — Rendering, exports, and external disclosure

Implements FR-9, FR-10.10, NFR-2.4, and TB-7/TB-9.

- Publisher content, identity claims, filenames, evidence, and model output MUST render as text. Browser code MUST use text nodes or context-safe construction; untrusted strings cannot enter `innerHTML` or executable DOM attributes.
- Notes MUST follow FR-9.5's restricted Markdown representation in preview, web, PDF, and plain-text channels. Disable raw HTML, images, embeds, and unsupported elements. Links allow only validated HTTP/HTTPS destinations with visible hosts; rendering cannot retrieve those destinations.
- The web application MUST deliver a CSP limited to bundled same-origin assets, without `unsafe-eval` or `unsafe-inline`; include `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`. Set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and HSTS on the HTTPS origin. Private data responses and exports require `Cache-Control: no-store`. Fonts remain local under NFR-3.1.
- CSP MUST begin with `default-src 'none'` and explicitly permit only needed asset types; use `form-action 'self'` and `connect-src 'self'`. OIDC navigation uses the server's validated redirect flow, not a general third-party script allowance. Deploy HSTS only after HTTPS is working; `includeSubDomains` and preload require control of every affected host. Browser storage/service workers MUST NOT cache private responses or credentials.
- Exports MUST use the same authorized, redacted projection as the UI and recheck current archive/source-use permissions. Downloads cannot be exposed as unauthenticated static files. Filenames and content-disposition headers MUST reject control characters and use safe encoding.
- CSV writers MUST quote/escape fields and neutralize formula-leading characters such as `=`, `+`, `-`, and `@`, including control/whitespace prefixes. Quoting alone is insufficient. Test malicious values in supported spreadsheet readers; preserve unmodified evidence only in appropriately safe structured/text outputs.
- PDF generation MUST use bundled fonts and approved local assets, without active scripts, attachments, or remote resource loads. JSON responses MUST use the intended content type and explicit field projections.
- Delivery MUST recheck recipient access, destination validation, source rights, preferences, and admin-managed Slack rules immediately before sending. Messages contain minimal information and authenticated report links. Public GitHub issues MUST use only verified public evidence; uncertain visibility blocks the write.

## SEC-8 — Durable jobs, errors, and audit

Implements NFR-1.3, NFR-2.2, and architecture DR-5/DR-9.

- Jobs MUST revalidate current repository state, installation access, source rights, and delivery authority. Enqueue-time authorization does not survive revocation. Stale worker leases MUST be fenced before committing results or performing side effects.
- Business changes and work intent MUST commit atomically. Unique job/delivery keys prevent duplicate intent; uncertain external send outcomes require reconciliation, not blind retries. Apply the requirements' bounded retry schedule without generating new scan events.
- Async failures MUST reach a centralized safe error boundary. Expected parser/provider failures become typed failures or coverage gaps. Fatal process failures MUST record a minimal safe diagnostic, stop serving, terminate nonzero within a bounded interval, and recover durable work through the supervisor.
- Audit records MUST include actor/service, action, time, target identifier, outcome, and a safe reason for sensitive actions listed in NFR-2.2. Audit writes cannot include authorization headers, cookies, credential values, raw request bodies, raw repository files, or complete provider errors.
- Log fields MUST use structured encoding, length limits, and redaction before serialization. Restrict access to logs, metrics, crash dumps, and support bundles. HTTP responses expose a safe error code and correlation ID, never stack traces or database/provider internals.
- HTTP logging MUST select method, route template after routing, status, duration, and a server-generated request ID (`requestIdHeader: false`). Exclude raw URLs/query strings, headers, bodies, SQL text/parameters, provider payloads, and arbitrary nested causes. Internal faults retain bounded class/code and approved stack information after recursive redaction; expected authentication/validation failures use safe categorical codes. Validated client trace identifiers may occupy a separately labeled field, never audit identity or authorization evidence. Synthetic-secret tests MUST capture ingress logs too. Metric labels use bounded categories, not user input or repository names.
- Audit storage MUST deny application UPDATE/DELETE privileges over committed audit entries. Record configuration revisions and job/operation IDs for correlation. This protects against ordinary application mistakes; it is not a claim of resistance to a database administrator. Audit failure cannot silently turn an administrative mutation into an unaudited success.
- An administrative mutation, its configuration revision, required audit event, and follow-up work intent MUST commit atomically. Audit failure rolls back the mutation; recording the failure after committing the mutation is insufficient. Outbound intent MUST be durable before a send; failure to record a result leaves an explicit uncertain outcome.

## SEC-9 — Build and deployment

Implements NFR-4/NFR-5 and TB-10.

- Follow the [dependency review and implementation handoff](docs/DEPENDENCY_REVIEW.md) for each addition or upgrade. Inspect the actual resolved tree, publisher identity, package contents, licenses, and applicable advisories; the earlier documentation-only audit does not validate a future release.
- CI MUST check manifest/lockfile consistency, direct/transitive advisories, secret leakage, security linting, and relevant negative tests. Review lockfile source/integrity changes. Known applicable vulnerable versions cannot pass release gates; automatic forced dependency fixes cannot bypass compatibility review.
- Once code exists, CI MUST run checked typing, lint checks for unhandled work promises/prohibited runtime primitives, and import/dependency-boundary checks for direct SQL, outbound network, key access, filesystem writes, and HTML sinks outside approved modules. These guardrails cannot prove capability confinement, authorization, or safe data flow; integration/negative tests remain mandatory. Suppressions require a narrow call site, rationale, and review; file-wide silencing is prohibited.
- Build jobs processing untrusted pull requests MUST NOT receive production secrets or privileged publishing credentials. Pin third-party CI actions to reviewed immutable revisions and grant job tokens only necessary permissions.
- Release images MUST contain only required runtime code/assets and production dependencies. Inspect build context and artifacts for secrets and private fixtures. Keep the application package private unless publication is deliberately introduced and reviewed.
- Run as a non-root identity with a read-only application filesystem, bounded writable temporary storage, dropped capabilities, and memory/CPU/process limits. Do not mount the Docker socket or expose PostgreSQL publicly. Network policy MUST restrict egress independently of application URL validation.
- Startup MUST validate required security configuration and reject missing keys, invalid origins, unlimited budgets, or unsafe transport settings. Production permission profiles and runtime flags require compatibility tests on the actual selected version; no hardening flag substitutes for application controls.
- Restore procedures MUST revalidate credentials and permissions before resuming persisted work. Business-history retention cannot preserve obsolete session authority or revoked credentials.

## SEC-10 — Required verification and review evidence

Before an affected feature merges, its review MUST identify relevant rule IDs and include tests that cross the real enforcement boundary. Before release, run the integrated suite against the actual container, runtime, database, and ingress configuration. These checks are required work, not tests already present in this repository.

| Area | Minimum negative cases |
| --- | --- |
| Identity and access | Wrong issuer/audience/algorithm; ID token as bearer; reused state; nonce mismatch; stale roles; logout replay; mixed credentials; polling past idle expiry; forged fresh-auth evidence; user invoking admin operations; another user's personal record; cookie mutation without CSRF evidence |
| Network boundary | Redirect to metadata/private IP; IPv6 and mapped addresses; DNS rebinding; credential-bearing redirect; malformed HTTP framing; spoofed forwarding headers; oversized/chunked/decompressed responses |
| Input and execution | Unknown fields rejected rather than stripped; string booleans; duplicate JSON/query keys; SQL injection; prototype keys; traversal/symlinks; XML entities; YAML aliases; deep nesting; hostile regex inputs; parser timeout; proof that repository hooks/manifests never execute |
| Disclosure and presentation | Stored/DOM XSS; unsafe note links; CSV formulas; PDF remote references; private public-issue content; seeded secrets in all outputs/error logs; prompt injection and fabricated model evidence |
| Work and recovery | Role/access revocation during queued work; archive versus send; expired worker lease; crash between commit and dispatch; uncertain provider acceptance; restart without duplicate side effects; transaction rollback, write skew, concurrent idempotent creation, and connection reuse; configuration changes during mutation; exhausted budgets across retries; late completion after cancellation |
| Deployment and load | Non-root/read-only operation; egress restrictions; key rotation/restore; ciphertext/tag/associated-data tampering; nonce reuse rejection; unavailable audit storage; bounded overload at the documented 1,000-repository/100-user validation target |

Tests MUST use the production application factory and shared policy adapters. Exercise allow and deny outcomes, run concurrent/restart cases against PostgreSQL, and use a controlled network endpoint for transport tests. Mocks cannot be the only evidence for database isolation, SSRF, or request parsing. Cryptography requires known-answer and tampering tests against the real envelope code plus database concurrency/restore tests; mocking the external secret provider is permitted. Prefer a regression test that fails when the relevant guard is removed; test the invariant rather than duplicating the implementation's decision logic. Never use live credentials, real private repositories, or production recipients in fixtures.

### Release evidence

The release owner MUST record a named owner, exact tested commit/configuration/versions, result, and retained artifact for every gate below. All listed gates are blocking when their feature is present. A missing implementation may be marked not applicable only with a scope explanation; a required release feature cannot pass that way. These are future implementation gates, not a requirement to build the application to merge this policy.

| Gate | Accountable role | Required evidence |
| --- | --- | --- |
| Authentication and authorization | Identity/use-case maintainer | Provider acceptance record; real-session, role freshness, owner/admin, and scoped-query test results |
| Network and parsing | Transport/parser maintainer | Socket-level SSRF results; actual registered-parser tests; configured budgets and overload/cancellation reports |
| Persistence and recovery | Persistence maintainer | Migration checksums; concurrency/retry tests; audit atomicity, key/nonce, restore-quarantine, and tampering results |
| Disclosure and presentation | Output/AI maintainer | Captured-byte AI egress assertions; synthetic-secret log/output checks; public-issue, browser, and export tests |
| Supply chain and runtime | Release maintainer | Lockfile hash, resolved inventory/advisory review, image digest, runtime flags, ingress configuration, and CI results |
| Capacity and deployment | Release maintainer with company operator | Tested hardware/configuration, worker/process limits, peak RSS, throughput/backlog, and restore instructions |

Failing a listed security invariant blocks release. Dependency scans, lint results, or schema validation cannot substitute for another gate's evidence. Advisory recommendations must be labeled separately from blocking failures; an exception cannot be hidden as a passing check.

Review evidence MUST record configuration, tested versions, results, unresolved gaps, and ownership. Changes to limits or security policy require the same evidence as code changes. A waived recommendation needs rationale, compensating controls, an owner, and a review date; mandatory product protections require an explicit specification change rather than an undocumented exception.
