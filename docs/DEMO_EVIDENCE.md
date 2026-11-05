# Demo evidence — REQ-DEMO-010 (#232)

Reviewer: Codex, implementing the project lead's requested presentation milestone. This is an implementation/test record, not human approval or production acceptance. Base commit: `3d9995d81e3a193a4ea3add1d3ae065071533418`; tested content is the demo branch accompanying this record.

Environment: macOS arm64, Node 24.16.0, npm 11.16.0; React/React DOM 19.3.1, esbuild 0.28.2, TypeScript 7.0.2. This does not establish the selected Linux/Node 26.13.0/PostgreSQL 18.6 release environment.

## Recorded results

| Check | Actual result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed from generated exact-pin lockfile; lifecycle scripts disabled |
| `node scripts/build.mjs` | Passed; browser demo bundle, CSS, mark, local fonts and notices emitted |
| `node_modules/.bin/tsc --project jsconfig.json --noEmit` | Passed strict checked JavaScript/JSDoc, JSX and test contracts |
| `node --test` | 9 tests passed, 0 failed, 0 skipped |
| `npm audit --audit-level=high` | Zero reported known advisories |
| `npm audit signatures` | 12 package signatures and 6 attestations verified |
| Build environment canary | Built with a synthetic secret environment value; scanned all emitted files and found no value |
| Real loopback HTTP negatives | Wrong Host/origin, cross-site request, unsupported methods, traversal, repository files, source maps and unknown paths rejected |
| Asset response controls | Fixed public allowlist, no-store, nosniff, no-referrer, restrictive CSP; GET/HEAD parity tested |
| Live source projection | 16 real records retrieved across all three types; 15 validated; one oversized affected-package array visibly omitted without relaxing the bound |
| Actual rendered feed | Chrome native accessibility tree showed real CVEs, GHSA links, source labels, retrieval timestamp and omitted-record notice |
| Screenshots | Dark desktop and 390-pixel-override native captures observed, but framing/zoom was not independently verified; mobile capture showed clipping requiring further inspection. These are partial observations, not a passed responsive check. |

AC-01: built demo and actual rendered public feed observed. Unit tests cover search and record-type separation. AC-02: actual socket and projection negatives pass. AC-03/AC-04: theme/fallback logic and CSS controls have local checks; full interaction and responsive acceptance remains pending.

Tests cover no-match and hostile search text, maximum query bounds, unverified email and missing display claims, closed theme values, invalid dates/types/URLs, unsafe URL schemes/hosts/paths, oversized arrays/text, duplicate records, minimal output projection, missing assets and actual HTTP deny behavior. No real company, repository, credential or recipient is used. Source descriptions remain inert React text; embedded links/resources are not followed automatically.

## Unmet merge and production gates

- TOOL-003 runtime audit remains deferred by #26. The rejected auditor was not installed and no override was used.
- 390/1440 layout acceptance in both themes, saved/system preference changes, full keyboard/focus, browser storage denial, reduced-motion rendering, long identifiers and the latest-two-major browser matrix are **not fully verified**. Browser navigation/DOM/screenshot APIs repeatedly failed, and native interactions were interrupted by user activity. The local page remains usable for presentation; that does not waive these checks.
- Production build/capability/import/security-lint/CI enforcement in #104 is not implemented by the demo scripts. No CI or release-image pass is claimed.
- A full Grim Prompter cumulative change review against the saved JSON has **not run** for this code change; it is still required before merge. T-005/T-006/T-011 remain open and no saved threat-model verification was promoted. Dread Ledger change review is not triggered: no security event was added, removed or altered.
- Authentication, authorization, database, jobs, audit, source lifecycle, automated refresh, exports and real repository analysis are absent. No production leaf is closed and all existing ledger evidence statuses remain unchanged.

**Merge disposition: draft, not merged.** The user's all-checks merge rule remains in force. The production skip/defer register is [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).
