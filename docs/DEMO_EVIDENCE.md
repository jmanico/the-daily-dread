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
- Feed, sample finding and repository layouts at 390/1440 in both themes and the saved/system preference paths described below are verified in this Chrome session. All-screen layout acceptance, full keyboard/focus coverage, storage-denial coverage outside the Chrome case below, exhaustive long-identifier cases and the latest-two-major browser matrix are **not fully verified**. The local page remains usable for presentation; that does not waive these checks.
- Production build/capability/import/security-lint/CI enforcement in #104 is not implemented by the demo scripts. No CI or release-image pass is claimed.
- Separate private Grim Prompter reviews cover the earlier foundation snapshot `24d8e40` and the subsequent UI/CI endpoint diff through `63c78ea`, including the focus and exploitation-flag changes. The bounded follow-up preserves all 17 open threats and 11 unrun production verification plans; local model reference/history checks pass without formal full-model validation or human/merge approval. Human review remains required before merge. T-005/T-006/T-011 remain open and no saved threat-model verification was promoted. Dread Ledger change review is not triggered: no security event was added, removed or altered.
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

## Installed-browser smoke checks — 2026-11-05 UTC

NFR-4.4 was reread before extending the browser checks. The versions below come from the installed applications' `CFBundleShortVersionString`; they are exact tested versions, not an assertion that the latest-two-major release matrix is satisfied. Each additional browser loaded the same corrected `6c664a3` assets from the existing loopback server in a separate temporary tab. No browser was installed, downgraded, signed in or given new permissions.

| Browser | Actual observed results |
| --- | --- |
| Safari 27.2 (build 22625.2.8.11.9) | Real feed and omission/provenance labels rendered; native screenshots inspected in System-dark and explicit Light. Light survived an actual toolbar Reload, verified by clearing a transient nonmatching query and returning to seven reviewed records. A nonmatching query showed zero results; Clear filters restored 15 records. Advisory detail/Back and in-page End/Restart worked. Search used the native accessible value action after click/type did not deliver input; keyboard focus recovery is not claimed for Safari. |
| Firefox 156.0 (build 15626.9.9) | Real feed rendered in System-dark and explicit Light; native screenshots inspected. Light survived reload, with filters returning from all 15 records to the default seven. Keyboard Tab from a nonmatching search reached Record type, Severity and Clear filters; Enter restored 15 records and Search focus. Opening an advisory focused main, Tab reached Back, and Enter returned to the feed. End demo focused main, Tab reached Restart, and Enter restored the feed. |
| Edge 156.0.4314.58 | Real feed rendered in System-light and explicit Dark; native screenshots inspected. Dark survived reload with the same observable filter reset. Empty-search keyboard recovery, advisory detail/Back and End/Restart passed with the same focus observations as Firefox. |

Temporary demo tabs were closed, leaving each browser's original tab intact. Each demo theme was restored to its initial System setting first. Chrome 156.0.8078.80 remains open with the corrected public-feed demo. These smoke checks use each browser's existing desktop window, not controlled 390/1440 viewports; the exact-size screenshot evidence above remains Chrome-specific. Native screenshots were inspected during the session, not retained as repository assets. Older stable majors, full screen/interaction coverage, Safari keyboard behavior, assistive technology, browser storage-policy denial, cross-tab checks outside Chrome and the full release matrix remain unverified. No production or release acceptance is inferred.

## Actual browser storage denial — 2026-11-05 UTC

Chrome **156.0.8078.80**, same served `6c664a3` demo code. The three served asset hashes were rechecked and match the corrected finding-build hashes above. The AC-03/Test Strategy was reread before this check. No application, test, dependency or security-event code changed.

The exact `http://127.0.0.1:4173` origin was temporarily added to Chrome's **Not allowed to save data on your device** list. The original default remained **Allow sites to save data on your device**, and the original exception lists were empty. The saved exact-origin rule and Chrome's blocked-site-data address-bar indicator were both observed. No global storage setting, unrelated origin or browser permission was changed.

With that browser policy in effect, a fresh demo load rendered the real public feed and System selection. Selecting Dark and then Light changed the selector and actual rendered colors; native screenshots were inspected. Reload after Light returned to System and the default seven reviewed records without losing the usable page. End demo removed the feed/navigation and displayed Restart demo; keyboard Tab/Enter on Restart restored the feed and focus to main. This establishes the observed browser-policy fallback and continued page-local interaction, not merely the controlled API harness behavior.

The temporary exception was removed, and all three custom exception lists were observed empty again with the original default still selected. After reload, the blocked-data indicator was absent. Light then survived another reload, providing a positive persistence check after restoration. System was selected at the end; the settings tab and DevTools were closed, leaving only the local demo tab open.

During setup, Chrome's native accessibility tree stopped returning page content. Only task-created tabs/windows were present; Chrome was restarted to recover inspection, and the existing loopback server was left running. The temporary rule was subsequently verified and removed as described above. An optional read-only console probe encountered Chrome's paste warning and was not executed or enabled. No claim is made about an observed JavaScript exception name. Screenshots included native browser chrome and were inspected in-session rather than committed as assets. Other browsers' storage-denial policies, actual quota exhaustion, all-screen interaction coverage and the complete release browser matrix remain unverified. Earlier dated statements that storage-policy denial was pending describe their earlier passes; this section records the narrower completed Chrome check.

