# Dread Ledger change review — initial pass

Target baseline revision: `06fc95695d6a30a4d88951bbf778a2a4ebe2306a`

Target change snapshot: `SECURITY_EVENTS.md` SHA-256 `742c1d4e28b120dfebceae180a208cdce9db1371237511ad0d3294148569b315`

Library revision: `c8c7e3892de9eb9264d4ea8344d47b5aff2cc2a4`

Scope: specification-only change to SEC-041, SEC-050, SEC-086 and SEC-APP-005/006/008/012; existing event contract, changed requirements/controls and all checklist identities inspected

Gate scope: **PASS** — all baseline checklist IDs/duplicate counts are preserved and all changed mappings were reviewed

Gate local foundation: **NOT RUN** — no application, logger, collector, test or consumer exists

Gate waves: **NOT RUN** — no event implementation changed
Gate deployment: **NOT RUN** — OD-001 through OD-005 and deployment evidence remain unresolved

## Inventory

| Event | Status | Evidence | Owner | Next |
| --- | --- | --- | --- | --- |
| SEC-041 | missing (retained) | `SECURITY_EVENTS.md:128`; export stages now distinguish request/generation/status/download/denial and use existing envelope `operation_ref`/`job_ref` | Unassigned | Implement and verify actual producer, durable audit, consumer and current-authority paths in its assigned wave. |
| SEC-050 | missing (retained) | `SECURITY_EVENTS.md:137`; `previous_revision_ref` is already declared in the local extra-field dictionary | Unassigned | Close enum/trigger semantics and verify authorized revision-conflict context without protected-object enrichment. |
| SEC-086 | missing (retained) | `SECURITY_EVENTS.md:173`; OD-001/OD-004 remain explicit | Unassigned | Resolve independent monitor/destination and durability decisions before instrumentation. |
| SEC-APP-005 | missing (retained) | `SECURITY_EVENTS.md:182`; existing `operation_ref`/`job_ref` envelope correlation retained | Unassigned | Verify effect-time authority, logical identity, fencing and unknown outcomes at real worker/effect boundaries. |
| SEC-APP-006 | missing (retained) | `SECURITY_EVENTS.md:183`; no event/field change | Unassigned | Verify malformed/incomplete evidence produces coverage state and never a clean result. |
| SEC-APP-008 | missing; **mapping repair required** | `SECURITY_EVENTS.md:185`; response-transition rejection points to SEC-078/`dread.integration.policy_rejected`, whose existing meaning at line 165 is unapproved provider/model/connector activation or use | Unassigned | Map malformed/unknown response input to SEC-031/`dread.input.rejected` and invalid business transition to SEC-049/`dread.workflow.rejected`; do not overload SEC-078. |
| SEC-APP-012 | missing (retained) | `SECURITY_EVENTS.md:189`; existing restore-gate name/fields retained | Unassigned | Verify each quarantine/revalidation/reactivation stage and affected consumer when implementation exists. |

## Finding

### DL-CR-001 — provider-response rejection is mapped to an event with a different established meaning

`SECURITY_EVENTS.md:185` proposes `dread.integration.policy_rejected` for an unknown/malformed provider response or out-of-contract transition. Its existing contract at line 165 is limited to rejection of unapproved provider/model/connector activation or use. Reusing it would conflate provider selection policy with response-schema or workflow-transition rejection, potentially producing misleading consumer queries and checklist mappings for SEC-078.

Priority rationale: wave 1 mapping/documentation defect, not a runtime exposure because nothing is implemented. Repair before implementation so the closed catalog remains semantically stable. Bounded repair: keep `dread.delivery.result` for delivery facts; map malformed/unknown response fields to SEC-031 `dread.input.rejected`; map an invalid state transition to SEC-049 `dread.workflow.rejected`; specify that one enforcement decision emits its one applicable record rather than duplicates. Focused future verification must vary malformed/unknown fields and an invalid transition and assert the exact single event, controlled outcome and absence of raw provider content.

## Contracts and drift checks

No event name, schema version, field type/limit, severity, wave, audit obligation, disposition, destination, retention, logger filter, sampling rule, queue/failure policy or consumer was changed. SEC-041 and SEC-APP-005 use existing envelope fields; SEC-050 uses existing `previous_revision_ref`. All affected rows remain `missing`, and the complete SEC checklist identity multiset matches the baseline. No row was promoted or described as verified.

No new authentication, admin, data or restore path bypasses a shared event path at the specification level. The changes add subcase accounting for existing paths. Runtime bypass, framework auto-capture, removed events, weakened tests, collector/consumer behavior and deployment configuration are unavailable because the application does not exist.

## Checks

- Read `AGENTS.md`, the target event contract/ledger and changed product/security/architecture/design requirements.
- Read Dread Ledger `runbook.md`, shared instruction, change-review prompt, coverage, checklist, event-contract and verification references at the library revision above.
- Compared each changed row with baseline revision `06fc956...`.
- Compared the sorted SEC checklist identity multiset: no addition, removal or duplicate-count drift.
- Implementation, emitter, collector, storage, query, alert, privacy, load and deployment checks: **NOT RUN** because no implementation exists.

## Decisions and blockers

OD-001 through OD-005 remain the authoritative blockers for destination/consumer, retention, additional personal data, denied/failed/rolled-back durability and AI digest representation. This review selects none of those choices. No owner, approval or deployment readiness is inferred.

## Handoff

Repair DL-CR-001 in the ledger text, then rerun the read-only change review. Preserve all row statuses and the closed field/name contract. Wave 0 remains the first implementation prerequisite; this specification review does not establish local foundation or deployment readiness.
