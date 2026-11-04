# Approved data sources for internal ingestion

Reviewed: 2026-11-04. This file owns the initial approved source catalog, source-specific reuse conditions, and policy for approving additional sources. [REQUIREMENTS.md](../REQUIREMENTS.md) defines system behavior; FR-2.2 and FR-8 refer to this file. Admin-approved runtime registrations are stored in the application database.

## Scope and selection

The system may ingest eligible publisher-owned news text and structured vulnerability advisories for a private company risk feed and repository analysis. Rich vulnerability data is the primary analysis input. Internal use includes database storage, display to authorized users, and private API responses, reports, and alerts. Public feeds are excluded. System-created issues in public repositories may contain only public evidence permitted for redistribution, with required attribution; private company analysis remains behind authenticated report links.

Selection is based on published permission for reuse, not an assumption that private business use is noncommercial. Each entry below permits the selected textual or structured-data use subject to attribution, item-specific restrictions, and access conditions. Approval applies only to the stated collection and eligible records, not every resource on a publisher's domain. Copyright permission does not guarantee endpoint availability or authorize bypassing access controls.

The initial catalog combines public-sector cybersecurity news and editorial briefings with the GitHub Advisory Database for structured vulnerability data. These sources do not promise complete or immediate coverage of vendor incidents or every repository component. Company-authorized GitHub repository access remains a separate integration from the public advisory source.

## Adding and maintaining sources

Admins may register additional news publishers, vulnerability databases, and vendor advisory collections through the application. Approval requires a named collection, canonical URL, supported retrieval method, primary-source permission evidence, allowed uses, exclusions, required attribution, reviewer, and review date. Supported formats are RSS/Atom, documented JSON APIs, and explicitly configured permitted HTML retrieval. Source identity and permissions must be validated before activation; unsupported formats remain inactive until an adapter exists. Registration of a tracked vendor does not approve ingestion from its website.

Runtime approval does not require a code release or an edit to this catalog. The database must retain the approval and any later revisions. Admins review changed terms and pause newly ineligible sources. Previously collected material and its collection-time permission evidence remain stored indefinitely; subsequent display, export, or analysis must still honor applicable restrictions. An internal-use grant alone does not establish permission to send publisher content to an external AI service.

Enabled sources are collected hourly. Failed collection retries the next hour, subject to provider retry instructions. After 24 hours of failure without recovery, notify admins and pause collection until an admin re-enables it. Unsupported or inaccessible endpoints must never be presented as successful empty feeds. See FR-8 for validation, partial ingestion, storage retries, and freshness labels.

## Initial approved source list

| ID | Publisher and eligible collection | Reuse basis for internal company ingestion | Conditions |
| --- | --- | --- | --- |
| NEWS-1 | UK National Cyber Security Centre (NCSC): publisher-owned news text reached through its news RSS feed | NCSC permits reuse under the Open Government Licence v3.0 unless otherwise stated. The OGL expressly permits copying, adaptation, and commercial use. | Credit NCSC and retain the original link and OGL notice. Exclude separately licensed content, third-party text, images, and logos. Do not imply endorsement. |
| NEWS-2 | CERT-EU: publisher-owned Cyber Brief text in its threat-intelligence publications | CERT-EU's legal notice permits CC BY 4.0 reuse unless otherwise noted. That license permits commercial reuse. | Credit CERT-EU, retain the original link and license notice, and identify changes. Exclude third-party material and item-specific restrictions. Do not fetch the external news articles cited by a brief. |
| NEWS-3 | European Union Agency for Cybersecurity (ENISA): publisher-owned news items and press releases | ENISA's legal notice authorizes reproduction with source acknowledgment unless otherwise stated; it does not limit that grant to personal or noncommercial use. | Credit ENISA and retain the original link and reuse notice. Limit this approval to reproduction of eligible text. Exclude stock photography, other third-party material, and items with separate restrictions. Transformation rights require separate verification. |
| VULN-1 | GitHub Advisory Database: published vulnerability and malware advisory records | The database is licensed under CC BY 4.0. | Preserve supplied credits, original advisory links, and the license notice; identify changes. Linked external resources require separate approval. |

These are the initially approved sources. Additional sources require an admin-approved registry entry with primary-source evidence for the intended use. Approval of a publisher does not override an item's separate rights notice. Source approval does not claim that an endpoint is currently accessible or that an ingestion implementation exists.

## Source evidence and retrieval

### NEWS-1: UK NCSC news

