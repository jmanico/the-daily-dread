# The Daily Dread threat model

Date: 2026-11-04

Mode: Grim Prompter `deep`, composed `web` primary plus bounded `api` secondary

Model: `daily-dread-spec-tm`, revision `05`
Status: **partial**

All six deep stages, `00-scope-and-evidence.md` through `05-report-and-handoff.md`, were performed in order for the composed web/API architecture. Partial status does not mean the workflow stopped: it records that the system is specification-only, implementation and runtime evidence do not exist, nine evidence/design gaps remain open, all verification is `not_run`, and no risk rubric was supplied. The 17 threats are design hypotheses, not confirmed vulnerabilities. This report makes no safety, compliance or production-readiness claim.

The latest cumulative snapshot is [07 change review](threat-model/2026-11-04-open-items/change-review.json), derived from revision `06-change-review`. Earlier snapshots remain historical evidence and are not rewritten.

## Scope and evidence

The model covers the private browser application and HTTP/JSON API; OIDC, server-side sessions and bearer admission; user/admin and personal-owner authorization; views and PDF/CSV/JSON exports; durable ingestion, inspection, assessment, correction, delivery and recovery; GitHub, source, AI and notification adapters; PostgreSQL; audit/security events; and the rendering of provider text, evidence, notes, identifiers and errors.

The following supplied specifications were read in full at project revision `06fc95695d6a30a4d88951bbf778a2a4ebe2306a`:

- `REQUIREMENTS.md` (`E-001` through `E-005`)
- `ARCHITECTURE.md` (`E-006`, `E-007`)
- `SECURITY.md` (`E-008` through `E-011`)
- `SECURITY_EVENTS.md` (`E-012`)
- `DESIGN.md` (`E-013`)
- The caller's explicit statement that nothing is implemented (`E-014`)

Public APIs and feeds, native/mobile clients, native passwords, inbound notification callbacks and public webhooks, user file uploads/previews, service workers and third-party browser code are absent release surfaces and were recorded as not applicable. They must be reassessed if introduced.

No code, concrete route/schema inventory, database schema, tests, deployment configuration, live provider data or runtime observations exist. No optional branded method or secure-coding technology pack ran. Working-tree status/diff was not used because configured clean/process filters made those protected commands unavailable under the runbook. No source conflict was found: required or proposed controls versus absent implementation are evidence-status differences, not conflicting facts.

## Architecture composition and boundary ownership

The web architecture owns TB-1 browser request/session admission, TB-2 OIDC/session behavior and TB-9 rendering/download behavior. The API contributes operation authority at TB-1, bearer admission at TB-2 and projection/export behavior at TB-9. The API owns TB-3 through TB-8 and TB-10. Shared threats and controls retain both architecture identities rather than being duplicated.

Authentication, issuer/audience recognition and a valid session are distinct from local company, object, function and property authority. Export creation, delayed execution and retrieval are distinct decision points. Provider acknowledgment is distinct from readership or business authority. Those distinctions drive the model below.

## Threat model

Every risk record `RK-001` through `RK-017` is unrated. Confidence in a scenario is not severity or likelihood.

### T-001 — unintended browser mutation

A cookie-authenticated mutation could occur without the user's intended request if a route omits effective session-bound request and origin checks. Evidence: `E-002`, `E-008`. Protective specification claims: `C-WEB-REQUEST`, `C-AUTHZ`; no route/runtime evidence. Gaps: `G-001`, `G-003`. Proposed response/test: `TR-001`, `V-001`.

### T-002 — stale session, role or displayed data

Logout, role removal, issuer/mapping change or privilege transition could leave stale authority or private browser state usable. Evidence: `E-002`, `E-008`, `E-010`, `E-013`. Protective claims: `C-AUTHN`, `C-AUTHZ`, `C-OUTPUT`; no transition or storage observations. Gaps: `G-001`, `G-006`. Proposed response/test: `TR-001`, `V-001`.

### T-003 — object, function or property authority drift

A valid user could alter an identifier, use an alternate route or supply/receive a property outside the permitted personal or admin operation. Evidence: `E-002`, `E-008`, `E-009`. Protective claims: `C-AUTHZ`, `C-VALIDATION`; the operation/property matrix is absent. Gaps: `G-001`, `G-002`. Proposed response/test: `TR-001`, `V-001`.

### T-004 — noncurrent export authority

An export selected while authorized could be generated or retrieved after role loss, archive, source-use restriction or report-scope change, or through an identifier no longer authorized to the caller. Evidence: `E-004`, `E-010`. Protective claims: `C-AUTHZ`, `C-OUTPUT`, `C-JOBS`; end-to-end lifecycle ownership is incomplete. Gaps: `G-001`, `G-004`. Proposed response/test: `TR-002`, `V-002`.

