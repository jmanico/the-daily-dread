# Dread Ledger change review — final pass

Target baseline revision: `06fc95695d6a30a4d88951bbf778a2a4ebe2306a`

Target change snapshot: `SECURITY_EVENTS.md` SHA-256 `bc68ed03dc88ece86cdae506d5b78ab6cd0250d3c7841b2b941b75876dc0ac19`

Library revision: `c8c7e3892de9eb9264d4ea8344d47b5aff2cc2a4`

Scope: final specification-only review of SEC-041, SEC-050, SEC-086 and SEC-APP-005/006/008/012 after the bounded DL-CR-001 mapping repair

Gate scope: **PASS** — all checklist identities/duplicate counts are preserved; changed requirements, controls, rows and shared mappings were reconciled

Gate local foundation: **NOT RUN** — no application, logger, collector, test or consumer exists

Gate waves: **NOT RUN** — no event implementation changed
Gate deployment: **NOT RUN** — OD-001 through OD-005 and deployment evidence remain unresolved

## Inventory

| Event | Status | Evidence | Owner | Next |
| --- | --- | --- | --- | --- |
| SEC-041 | missing (retained) | `SECURITY_EVENTS.md:128`; request/generation/status/download/denial remain distinct and use declared envelope correlation | Unassigned | Implement and verify producer, durable audit, consumer and current-authority behavior in its assigned wave. |
| SEC-050 | missing (retained) | `SECURITY_EVENTS.md:137`; `previous_revision_ref` is an existing declared extra field | Unassigned | Close enums/triggers and verify authorized revision-conflict context without protected-object enrichment. |
| SEC-086 | missing (retained) | `SECURITY_EVENTS.md:173`; independent health is still blocked by OD-001/OD-004 | Unassigned | Resolve monitor/destination and durability decisions before instrumentation. |
| SEC-APP-005 | missing (retained) | `SECURITY_EVENTS.md:182`; existing `operation_ref`/`job_ref` correlation and event name retained | Unassigned | Verify effect-time authority, logical identity, fencing and unknown outcomes at real worker/effect boundaries. |
| SEC-APP-006 | missing (retained) | `SECURITY_EVENTS.md:183`; event/fields unchanged | Unassigned | Verify malformed/incomplete evidence produces coverage state and never a clean result. |
| SEC-APP-008 | missing (retained; mapping repaired) | `SECURITY_EVENTS.md:185`; malformed/unknown response input maps to SEC-031 and an invalid business transition to SEC-049; SEC-078 keeps its activation/use meaning | Unassigned | Verify each distinct trigger emits its one applicable controlled record and excludes raw provider content. |
| SEC-APP-012 | missing (retained) | `SECURITY_EVENTS.md:189`; restore-gate name and fields retained | Unassigned | Verify quarantine/revalidation/reactivation stages and affected consumers when implementation exists. |

## Findings

No remaining logging-drift finding is supported in the final snapshot. The initial pass's DL-CR-001 was repaired outside the read-only review: `dread.integration.policy_rejected` is no longer overloaded for provider response data or workflow transitions. The repair preserves the established event catalog and checklist meanings.

## Contracts and drift checks

The change adds investigation subcases to existing rows but changes no event name, schema version, field type/limit, severity, wave, audit obligation, coverage disposition, destination, retention, logger filter, sampling rule, queue/failure policy or consumer. SEC-041 and SEC-APP-005 use already-declared envelope `operation_ref`/`job_ref`; SEC-050 uses already-declared `previous_revision_ref`. SEC-APP-008 now uses existing names according to their existing semantics and explicitly avoids duplicate records for one enforcement decision.

All affected rows remain `missing`; none is described as implemented, verified, collected, durable, queryable or alerting. The full sorted SEC checklist identity multiset, including the pre-existing duplicate checklist row, matches the baseline exactly. Unchanged ledger evidence is reused only at baseline revision `06fc956...`; no old result is relabeled newly verified.

No new authentication, admin, data, provider or restore path bypasses a shared event path at the specification level. Runtime bypass, framework automatic capture, removed implementation events, weakened tests, collector/consumer behavior and deployment configuration remain unavailable because the application does not exist.

## Checks

- Read the target instructions, event contract/ledger, changed requirements/architecture/security/design and Grim Prompter threat IDs.
- Read Dread Ledger `runbook.md`, shared instruction, change-review prompt, coverage, checklist, event-contract and verification references at revision `c8c7e389...`.
- Compared every changed row with target baseline revision `06fc956...` and rechecked the repaired SEC-APP-008 mapping against SEC-031, SEC-049 and SEC-078.
- Compared the sorted SEC checklist identity multiset: no addition, removal or duplicate-count drift.
- Implementation, emitter, collector, storage, query, alert, privacy, load and deployment checks: **NOT RUN** because no implementation exists.

## Decisions and blockers

OD-001 through OD-005 remain the authoritative blockers for destination/consumer, retention, additional personal data, denied/failed/rolled-back durability and AI digest representation. This review selects no policy, owner, destination, retention period or failure behavior.

## Handoff

The ledger change is ready as specification text, with no runtime-coverage claim. Wave 0 remains the first implementation prerequisite. Future verification must exercise exact triggers, event absence, controlled outcomes, trusted actor/company/job context, secret/raw-response exclusion, one-record mapping, durable audit/consumer behavior and independent health before any row can become covered.
