---
version: alpha
name: The Daily Dread
description: Evidence-first visual system for a private cybersecurity feed and repository exposure reports. Hatching marks what is unknown.
colors:
  primary: "#3B2D55"
  on-primary: "#FFFFFF"
  ink: "#231A33"
  secondary: "#5B5670"
  neutral: "#ECEDF1"
  surface: "#FFFFFF"
  mist: "#D7D9E0"
  line: "#77728A"
  tertiary: "#E8A33D"
  dawn-ink: "#7A4A00"
  dawn-wash: "#FBEBD0"
  error: "#A1203A"
  error-wash: "#F8E1E5"
  verified: "#1E6553"
  verified-wash: "#DCEFE8"
typography:
  display:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 21px
    fontWeight: 700
    lineHeight: 1.3
  headline-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
  label-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
  score:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1
    fontFeature: '"tnum" 1'
  source-md:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.65
  source-sm:
    fontFamily: Source Serif 4
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  code-sm:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: 0px
  sm: 2px
  md: 6px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  measure: 680px
  rail: 360px
  page-max: 1280px
components:
  app-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    height: 56px
  nav-item:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.mist}"
    typography: "{typography.label-md}"
  nav-item-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  role-badge-admin:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  button-secondary-hover:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-disabled:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.secondary}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 40px
  input-error:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.ink}"
  feed-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: 16px
  feed-row-hover:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
  status-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  status-chip-failed:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.error}"
  status-chip-completed:
    backgroundColor: "{colors.verified-wash}"
    textColor: "{colors.verified}"
  exploited-flag:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  new-marker:
    backgroundColor: "{colors.dawn-wash}"
    textColor: "{colors.dawn-ink}"
    typography: "{typography.label-sm}"
  confidence-meter:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.primary}"
    height: 12px
    rounded: "{rounded.sm}"
  source-quote:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.source-md}"
    padding: 16px
  coverage-gap:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  redaction:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.code-sm}"
  evidence-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 24px
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  error-panel:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  session-banner:
    backgroundColor: "{colors.dawn-wash}"
    textColor: "{colors.ink}"
---

# The Daily Dread

## Overview

This file owns brand, tokens, typography, layout, components, accessibility and security-relevant interaction/rendering presentation. Product behavior is in [REQUIREMENTS.md](REQUIREMENTS.md); implementation controls are in [SECURITY.md](SECURITY.md); stack and asset pins are in [ARCHITECTURE.md](ARCHITECTURE.md). The [static preview](design/preview.html) illustrates the light theme, not completed application or PDF implementation.

The audience is company-authorized security engineers and admins, working mostly in a desktop browser. The feed answers “what changed overnight and does it touch us?”; findings answer “is this repository exposed, how sure are we, what is missing, and what do I do next?”; admin views answer “is collection and analysis healthy, and what needs my decision?” Tone is calm, exact and unsensational.

The product mark is [logo.svg](logo.svg): a dawn sun over hatched ground. Hatching is the visual signature for unknown values, missing evidence and coverage gaps; solid fill represents observed evidence. Reports open with a plain-sentence verdict and confidence meter; feeds use dense rows. Color and type choices below distinguish provenance and status without making the feed feel urgent.

## Colors

