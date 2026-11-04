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
- MUST use `Buffer.alloc` for new buffers and vetted crypto APIs for secrets; fixed-length secret comparisons use `crypto.timingSafeEqual` with length validation.
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

## SEC-2 — Identity, sessions, and authorization

Implements FR-7 and TB-1/TB-2.

- OIDC MUST use the established identity adapter and authorization-code flow with PKCE S256, single-use state and nonce, exact registered callback URLs, and a five-minute login transaction lifetime. Return destinations MUST be local, allowlisted paths.
- Token validation MUST bind issuer, audience, approved algorithm, signature, expiry, and applicable time claims to the configured provider. Keys come only from that provider's validated configuration; token-supplied key URLs cannot select fetch destinations. ID tokens MUST NOT authenticate API requests. Unsupported opaque access tokens MUST be rejected unless the configured provider supports validated introspection.
- Accounts MUST be keyed by trusted `(iss, sub)`. Display claims and email domains cannot grant roles. UserInfo subject mismatches MUST fail validation.
- Browser sessions MUST use opaque, cryptographically random identifiers with at least 256 bits of entropy; PostgreSQL stores a digest and server-side session state. Use a host-only `__Host-` cookie with `Secure`, `HttpOnly`, `Path=/`, and `SameSite=Lax` for the supported top-level GET callback. Tokens and session identifiers MUST NOT enter browser persistent storage or URLs.
- Session limits MUST default to 30 minutes idle and eight hours absolute. Rotate the identifier after login or privilege changes. Logout invalidates server state and clears private browser views. Administrative changes may shorten these limits; increasing them requires a reviewed policy change.
- Provider-authoritative role validation MUST be refreshed within 15 minutes, including for long-lived API tokens. If freshness cannot be established, deny protected operations. Issuer/client/mapping changes MUST invalidate affected sessions and cached authorization.
- `DAILY-DREAD-ADMIN` inherits user access. All admitted users read active company repositories; personal preferences and alert history remain owner-scoped. Shared mutations, Slack routing, and archive access MUST require admin. Never accept a submitted owner ID as proof of ownership.
- Cookie-authenticated mutations MUST require a session-bound CSRF token plus validation of the request origin against the configured application origin. GET/HEAD MUST NOT change business state. SameSite is an additional defense. A bearer-only endpoint may omit CSRF tokens only if it rejects ambient cookie authentication.
- Bootstrap issuer/admin mappings MUST come from company-controlled deployment configuration. There MUST NOT be an unauthenticated setup endpoint or local-password bypass.

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

## SEC-4 — Outbound requests and SSRF

Implements NFR-2.3 and TB-2/TB-3/TB-4/TB-6/TB-7.

- Only integration adapters may make outbound connections. Each adapter MUST use a destination policy for its purpose; source approval does not authorize every URL mentioned in an article.
- Source retrieval MUST allow only approved HTTPS endpoints, paths, and ports. Reject URL credentials, unsupported schemes, and local, loopback, private, link-local, metadata-service, multicast, reserved, or otherwise unapproved destinations, including IPv6 and IPv4-mapped forms.
- Resolve and validate destination addresses at connection time. Bind the connection to validated addresses while preserving TLS hostname checks; a preflight DNS lookup followed by an unrestricted fetch is insufficient. Disable automatic redirects or validate every redirect through the same gate. Reused connections MUST retain the same destination policy.
- Cross-origin redirects MUST NOT carry credentials. Linked articles, embedded resources, XML references, Markdown links, and model-generated URLs MUST NOT trigger automatic fetching.
- GitHub, identity, AI, and messaging adapters MUST use their configured provider endpoints. A company SMTP host, including an explicitly configured private host, is a separate restricted transport permission; it cannot become an exception for general source retrieval.
- Every request MUST have cancellation, connect/read/total deadlines, redirect and response-byte limits, and decompression limits. TLS, DNS, or policy failures MUST be visible failures, never a reason to retry with weaker validation.

## SEC-5 — Repository inspection and resource budgets

Implements FR-3, FR-8, NFR-4.2, and TB-4/TB-5.

