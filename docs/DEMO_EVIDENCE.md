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
| Navigation and preferences | Mobile filters now start collapsed. Opening an advisory moves focus into main content; the next Tab reaches its Back control (observed in Chrome). Missing optional claims render “Signed-in user”; Light survives reload; Dark selection renders. System mode followed emulated Light → Dark changes without reload; explicit Dark overrode emulated Light. Reduced-motion and keyboard empty-search recovery were subsequently checked below. |

AC-01: built demo and actual rendered public feed observed. Unit tests cover search and record-type separation. AC-02: actual socket and projection negatives pass. AC-03/AC-04: theme/fallback logic and CSS controls have local checks; full interaction and responsive acceptance remains pending.

Tests cover no-match and hostile search text, maximum query bounds, unverified email and missing display claims, closed theme values, invalid dates/types/URLs, unsafe URL schemes/hosts/paths, oversized arrays/text, duplicate records, minimal output projection, missing assets and actual HTTP deny behavior. No real company, repository, credential or recipient is used. Source descriptions remain inert React text; embedded links/resources are not followed automatically.

## Unmet merge and production gates

- TOOL-003 runtime audit remains deferred by #26. The rejected auditor was not installed and no override was used.
- Feed, sample finding and repository layouts at 390/1440 in both themes and the saved/system preference paths described below are verified in this Chrome session. All-screen layout acceptance, full keyboard/focus coverage, browser storage denial, exhaustive long-identifier cases and the latest-two-major browser matrix are **not fully verified**. The local page remains usable for presentation; that does not waive these checks.
- Production build/capability/import/security-lint/CI enforcement in #104 is not implemented by the demo scripts. No CI or release-image pass is claimed.
- A private cumulative Grim Prompter review completed for the earlier foundation snapshot `24d8e40`; the later focus change below is outside that fixed snapshot. Current change-review and human-review gates remain required before merge. T-005/T-006/T-011 remain open and no saved threat-model verification was promoted. Dread Ledger change review is not triggered: no security event was added, removed or altered.
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

## Keyboard recovery and reduced motion — 2026-11-05 UTC

Chrome **156.0.8078.80** on macOS, local demo code `925367e34b2da572d1ad998d452841084c0f67df`. Browser JS SHA-256 `c60a64af70aa5633baa7d8ff066123a43c2ea015c96808f2d4b0e2d8c371d8c9`; CSS and theme hashes are unchanged from the earlier capture. The owned local server was restarted with this build and the page reloaded. Build, strict checked contracts, all nine tests, dependency audit (zero reported advisories) and whitespace checks pass locally. No package, runtime network capability, HTML sink or security event was added.

