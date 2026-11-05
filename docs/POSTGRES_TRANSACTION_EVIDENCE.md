# REQ-PLATFORM-010 — scoped transaction boundary

2026-11-05. Read #92's template, the local secure-coding guide, SEC-1/3/5/8/9/10, TB-8/TB-10 and cited PostgreSQL/node-postgres transaction guidance before implementation. [The client decision](decisions/POSTGRES_CLIENT.md) records NFR-5 verification and replacement of the blocked, uninstalled pg selection.

The trusted persistence boundary provides a fixed-statement registry and one transaction capability. Every statement receives company scope as its first bound parameter; each owner's SQL must enforce it. This is not automatic authorization or a SQL parser. Current principal/role/revision decisions belong inside the same serializable transaction. Bounded primitive parameters and explicitly decoded immutable text/null rows preserve integer exactness. Invalid statements/parameters, concurrent or unowned queries, and swallowed statement errors poison the transaction.

Two operations can be active per boundary, with no retained queue. Each owns one checked-out connection, 2-second statements, 1-second locks, 3-second idle-transaction expiry and a caller deadline capped at 10 seconds. Each closes its single-connection pool afterward. This favors isolation and bounded cleanup over connection-reuse throughput. Production composition must construct one installation-wide owner and measure capacity; no throughput claim is made.

Verified TLS/hostname and SCRAM channel binding are mandatory. URLs, TLS bypass options, notices/debug logging, COPY/subscriptions and generated row decoders are absent from the exposed capability. All row queries use `.raw()`. Owner SQL/schema constraints must bound database results; additional adapter checks precede disclosure but do not bound a malicious database server's wire allocations.

Cancellation fences late callbacks and destroys the owned connection. Shutdown cancels admitted operations. Server-confirmed serialization/deadlock failures, including at COMMIT, are retryable; unconfirmed COMMIT is unknown. No nested retry loop exists. Durable owners must reconcile original operation identity and apply the requirement-defined whole-operation schedule; source writes retain FR-8.21's 1/5/15-minute retries. External calls remain prohibited in product transaction callbacks; the primitive cannot sandbox developer code.

## Actual validation

Local Node 24.16.0/macOS arm64: **113 standard tests pass**. Build, checked contracts, runtime/import guard, dependency graph, artifact, whitespace and npm audit pass. npm verifies 62 registry signatures and 30 attestations. No unrelated lock entries changed. The recorded local runtime vulnerability failure is not waived; Node 26.13.0 CI is the selected runtime gate.

Real **PostgreSQL 18.6: 12 tests pass** (one parent plus eleven subtests), using the production transaction module and Fastify factory:

- TLS/SCRAM, wrong credentials, separate untrusted CA, wrong hostname, one backend per transaction and exact local settings.
- Current synthetic owner authority, wrong company, missing/revoked/reader role, absent scoped resource, stale revision and parameterized injection canary.
- Atomic mutation/audit/work; rollback on failed work or duplicate operation identity; restricted-role denial of audit DELETE and schema migration.
- Invalid, oversized, accessor, sparse and unknown parameters; malformed Unicode; query count/concurrency limits; oversized output and swallowed query errors.
- Registered HTTP handler access, role revocation, scoped projection and exclusion of private database fields.
- Lock timeout, backend termination, late callback fencing, running-query cancellation, two-slot saturation, shutdown and subsequent successful operations.
- A 100-row raw result with instrumented Function construction makes zero generated-code attempts.
- Real deadlock detection yields one commit and one retryable rollback. Concurrent write skew yields one commit and one serialization failure. A fresh whole-operation retry reruns authorization, sees the changed predicate and denies the unsafe update.
- A real COMMIT waits in `SyncRep` while acknowledgement is withheld. The deadline returns unknown with the original operation ID. Releasing the wait reveals committed mutation/audit/work, proving blind retry or a false failure result would be wrong.

Standard tests also exercise invalid configuration/registry/admission and native-socket rejection of premature ready, unsupported authentication and missing channel binding. Synthetic owner/schema fixtures prove the primitive, not completed product identity, migrations or durable queues. AC-01/02/04 have transaction-level evidence; AC-03 has scoped-query/current-authority/HTTP fixture evidence. Product integration and deployment acceptance remain separate.

## Database fixture and remaining gates

The fixture pins Docker Official Image `postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5`. Official-images points to docker-library/postgres commit `e00e1bd34ec5c8a8e7ad89b273b3d42efaf6d5bc`, `18/bookworm`, selecting PG 18.6-1.pgdg12+2. The [security table](https://www.postgresql.org/support/security/) and [18.6 release notes](https://www.postgresql.org/docs/release/18.6/) were checked on 2026-11-05; listed current PostgreSQL fixes are included. This does not audit every Debian package.

Local Docker Engine is 29.9.1, not the selected 29.9.3 release target. The disposable database uses a read-only root, memory/PID/CPU limits, temporary data, generated TLS material and loopback-only ports, then is removed. Its arm64 inventory has 147 rows, SHA-256 `abb4b6891f3de6b743368752b056f8a41ba1f9750226bb7484290202c6cd173b`. No production image, company activation, persistent deployment or OS-package advisory clearance is claimed. Production image/engine inventory and advisory checks remain release gates.

No ledger status changes; fixture audit tables do not implement SEC-11. Product migrations, durable idempotency/lease/retry owners, live identity, production audit consumers, capacity, Grim Prompter and human review remain outstanding. Keep #92 and its PR open/draft until full acceptance. No UI changed.

Selected-runtime confirmation: [CI 42068580737](https://github.com/jmanico/the-daily-dread/actions/runs/42068580737) passed both jobs at `88a4375` on Node 26.13.0/Linux: 113 standard tests, 12 PostgreSQL 18.6 tests, native DNS, 17 isolated outbound tests, parser capacity and every build/type/import/graph/artifact/advisory/signature/whitespace/runtime gate.