### T-005 — active interpretation of untrusted content

Publisher text, names, notes, evidence excerpts or model output could become active browser content in a user or admin view. Evidence: `E-005`, `E-009`, `E-010`, `E-013`. Protective claims: `C-UNTRUSTED-DATA`, `C-OUTPUT`; no renderer or content fixtures exist. Gap: `G-001`. Proposed response/test: `TR-003`, `V-003`.

### T-006 — private response or browser residual exposure

A private response could be reused for a signed-out client or remain visible in a browser profile after signout or role loss. Evidence: `E-010`, `E-013`. Protective claim: `C-OUTPUT`; no cache-header, reuse-path or browser-storage observation exists. Gaps: `G-001`, `G-006`. Proposed response/test: `TR-003`, `V-003`.

### T-007 — outbound destination or redirect escape

A configured URL or redirect could cause an adapter to connect outside its approved destination class. Evidence: `E-005`, `E-009`. Protective claim: `C-EGRESS`; no transport or reachability test exists. Gap: `G-001`. Proposed response/test: `TR-004`, `V-004`.

### T-008 — provider response acquires business authority

A source, AI or delivery response field could be used beyond its defined meaning to change finding, delivery, configuration or workflow state. Evidence: `E-005`, `E-009`, `E-010`, `E-012`. Counterevidence narrows the hypothesis: the specs already say provider acceptance is not readership and external data remains untrusted. Adapter-specific response and transition contracts are still absent. Gaps: `G-001`, `G-005`. Proposed response/test: `TR-005`, `V-005`.

### T-009 — delayed effect after authority or lease loss

A queued/running job could read, write, notify, call AI or commit after rights/resource state changed or its lease was superseded. Evidence: `E-003`, `E-008`, `E-010`. Protective claims: `C-AUTHZ`, `C-JOBS`; no effect-time implementation evidence exists. Gap: `G-001`. Proposed response/test: `TR-006`, `V-006`.

### T-010 — duplicate effect after unknown outcome

A timeout, crash or unknown provider outcome could be blindly retried, duplicating a notification, issue update, AI charge or other effect, or recording false state. Evidence: `E-003`, `E-005`, `E-010`, `E-012`. Protective claim: `C-JOBS`; effect identity and reconciliation are not implemented. Gaps: `G-001`, `G-005`. Proposed response/test: `TR-006`, `V-006`.

### T-011 — resource exhaustion

Large, deep, expanded or numerous HTTP/source/repository/export inputs could exhaust shared service, worker, database, disk or provider capacity. Evidence: `E-003`, `E-005`, `E-009`. Protective claims: `C-VALIDATION`, `C-EGRESS`, `C-UNTRUSTED-DATA`; no capacity or adversarial parser evidence exists. Gap: `G-001`. Proposed response/test: `TR-007`, `V-007`.

### T-012 — AI egress or cross-assessment reference disclosure

Private identifiers/snippets could cross the AI boundary, or returned evidence identifiers could resolve outside the authorized assessment. Evidence: `E-009`, `E-011`. Protective claims: `C-SECRETS-AI`, `C-UNTRUSTED-DATA`; final-byte and reference-resolution tests are absent and AI audit representation is blocked. Gaps: `G-001`, `G-007`. Proposed response/test: `TR-008`, `V-008`.

### T-013 — external output disclosure or misrouting

A notification, shared Slack message or public issue could reach an unauthorized destination or contain private/rights-restricted evidence. Evidence: `E-004`, `E-005`, `E-010`. Protective claims: `C-AUTHZ`, `C-OUTPUT`, `C-JOBS`; no channel projection or delivery evidence exists. Gaps: `G-001`, `G-005`. Proposed response/test: `TR-004`, `V-004`.

### T-014 — uninvestigable event or silent pipeline failure

A denied, failed, rolled-back or AI-egress action could lack durable/independent evidence, making silence indistinguishable from health. Evidence: `E-011`, `E-012`. Protective claim: `C-AUDIT`; OD-001/002/004/005 defer representation, destination, retention and durability; OD-003 now defines minimal personal attribution. Gaps: `G-001`, `G-007`. Proposed response/test: `TR-009`, `V-009`.

### T-015 — stale concurrent privileged change

Concurrent or retried admin edits could overwrite newer configuration, activate stale authority or separate a mutation from its matching audit/revision. Evidence: `E-002`, `E-008`, `E-009`, `E-011`. Protective claims: `C-AUTHZ`, `C-VALIDATION`, `C-JOBS`, `C-AUDIT`; operation-specific preconditions and commitment points are absent. Gaps: `G-001`, `G-002`. Proposed responses/tests: `TR-006`, `TR-011`, `V-006`, `V-011`.

