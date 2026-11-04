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

**Brief.** *Subject:* a company's private cybersecurity feed (zero-days, vendor incidents, advisories) joined to exposure analysis of its registered GitHub.com repositories. *Audience:* company-authorized security engineers and the admins who manage sources, repositories, vendors, connectors, and sign-in, working mostly at a desktop browser. *Primary jobs:* the **feed** answers "what changed overnight and does it touch us?"; the **finding report** answers "is this repository exposed, how sure are we, what is missing, and what do I do next?"; **admin screens** answer "is collection and analysis healthy, and what needs my decision?" The requirements repeat one idea: incomplete evidence never proves safety. The design makes that visible.

**Signature.** Hatching means unknown. Solid fill is observed evidence, and diagonal hatching marks missing evidence, coverage gaps, and unknown values: the empty part of a confidence meter, a skipped branch, a business impact nobody has supplied. The logo uses the same device, with a dawn sun over hatched ground. Everything else stays quiet.

**Draft plan, then revisions after review against the brief and the skill's generic defaults:**

1. *Color.* Draft: near-black canvas with a single red alert accent. That is a generic default and would suit any security tool. **Revised** to plum ink on a cool fog canvas. Dawn amber is held back for first light: exploitation reported, new since your last visit, the admin badge. Red appears only for failures and destructive actions.
2. *Type.* Draft: Inter for everything plus a monospace face for metadata labels. That is the template tell. **Revised** so type shows provenance (FR-1.6, FR-9.3): publisher text is set in a serif (Source Serif 4), and the system's own words, analysis, and controls in a sans (Atkinson Hyperlegible Next). Monospace is used only for real identifiers: commit IDs, file and dependency paths, package versions.
3. *Layout.* Draft: a dashboard of identical rounded KPI cards with big counts. That is the SaaS card kit with a big-number hero. **Revised:** a report opens with a plain-sentence verdict and the confidence meter, and the feed is a dense list of rows, not cards.
4. *Confidence.* Draft: red, amber, and green traffic lights. That merges confidence with severity, which FR-4.4 keeps separate, and relies on color alone. **Revised:** confidence is a plum bar with a hatched remainder, plus the number and band word. Severity is a separate text tag.
5. *Labels.* Draft: tracked all-caps eyebrows and meta strings joined with middle dots. **Revised:** labels are in sentence case, and metadata is set as label and value pairs.
6. *After screenshots at 390 and 1440 px:* the report now fills the page width, meter tracks line up, coverage-gap hatching is 6 px wide so it reads as hatching instead of a dashed border, and identifiers wrap at spaces. One decoration was removed: the thick left stripe on error panels. The full notes are at the end of `design/preview.html`.

Tone: calm, exact, unsensational. The name is wry, and the interface does not need to be.

## Colors

