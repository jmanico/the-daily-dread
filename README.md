<p align="center">
  <img src="logo.svg" width="128" height="128" alt="The Daily Dread logo: a dawn sun rising inside a confidence dial, with hatched ground below the horizon">
</p>

<h1 align="center">The Daily Dread</h1>

<p align="center">
  A private cybersecurity feed for your company, plus evidence-backed exposure analysis of your GitHub repositories.
</p>

> **Status:** requirements, design and architecture only. Nothing is built yet. [REQUIREMENTS.md](REQUIREMENTS.md) owns behavior and workflows, [DESIGN.md](DESIGN.md) owns the visual system, and [ARCHITECTURE.md](ARCHITECTURE.md) owns components, technology and data flow.

## What it does

Every hour, The Daily Dread collects approved security news, structured vulnerability advisories, and vendor incident reports. When a new or materially changed risk arrives, it immediately queues checks of your registered repositories for exposure and tells the people who care.

- **A curated feed.** Major zero-days and vendor security incidents are collected automatically, with each publisher's original text, links, timestamps, and correction or withdrawal status. When relevance is uncertain the feed includes the item and labels the uncertainty.
- **Repository exposure checks.** A company-installed GitHub App reads the default branch and every branch active in the last 30 days, including the full file tree, dependency graphs, GitHub Actions, and container and infrastructure components. Package matching covers npm, PyPI, Maven, NuGet, Go, RubyGems, Composer, Cargo, Hex, Pub, Swift, and GitHub Actions.
- **Findings you can act on.** Each finding explains the affected asset, what could go wrong, the possible impact, protections that may reduce risk, and prioritized next steps, each with a way to verify the result. Confidence (0–100) is kept separate from severity, business impact, and exploitation evidence.
- **Vendor watchlists.** New users follow 30 major vendors (Microsoft, AWS, Google, Okta, Cloudflare, Ivanti, and others), and each user customizes their own list. Matches cover products, former names, and subsidiaries only where a recorded relationship supports it.
- **Alerts on your channels.** Company SMTP email, Twilio SMS/WhatsApp, and admin-managed Slack direct messages and shared channels, with fallback order, bounded retries, and deduplication. Admins can also enable one GitHub issue per repository and risk.
- **Exports.** PDF, CSV, and JSON reports that keep confidence, status, evidence references, and attribution.

## Principles

- **Incomplete evidence never proves safety.** Failed ingestion, missing permissions, and absent evidence are shown as coverage gaps, never as "no risk."
- **Evidence first.** Every finding cites exact source revisions, branches, commit IDs, file and dependency paths, and observed versions. Missing evidence is named, never invented.
- **A version match is not a compromise.** Package matches are never presented as proof of exploitation.
- **Read-only analysis.** The system never changes repository files, branches, settings, or Dependabot states, and never runs repository code. The only GitHub write it makes is to its own issues, when admins enable them.
- **Private by default.** All content requires sign-in. Matching uses data stored inside the company's system. Any external AI processing receives only de-identified, redacted facts.
- **Permission-based sources.** Only sources whose published terms or written permission cover the intended use are ingested, with credit and reuse notices kept on every display, export, alert, and issue.

## Who uses it

| Role | Can do |
| --- | --- |
| `DAILY-DREAD-USER` | Read the feed, findings, company notes, and reports for every active repository; export reports; manage their own watchlist, personal non-Slack notification preferences, and alert history. |
| `DAILY-DREAD-ADMIN` | Everything a user can do, plus manage sources, repositories, the shared vendor catalog, company context, notification connectors, OIDC configuration, ingestion and delivery failures, and archives. |

Each company runs its own private Docker installation, targeting 1,000 repositories and about 100 concurrent users; capacity is an implementation validation target. Repository checks use a persistent queue, one at a time by default, with admin-adjustable concurrency and visible progress refreshed every 30 seconds. The company’s IT team owns backups.

Sign-in uses one company-configured OIDC provider at a time: Google, Okta, Microsoft Entra, or PingOne. Roles come from mapped group or role claims. There are no local passwords. Admins can enable one external AI provider at a time—OpenAI, Anthropic, or Google—subject to the required local redaction and disclosure checks. Signal is outside the first release.

## Scope of this release

**In scope:** a web application and its private API, repositories on GitHub.com, and the sources in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) plus sources admins approve later.

**Out of scope:** public feeds, third-party API integrations, native mobile apps, native password authentication, GitHub Enterprise Server and other repository providers, manual or scheduled repository scans, automatic summaries and translations, and permanent deletion.

## Initial sources

| ID | Source | Reuse basis |
| --- | --- | --- |
| NEWS-1 | UK National Cyber Security Centre news | Open Government Licence v3.0 |
| NEWS-2 | CERT-EU Cyber Briefs | CC BY 4.0 |
| NEWS-3 | ENISA news and press releases | Reproduction with acknowledgment |
| VULN-1 | GitHub Advisory Database | CC BY 4.0 |

See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for conditions, retrieval details, and the approval policy for new sources.

## Design

The visual system is built around one idea: **hatching means unknown.** Solid fill is observed evidence, and diagonal hatching marks missing evidence, coverage gaps, and unknown values. The same device appears in the logo. Publisher text is set in a serif and the system's own words in a sans, so every reader can tell who said what.

- [DESIGN.md](DESIGN.md) defines light and dark themes, bundled fonts, basic note formatting, common severity labels, printer-friendly PDFs, name-first identity display, and company-name branding, including tokens and accessibility contrast pairs.
- [design/preview.html](design/preview.html) is a static, self-contained light-theme reference for the palette, type scale, components and their states, and the finding report screen. It uses installed fonts or fallbacks and predates the full interview decisions; it does not implement the application, theme switching, note editor, or PDF export. Open it locally in a browser.

## Repository contents

| Path | Purpose |
| --- | --- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional and non-functional requirements |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Approved source catalog and source approval policy |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, stack, ownership, trust boundaries and data flows |
| [docs/DEPENDENCY_REVIEW.md](docs/DEPENDENCY_REVIEW.md) | Proposed dependency review and release gates |
| [DESIGN.md](DESIGN.md) | Design system in the `@google/design.md` format |
| [design/preview.html](design/preview.html) | Static design preview |
| [logo.svg](logo.svg) | Product mark |

Check the design file with:

```sh
npx @google/design.md lint DESIGN.md
```

## License

The Daily Dread is licensed under the [MIT License](LICENSE). Third-party fonts and ingested source content retain their own licenses and reuse conditions.
