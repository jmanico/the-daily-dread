# SYSTEM_UNDER_REVIEW

Bundle: The Daily Dread specifications, revision 06fc95695d6a30a4d88951bbf778a2a4ebe2306a; working tree not_checked because configured Git clean/process filters made protected working-tree status unavailable under the Grim Prompter runbook.

Run: deep composed web/API review. Project root is the local The Daily Dread checkout; library root is the local Grim Prompter checkout at revision 7ae967c61499cc6ea6d6dde1cce7d3adf1d9ccd5. Selected prompts are deep/web/00-scope-and-evidence.md through 05-report-and-handoff.md and deep/api/00-scope-and-evidence.md through 05-report-and-handoff.md. The composition guide is reference/composition-guide.md. Primary architecture: web. Bounded secondary architecture: api.

Purpose: establish a specification-only threat-model baseline for later change reviews, then support evidence-backed specification updates after this read-only run finishes.

Scope: the browser application, private HTTP/JSON API, OIDC session and bearer-token paths, server-side authorization and validation, report/export paths, durable asynchronous work reached through web/API operations, external-provider adapters, PostgreSQL persistence, rendered output, and security-event/audit obligations described by the five caller-supplied specifications. Browser/session/rendering boundaries are owned by the web architecture; JSON operation/resource/property authority, bulk export, delayed-work authority and provider-response consumption are owned by the API architecture. TB-1 is shared: web owns browser request intent and session transitions, while api owns operation/resource authorization after admission. Each other boundary keeps the single owner stated in the specifications, with both contributors retained where a scenario crosses surfaces.

Out of scope: implementation or code-level claims; runtime behavior; deployment validation; live providers; production configuration; dependency/vendor trees; project files other than the five named evidence documents; public APIs; third-party API credentials; public feeds; native mobile clients; native password/recovery flows; inbound notification-provider callbacks or public webhooks; user file uploads and upload preview/download flows; service workers and third-party browser code; optional method executions; risk scoring without a caller-supplied rubric. These absent release surfaces are not applicable to this model and must be reassessed if introduced.

## Evidence

E1 — documentation claim
Locator: REQUIREMENTS.md:7-17. The product is a private company cybersecurity feed and repository-exposure system. Its release surfaces are a web application and private API for authorized users; public feeds, third-party API integrations, native mobile applications and native password authentication are excluded.

E2 — documentation claim
Locator: REQUIREMENTS.md:115-138. The UI and private API cover the same company-scoped workflows. Authentication is OIDC, API access accepts system-issued bearer access tokens rather than ID tokens, role mappings grant user/admin authority, and all admitted users may read company repository analysis while personal settings remain owner-scoped.

E3 — documentation claim
Locator: REQUIREMENTS.md:40-64. Repository registration and issue configuration are admin operations. News/advisory revisions fan out durable repository checks, with bounded concurrency, retained event identity, revocation handling and visible queued/running/failure states.

E4 — documentation claim
Locator: REQUIREMENTS.md:85-98. Findings and exports preserve evidence, provenance, status, confidence and gaps. PDF, CSV and JSON exports are authorized product behaviors; failures cannot replace a prior finding with a clean result.

E5 — documentation claim
Locator: REQUIREMENTS.md:140-189. Admin-configured source retrieval, notification delivery, GitHub issue writing and external destinations cross provider boundaries. No inbound notification callback or public webhook is required for the release.

E6 — documentation claim
Locator: REQUIREMENTS.md:191-208. Business history has no automatic expiration, while credentials, access tokens, transient raw copies and detected secrets are not permanent business records. External AI is optional and must receive reduced, policy-approved input.

E7 — documentation claim
Locator: ARCHITECTURE.md:5-13. This is a specification, not an implemented application. One Node.js/Fastify service and one PostgreSQL database are confirmed core choices; the native browser client and resource-oriented HTTP/JSON API remain proposed and share Fastify routing, schemas, authentication hooks and error translation.

E8 — documentation claim
Locator: ARCHITECTURE.md:48-75. Logical components separate HTTP presentation/API, identity, ingestion, repository inspection, findings/reports, output, delivery, durable work and audit/health ownership within one service. Component status does not claim implementation or test coverage.

E9 — documentation claim
Locator: ARCHITECTURE.md:77-120. The specifications define seven main flows and TB-1 through TB-10. TB-1 admits browser/private API requests; TB-2 covers OIDC; TB-3/TB-4/TB-6/TB-7 cover providers; TB-5 covers transient-to-retained analysis; TB-8 covers PostgreSQL; TB-9 covers rendered/downloaded/published output; TB-10 covers restricted configuration, secrets and operational output.

E10 — proposal
Locator: ARCHITECTURE.md:87-103. PostgreSQL queue rows, claims, leases, recovery wake-ups, local GitHub inspection, parsing boundaries, polling, and provider connector details are proposed design selections rather than implementation observations.

E11 — documentation claim
Locator: SECURITY.md:29-49. Every protected use case requires trusted actor/company or service/job context. Request, queue, provider and database data cannot establish authority. Authorization must precede mutation, disclosure or side effects, and dangerous capabilities are centralized.

E12 — documentation claim
Locator: SECURITY.md:60-76. Browser login uses OIDC authorization code with PKCE, state and nonce; browser sessions are server-side and opaque; cookie mutations require CSRF and origin validation; role freshness is bounded; mixed session/bearer credentials are rejected; sensitive configuration changes require fresh, operation-bound authentication.

