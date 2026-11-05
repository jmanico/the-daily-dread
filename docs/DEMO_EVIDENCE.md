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
| Screenshots | Full feed viewport captures at 390 × 1000 and 1440 × 1000 CSS pixels, both themes, inspected against DESIGN.md and the preview HTML/CSS. Chrome DevTools capture avoids the native-window clipping seen earlier. See the dated review and retained PNGs below; other screens and browser versions remain unverified. |
| Navigation and preferences | Mobile filters now start collapsed. Opening an advisory moves focus into main content; the next Tab reaches its Back control (observed in Chrome). Missing optional claims render “Signed-in user”; Light survives reload; Dark selection renders. System mode followed emulated Light → Dark changes without reload; explicit Dark overrode emulated Light. Reduced-motion runtime checks remain pending. |

AC-01: built demo and actual rendered public feed observed. Unit tests cover search and record-type separation. AC-02: actual socket and projection negatives pass. AC-03/AC-04: theme/fallback logic and CSS controls have local checks; full interaction and responsive acceptance remains pending.

Tests cover no-match and hostile search text, maximum query bounds, unverified email and missing display claims, closed theme values, invalid dates/types/URLs, unsafe URL schemes/hosts/paths, oversized arrays/text, duplicate records, minimal output projection, missing assets and actual HTTP deny behavior. No real company, repository, credential or recipient is used. Source descriptions remain inert React text; embedded links/resources are not followed automatically.

## Unmet merge and production gates

- TOOL-003 runtime audit remains deferred by #26. The rejected auditor was not installed and no override was used.
- Feed layouts at 390/1440 in both themes and the saved/system preference paths described below are verified in this Chrome session. All-screen layout acceptance, full keyboard/focus coverage, browser storage denial, reduced-motion rendering, exhaustive long-identifier cases and the latest-two-major browser matrix are **not fully verified**. The local page remains usable for presentation; that does not waive these checks.
- Production build/capability/import/security-lint/CI enforcement in #104 is not implemented by the demo scripts. No CI or release-image pass is claimed.
- A full Grim Prompter cumulative change review against the saved JSON has **not run** for this code change; it is still required before merge. T-005/T-006/T-011 remain open and no saved threat-model verification was promoted. Dread Ledger change review is not triggered: no security event was added, removed or altered.
- Authentication, authorization, database, jobs, audit, source lifecycle, automated refresh, exports and real repository analysis are absent. No production leaf is closed and all existing ledger evidence statuses remain unchanged.

**Merge disposition: draft, not merged.** The user's all-checks merge rule remains in force. The production skip/defer register is [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).

## Feed screenshot and preference review — 2026-11-05 UTC

Actual served demo content matches a rebuild of `94b197fe49e3d678e06e9098bfbf79c41ca8099a`: browser JS SHA-256 `ea641befb1c5196e287068e9fad1be7870fca9cd1578343cf72f47ca8b2a074f`, CSS `a05a2f664e6cdab8c0c7c4b419946d6523b6cb4664bb09d8b58df0d73dd77edc`, and theme bootstrap `997ddb5e803a24fc6e3dca771aa9fb064a93cc6c4e1f24652a2676be11220ba9`. The later platform branch changes the storage-denial catch path; these observations apply to the demo branch, not that unexercised failure path.

Native Chrome DevTools Responsive mode was set to each exact width and 1000-pixel height; Capture screenshot produced the complete viewport at 2× device pixels (2880×2000 and 780×2000). These are browser renders, not generated mockups. The captured pointer/glow comes from the browser-control overlay. Desktop captures show the missing-claim fallback; the phone reload restores the synthetic Alex Morgan identity.

| Capture | Observed result |
| --- | --- |
| [1440 Light](demo-screenshots/feed-1440-light.png) | Left-aligned bounded page, one-column feed rows, separate provenance rail, expanded filters, plum header, readable metadata/identifiers and labeled hatched omission notice. |
| [1440 Dark](demo-screenshots/feed-1440-dark.png) | Same layout with dark surface/canvas, retained plum/white header, dawn admin badge and readable borders/text. |
| [390 Light](demo-screenshots/feed-390-light.png) | 16-pixel side gutters, wrapped heading/advisory title and timestamps, filters initially collapsed, header identity and End demo fit; navigation has its own horizontal overflow. |
| [390 Dark](demo-screenshots/feed-390-dark.png) | Same phone arrangement with readable dark tokens and non-color status labels; feed content does not clip horizontally in the reviewed viewport. |

The comparison used DESIGN.md's theme, typography, layout, flat panels and hatch rules plus `design/preview.html`'s header, row, chip and responsive style definitions. The preview remains a specification illustration; no claim is made that this is a pixel-identical reproduction or that unshown report/PDF screens passed. Neither phone screenshot includes the bottom of the first row; source action/focus behavior was observed separately as recorded above.

Observed preference sequence: Light survived a page reload at 390 pixels. With explicit Dark selected, DevTools `prefers-color-scheme: light` left the rendered page dark. Selecting System immediately rendered light; changing emulation to dark immediately rendered dark without reload. Emulation was restored to No emulation, device viewport override disabled and DevTools closed, leaving the demo in System mode. This exercises browser media-query changes without altering macOS settings; reload in every combination, storage denial and cross-tab preference propagation remain unverified.

After reload, all three Console errors were inspected: one blocked DevTools workspace-discovery connection and two blocked Codex-extension data-URL favicon images. They name `connect-src 'none'` and `img-src 'self'`; no application exception appeared in that inspected console. The CSP was not relaxed. This does not establish a clean console across every workflow or browser.