The [NCSC terms, Use of website content](https://www.ncsc.gov.uk/section/about-this-website/terms-and-conditions) grant reuse under OGL v3.0, require source acknowledgment, and exclude third-party material and logos. The [OGL v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) permits commercial and noncommercial reuse subject to its conditions.

The [official RSS directory](https://www.ncsc.gov.uk/information/rss-feeds) publishes a news feed at:

`https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml`

The news feed is the selected collection; guidance, threat reports, and other collections are not automatically included. A direct retrieval during this review returned HTTP 500. The endpoint is documented, but successful ingestion was not verified. Treat this as a source failure; do not bypass it or report an empty news result.

Suggested credit: “Source: UK National Cyber Security Centre. Contains information licensed under the Open Government Licence v3.0.” Include the original article and license links. Preserve any more specific attribution supplied with an item.

### NEWS-2: CERT-EU Cyber Briefs

The [CERT-EU legal notice](https://cert.europa.eu/legal-notice) gives CC BY 4.0 reuse permission with exceptions for third-party works and other excluded rights. The [license conditions](https://creativecommons.org/licenses/by/4.0/) require attribution and identification of changes. The [threat-intelligence collection](https://cert.europa.eu/publications/threat-intelligence/) describes Cyber Briefs as monthly reports on cybersecurity developments drawn from open sources. Select Cyber Briefs only; the wider collection also contains other document types.

The publisher-hosted RSS endpoint is:

`https://cert.europa.eu/publications/threat-intelligence-rss`

The browser retrieval identified an XML response but could not render it; a direct retrieval returned HTTP 403. Successful parsing and a supported automated access path remain unverified. An ingestion implementation must handle access denial without bypassing it. The copyright reuse basis and the operational access problem are separate findings.

Suggested credit: “Source: CERT-EU, [publication title], [original URL], CC BY 4.0.” Preserve supplied copyright and other required notices; identify any modifications. The approval covers CERT-EU's own text, not the articles it cites. Monthly publication also limits alert timeliness.

### NEWS-3: ENISA news

The [ENISA legal notice, sections 1.2 and 2.5](https://www.enisa.europa.eu/about-enisa/legal-notice) permits reproduction with acknowledgment, subject to item-specific exceptions, and separates third-party rights. The approved collection is [ENISA News](https://www.enisa.europa.eu/news), restricted to news items and press releases. Do not extend this approval to stock images, podcasts, videos, datasets, or linked external sites.

The news collection and legal notice were readable during the news-source review. A current supported RSS endpoint was not verified, so none is asserted here. Use explicitly configured HTML retrieval limited to eligible news items and press releases linked from the approved collection, subject to current access conditions. Inaccessible or disallowed retrieval follows FR-8.23; no bypass is authorized. Copy eligible text without rewriting under this approval; automatic summaries and translations are outside this release.

Suggested credit: “Source: European Union Agency for Cybersecurity (ENISA), [article title], [original URL]. Reproduced under ENISA's published reuse permission.” Retain the legal-notice link and any item-specific notices.

### VULN-1: GitHub Advisory Database

The [official database repository](https://github.com/github/advisory-database) publishes advisories in OSV JSON format. Its [license](https://github.com/github/advisory-database/blob/main/LICENSE.md) is CC BY 4.0. [GitHub's database documentation](https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/github-advisory-database) distinguishes reviewed, unreviewed, and malware advisories. Preserve that distinction when assessing confidence; an unreviewed record is not a verified claim.

Use the [documented global advisory API](https://docs.github.com/en/rest/security-advisories/global-advisories) at `https://api.github.com/advisories`. Explicitly retrieve reviewed, unreviewed, and malware types, with pagination and modification checkpoints, and reconcile withdrawn records. Default requests omit unreviewed and malware records. Follow [GitHub's API access and retry guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api). Download public advisory data for local matching; never send private dependency names or versions in API queries.

Suggested credit: “Source: GitHub Advisory Database, [GHSA identifier], [original advisory URL], CC BY 4.0.” Preserve supplied credits and license links and label extracted or changed content. This approval covers database records, not automatic fetching of their external references. Documentation and permission evidence were verified; an operational ingestion service was not tested.

## Content handling

Ingest only text or structured records covered by the applicable grant. Keep source identity, the original URL, the reuse notice, and required attribution with the item. Apply those notices to displays and downstream outputs that reproduce the content, including eligible public issue content. Exclude content when a separate rights notice prohibits the intended use or ownership is unclear. Do not assume that a publisher's permission covers a quoted third-party work.

Do not ingest images, logos, video, audio, or externally linked articles under these approvals. Do not imply that a publisher endorses the system. Preserve the distinction between publisher text, changed text, and company analysis. No paid license or individual permission request is needed for the eligible use covered by the published grants above; unsupported uses are outside this approval.

## Removed from the source list

Cloudflare Zero Wire and The Register are removed. Cloudflare's [Radar licensing policy](https://radar.cloudflare.com/about) puts API/download data under a noncommercial license, and The Register's [website terms](https://www.theregister.com/profile/terms_and_conditions_of_use) limit use to personal, noncommercial use and require authorization for copying. No applicable company-ingestion permission has been established for either.

CISA KEV, CVE, EPSS, VERIS, SEC EDGAR, OSV as a separate service, and NVD are not initially approved sources. Admins may evaluate them for runtime registration based on permission for the intended use. Vendor notices also require source-specific permission evidence. Absence from the catalog does not claim that all use of a source is unlawful. The GitHub Advisory Database is now approved separately as VULN-1.

## Validation and remaining limits

The review checked official publisher permission notices, the NCSC feed directory, the approved publication collections, and the applicable OGL/CC BY terms. Direct RSS probes found the access failures recorded above; no working ingestion service is claimed. No publisher was contacted, no contract was accepted on the company's behalf, and no production source was enabled.

REQUIREMENTS.md defines source registration, hourly collection, event-triggered analysis, extraction and validation, partial ingestion, retries, attribution, and indefinite retention. This catalog seeds approvals; later entries must satisfy the same evidence requirements through the admin registry. Existing NCSC and CERT-EU access failures remain operational limitations, not permission to bypass controls. Before production ingestion, validate each configured adapter and confirm that the item and current access conditions remain within its recorded approval.