## Remaining demo screen captures — 2026-11-05 UTC

Chrome **156.0.8078.80**, same served `6c664a3` assets, without a rebuild or application change. The issue's screenshot requirements, DESIGN.md and preview styles were reread. Sixteen additional full-page PNGs were captured with Chrome's device toolbar at 390 and 1440 CSS pixels, height 1000 and 2× device scale. All sixteen were opened and visually inspected. Desktop navigation is fully visible; content panels, action labels, sample disclaimers, non-color status labels and the unavailable-production notice remain readable in both themes. Phone cards and prose wrap within the content gutters.

| Screen | 390 Light / Dark | 1440 Light / Dark | Actual PNG dimensions |
| --- | --- | --- | --- |
| Findings list | [Light](demo-screenshots/findings-390-light.png) / [Dark](demo-screenshots/findings-390-dark.png) | [Light](demo-screenshots/findings-1440-light.png) / [Dark](demo-screenshots/findings-1440-dark.png) | Phone 780×2136; desktop 2880×2000 |
| Vendor watchlist | [Light](demo-screenshots/vendors-390-light.png) / [Dark](demo-screenshots/vendors-390-dark.png) | [Light](demo-screenshots/vendors-1440-light.png) / [Dark](demo-screenshots/vendors-1440-dark.png) | Phone 780×2940; desktop 2880×2000 |
| Alerts | [Light](demo-screenshots/alerts-390-light.png) / [Dark](demo-screenshots/alerts-390-dark.png) | [Light](demo-screenshots/alerts-1440-light.png) / [Dark](demo-screenshots/alerts-1440-dark.png) | Phone 780×2136; desktop 2880×2000 |
| Administration preview | [Light](demo-screenshots/admin-390-light.png) / [Dark](demo-screenshots/admin-390-dark.png) | [Light](demo-screenshots/admin-1440-light.png) / [Dark](demo-screenshots/admin-1440-dark.png) | Phone 780×2136; desktop 2880×2000 |

**Unresolved navigation observation:** the phone strip retained a horizontal scroll position with Feed outside the viewport and the beginning of Findings partially clipped, including the active Findings label in its captures. Content wrapping passes the observed check, but these images do not establish complete mobile navigation/focus acceptance. The cause and keyboard visibility after an actual phone-width activation remain to be checked; no CSS correction or acceptance waiver is inferred. An initial desktop resize did not apply correctly; the width was subsequently entered and verified as 1440 before the retained desktop captures.

Separate native keyboard checks in the normal browser window passed: after selecting Vendors, Tab reached the first watchlist action; Enter removed/re-added Cedar (2→1→2 followed), and Harbor's action added/removed it (2→3→2), with focus retained and labels updated. The no-notification notice remained visible. In Administration, Tab from main reached the optional-claims checkbox; Space changed both the header and current-display text to Signed-in user, and Space restored Alex Morgan with checkbox focus retained. In Alerts, Tab/Enter on Review the finding opened the fictional finding and focused main. These are demo state changes only; no real notification, credential or production configuration was created.

System theme and the default seven-record public feed were restored, device emulation disabled and DevTools closed. The retained images supplement the earlier fourteen captures; they do not replace the unresolved mobile navigation check, full browser/assistive-technology matrix, PDFs, human review or runtime-audit gate. No implementation changed, so the existing implementation test results were not rerun merely for this documentation/image addition.

A subsequent 390×1000 check activated Findings in the emulated viewport, then used Shift-Tab to reach its navigation button. A native screenshot showed the complete Findings label with a visible focus outline. Keyboard navigation returned to Feed; Shift-Tab from content again reached Findings, and Enter opened its heading and focused main. This narrows the earlier gap: that keyboard route works, while the retained full-page captures still show a different horizontal scroll position. It does not establish every navigation item/focus state or explain the capture discrepancy. Emulation was disabled again, DevTools closed and the System-theme Feed restored.

## Browser search negatives — 2026-11-05 UTC

Chrome 156.0.8078.80, unchanged served `6c664a3` code. The AC-02/Test Strategy was reread. A search value containing an HTML image tag with an error-handler title marker remained literal input text, produced zero matching records, and left the document/tab title unchanged. No injected image or marker was observed in the accessibility tree. This is one actual browser negative case, supported by the existing JSX/input and projection checks; it is not proof against every XSS payload or an assertion that CSP alone is sufficient.

Pasting 220 ASCII characters into Search retained exactly 160, as read back from Chrome's accessible input value, and displayed the bounded no-match state. Tab through Record type and Severity to Clear filters, then Enter, restored all 15 valid records and focus to Search. Reload restored System theme and the default seven GitHub-reviewed records. No app code, dependency, stored browser policy or source data changed. Existing implementation tests were not rerun for this evidence-only addition.