- Inspection MUST read authorized immutable GitHub commits through the repository adapter. It MUST NOT run repository code, package managers, install hooks, builds, tests, Git hooks, manifest expressions, or downloaded binaries. Worker threads provide scheduling, not a hostile-code sandbox.
- Repository data MUST NOT select local filesystem paths, executable names, dynamic imports, parser plugins, or parser schemas. Submodules require independent authorization; external references remain gaps unless separately permitted.
- XML readers MUST disable external entities, DTD processing, and network/file resolution. YAML readers MUST reject custom executable tags and bound alias expansion. JSON, HTML, TOML, Markdown, and ecosystem readers MUST have adversarial nesting, malformed-input, and allocation tests.
- Configuration MUST specify finite budgets for input bytes, expanded bytes, nesting, entries, files, total job work, parser time, and export size. Each rejection MUST record the applied limit without retaining unsafe payloads. No parser or endpoint may ship with an unlimited default.
- CPU-heavy parsing and PDF work MUST use bounded workers with termination deadlines. An asynchronous wrapper around synchronous parsing does not bound execution time. Network cancellation alone does not interrupt parsing.
- Repository concurrency MUST default to one installation-wide; nested fetches, worker pools, database pools, and notification queues also require finite limits. Rate limits MUST cover login attempts, API reads/mutations, exports, and connector use without allowing one caller to exhaust shared capacity.
- Temporary files MUST use service-generated names in restricted directories outside code and web roots, reject traversal/symlink escape, and be removed after success, failure, cancellation, or restart recovery. Raw private processing copies cannot become retained history.

## SEC-6 — Secrets, retention, and external AI

Implements FR-11.5, FR-12, NFR-2.1, and TB-5/TB-6/TB-10.

- Bootstrap secrets and wrapping keys MUST be company-provisioned mounts readable only by the service identity. Credentials MUST NOT be embedded in source, fixtures, images, build arguments, or business records. Configuration APIs return credential presence/status, never stored values.
- Connector secrets stored in PostgreSQL MUST use authenticated encryption through vetted crypto APIs, with a versioned key identifier, unique nonce per key, and record/purpose binding as authenticated data. Wrapping keys remain outside PostgreSQL. Authentication-tag failures MUST deny use.
- Secret rotation MUST support re-encryption, provider credential replacement, revocation, and recovery testing. Backups require encryption and separate protection of recovery keys. Company IT owns backup scheduling and restore operations.
- Sensitive-data detection MUST run locally before raw input becomes durable evidence or leaves the service. Combine field classification, known credential formats, and content checks; uncertain fragments MUST be withheld. Store redacted locations and safe reasons, not secret values. Preserve required original source text only subject to these protections and its reuse rights.
- AI egress MUST serialize an allowlisted factual projection, apply de-identification, and validate the final payload. Company/repository identities, personal data, internal addresses, private package names/versions, credentials, complete trees, and raw private files MUST be excluded. Placeholder mappings stay local. A model cannot decide whether a payload is safe to send.
- AI remains disabled until configured, with one approved provider active. Unsafe input or provider failure MUST fall back to local assessment with explicit limitations; it cannot activate another provider or relax the disclosure gate.
- Source and repository text MUST be treated as evidence even when it contains instructions. Model output MUST pass schema and local evidence-reference checks and safe rendering. It cannot invoke tools, select recipients, approve sources, grant permissions, execute fixes, or turn an uncertain match into a definite one.
- Verification MUST seed synthetic secrets and private identifiers into fixtures and inspect captured outbound requests, retained evidence, logs, and exports. Tests must prove those values are absent, including on error paths.

## SEC-7 — Rendering, exports, and external disclosure

Implements FR-9, FR-10.10, NFR-2.4, and TB-7/TB-9.