- **Plum (`primary` #3B2D55):** app header, primary buttons, filled part of the confidence meter.
- **Ink (`ink` #231A33):** body text, focus outlines, redaction blocks.
- **Slate (`secondary` #5B5670):** secondary text, timestamps, hatch strokes.
- **Fog (`neutral` #ECEDF1):** page canvas. **Surface (#FFFFFF):** panels, rows, inputs. **Mist (#D7D9E0):** hatched backgrounds, hover, disabled.
- **Line (#77728A):** borders on inputs, chips, and panels. It meets 3:1 against fog, surface, and mist.
- **Dawn (`tertiary` #E8A33D):** fill only, never text on light. Ink text on dawn, and dawn rules or focus rings on plum. **Dawn ink (#7A4A00)** on **dawn wash (#FBEBD0)** marks new items.
- **Error (#A1203A) / error wash (#F8E1E5):** failures, field errors, destructive buttons, critical severity.
- **Verified (#1E6553) / verified wash (#DCEFE8):** checks that completed, and configuration verified in the repository. Never use it to mean "safe".

Measured light-theme contrast pairs, all passing WCAG 2.2 AA:

| Foreground / background | Ratio | Use |
|---|---|---|
| ink / fog, ink / surface | 14.17, 16.57 | body text, focus outline |
| slate / fog, surface, mist | 5.96, 6.98, 4.95 | secondary text |
| on-primary / plum | 12.41 | header, primary button |
| mist / plum | 8.80 | inactive nav items |
| dawn / plum | 5.75 | current-nav rule, focus ring on the header |
| ink / dawn | 7.69 | exploited flag, admin badge |
| dawn ink / dawn wash | 6.38 | new marker, session banner |
| error / surface, error wash | 7.55, 6.07 | error text |
| on-primary / error | 7.55 | destructive button |
| verified / verified wash, surface | 5.77, 6.90 | completed chip |
| plum / mist | 8.80 | meter fill against its hatched track |
| line / fog, surface, mist | 3.94, 4.61, 3.27 | component borders |

Dawn on fog (1.84) and dawn on white (2.16) fail, so those pairs are never used.

### Light and dark themes

Theme preference behavior is specified in [FR-6.8](REQUIREMENTS.md#web-interface-and-private-api). Present its System / Light / Dark control and apply the selected theme before painting company content. Both themes MUST meet WCAG 2.2 AA contrast and preserve keyboard focus, non-color status cues and reduced-motion behavior. The frontmatter tokens above define the light theme; the following table defines the dark overrides. Do not invert colors automatically.

| Token | Dark value |
| --- | --- |
| primary | #C6AFED |
| on-primary | #21172D |
| ink | #F3EFF8 |
| secondary | #C4BDCF |
| neutral | #17131D |
| surface | #211B2A |
| mist | #332B3F |
| line | #91869F |
| tertiary | #E8A33D |
| dawn-ink | #F3C679 |
| dawn-wash | #3D2D16 |
| error | #FF9CAF |
| error-wash | #44222D |
| verified | #8ED5BA |
| verified-wash | #19392F |

In dark mode, retain the plum header (#3B2D55), white header text, mist (#D7D9E0) inactive navigation, and dawn underline/focus ring from the light theme. The admin badge and exploitation flag retain dark #231A33 text on dawn. Other components use the dark tokens: primary buttons and confidence fills become lavender; normal focus outlines and redaction backgrounds use light ink with dark on-primary text. The product mark keeps its original colors. Hatching uses dark-theme secondary strokes on mist and keeps the same meaning and pitch.

Measured dark-theme pairs: ink/surface 14.75:1; ink/neutral 16.14:1; secondary/surface 9.19:1; secondary/mist 7.40:1; on-primary/primary 8.78:1; dawn-ink/dawn-wash 8.30:1; error/surface 8.47:1; error/error-wash 7.03:1; on-primary/error 8.67:1; verified/surface 9.86:1; verified/verified-wash 7.42:1; primary/mist 6.90:1. Line borders against neutral, surface, and mist are 5.33:1, 4.87:1, and 3.92:1. Rendered acceptance checks are specified in [NFR-3.2](AGENTS.md#presentation-validation).

## Typography

- **Atkinson Hyperlegible Next** is the system's voice: headings, body, labels, analysis, controls. It was chosen because distinguishing characters (`l`, `1`, `I`, `0`, `O`) matters in advisories. Fallback: system-ui sans.
- **Source Serif 4** is used only for text reproduced from a publisher or advisory, with extra line height and a measure under 75 characters. If it is in serif, someone else said it. Fallback: Georgia.
- **IBM Plex Mono** is used only for identifiers: commit IDs, `owner/name`, file and dependency paths, `package@version`, request IDs. Fallback: ui-monospace.
- The scale follows the classic 12 / 14 / 16 / 18 / 21 / 24 / 36 sequence. Scores use tabular numerals. Labels are in sentence case and bold, never tracked capitals.
- **NFR-3.1** Bundle these three typefaces with the application and serve fonts/stylesheets only from its origin; no third-party font service requests at runtime. Pin shipped versions using the [architecture asset selections](ARCHITECTURE.md#stack) and retain copyright and SIL Open Font License 1.1 notices: [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next/blob/main/OFL.txt), [Source Serif 4](https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md), and [IBM Plex](https://github.com/IBM/plex/blob/master/LICENSE.txt). Include regular, bold, italic and bold italic styles for supported notes, use `font-display: swap` with the fallbacks above, and embed PDF fonts locally under their licenses. The standalone preview uses installed fonts or fallbacks.

## Layout

- The grid uses a 4 px base and the `spacing` tokens. The page is capped at 1280 px, left-aligned, with 24 px gutters (16 px below 600 px).
- **Finding report:** the report wrapper fills the available page width, with a narrative column up to 680 px plus a 360 px evidence rail on wide screens. Below 960 px the rail stacks directly after the verdict and confidence, so evidence is never hidden behind a tab.
- **Feed:** one column of rows. Each row shows the title, source, and times, then status and relevance reasons. Filters sit in a bar above the list, and become a disclosure on narrow screens.
- **Admin health views:** tables with a status column first, sortable by freshness.
- Identifiers prefer wrapping at spaces and path separators. If a package name, path, or URL still exceeds the available width, wrap anywhere without inserting or dropping characters; copying must recover the exact original value. Evidence must not clip on screen or in PDF.
- Numbered markers are used only for real sequences: prioritized next steps and retry attempts.
- Metadata uses label/value pairs rather than middle-dot-separated strings.

### PDF reports

- **FR-4.12** PDFs MUST use a printer-friendly layout independent of the screen theme: white pages, dark text, one column and clear section headings. Use 16 mm margins fitting A4 and US Letter portrait, body text of at least 11 pt, and a footer with report version, export time and page number. Start with the company name and The Daily Dread, finding status and verdict, confidence and rationale, then severity with original source values, business impact and exploitation evidence, coverage gaps, prioritized next steps, evidence references, company notes and attribution.

Draw black/dark-gray hatching explicitly as vector patterns, independent of browser background-print settings, and pair it with Unknown or Coverage gap labels. Confidence uses solid dark-gray fill with its number and band beside the track. Keep headings with their first paragraph and repeat table headings after page breaks. Wrap long identifiers/URLs without dropping characters or clipping evidence; links remain clickable and destinations readable in print. Preserve note formatting and source attribution. Acceptance checks are in [NFR-3.2](AGENTS.md#presentation-validation); secure generation controls are in [SEC-7](SECURITY.md#sec-7--rendering-exports-and-external-disclosure).

## Elevation & Depth

The design is flat. Hierarchy comes from tone: surface panels on the fog canvas, 1 px line borders, and plum for chrome. Only dialogs float, with a 1 px line border, a 0 16px 40px rgba(35,26,51,0.28) shadow, and an ink scrim at 60% behind them. There are no shadows under rows or panels.

## Shapes

Radius shows the kind of element: controls use `md` (6 px), evidence and report panels `sm` (2 px, close to a document), and status chips and the role badge `full`, as small tokens of state. Hatching is a 45° stripe, 1.5 px slate over mist at a 6 px pitch, and its meaning never changes. External links carry a small arrow-out-of-box glyph after the link, never a "→" appended to the text.

## Components

- **App header:** plum bar with the identity/branding fields specified in [FR-6.9](REQUIREMENTS.md#web-interface-and-private-api), plus nav (Feed, Findings, Vendors, Alerts and Admin for admins). Keep the company name secondary but readable; wrap or accessibly truncate long names with the full name available, without hiding identity or Sign out. The current item has a 3 px dawn underline. Signed-in identity sits on the right (see Trust and safety).
- **Buttons:** primary (plum), secondary (surface with a line border), destructive (error), and quiet text. Every button has default, hover, a 2 px ink focus outline with 2 px offset (dawn on the plum header), and disabled (mist, slate text, with the reason shown next to it). Labels are verbs that name the result, such as "Pause repository" or "Export PDF".
- **Inputs:** label above, helper text below, line border. Errors use an error-wash fill, an error border, and an icon with text under the field saying what to change (FR-3.16, FR-6.4). Errors never rely on color alone.
- **Status chips:** each check, source, and delivery shows a chip with an icon and words. Checks: Queued, Running, Completed, Completed with gaps (hatched chip), Failed, Canceled, Awaiting next advisory. Deliveries: Pending, Accepted by provider (never "Read"), Outcome uncertain, Retrying 2 of 3, Failed. A malformed or unknown provider response MUST show Outcome uncertain or Failed with a safe reason and MUST NOT unlock a later workflow. Sources: Active, Retrying, Degraded, Paused, Stale. Incidents: Confirmed, Suspected, Disputed, Withdrawn (struck through, with a link to the reason). ([T-008](THREAT_MODEL.md#t-008), [T-010](THREAT_MODEL.md#t-010))
- **Repository queue progress:** render the states, queue position and batch counts defined in [FR-3.22](REQUIREMENTS.md#repository-registration-and-exposure-checks), with the last-update display defined in FR-6.10. Visually separate the current sequence label from success/failure counts; use counts rather than a global current-position label with multiple workers.
- **Export progress and download:** show the bound report revision, Queued/Running/Ready/Unavailable state, and last-updated time. Ready exposes a download action only while the current authorization check succeeds. Role loss, archive, source-use restriction, or report-scope change replaces progress and download controls with “This export is no longer available” and a link back to the currently authorized report; never leave a stale download URL or protected preview visible. ([T-004](THREAT_MODEL.md#t-004))
- **Connector and AI settings:** use the privileged confirmation interaction below for provider changes; saved settings show credential presence/status under [SEC-6](SECURITY.md#sec-6--secrets-retention-and-external-ai). Available providers, setup disclosures and authorization are defined in FR-10.11–FR-10.12 and FR-12.7.
- **Confidence meter:** a 0–100 track with notches at 50 and 80. Align meter tracks across reports. It has a plum fill and a hatched remainder, followed by the score, band word, and a single-sentence rationale. Score meaning and inclusion follow [FR-4.3](REQUIREMENTS.md#findings-and-reports); do not color confidence by severity.
- **Severity, impact, and exploitation:** separate text fields using [FR-4.10–FR-4.11](REQUIREMENTS.md#findings-and-reports)'s normalized/original severity values. Unknown uses hatching and a reason; confidence remains a separate meter. Render [FR-4.8](REQUIREMENTS.md#findings-and-reports)'s Unknown business impact on hatching. Exploitation reported uses the dawn flag.
- **Feed row:** title, source, publication and retrieval times, and status. "Why this is here" gives the inclusion reasons, with uncertainty labeled. A new marker shows items added since the last visit.
- **Source quote:** serif text with a 3 px slate left rule. Under it, an attribution line with the publisher, original link, revision, retrieved time, and reuse notice (FR-9.1). Text that is a feed description only says so.
- **Provenance labels:** every block of prose carries one of three labels: Publisher statement, Analysis, or Company note (FR-9.3).
- **Evidence panel:** label and value pairs covering source revision, branches with commit IDs, dependency path and scope, matching criteria, analysis time, and analysis version.
- **Coverage gap:** a 6 px-wide hatched strip that says what was not seen and why, and what would close the gap.
- **Report history:** a list of versions with time and change reason. Withdrawn or disproven findings are labeled differently from remediated ones (FR-4.9).
- **Company notes:** use an admin editor with preview of the [FR-9.5](REQUIREMENTS.md#source-attribution-and-content-use) subset, rendered through the same representation as the saved note. Prose uses the system sans; code uses mono; retain a Company note label. Supported output formatting is defined in FR-9.5, and renderer controls in [SEC-7](SECURITY.md#sec-7--rendering-exports-and-external-disclosure).

### Trust and safety interactions

- **Signed-in state:** display the identity/provider fields selected by [FR-7.9](REQUIREMENTS.md#company-access-and-roles), with a dawn **Admin** badge whenever admin rights are active. Keep Sign out visible outside menus. On session/role loss, immediately clear company data, private export previews/links, and pending privileged dialogs, then show a sign-in panel naming the reason; never leave stale data behind a modal or in a restored view. Hide admin-only controls from users. An unauthorized admin page shows “This page needs the admin role” instead of its contents. Identity and authorization controls are in [SEC-2](SECURITY.md#sec-2--identity-sessions-and-authorization). ([T-002](THREAT_MODEL.md#t-002), [T-006](THREAT_MODEL.md#t-006))
- **Confirming actions:** there are three tiers. (1) Personal changes, such as unfollowing a vendor, get a dialog that names the vendor and the effect: "Pending alerts for Okta will be canceled." (2) Privileged changes, such as pausing or resuming a source or repository, editing connectors, or enabling issue creation, get a dialog listing the object, what stops, what is kept, and "Recorded in audit history." (3) High-impact changes, such as archiving a repository, source, or vendor, or changing the OIDC issuer or role mappings, also require typing the exact `owner/name` or issuer, and the destructive button stays disabled until it matches. The dialog MUST retain the server-supplied target and revision it displayed; a conflict or changed target closes the confirmation, performs no mutation, and requires a fresh authorized dialog before retry. Focus starts on Cancel, and Enter never confirms on open. Enabling issues on a public repository shows exactly what will be published (FR-10.10). ([T-015](THREAT_MODEL.md#t-015))
- **Error messages:** present [FR-6.5](REQUIREMENTS.md#web-interface-and-private-api)'s error fields as a plain explanation, next action, stable code and copyable request ID. Error panels have no thick left stripe. An unavailable resource reads “Not found or not available to you.” GitHub access errors name the repository and show FR-3.7's last access time and gap, with contact-an-admin guidance for users and a repair action for admins. Disclosure controls are in [SEC-1](SECURITY.md#sec-1--trust-boundaries-and-policy-ownership) and [SEC-8](SECURITY.md#sec-8--durable-jobs-errors-and-audit).
- **Imported content and links:** present the text/restricted-note outputs required by [SEC-7](SECURITY.md#sec-7--rendering-exports-and-external-disclosure). Links show their destination host and external-link glyph, opening only after deliberate click. Long strings wrap anywhere. In code excerpts, render invisible and bidirectional controls as visible markers. Detected secrets appear as an ink redaction block giving only their location, for example “Secret redacted in `config/prod.env`, line 12.”

## Accessibility and status language

Pair every color state with an icon or words. For a failed, incomplete or evidence-free check, do not show “No risk,” a green check or “Safe.” Say “No match found in the evidence we could read,” and list gaps (FR-3.6/FR-4.6). Provider acceptance labels must not imply “delivered to” or “read by” a person (FR-10.4).

Do not add counters, gradients or motion to manufacture urgency. The only permitted motion is the Running chip's progress stripe, which stops under reduced motion. Functional queue counts remain part of the progress component.

## High-impact confirmation phrases

DQ-8 resolved 2026-11-04. The server supplies the exact visible phrase and binds it to the action, stable target ID and revision. Repository archive uses the canonical `owner/name`; source archive uses `ARCHIVE SOURCE <stable source ID>`; vendor archive uses `ARCHIVE VENDOR <stable vendor ID>`; issuer replacement uses the exact new canonical issuer URL; role-mapping change uses `CHANGE ROLES <current canonical issuer URL>`. Angle-bracket notation here describes substituted server values, not literal input placeholders. Show the friendly name beside the stable ID. Compare exact text without case folding; allow paste and assistive input. Changed target/revision requires fresh review and confirmation. The phrase is deliberate confirmation, not authorization or a secret; fresh authentication and server policy still apply. Test every action, stale revisions, duplicate display names and keyboard/screen-reader operation under V-011.

Export status must show the 15-minute download expiry and offer regeneration after expiry without implying that the underlying report was deleted.
