# REQ-PLATFORM-011 — durable claims, recovery and fencing

2026-11-05. Read the actual #93 template, secure-coding guide, SEC-1/3/5/8/9/10, queue contract, original event/retry requirements and PostgreSQL SELECT locking, isolation, retry and notification documentation before implementation. Notifications carry no authority; persisted rows are authoritative.

The repository-work owner uses the reviewed transaction boundary and a deployment-owned schema definition. Logical identity is company + original event/revision + repository. Job and attempt rows retain original identity, grant/repository revisions, attempt ordinals, operation correlation and cumulative budgets. Composite foreign keys/unique constraints enforce attempt ownership and logical idempotency. A producer can insert its event and enqueue work in the same transaction. No runtime DDL or automatic migration is exposed.

One installation-wide slot is enforced through a database mutex row and serializable transactions, including concurrent company-scoped callers. The initial lease is **60 seconds**, renewable only by its current fenced owner. This is a conservative implementation choice, not measured capacity; later scheduling/concurrency policy remains #94. Reclaiming work replaces the random attempt token and increments version/attempt identity while preserving prior attempts and budgets. A repeated unconfirmed claim operation returns the same still-current attempt rather than allocating another job. Old operation identities cannot recreate expired attempts.

The current authority port must read/lock validated service identity, grant ownership and source/repository revisions in the same transaction. `denied` means no permission to own the job and permits no mutation. `revoked` is a separate assertion that the caller still owns lifecycle maintenance but bound source/repository access or revision is no longer valid; only that result can mark work blocked. An inaccessible job returns not-found before disclosing fence/state differences. Tests exercise a second enabled principal possessing the real job ID and token; it cannot claim, block, renew, recover or commit that job.

Recovery handles at most ten expired rows per transaction and reports whether another page may be due. Unavailable authority rolls the whole page back. Startup reconciliation and the owned async recovery iterator provide immediate and **real 30-second** wakeups without accumulating missed callbacks. A consumer must await this iterator and call the owner; it is not an installed production scheduler. Database notifications remain optional hints.

Budget reservations use the existing pure cumulative-counter policy before work. Recovery cannot refund or reset bytes, tree entries or active milliseconds. Exhaustion marks the job/attempt failed; stale versions, expired leases, wrong tokens and current-authority failures cannot commit a result. Completion invokes the result owner inside the same transaction and checks current authority and actual database lease expiry before its final transition. External calls are prohibited in that callback; #95 owns external intent and reconciliation.

## Actual results

Local Node 24.16.0/macOS arm64: **115 standard tests pass**, including startup/abort cases and the actual approximately 30-second periodic tick. **12 PostgreSQL 18.6 durable-work tests pass** (one parent and eleven subtests):

- Producer event/work rollback and commit, concurrent deduplication and repeat identity.
- Malformed commands, unknown/prototype fields, wrong company, missing/stale authority and unavailable/throwing/invalid policy results.
- Actual database budget/ownership constraints and denied runtime DELETE privileges.
- Revoked queued work, forged/cross-company fences, and a different enabled principal denied without state changes or disclosure.
- Atomic single-slot admission across companies and idempotent uncertain-claim recovery.
- A real child process commits a claim and budget reservation, then receives SIGKILL with empty stdout/stderr. A fresh owner recovers the same durable job after the fixture advances its lease into the past. Original event/revision and debits persist; the old token cannot commit.
- Grant revocation/revision, repository revision and source validity are rechecked at renewal, debit, recovery and completion.
- Eleven expired jobs recover in bounded pages of ten and one; authority failure on a later row leaves the whole page unchanged.
- Cumulative exact budget boundary, stale versions, terminal exhaustion and no automatic retry after exhaustion.
- Result rollback after owner failure, final authority change, cancellation and actual elapsed lease expiry; successful completion and denied duplicate completion.

Build, strict checked contracts, runtime/import guard, reviewed dependency graph, artifact, dependency audit and whitespace checks pass. The previous 12-test PostgreSQL transaction suite remains in CI. No dependency or UI changed in this slice. Selected-runtime CI must pass on the submitted revision; the existing local runtime audit failure is not waived.

Schema SHA-256: `b7addeab8907536b2efef0fcb7ae71fbd60ffd52c8cbec58938581b9ebef52df`. Tests apply this actual schema to the pinned disposable PostgreSQL 18.6 image documented in POSTGRES_TRANSACTION_EVIDENCE.md. The migration installer, checksum enforcement, deployment grants and production restore quarantine are not implemented by merely storing this SQL file. The fixture's principal/event/repository/grant owner is synthetic; product identity and source/repository integration remain unimplemented.

No `dread.*` event or ledger evidence status changes. No later instrumentation wave is enabled. Scheduling priorities/admin concurrency and transient retry policy (#94), external effect reconciliation (#95), product adapters and workers, deployment/restore, capacity, Grim Prompter and human review remain outstanding. AC-01/02/04 have local persistence/failure evidence; AC-03 has actual current-authority and scope tests through the owning adapter, not production OIDC acceptance. Keep #93 and its PR open/draft until full acceptance.
