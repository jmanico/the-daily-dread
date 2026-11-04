# Approved news sources for internal ingestion

Reviewed: 2026-11-04. This file owns the approved news-source list and source-specific reuse conditions. [REQUIREMENTS.md](../REQUIREMENTS.md) defines system behavior; FR-2.2 refers to this file.

## Scope and selection

The system may ingest eligible publisher-owned news text for a private company risk feed. Internal use includes storage, display to company-authorized users, and authorized internal API responses, reports, and alerts. Public publication is excluded by the product requirements.

Selection is based on published permission for reuse, not an assumption that private business use is noncommercial. Each entry below permits the selected textual use subject to attribution, item-specific restrictions, and access conditions. Approval applies only to the stated news collection and eligible text, not every resource on a publisher's domain. Copyright permission does not guarantee endpoint availability or authorize bypassing access controls.

The selected sources are public-sector cybersecurity news and editorial briefings. They do not provide complete or immediate coverage of vendor breaches. Vulnerability databases, exploit scores, incident datasets, and regulatory filings are outside the news-source list. Company-authorized GitHub repository access remains a separate integration.

## Approved source list

| ID | Publisher and eligible news collection | Reuse basis for internal company ingestion | Conditions |
| --- | --- | --- | --- |
| NEWS-1 | UK National Cyber Security Centre (NCSC): publisher-owned news text reached through its news RSS feed | NCSC permits reuse under the Open Government Licence v3.0 unless otherwise stated. The OGL expressly permits copying, adaptation, and commercial use. | Credit NCSC and retain the original link and OGL notice. Exclude separately licensed content, third-party text, images, and logos. Do not imply endorsement. |
| NEWS-2 | CERT-EU: publisher-owned Cyber Brief text in its threat-intelligence publications | CERT-EU's legal notice permits CC BY 4.0 reuse unless otherwise noted. That license permits commercial reuse. | Credit CERT-EU, retain the original link and license notice, and identify changes. Exclude third-party material and item-specific restrictions. Do not fetch the external news articles cited by a brief. |
| NEWS-3 | European Union Agency for Cybersecurity (ENISA): publisher-owned news items and press releases | ENISA's legal notice authorizes reproduction with source acknowledgment unless otherwise stated; it does not limit that grant to personal or noncommercial use. | Credit ENISA and retain the original link and reuse notice. Limit this approval to reproduction of eligible text. Exclude stock photography, other third-party material, and items with separate restrictions. Transformation rights require separate verification. |

These are the only approved news sources. New sources require an update to this list with primary-source evidence for the intended internal use. Approval of a publisher does not override an item's separate rights notice.

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

The news collection and legal notice were readable during this review. A current supported RSS endpoint was not verified, so none is asserted here. The retrieval method remains an open question; this entry establishes text-reuse permission, not a promise of a working automated feed. Copy eligible text without rewriting under this approval; summaries or translations require a verified permission basis.

Suggested credit: “Source: European Union Agency for Cybersecurity (ENISA), [article title], [original URL]. Reproduced under ENISA's published reuse permission.” Retain the legal-notice link and any item-specific notices.

## Content handling

Ingest only text covered by the applicable grant. Keep source identity, the original URL, the reuse notice, and required attribution with the item. Apply those notices to internal displays and downstream internal outputs. Exclude content when a separate rights notice prohibits the intended use or ownership is unclear. Do not assume that a publisher's permission covers a quoted third-party work.

Do not ingest images, logos, video, audio, or externally linked articles under these approvals. Do not imply that a publisher endorses the system. Preserve the distinction between publisher text, changed text, and company analysis. No paid license or individual permission request is needed for the eligible use covered by the published grants above; unsupported uses are outside this approval.

## Removed from the source list

Cloudflare Zero Wire and The Register are removed. Cloudflare's [Radar licensing policy](https://radar.cloudflare.com/about) puts API/download data under a noncommercial license, and The Register's [website terms](https://www.theregister.com/profile/terms_and_conditions_of_use) limit use to personal, noncommercial use and require authorization for copying. No applicable company-ingestion permission has been established for either.

CISA KEV, CVE, GitHub Advisory Database, EPSS, VERIS, SEC EDGAR, OSV, and NVD are removed because they are structured data or filing sources rather than the selected news collections. Generic vendor notices are also removed because they have no shared reuse grant. Their removal does not make a claim that all use of those sources is unlawful.

## Validation and remaining limits

The review checked official publisher permission notices, the NCSC feed directory, the approved publication collections, and the applicable OGL/CC BY terms. Direct RSS probes found the access failures recorded above; no working ingestion service is claimed. No publisher was contacted, no contract was accepted on the company's behalf, and no production source was enabled.

Implementation still needs a retrieval method for each source, a schedule, content-field selection, handling of corrections, and news-to-exposure criteria. Those decisions remain in REQUIREMENTS.md's open questions. Before production ingestion, confirm that the relevant item and current access conditions still fall within this documented scope.