A keyboard walkthrough reproduced loss of focus to the HTML document when the empty-result **Clear filters** button disappeared. The code now opens the filter disclosure and restores focus to its existing search input after React commits the reset. The issue template, local React/output guide, SEC-7 and DESIGN.md focus/motion rules were reread, along with [React's DOM-ref focus example](https://react.dev/reference/react/useRef#manipulating-the-dom-with-a-ref) and [OWASP safe sinks](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#safe-sinks).

Actual native Chrome keyboard checks: Tab reaches the filter disclosure; Enter closes/opens it; the expanded tab order reaches Search, Record type, Severity and the empty-state recovery button. A synthetic nonmatching query renders the bounded snapshot warning. Enter on Clear filters restores all 15 valid records and focus to Search. Repeating with filters collapsed first also expands the disclosure and focuses Search. The accessibility tree confirmed the focused search field after each corrected case. This covers the observed regression, not every keyboard interaction or assistive-technology/browser combination.

In the Repositories sample, read-only DevTools inspection observed `prefers-reduced-motion: reduce`, the retained “Running” text, computed `animationName: none`, and zero active document animations. The same result held under explicit reduced-motion emulation. The underlying system already preferred reduced motion; the opposite preference was not emulated. Temporary emulation was returned to No emulation without changing macOS settings.

Additional complete viewport screenshots were inspected against DESIGN.md and the previously inspected preview styles:

- [1440 px dark, all record types](demo-screenshots/feed-1440-all-types-dark.png): 2880×2000 PNG at 2×; the expanded filters, bounded feed/provenance rail, public/synthetic labels and non-color source/omission cues remain readable.
- [390 px light, expanded filters](demo-screenshots/feed-390-expanded-light.png): 780×2000 PNG at 2×; filter fields stack within the phone gutters, labels and long advisory title wrap, and the navigation retains its own horizontal overflow. The viewport ends within the first feed row; lower actions are not asserted visible by this image.

These images establish the reviewed layout state; keyboard focus restoration is supported separately by the observed accessibility focus, since opening the capture toolbar changes focus. Native-window screenshot capture was unavailable, so Chrome's own viewport capture was used. Device emulation was disabled and DevTools closed afterward; the page was left in System theme on the default seven reviewed advisories. The source remains the dated manual snapshot, not an automatic live refresh.

## Built theme failure checks — 2026-11-05 UTC

`test/theme-bootstrap.test.mjs` executes the actual built `theme.js` using controlled browser API objects. Four test groups cover initial Light/Dark/System selection, invalid saved values, media-query changes with and without explicit overrides, storage-access/read `SecurityError`, write `QuotaExceededError`, continued page-local selection after failures, invalid custom-event values, ignored plain events/unrelated keys, and storage update/removal/clear without write-back loops. This is trusted project code in a Node VM test harness, not hostile-code isolation or a real browser. It does not establish browser storage-policy behavior or React control synchronization across tabs.

The issue's AC-03 and Test Strategy, project-local guide, SEC-7 and browser baseline were reread. Platform behavior was checked against [MDN localStorage exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#exceptions) and [storage event semantics](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event). No application code, dependency, visual layout, storage policy or security event changed; existing screenshots remain applicable. Build and strict checked contracts passed, all **13 demo tests** passed, dependency audit reported zero advisories, and whitespace checks passed. The original nine-test observations above retain their original scope. Actual browser storage denial, the full browser matrix and all merge gates remain outstanding.

Actual Chrome follow-up on the same served `925367e` code: a temporary second tab loaded the local demo in System mode. Selecting Dark there updated the original tab's Theme control without reload; read-only DevTools inspection returned `{"theme":"dark","selection":"dark"}` for the original tab's root attribute and selector value. Selecting System in the original tab propagated back to the second tab. The temporary tab was closed and DevTools left closed; System was restored. This establishes the observed two-tab preference path, while the synthetic storage failures above remain separate from real browser-policy testing.

The original tab's End demo action removed the feed and navigation and showed the ended-state heading and Restart demo button. Keyboard Tab from the focused main container reached Restart demo; Enter restored the default reviewed-advisory feed and focus to main. This verifies the in-page end/restart path only, not persistence of an ended state across browser reloads or production signout. The local presentation remains open on the default public feed.

## Finding and repository screenshots — 2026-11-05 UTC

Full-page captures in the same Chrome 156.0.8078.80 session extend the visual review beyond the feed. Each was inspected against DESIGN.md's layout, themes, status language, confidence, evidence and coverage-gap rules and the report/rail styles in `design/preview.html`. At 1440 CSS pixels the finding keeps its narrative and evidence rail side by side; at 390 the evidence stacks immediately after verdict/confidence. Sample repository paths and the complete commit identifier remain readable without clipped evidence. History, fictional publisher/company-note labels and the coverage-gap explanation remain visible. The repository screen separately labels batch counts, Running, Queued and Completed with gaps, and states that no scans are running. Phone navigation scrolls horizontally within its own strip; the repository capture reflects keyboard navigation that had scrolled that strip.

The first review caught a real mismatch: the finding's reported-exploitation value lacked DESIGN.md's dawn flag. Commit `6c664a3` uses the existing `Chip` and `dawn` class only for that exact status, retaining JSX text and the words alongside the flag. No dependency, HTML sink, event or runtime capability was added. The issue template, React/output guide, SEC-7 and design rule were read before this correction, with [React component props](https://react.dev/learn/passing-props-to-a-component) and [OWASP safe sinks](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#safe-sinks). Build, strict checked contracts, all 13 demo tests, zero-advisory dependency audit and whitespace checks pass. The owned loopback server was restarted and the page reloaded before all four corrected finding captures below.

| Retained capture | Actual PNG dimensions and code scope |
| --- | --- |
| [Finding 1440 Light](demo-screenshots/finding-1440-light.png) / [Dark](demo-screenshots/finding-1440-dark.png) | 2880×4444 at 2×; corrected `6c664a3`, including dawn exploitation flag |
| [Finding 390 Light](demo-screenshots/finding-390-light.png) / [Dark](demo-screenshots/finding-390-dark.png) | 780×7028 at 2×; corrected `6c664a3`, including stacked evidence and wrapped prose |
| [Repositories 1440 Light](demo-screenshots/repositories-1440-light.png) / [Dark](demo-screenshots/repositories-1440-dark.png) | 2880×2514 at 2×; prior served `925367e`, repository code unchanged by the flag correction |
| [Repositories 390 Light](demo-screenshots/repositories-390-light.png) / [Dark](demo-screenshots/repositories-390-dark.png) | 780×3748 at 2×; same unchanged repository view, all three cards and frozen-demo notice captured |

The browser's full-size capture includes below-the-fold content; viewport height remained 1000 CSS pixels. An attempted phone resize initially remained at 1440 and was corrected and verified before the retained phone images; that intermediate capture is not acceptance evidence. Keyboard activation reached Repositories and moved focus to main. Captures themselves do not prove visible keyboard focus because the capture toolbar owns focus. This pass does not cover every screen, arbitrary long input, copy/paste fidelity, assistive technology, PDFs, actual storage denial or the full browser matrix. System theme was restored, device emulation disabled and DevTools closed, leaving the corrected demo on the default public feed. These checks do not close any production leaf or waive review/runtime-audit gates.

The served assets were compared byte-for-byte with the corrected local build. Browser JS SHA-256: `42ada796469a3e1622084679dded6ee0b57b48019184bc1636ce61427427f7bb`; CSS and theme hashes remain as recorded above.