E13 — documentation claim
Locator: SECURITY.md:78-135. HTTP routes require explicit authentication, bounds, validation and projections; SQL is scoped and parameterized; private data is same-origin; transport framing and TLS are controlled; outbound adapters enforce destination policy, redirect validation and finite budgets.

E14 — documentation claim
Locator: SECURITY.md:136-195. Repository/provider inputs remain untrusted and cannot execute. Parsing and work have finite limits. Credentials use a restricted adapter and authenticated encryption. AI egress is allowlisted, redacted, evidence-scoped and tool-less.

E15 — documentation claim
Locator: SECURITY.md:197-235. Untrusted content renders inertly; notes use a restricted shared representation; private responses/exports are no-store; downloads remain authenticated; CSV/PDF have context-specific controls; delayed jobs revalidate authority and use fenced durable intent; observability is redacted; deployment is constrained.

E16 — documentation claim
Locator: SECURITY.md:237-310. Negative and release verification is required but not yet run. Security-event destinations, non-audit retention, additional personal-data collection, durability for denied/failed events, and the AI egress audit digest representation remain open in OD-001 through OD-005.

E17 — documentation claim
Locator: SECURITY_EVENTS.md:1-18. The event ledger assesses specified boundaries, not runtime coverage. Local foundation, waves and deployment have not run. No application, collectors, provider feeds or runtime tests establish coverage. The external-AI audit digest obligation is unresolved.

E18 — documentation claim
Locator: SECURITY_EVENTS.md:20-74. Security events have a closed, bounded envelope; trusted identity and correlation fields are constrained; outcomes distinguish attempted, committed, denied, failed, rolled back and unknown; producer acceptance, persistence and delivery are distinct.

E19 — documentation claim
Locator: SECURITY_EVENTS.md:76-194. Ledger rows are missing, unavailable-signal or not-applicable rather than covered. Runtime verification is NOT RUN. Reserved names do not establish detectors or authorize collection.

E20 — documentation claim
Locator: DESIGN.md:223-309. The design treats unknowns and coverage gaps explicitly, requires pre-paint theme application, locally served fonts, non-clipping identifiers, and independent printer-safe PDF rendering.

E21 — documentation claim
Locator: DESIGN.md:319-352. Security-relevant interactions show identity/role, session loss, confirmation tiers, safe error language, deliberate external links, visible bidi/invisible controls and redaction locations. DQ-8 leaves some typed confirmation targets unresolved.

E22 — caller claim
Locator: session request. Nothing is implemented yet. Missing implementation/runtime evidence must remain a gap rather than becoming a code-level finding.

## Gaps

G1 — Unknown: no implementation, route inventory, registered schemas, database schema/policies, code, tests, runtime configuration, deployment evidence or observations were supplied. Needed: later implementation and verification evidence tied to the specified enforcement points. This gap limits control status and defect confirmation; it does not establish a vulnerability.

G2 — Unknown: the private API's concrete operation inventory, resource/property authorization matrix and per-operation asynchronous authority handoff are not enumerated. Needed: an API contract and use-case policy matrix showing callers, roles, resource ownership, writable/readable properties, commitment points and revocation behavior.

G3 — Unknown: the exact browser route/state-change inventory and mapping from each cookie-authenticated mutation to CSRF/origin enforcement is not enumerated. Needed: route inventory and request-authority matrix.

G4 — Unknown: export creation, retained-result authorization, expiry/deletion and post-revocation retrieval behavior are not fully allocated across components. Needed: end-to-end export lifecycle and ownership contract for UI, API, worker, storage and download.

G5 — Unknown: external-provider response fields and the component permitted to translate each response into business state are not enumerated. Needed: adapter response schemas, authority mapping and negative cases, separate from provider acknowledgments.

G6 — Unknown: implementation-specific cache configuration and browser storage behavior are unavailable. The specification requires no-store and prohibits service-worker/browser caching, but effectiveness is unverified. Needed: deployed header/storage tests.

G7 — Unknown: security-event destinations/consumers, non-audit retention, additional personal-data policy, durable denied/failed-event path and AI digest representation are blocked by OD-001 through OD-005. Needed: recorded decisions and verification evidence; no destination or detector is inferred.

G8 — Unknown: DQ-8 lacks exact typed confirmation targets for some high-impact actions. Needed: design-owner mapping for each covered action before implementation.

G9 — Unknown: no exact resolved technology secure-coding pack was supplied for this run. Needed: resolver provenance for the selected stack if technology-specific prescriptions beyond the five supplied specifications are desired. Architectural analysis can continue without it.

## Inspection log

Read in full: REQUIREMENTS.md, ARCHITECTURE.md, SECURITY.md, SECURITY_EVENTS.md and DESIGN.md at project revision 06fc95695d6a30a4d88951bbf778a2a4ebe2306a; Grim Prompter runbook.md, reference/composition-guide.md, and the selected web/API stage-00 prompts at library revision 7ae967c61499cc6ea6d6dde1cce7d3adf1d9ccd5. The remaining selected stage prompts will be read completely immediately before their stages. Project working-tree status/diff/blame were not used because protected Git configuration inspection found clean/process filters. No project scripts, code, tests, dependencies, generated runs, live systems, network sources, provider data, credentials or secret stores were inspected. The five named specifications were inspected for sensitive details; none requiring redaction were found.

Redactions: none found after inspection.
