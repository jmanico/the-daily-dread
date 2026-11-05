# Local automatic feed evidence — REQ-DEMO-011 (#249)

Date: 2026-11-05 UTC. Scope: isolated loopback demonstration with public GitHub advisory data and fictional company examples. This is an implementation record, not human approval, production ingestion acceptance or a claim that the original epic is complete.

## Observed behavior and boundaries

The actual public adapter retrieved 30 current records: ten reviewed, ten unreviewed and ten malware advisories. Native Chrome displayed the live status and scheduled check. Without reloading, the feed advanced from 20:40 to 20:45 UTC while the `filecoin` search and its one matching result survived. Opening that result retained a separate immutable detail snapshot with its own retrieval timestamp. Source text is plain React text; source and supplied credits remain visible.

The server owns three serial requests every five minutes to the fixed public GitHub endpoint. Browser connections do not initiate provider work. The existing socket/TLS validation and worker parser enforce a shared 2 MiB response budget, zero redirects and a 30-second cycle. Invalid records are counted and omitted. A failed refresh retains the last successful sample; rate/access responses and provider delays longer than the schedule pause collection until restart. This recent sample does not establish complete history or withdrawal reconciliation.

The browser uses a fixed credential-free same-origin fetch stream, with no-store and redirect rejection, finite chunk/frame/idle bounds and owned reconnect cleanup. The runtime AST guard permits only that exact call and rejects changed destinations, options, aliases and other network capabilities. The server admits at most eight streams, rejects hostile Host/Origin/site, credentials, unsupported methods and query/path variants, and closes clients with queued writes. No private data, new package, security event or event-ledger status was introduced.

## Actual validation

Environment: selected Node 26.13.0/npm 11.20.0 on macOS arm64; Linux GitHub CI uses the same selected runtime and pinned PostgreSQL 18.6 fixtures.

| Check | Actual result |
| --- | --- |
| Standard suite after final negative-test additions | 140 passed, zero failures/skips |
| Type checking; runtime/import guard; dependency graph; build; artifact scan | Passed locally |
| Dependency audit | Zero reported vulnerabilities; 62 verified registry signatures and 30 attestations |
| Runtime audit | Passed at 2026-11-05T20:43:35.633Z; 204 official advisory records checked, zero matches; support checked |
| Initial full CI at `0113d15` | [Run 42105722751](https://github.com/jmanico/the-daily-dread/actions/runs/42105722751): both jobs passed, 138 standard tests, 51 PostgreSQL/process integration tests, one native DNS test, 33 isolated socket/TLS/parser tests, parser capacity and all build/audit checks |
| Additional negative coverage | Bad status/MIME/empty stream, malformed JSON/state/UTF-8, late fetch after cleanup, actual queued-write disconnect and oversize initial projection pass locally; partial provider-record omission added to isolated TLS suite for CI |
| Whitespace | Working-tree and committed-diff check passed for the tested revisions |

Provider integration tests cross an actual TLS socket and the shared bounded worker in an isolated network namespace. They cover duplicate records/JSON keys, unknown fields, decompression expansion, deep JSON, excess records, MIME/status/redirect/rate/access/poll responses and cancellation of a stalled socket. Browser parser tests use native readable streams; real HTTP tests exercise admission, stream capacity, disconnect and backpressure. These tests do not substitute for production composition or browser-matrix evidence.

## Screenshot review

Actual full-page captures of served `0113d15`, taken with native Chrome DevTools at 390/1440 CSS pixels and 1000-pixel viewport height, were inspected against DESIGN.md and design/preview.html. The later stream input-bound check does not alter layout. Both themes preserve readable source labels, wrapped long titles, coverage notices, refresh status and attribution. The rail stacks at phone width; no horizontal content clipping was observed.

| Capture | PNG dimensions |
| --- | --- |
| [390 Light](demo-screenshots/live-refresh-390-light.png) | 780 × 12300 |
| [390 Dark](demo-screenshots/live-refresh-390-dark.png), System resolved to Dark | 780 × 12300 |
| [1440 Light](demo-screenshots/live-refresh-1440-light.png) | 2880 × 7964 |
| [1440 Dark](demo-screenshots/live-refresh-1440-dark.png), explicit override | 2880 × 7964 |

Keyboard Tab from Search reached Record type with visible focus. Historical theme/System-change, saved-override, reduced-motion and missing-claim checks are recorded with their exact scopes in [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md); their implementation is unchanged. This record does not claim a new complete browser/assistive-technology matrix or PDF validation.

## Remaining gates

Draft PR #250 contains `Closes #249`. Required human review and the trust-boundary change review against the saved threat model remain pre-merge gates. The existing 17 production threats and 11 unrun production plans are not promoted by this demonstration. Original production source/authentication/audit composition, deployment and release acceptance remain incomplete. No PR or original production issue was merged/closed by these results. Every original leaf's skip/defer reason remains in [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).
