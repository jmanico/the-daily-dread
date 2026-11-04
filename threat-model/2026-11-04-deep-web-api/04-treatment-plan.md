# Stage 04 — treatment and validation

Status: **partial**. The declared specification scope was treated, but every response remains proposed, every verification remains `not_run`, no implementation exists, OD-001 through OD-005 remain open, and no risk rubric or exact secure-coding pack was supplied. Partial status records those evidence and decision gaps; it is not a finding of vulnerability.

## Composed treatment boundary

The web architecture remains primary and owns browser/session admission at TB-1, OIDC/session behavior at TB-2, and rendering/download behavior at TB-9. The API architecture owns TB-3 through TB-8 and TB-10, while contributing operation authority to TB-1, bearer admission to TB-2, and projection/export behavior to TB-9. Shared threats and controls retain both architecture IDs. Public APIs, inbound callbacks, uploads, service workers, third-party browser code, native clients and native passwords remain not applicable to this release.

## Proposed outcomes

| Treatment | Threats | Proposed architectural outcome |
| --- | --- | --- |
| `TR-001` | `T-001`–`T-003` | One current operation-authority contract binds principal, company, intended request, function, object and properties across browser and API use cases. |
| `TR-002` | `T-004` | Export request, execution, status and retrieval share a server-owned identity and recheck current report/source authority; possessing a result ID is never authority. |
| `TR-003` | `T-005`, `T-006` | Untrusted content remains inert and private response/browser state becomes unusable after loss of authority. |
| `TR-004` | `T-007`, `T-013` | Each outbound use case owns a closed destination class and minimal projection, with redirect and recipient/source revalidation before transmission. |
| `TR-005` | `T-008` | Adapters return closed typed facts; only a code-owned use case may translate them into an allowed business transition. |
| `TR-006` | `T-009`, `T-010`, `T-015`, `T-017` | Durable work uses current effect-time authority, logical effect identity, fencing, preconditioned transitions, reconciliation and restore quarantine. |
| `TR-007` | `T-011` | Admission, parsing, queues, expansion and temporary output have finite budgets and visible bounded failure. |
| `TR-008` | `T-012` | The AI gate checks final serialized bytes and resolves returned evidence only within the authorized assessment. |
| `TR-009` | `T-014` | Required events have an approved durable path, consumer and independent silence signal without conflating emission, persistence, detection and delivery. |
| `TR-010` | `T-016` | Evidence validation preserves provenance and explicit malformed, ambiguous, contradictory, incomplete and unsupported states. |
| `TR-011` | `T-015` | High-impact confirmation is bound to the current target and revision; stale state requires fresh review and confirmation. |

Every treatment includes alternatives and tradeoffs in `04-treatment-plan.json`. They are architectural proposals, not implementation prescriptions or accepted risk.

## Verification plan

`V-001` through `V-011` define isolated, caller-authorized future checks for authority matrices, export revocation, rendering/cache isolation, controlled outbound receivers, provider-response semantics, delayed-work concurrency/recovery, capacity, AI final bytes, event durability/health, evidence integrity and stale confirmations. Each plan has separate pass, fail and inconclusive criteria. None was executed, and the plan authorizes no execution.

## Risk and decisions

Each open threat has its own unrated record, `RK-001` through `RK-017`. No risk value was calculated because no caller-approved rubric or sufficient runtime inputs exist. `DEC-001` proposes rubric criteria for later approval; `DEC-002` preserves OD-001 through OD-005 as prerequisites for event validation; `DEC-003` proposes revision-bound exact confirmation text. No owner, date, acceptance, rejection or deferral was invented.

## Handoff integrity

The cumulative envelope preserves all evidence, system records, threats, controls, gaps and earlier change history. Revision 04 names revision 03 as its parent; `ATT-PRIOR-CHANGES-03` preserves the parent's declarations. The JSON was parsed with duplicate-key and non-finite-value rejection; 274 typed IDs were unique, 1,198 live references resolved, all 17 open threats had treatment and unrated-risk coverage, and all 11 verifications were confirmed `not_run` with no result evidence. No formal schema validator was available.
