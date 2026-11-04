# Grim Prompter change review — specification foldback

Baseline: `daily-dread-spec-tm` revision `05` (`../2026-11-04-deep-web-api/05-report.json`)

Reviewed revision: `06-change-review`

Depth: carried `deep` baseline
Change-review status: **complete**

## Outcome

The foldback is consistent with the revision-05 model. It creates no new architecture surface, actor, asset, boundary, dependency, event destination, credential path or distinct threat scenario. It strengthens claimed specification controls for existing `T-003`, `T-004`, `T-008`–`T-010`, `T-014`–`T-017` and adds clearer interaction behavior for `T-002`/`T-006`. No threat is resolved, retired, merged, reopened or upgraded to an evidenced weakness because nothing is implemented or observed.

The explicit composition ownership in `ARCHITECTURE.md` matches the baseline: web owns TB-1, TB-2 and TB-9; API owns TB-3 through TB-8 and TB-10, with API contributions on shared web boundaries. The new store-to-output diagram edge represents report/export state flow and does not grant authority to stored identifiers.

## Changed model records

- Added `E-015` through `E-019`, each bound to the inspected working-tree SHA-256 of one changed specification.
- Updated `F-AUTHORIZED-USECASE`, `F-EXPORT-CREATE`, `F-EXPORT-RETRIEVE` and `F-DELIVERY` to reflect the new allocation while preserving their implementation gaps.
- Added the foldback evidence to existing claimed controls `C-AUTHZ`, `C-VALIDATION`, `C-UNTRUSTED-DATA`, `C-OUTPUT`, `C-JOBS` and `C-AUDIT`; none was promoted beyond `claimed`.
- Promoted stage-04 proposals `R-P-AUTHORITY`, `R-P-EXPORT`, `R-P-PROVIDER` and `R-P-RESTORE` to `supplied` requirements. `R-P-CONFIRM` remains proposed because DQ-8 still lacks exact per-action confirmation text.
- Narrowed but kept open `G-002`, `G-004` and `G-005`: ownership/semantics are now specified, while concrete route/property matrices, adapter schemas, export storage/lifetime and all implementation evidence remain absent.
- Added change-review coverage `COV-CR-001` through `COV-CR-007`. No conflicts or identity dispositions were added.

## Counterevidence and limits

The new requirements are protective design evidence, not enforcement evidence. `G-001` remains the decisive implementation gap. `G-003` still needs the concrete state-changing browser route inventory; `G-006` still needs cache/browser observations; `G-008` and DQ-8 remain open; `G-007` and OD-001 through OD-005 still block complete event-pipeline claims. All 17 risks remain unrated, all 11 treatments remain proposed and all 11 verifications remain `not_run`.

The security-event edits refine existing mappings only. They add no event name or field, do not change severity, wave, audit policy, consumer, retention, destination or disposition, and do not promote any row from `missing`/`unavailable_signal`. A separate Dread Ledger change review found and repaired one response-rejection mapping so malformed input retains SEC-031 semantics and invalid business transitions retain SEC-049 semantics rather than overloading SEC-078.

## Checks

- Inspected all five changed files at the SHA-256 locators recorded in `SYSTEM_UNDER_REVIEW.md`.
- Parsed `change-review.json` with duplicate-key and non-finite-number rejection.
- Confirmed 291 unique typed IDs and 1,233 resolved live references.
- Compared every addressable record directly with revision 05: 12 additions and 17 modifications, no removal; the declared change groups match exactly.
- Confirmed every threat remains open and every verification remains `not_run` without result evidence.
- Formal schema validation, implementation tests, runtime inspection and optional methods: **NOT RUN**.

The review artifacts contain no credentials, tokens, secrets or unnecessary personal/operational values.