### T-016 — unsupported definite or clean result

Malformed, ambiguous, contradictory or incomplete evidence could become a definite match or clean result. Evidence: `E-003`, `E-005`, `E-009`. Protective claim: `C-UNTRUSTED-DATA`; comparison/parser behavior is not implemented. Gap: `G-001`. Proposed response/test: `TR-010`, `V-010`.

### T-017 — unsafe authority after restore

A restore could reactivate obsolete sessions, queued effects or connector credentials before current rights, destinations and keys are revalidated. Evidence: `E-009`, `E-010`, `E-011`. Protective claims: `C-AUTHN`, `C-SECRETS-AI`, `C-JOBS`, `C-AUDIT`; no restore exercise exists. Gap: `G-001`. Proposed response/test: `TR-006`, `V-006`.

## Action register — treatments and verification

Treatments remain proposed implementation plans and all verification is `not_run`. The project lead tracks delivery; feature maintainers execute the associated checks before feature merge/release. Dates are gates, not fabricated calendar commitments.

| Treatment | Verification | Threats | Next evidence/action | Owner | Date |
| --- | --- | --- | --- | --- | --- |
| `TR-001` | `V-001` | `T-001`–`T-003` | Define the full route/use-case/object/function/property matrix, then compare allowed, cross-object, unintended-request and post-role-loss paths with synthetic accounts. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-002` | `V-002` | `T-004` | Allocate export job/result ownership, retention and invalidation, then observe generation/status/download across authority and resource-state changes. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-003` | `V-003` | `T-005`, `T-006` | Inventory rendered fields, interpreters, private response reuse and browser storage; test inert markers and signout/role-loss transitions. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-004` | `V-004` | `T-007`, `T-013` | Define destination/redirect/data policy per adapter; test only caller-controlled inert receivers and current recipient/source revocation. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-005` | `V-005` | `T-008` | Define closed adapter result schemas and state-transition owners; vary acknowledgment, unknown, malformed and business-looking fields against provider doubles. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-006` | `V-006` | `T-009`, `T-010`, `T-015`, `T-017` | Define effect/commit points, revisions, fences, effect identity, reconciliation and restore quarantine; exercise them with isolated sinks. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-007` | `V-007` | `T-011` | Record finite budgets and capacity criteria, then observe boundary and just-over-limit synthetic workloads in isolation. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-008` | `V-008` | `T-012` | Implement the approved AI projection, then capture final bytes and test same- versus cross-assessment returned references with a controlled double. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-009` | `V-009` | `T-014` | Resolve deferred OD-001/002/004/005; then trace synthetic success, denial, rollback, failure and silence through persistence, consumer and independent health paths. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-010` | `V-010` | `T-016` | Build provenance-preserving evidence fixtures for malformed, ambiguous, contradictory, incomplete and supported states and trace every output. | Project lead / feature maintainer | Before dependent feature merge/release |
| `TR-011` | `V-011` | `T-015` | Define exact revision-bound confirmation phrases, then test changed-target/stale-revision conflicts and keyboard/assistive-technology behavior. | Project lead / feature maintainer | Before dependent feature merge/release |

## Action register — open gaps

| Gap | Status | Next evidence/action | Owner | Date |
| --- | --- | --- | --- | --- |
| `G-001` | DEFERRED | Supply implementation, schemas, tests, deployment configuration and runtime observations tied to each enforcement point. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-002` | DEFERRED | Enumerate the API/use-case policy matrix, properties, commitment points and delayed-work authority handoff. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-003` | DEFERRED | Enumerate every browser route and map cookie-authenticated mutation, intended request, origin and server authorization checks. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-004` | DEFERRED | Implement the export ownership and temporary-output lifecycle now allocated in ARCHITECTURE.md; verify status/download authorization. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-005` | DEFERRED | Define per-adapter response schemas, semantic authority, transition owner and negative cases. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-006` | DEFERRED | Observe deployed private-response headers, browser storage and signout/role-change behavior. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-007` | DEFERRED | Resolve deferred OD-001/002/004/005 and independently verify event representation, durability, consumer and silence monitoring. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-008` | Resolved design decision; verification not run | Record the visible exact confirmation phrase for every high-impact action and bind it to the current target/revision. | Project lead / feature maintainer | Before dependent feature merge/release |
| `G-009` | Project-local guide location resolved; external-pack claims remain unverified | Read `.manicode/secure-coding.md` and its owning SEC sections. This is newly established project guidance, not discovery or verification of an external pack; record any further concrete prescription gap before dependent implementation. | Project lead / feature maintainer | Before dependent feature merge/release |

## Decisions