- **Plum (`primary` #3B2D55):** app header, primary buttons, filled part of the confidence meter.
- **Ink (`ink` #231A33):** body text, focus outlines, redaction blocks.
- **Slate (`secondary` #5B5670):** secondary text, timestamps, hatch strokes.
- **Fog (`neutral` #ECEDF1):** page canvas. **Surface (#FFFFFF):** panels, rows, inputs. **Mist (#D7D9E0):** hatched backgrounds, hover, disabled.
- **Line (#77728A):** borders on inputs, chips, and panels. It meets 3:1 against fog, surface, and mist.
- **Dawn (`tertiary` #E8A33D):** fill only, never text on light. Ink text on dawn, and dawn rules or focus rings on plum. **Dawn ink (#7A4A00)** on **dawn wash (#FBEBD0)** marks new items.
- **Error (#A1203A) / error wash (#F8E1E5):** failures, field errors, destructive buttons, critical severity.
- **Verified (#1E6553) / verified wash (#DCEFE8):** checks that completed, and configuration verified in the repository. Never use it to mean "safe".

Measured contrast pairs, all passing WCAG 2.2 AA:

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

## Typography

- **Atkinson Hyperlegible Next** is the system's voice: headings, body, labels, analysis, controls. It was chosen because distinguishing characters (`l`, `1`, `I`, `0`, `O`) matters in advisories. Fallback: system-ui sans.
- **Source Serif 4** is used only for text reproduced from a publisher or advisory, with extra line height and a measure under 75 characters. If it is in serif, someone else said it. Fallback: Georgia.
- **IBM Plex Mono** is used only for identifiers: commit IDs, `owner/name`, file and dependency paths, `package@version`, request IDs. Fallback: ui-monospace.
- The scale follows the classic 12 / 14 / 16 / 18 / 21 / 24 / 36 sequence. Scores use tabular numerals. Labels are in sentence case and bold, never tracked capitals.
- Font hosting and licensing are TO BE DECIDED (DQ-1). The preview renders with fallbacks.

## Layout

- The grid uses a 4 px base and the `spacing` tokens. The page is capped at 1280 px, left-aligned, with 24 px gutters (16 px below 600 px).
- **Finding report:** a narrative column up to 680 px plus a 360 px evidence rail on wide screens. Below 960 px the rail stacks directly after the verdict and confidence, so evidence is never hidden behind a tab.
- **Feed:** one column of rows. Each row shows the title, source, and times, then status and relevance reasons. Filters sit in a bar above the list, and become a disclosure on narrow screens.
- **Admin health views:** tables with a status column first, sortable by freshness.
- Identifiers wrap at spaces and path separators, never inside a package name.
- Numbered markers are used only for real sequences: prioritized next steps and retry attempts.

## Elevation & Depth

The design is flat. Hierarchy comes from tone: surface panels on the fog canvas, 1 px line borders, and plum for chrome. Only dialogs float, with a 1 px line border, a 0 16px 40px rgba(35,26,51,0.28) shadow, and an ink scrim at 60% behind them. There are no shadows under rows or panels.

## Shapes

Radius shows the kind of element: controls use `md` (6 px), evidence and report panels `sm` (2 px, close to a document), and status chips and the role badge `full`, as small tokens of state. Hatching is a 45° stripe, 1.5 px slate over mist at a 6 px pitch, and its meaning never changes. External links carry a small arrow-out-of-box glyph after the link, never a "→" appended to the text.

## Components

- **App header:** plum bar with the logo, product name, and nav (Feed, Findings, Vendors, Alerts, plus Admin for admins). The current item has a 3 px dawn underline. The signed-in identity sits on the right (see Trust and safety).
- **Buttons:** primary (plum), secondary (surface with a line border), destructive (error), and quiet text. Every button has default, hover, a 2 px ink focus outline with 2 px offset (dawn on the plum header), and disabled (mist, slate text, with the reason shown next to it). Labels are verbs that name the result, such as "Pause repository" or "Export PDF".
- **Inputs:** label above, helper text below, line border. Errors use an error-wash fill, an error border, and an icon with text under the field saying what to change (FR-3.16, FR-6.4). Errors never rely on color alone.
- **Status chips:** each check, source, and delivery shows a chip with an icon and words. Checks: Queued, Running, Completed, Completed with gaps (hatched chip), Failed, Awaiting next advisory. Deliveries: Pending, Accepted by provider (never "Read"), Retrying 2 of 3, Failed. Sources: Active, Retrying, Degraded, Paused, Stale. Incidents: Confirmed, Suspected, Disputed, Withdrawn (struck through, with a link to the reason).
- **Confidence meter:** a 0–100 track with notches at 50 and 80. It has a plum fill and a hatched remainder, followed by the score, band word, and a single-sentence rationale. Low confidence never hides the finding.
- **Severity, impact, and exploitation:** three separate fields. Severity is a text tag naming its source and scoring version. Business impact shows "Unknown" on hatching until an admin supplies context. Exploitation reported is the dawn flag.
- **Feed row:** title, source, publication and retrieval times, and status. "Why this is here" gives the inclusion reasons, with uncertainty labeled. A new marker shows items added since the last visit.
- **Source quote:** serif text with a 3 px slate left rule. Under it, an attribution line with the publisher, original link, revision, retrieved time, and reuse notice (FR-9.1). Text that is a feed description only says so.
- **Provenance labels:** every block of prose carries one of three labels: Publisher statement, Analysis, or Company note (FR-9.3).
- **Evidence panel:** label and value pairs covering source revision, branches with commit IDs, dependency path and scope, matching criteria, analysis time, and analysis version.
- **Coverage gap:** a hatched strip that says what was not seen and why, and what would close the gap.
- **Report history:** a list of versions with time and change reason. Withdrawn or disproven findings are labeled differently from remediated ones (FR-4.9).

### Trust and safety interactions

- **Signed-in state:** the header always shows the display name and the identity provider ("via Okta"), plus a dawn **Admin** badge whenever admin rights are active, so the user always knows when they are working with admin rights. A Sign out button is always visible, never hidden in a menu. When the session ends or a role is removed (FR-7.8), the page replaces company data with a sign-in panel naming the reason. It never shows stale data behind a modal. Users never see admin-only controls. Opening an admin page without the role shows "This page needs the admin role," not the page itself.
- **Confirming actions:** there are three tiers. (1) Personal changes, such as unfollowing a vendor, get a dialog that names the vendor and the effect: "Pending alerts for Okta will be canceled." (2) Privileged changes, such as pausing or resuming a source or repository, editing connectors, or enabling issue creation, get a dialog listing the object, what stops, what is kept, and "Recorded in audit history." (3) High-impact changes, such as archiving a repository, source, or vendor, or changing the OIDC issuer or role mappings, also require typing the exact `owner/name` or issuer, and the destructive button stays disabled until it matches. Focus starts on Cancel, and Enter never confirms on open. Enabling issues on a public repository shows exactly what will be published (FR-10.10).
- **Error messages:** show a plain explanation, what to do next, the stable error code, and a copyable request ID (FR-6.5). They never show stack traces, tokens, credentials, internal hostnames, raw provider responses, or private data from another context. An unavailable resource reads "Not found or not available to you" and does not confirm that the resource exists. GitHub access failures name the repository, the last successful access time, and the resulting gap. Users are told to contact an admin, and admins see the repair action.
- **User-supplied and imported content:** source text, feed descriptions, file excerpts, proposed vendor names, and company notes are all shown as inert plain text. No imported HTML, scripts, embeds, or remote images are rendered (FR-9.4, NFR-2.3). Links show their destination host and an external-link glyph, and open the original only on a deliberate click. Long strings wrap anywhere. In code excerpts, invisible and bidirectional control characters appear as visible markers. Detected secrets appear as an ink redaction block giving only the location: "Secret redacted in `config/prod.env`, line 12".

## Do's and Don'ts

- Do use hatching for every unknown, gap, or missing value, and only for those.
- Do pair every color state with an icon or words.
- Do keep publisher text in serif and the system's words in sans.
- Don't show "No risk," a green check, or "Safe" for a check that failed, has gaps, or has no evidence. Say "No match found in the evidence we could read," and list the gaps.
- Don't color confidence by severity, or show severity as confidence.
- Don't call provider acceptance "delivered to" or "read by" a person.
- Don't use dawn for text on light backgrounds.
- Don't add counters, gradients, or motion to make a feed feel urgent. The only motion allowed is the Running chip's progress stripe, which stops under reduced motion.

## Open Questions

- **DQ-1:** Font hosting and licensing for Atkinson Hyperlegible Next, Source Serif 4, and IBM Plex Mono: TO BE DECIDED.
- **DQ-2:** A dark theme: TO BE DECIDED. The palette has only been checked on light surfaces.
- **DQ-3:** Whether company notes support any formatting (for example Markdown) or stay plain text. ASSUMPTION: plain text with line breaks.
- **DQ-4:** The severity vocabulary and its mapping across source scoring systems: UNKNOWN. The preview uses the source's own label.
- **DQ-5:** PDF export layout, and whether hatching survives grayscale printing: TO BE DECIDED.
- **DQ-6:** Which OIDC claims provide display name and email for the header: UNKNOWN. ASSUMPTION: a name claim is available.
- **DQ-7:** Whether company branding (logo or name) appears alongside the product mark: TO BE DECIDED.
