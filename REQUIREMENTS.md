## Required Requirement Inputs

- Project purpose: Provide a company with a private internal feed of ingested cybersecurity news, articles, and reported vendor incidents, plus repository exposure checks, reports, and alerts.
- Users and actors: Users of the system; an admin who manages data feeds and repositories and is likely the company's cybersecurity lead.
- Core workflows: Ingest permitted news text; read news and articles; manage news sources and repositories as an admin; register repositories; automatically check repository exposure to new risk items; view risk reports; register vendors of interest; receive alerts about vendor security incidents.
- Data entities: News items, source links, source permissions, retrieval status, company-written notes, risk items, repositories, repository registrations, third-party vendors, vendor registrations, risk signals, exposure reports, and alerts.
- External integrations: Ingest eligible news text only from the approved sources in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md), under the conditions recorded for each source. GitHub.com repository access is a separate company-authorized integration for exposure checks, not a news source.
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
- **FR-2.2** The system MUST ingest eligible news text from enabled sources listed in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) into the internal risk feed.
- **FR-2.3** The system MUST include reported vendor security incidents from the approved news sources in the risk feed.
- **FR-2.4** The system MUST NOT ingest external vulnerability databases, exploit scores, incident datasets, or regulatory filings as news sources.

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

### News Ingestion and Reuse

- **FR-8.1** The system MUST let the admin enable a news source listed in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-8.2** The system MUST let the admin disable ingestion from a news source.
- **FR-8.3** The system MUST reject source activation when the source is not in the approved source list.
- **FR-8.4** The system MUST retain the source name, original URL, and applicable reuse notice with each imported item.
- **FR-8.5** The system MUST include required source credit and reuse notices when it displays or distributes imported text to authorized users.
- **FR-8.6** The system MUST identify changes to imported text when the source license requires a change notice.
- **FR-8.7** The system MUST exclude content with a separate rights notice that does not permit the intended internal use.
- **FR-8.8** The system MUST NOT import images, logos, video, audio, or separately credited third-party text under a publisher's general text permission.
- **FR-8.9** The system MUST NOT fetch content from third-party links in an imported article unless that source is also approved for ingestion.
- **FR-8.10** The system MUST show the last successful retrieval time for each enabled source.
- **FR-8.11** The system MUST show a retrieval error to the admin when a source cannot be read.
- **FR-8.12** The system MUST NOT report a failed retrieval as an absence of new risk information.
- **FR-8.13** The system MUST reject a news item when its required source identity, original URL, or reuse basis is missing.
- **FR-8.14** The system MUST identify company-written notes as company content.
- **FR-8.15** The system MUST NOT publish ingested news content, reports, or alerts to the public.

## Non-Functional Requirements

### Source Access

- **NFR-1.1** The system MUST keep source requests within the provider's published access limits.
- **NFR-1.2** The system MUST obey the provider's stated retry interval after a rate-limit response.

## Open Questions

- **OQ-1** Who selects which imported news items appear in the curated feed? What topic and relevance rules apply?
- **OQ-2** Which additional news publishers with suitable reuse permission are required? Is Okta a required tracked vendor or only an example?
- **OQ-3** Beyond source identity, original URL, and reuse notices, what fields must each news item contain? Must the system retain full permitted article text, feed descriptions, or both?
- **OQ-4** What makes a risk item new, and when must it trigger a repository exposure check?
- **OQ-5** Are GitHub Enterprise Server or repository providers other than GitHub.com required?
- **OQ-6** How must news reports become testable exposure criteria? Who verifies extracted package names, affected versions, and other claims when structured vulnerability feeds are excluded?
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
- **OQ-22** What rules identify imported articles that refer to the same risk item? How must corrected or withdrawn information affect existing checks and alerts?
- **OQ-23** What permitted retrieval method must be used for sources without a verified RSS endpoint? What must happen while an approved source remains inaccessible?
- **OQ-24** Are automatic summaries or translations required? If so, which source permissions cover those transformations and how must changes be labeled?