Decision authority: on 2026-11-04 the user delegated the remaining choices to the assistant's best advice, after explicitly approving queue order, Linux, browser React, one service, PostgreSQL persistence and 30-second recovery.

- **DEC-001 — DEFERRED:** quantitative/ordinal risk ratings until implementation and deployment evidence supports likelihood and business impact. Owner: project lead. Keep all 17 risks unrated; prioritize authorization, disclosure, audit and recovery verification by dependency rather than inventing numeric confidence. Blocks risk-rating claims only.
- **DEC-002 — Accepted:** preserve the full event-pipeline gate; OD-003 collection policy is resolved, while OD-001/002/004/005 remain explicitly deferred. No event becomes covered without V-009 evidence.
- **DEC-003 — Accepted:** adopt DESIGN.md's complete per-action, revision-bound confirmation phrase mapping (resolved DQ-8/G-008). V-011 still must verify enforcement and accessibility.

G-001–G-007 and G-009 are deferred evidence work with existing IDs, not accepted risks. Their table states the needed evidence; only the dependent features/claims are blocked. G-009 follows TOOL-004. All treatments retain their implementation/verification gates, and all historical proposed decisions in prior snapshots remain historical.

## Coverage and handoff integrity

Web coverage included intended state change, session/role transitions, object/function/property authority, untrusted rendering, private-response reuse, signout and asynchronous work. API coverage included individual/bulk/export authority, delayed execution and retrieval, replay/concurrency/unknown outcomes, destination and redirect policy, outbound payload minimization, provider-response authority, bounded work and restore. Uploads, inbound callbacks/status feeds, third-party browser code and optional identity-method work were not applicable or did not run as recorded above.

`05-report.json` retains the complete cumulative model: 17 open design hypotheses, 10 claimed but unimplemented controls, 14 evidence records, 9 open gaps, 11 proposed treatments, 11 `not_run` verifications, 17 unrated risks and 3 proposed decisions. Counts describe records, not severity or assurance. There are no conflict or identity-map records because no incompatible source facts or imported model identities were found.

The final JSON was parsed with duplicate-key and non-finite-number rejection, typed-ID uniqueness and live-reference checks. No formal schema validator was available. The report and cumulative attachments were reviewed for sensitive detail: no credentials, tokens, secrets or unnecessary personal/operational values were present; only specification identifiers, abstract architecture and sanitized provenance are retained.

## Historical specification foldback (revision 06)

After stage 05 closed the read-only modeling run, supported outcomes were folded into their owning specifications without changing any threat, control, risk, treatment or verification status:

- `REQUIREMENTS.md` now specifies current export authority, UI/API/worker policy parity, stale-revision conflicts, current job/effect authority, provider-response semantics and restore quarantine for `T-003`, `T-004`, `T-008`–`T-010`, `T-015` and `T-017`.
- `ARCHITECTURE.md` now assigns web/API composition ownership, defines the operation-authority context, allocates export lifecycle and typed adapter-result ownership, and updates the affected data flows and component diagram.
- `SECURITY.md` now requires an explicit operation authority record, property/revision binding, current export authorization, effect identity/reconciliation and code-owned provider-response transitions. Existing event-pipeline obligations remain blocked by OD-001 through OD-005; no new event destination, field, retention period or durability path was selected.
- `DESIGN.md` now defines non-authoritative provider/uncertain states, current-authority export UX, private-state clearing and stale confirmation behavior. DQ-8 remains open; this work did not guess its missing per-action text.
- `SECURITY_EVENTS.md` retains the closed event catalog while refining existing ledger rows for export stages, revision conflicts, job/effect authority, evidence uncertainty, provider-result rejection, audit silence and restore quarantine.

These are specification requirements and proposals only. They are not implementation or verification evidence; `G-001` and every `not_run` verification remain unchanged.

## Decision-pass delta — 2026-11-04

React introduces a browser library dependency at TB-1/TB-9/TB-10, not a server-rendering or Server Function surface. SEC-7/SEC-9/SEC-10 now cover JSX/prop/URL boundaries, minimal component state, production bundles, strict CSP and stale asynchronous responses. T-005/T-006/T-011 retain their existing identities and require React-boundary verification; no threat is resolved by adopting these rules. DQ-8/G-008 closes a design gap only. The older counts and foldback narrative above describe their dated snapshots, not current completion evidence.

## Backlog tooling handoff — 2026-11-04

AR-001/AR-002 now record the selected-tree review and development tool choices; TOOL-004 identifies a newly established project-local reading guide. These resolve selection/location work only. No T-* hypothesis is resolved, no V-* application check becomes run, and no external secure-coding pack is claimed verified. TOOL-003, AR-003, OD-001/002/004/005, authoritative unavailable signals and implementation/release evidence remain open under their existing owners and GitHub issues.
