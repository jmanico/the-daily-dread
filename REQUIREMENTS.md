## Required Requirement Inputs

- Project purpose: Provide a company with a private internal feed of ingested cybersecurity news, articles, and reported vendor incidents, plus repository exposure checks, reports, and alerts.
- Users and actors: Users of the system; an admin who manages data feeds and repositories and is likely the company's cybersecurity lead.
- Core workflows: Ingest permitted source data into the system database; use stored risk data and repository dependencies for exposure checks; read news and articles; manage news sources and repositories as an admin; register repositories; automatically check repository exposure to new risk items; view risk reports; register vendors of interest; receive alerts about vendor security incidents.
- Data entities: News items, source records, source revisions, source permissions, ingestion results, company-written notes, risk items, affected package versions, repository dependency snapshots, repositories, repository registrations, third-party vendors, vendor registrations, risk signals, exposure reports, and alerts.
- External integrations: Ingest eligible source data into the system database only from the approved sources in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md), under the conditions recorded for each source. GitHub.com repository access is a separate company-authorized integration for exposure checks, not a news source.
- Authentication and roles: System user and admin roles; the admin manages data feeds and repositories; authentication method and detailed access rules UNKNOWN.
- Regulatory or privacy constraints: News ingestion requires published permission for internal company reuse; source attribution, license notices, and content exclusions apply; feed content, API responses, reports, and alerts are for company-authorized users only; private repository data requires company authorization; other regulatory, privacy, and retention constraints UNKNOWN.
- Target surfaces: Web user interface and API only; mobile excluded from the current scope; automatic exposure checks required; background jobs UNKNOWN.

## Functional Requirements

### News and Articles

- **FR-1.1** The system MUST provide a curated cybersecurity news feed to company-authorized users.
- **FR-1.2** The system MUST display permitted news text from enabled sources in the internal feed.
- **FR-1.3** The system MUST show a link to the original publication with each news item.

### Risk Information

- **FR-2.1** The system MUST provide news about cybersecurity risks in the internal risk feed.
- **FR-2.2** The system MUST use data ingested from enabled sources listed in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) to supply the internal risk feed.
- **FR-2.3** The system MUST include reported vendor security incidents from the approved news sources in the risk feed.
- **FR-2.4** The system MUST ingest data only when the source's published terms or written permission allow ingestion and internal company use.

### Repository Registration and Exposure Checks

- **FR-3.1** The system MUST let the admin register repositories for exposure checks.
- **FR-3.2** The system MUST automatically check registered repositories for exposure to each new risk item.
- **FR-3.3** The system MUST let the admin register public and private GitHub.com repositories that the company authorizes it to access.
- **FR-3.4** The system MUST let an authorized user view available dependency data for a registered GitHub repository.
- **FR-3.5** The system MUST show links to available Dependabot alerts for registered GitHub repositories when repository access permits it.
- **FR-3.6** The system MUST report an incomplete exposure check when required repository data or risk criteria are unavailable.
- **FR-3.7** The system MUST stop new access to a repository when GitHub reports that access permission has been revoked.
- **FR-3.8** The system MUST NOT change repository contents or Dependabot alert states during exposure checks.
- **FR-3.9** The system MUST NOT report a confirmed compromise from a package version match alone.
- **FR-3.10** The system MUST repeat affected repository exposure checks when stored risk criteria change.

### Reports

- **FR-4.1** The system MUST provide reports that show risk signals in repositories.
- **FR-4.2** The system MUST provide reports that show risk exposure.

### Vendor Registration and Alerts

- **FR-5.1** The system MUST let the user register third-party vendors of interest.
- **FR-5.2** The system MUST send the user an alert about a security incident at a vendor that the user registered.
- **FR-5.3** The system MUST include the source link in each vendor incident alert.
- **FR-5.4** The system MUST NOT classify a vendor as breached solely because its product has a vulnerability or a service outage.

### User Interfaces

- **FR-6.1** The system MUST provide a web user interface.
- **FR-6.2** The system MUST provide an API.

### Company Access

- **FR-7.1** The system MUST restrict access to users authorized by the company.
- **FR-7.2** The system MUST NOT provide its feeds to the public.

### Data Ingestion for Repository Analysis