- Publisher content, identity claims, filenames, evidence, and model output MUST render as text. Browser code MUST use text nodes or context-safe construction; untrusted strings cannot enter `innerHTML` or executable DOM attributes.
- Notes MUST follow FR-9.5's restricted Markdown representation in preview, web, PDF, and plain-text channels. Disable raw HTML, images, embeds, and unsupported elements. Links allow only validated HTTP/HTTPS destinations with visible hosts; rendering cannot retrieve those destinations.
- The web application MUST deliver a CSP limited to bundled same-origin assets, without `unsafe-eval` or `unsafe-inline`; include `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`. Set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and HSTS on the HTTPS origin. Private data responses and exports require `Cache-Control: no-store`. Fonts remain local under NFR-3.1.
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
- Admin mutations requiring audit MUST fail if their durable audit record cannot be committed. Outbound intent MUST be durable before a send; failure to record a result leaves an explicit uncertain outcome.

## SEC-9 — Build and deployment

Implements NFR-4/NFR-5 and TB-10.

- Follow the [dependency review and implementation handoff](docs/DEPENDENCY_REVIEW.md) for each addition or upgrade. Inspect the actual resolved tree, publisher identity, package contents, licenses, and applicable advisories; the earlier documentation-only audit does not validate a future release.
- CI MUST check manifest/lockfile consistency, direct/transitive advisories, secret leakage, security linting, and relevant negative tests. Review lockfile source/integrity changes. Known applicable vulnerable versions cannot pass release gates; automatic forced dependency fixes cannot bypass compatibility review.
- Build jobs processing untrusted pull requests MUST NOT receive production secrets or privileged publishing credentials. Pin third-party CI actions to reviewed immutable revisions and grant job tokens only necessary permissions.
- Release images MUST contain only required runtime code/assets and production dependencies. Inspect build context and artifacts for secrets and private fixtures. Keep the application package private unless publication is deliberately introduced and reviewed.
- Run as a non-root identity with a read-only application filesystem, bounded writable temporary storage, dropped capabilities, and memory/CPU/process limits. Do not mount the Docker socket or expose PostgreSQL publicly. Network policy MUST restrict egress independently of application URL validation.
- Startup MUST validate required security configuration and reject missing keys, invalid origins, unlimited budgets, or unsafe transport settings. Production permission profiles and runtime flags require compatibility tests on the actual selected version; no hardening flag substitutes for application controls.
- Restore procedures MUST revalidate credentials and permissions before resuming persisted work. Business-history retention cannot preserve obsolete session authority or revoked credentials.

## SEC-10 — Required verification and review evidence

Before an affected feature merges, its review MUST identify relevant rule IDs and include tests that cross the real enforcement boundary. Before release, run the integrated suite against the actual container, runtime, database, and ingress configuration. These checks are required work, not tests already present in this repository.

| Area | Minimum negative cases |
| --- | --- |
| Identity and access | Wrong issuer/audience/algorithm; ID token as bearer; reused state; nonce mismatch; stale roles; logout replay; user invoking admin operations; another user's personal record; cookie mutation without CSRF evidence |
| Network boundary | Redirect to metadata/private IP; IPv6 and mapped addresses; DNS rebinding; credential-bearing redirect; malformed HTTP framing; spoofed forwarding headers; oversized/chunked/decompressed responses |
| Input and execution | Unknown fields; duplicate parameters; SQL injection; prototype keys; traversal/symlinks; XML entities; YAML aliases; deep nesting; hostile regex inputs; parser timeout; proof that repository hooks/manifests never execute |
| Disclosure and presentation | Stored/DOM XSS; unsafe note links; CSV formulas; PDF remote references; private public-issue content; seeded secrets in all outputs/error logs; prompt injection and fabricated model evidence |
| Work and recovery | Role/access revocation during queued work; archive during execution; expired worker lease; crash between commit and dispatch; uncertain provider acceptance; restart without duplicate side effects |
| Deployment and load | Non-root/read-only operation; egress restrictions; key rotation/restore; unavailable audit storage; bounded overload at the documented 1,000-repository/100-user validation target |

Review evidence MUST record configuration, tested versions, results, unresolved gaps, and ownership. Changes to limits or security policy require the same evidence as code changes. A waived recommendation needs rationale, compensating controls, an owner, and a review date; mandatory product protections require an explicit specification change rather than an undocumented exception.
