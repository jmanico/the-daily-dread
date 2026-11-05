# REQ-AUDIT-012 — bounded audit delivery and independent observation

2026-11-05. Read issue #108, the local secure-coding guide, applicable SEC-1/3/5/8/9/10/11 controls, SEC-085/086/089, the event contract and selected AUDIT_POLICY before implementation. Public sources: [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [PostgreSQL privileges](https://www.postgresql.org/docs/18/ddl-priv.html), [WAL settings](https://www.postgresql.org/docs/18/runtime-config-wal.html), [Node child-process lifetime](https://nodejs.org/api/process.html#processchannelref) and timers. No dependency or UI change.

The standalone Wave-0 receiver accepts validated unsuccessful/attempted audit-configuration projections under a current, transaction-locked producer binding. Success remains in #107's atomic owner. Identical producer/event retransmissions deduplicate; valid conflicts preserve both projections without overwriting history. Malformed and corrupted records cannot enter quarantine. A success-only composite receipt constraint prevents unsuccessful events becoming mutation receipts. Monitor credentials can write synthetic probes/read checkpoints, but cannot read event bytes or append audit.

The pipeline owns two active writes, 128 pending records, 1 MiB pending bytes and an 8,192-byte record limit. Each standalone write has a total 1,000 ms deadline and at most one classified transient retry using the same identity. Unknown commits are not retried. Saturation/failure stops protected admission; recovery requires a drained queue, current writer privileges and independent storage/pipeline verification. Shutdown stops admission and allows five seconds to drain. Uncommitted memory can be lost on crash; no spool or loss-free promise is made.

Durable boot generations preserve restart uncertainty. The separate monitor checks monotonic heartbeat and database checkpoint progress using bounded probes. It emits only the existing nonrecursive SEC-086 aggregate projection; this is not a clock-synchronization detector or proof of operator delivery.

## Actual local verification

Selected Node 26.13.0/npm 11.20.0 on macOS arm64; PostgreSQL 18.6 at the pinned test-container digest. **129 standard tests and 51 PostgreSQL/process integration tests passed**, including 13 receiver tests and the independent-process test, plus unchanged transaction/durable-work/atomic-audit suites.

- AC-01: immutable bounded admission, exact deduplication, current-authority append, independent healthy-idle observations and real successful drain.
- AC-02: extra fields, accessors, mutable inputs, namespace/policy forgery, oversize records, corrupted stored projections, conflicting IDs and failed quarantine; no raw canary output.
- AC-03: wrong-company/producer/revoked service bindings, separated writer/monitor grants, forbidden history mutation, production HTTP authentication before readiness checks.
- AC-04: real database lock timeout, concurrency, commit acknowledgment loss, cancellation, queue saturation, exhausted boot generation, current privilege loss, stuck writer, recovery races and forced nonzero process shutdown. The shutdown fixture retains its IPC handle until the real signal arrives; no assertion or production bound was weakened.

The independent-process test freezes the producer with real SIGSTOP, verifies its process state and unchanged heartbeat, observes continued PostgreSQL probes from a separate process and requires silence detection within 42 seconds. The monitor exits nonzero with empty stdout/stderr. This uses actual monitor/receiver code and synthetic installation binding, not production supervisor configuration.

Strict checked JavaScript, runtime/import guard, dependency graph, build/artifact checks and whitespace pass. Dependency audit reports zero vulnerabilities; 62 registry signatures and 30 attestations verified. Actual runtime audit at 2026-11-05T20:26:30.577Z checked 204 records with zero matches for Node 26.13.0. Security source SHA-256: f828e1488a638b970e88cc3e9993d34a8fb1fc02bd5e160b8ced2df99016d217; support source: 50fe35a4df02398f741fdffbc666aceca323fcdb7f46d05af93145bf610d0049. The application build remains a local demo build.

Migration 003 SHA-256: dc2ec77907a0fdedea217c658a89f1b05c32401d55722bd5a5ae25b4fd33b736. Actual tests apply 002 then 003 and rerun the earlier atomic receipt suite. Production migration provisioning remains separate.

## Remaining gates

Bounded Dread Ledger prompt-09 review inspected these changed producer/consumer paths. All 103 ledger rows and statuses remain unchanged; private review details stay outside version control. Full Wave 0 still needs the actual nonblocking operational diagnostic output adapter (#106), product identity/configuration composition, installation heartbeat mount/supervisor/operator consumer, restore and capacity verification. The fixture producer readiness port is synthetic; independent monitor tests do not establish complete bootstrap integration. No later-wave coverage is claimed.

Cumulative Grim Prompter review, human review and remaining acceptance/release gates are not complete. Keep #108 and its PR open/draft; no merge or activation is authorized by passing these bounded tests alone.