- **FR-8.1** The system MUST let the admin enable ingestion from a source listed in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-8.2** The system MUST let the admin stop new ingestion from an enabled source.
- **FR-8.3** The system MUST reject ingestion from a source that is not approved for the intended use in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-8.4** The system MUST store permitted source content in its database for later repository analysis.
- **FR-8.5** The system MUST store the source name, original URL, retrieval time, and applicable reuse notice with each source record.
- **FR-8.6** The system MUST store available vulnerability identifiers, package names, package ecosystems, affected version ranges, fixed versions, and vendor names as separate risk fields.
- **FR-8.7** The system MUST link each extracted risk field to the source record and source revision that supports it.
- **FR-8.8** The system MUST mark missing risk fields as unknown.
- **FR-8.9** The system MUST store company-authorized repository dependency snapshots with the repository identifier, analyzed revision, collection time, package identities, and available versions.
- **FR-8.10** The system MUST make stored risk fields and repository dependency snapshots available to exposure checks.
- **FR-8.11** The system MUST reject a source record when its source identity, original URL, or reuse basis is missing.
- **FR-8.12** The system MUST report the reason for each rejected source record to the admin.
- **FR-8.13** The system MUST NOT create a duplicate source record when it ingests the same source item and revision again.
- **FR-8.14** The system MUST retain a new source revision when an existing source item changes.
- **FR-8.15** The system MUST identify a stored source record as withdrawn when the source reports its withdrawal.
- **FR-8.16** The system MUST report ingestion as successful only after the accepted records are stored in the database.
- **FR-8.17** The system MUST report retrieval, validation, and database write failures to the admin.
- **FR-8.18** The system MUST show the last successful ingestion time for each enabled source.
- **FR-8.19** The system MUST NOT treat a failed ingestion as evidence that no repository risk exists.

### Source Attribution and Content Use

- **FR-9.1** The system MUST include required source credit and reuse notices when it displays or distributes stored source content to authorized users.
- **FR-9.2** The system MUST identify changes to source content when the source license requires a change notice.
- **FR-9.3** The system MUST identify company-written notes as company content.

## Non-Functional Requirements

### Source Access

- **NFR-1.1** The system MUST keep source requests within the provider's published access limits.
- **NFR-1.2** The system MUST obey the provider's stated retry interval after a rate-limit response.

## Open Questions

- **OQ-1** Who selects which imported news items appear in the curated feed? What topic and relevance rules apply?
- **OQ-2** Which additional news publishers with suitable reuse permission are required? Is Okta a required tracked vendor or only an example?
- **OQ-3** Beyond the required source and risk fields, what additional data must be stored? Must the system retain full permitted article text, feed descriptions, or both?
- **OQ-4** What makes an ingested risk item new, and how soon after storage must new or changed risk criteria trigger repository exposure checks?
- **OQ-5** Are GitHub Enterprise Server or repository providers other than GitHub.com required?
- **OQ-6** What extraction and validation rules turn stored source content into testable exposure criteria? Who verifies extracted claims, and which unresolved or invalid fields must prevent a completed check?
- **OQ-7** What information must the admin supply to register a repository? How must the system validate it and respond to invalid, duplicate, or inaccessible repositories?
- **OQ-8** What information must the user supply to register a vendor? How must the system identify the vendor, validate the registration, and respond to invalid, duplicate, or unknown vendors?
- **OQ-9** How must the system verify company access through the web user interface and API? How are user and admin roles assigned? Which permissions does each role have for news sources, repository registrations, repository data, exposure checks, reports, vendor registrations, and alerts?
- **OQ-10** What retrieval schedule, retry schedule, and stale-data labels must apply to each news source? What user notifications must apply when a news source or GitHub access fails?
- **OQ-11** What qualifies as a vendor security incident, and what rules match an incident to a registered vendor? How must uncertain matches and conflicting reports be shown?
- **OQ-12** What information must an alert contain, how must it reach the user, and when must it arrive? What must happen if alert delivery fails or an incident changes?
- **OQ-13** What is a repository risk signal? What news evidence, company data, scope, and format must each report have, and when must the system create or update it? What must reports show when data is missing or a check fails?
- **OQ-14** Which workflows must the web user interface and API each support? What inputs, success responses, validation responses, access-denied responses, and other error responses must each interface provide?
- **OQ-15** Which repository management actions must the admin perform beyond registration? Can other users register or manage repositories? Must users be able to change or remove vendor registrations? What must happen to related checks, reports, and alerts after a registration changes or is removed?
- **OQ-16** What privacy, retention, deletion, or regulatory constraints apply to imported news, repository data, registrations, company-written notes, reports, and alerts?
- **OQ-17** Are background jobs part of the required scope beyond the stated automatic exposure checks?
- **OQ-18** Who reviews changes to source permissions and the approved source list? What must happen to stored content if a source becomes ineligible for further ingestion?
- **OQ-19** Which package ecosystems, branches, and dependency types must exposure checks cover? What evidence must each result include?
- **OQ-20** How will the company authorize GitHub access, and may private dependency names or versions be sent to external lookup services?
- **OQ-21** What rules match news reports to vendor legal entities, subsidiaries, and former names?
- **OQ-22** What rules identify the same source item and revision, and link records from different sources to the same risk item? How must conflicting, corrected, or withdrawn information affect existing checks and alerts?
- **OQ-23** What permitted retrieval method must be used for sources without a verified RSS endpoint? What must happen while an approved source remains inaccessible?
- **OQ-24** Are automatic summaries or translations required? If so, which source permissions cover those transformations and how must changes be labeled?
- **OQ-25** How long must source revisions and repository dependency snapshots be retained? Which stored revision must each analysis result cite?
- **OQ-26** What record validation rules, partial-ingestion behavior, and retry policy must apply after a database write failure?
