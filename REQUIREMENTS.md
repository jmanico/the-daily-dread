## Required Requirement Inputs

- Project purpose: Provide a private company with a curated feed of links to cybersecurity news, articles, risk information, and vendor incidents, plus repository exposure checks, reports, and alerts; the feed is not public.
- Users and actors: Users of the system; an admin who manages data feeds and repositories and is likely the company's cybersecurity lead.
- Core workflows: Follow links to news, articles, and risk information; manage source links and repositories as an admin; register repositories; automatically check repository exposure to new risk items; view risk reports; register vendors of interest; receive alerts about vendor security incidents.
- Data entities: Source links, company-written notes, risk items, repositories, repository registrations, third-party vendors, vendor registrations, risk signals, exposure reports, and alerts.
- External integrations: Link to Cloudflare Zero Wire, The Register, CISA KEV, CVE records, GitHub advisories, FIRST EPSS, VERIS incident records, SEC EDGAR filings, CERT-EU publications, OSV records, NVD records, and official vendor notices; do not copy their feeds or content. GitHub.com repository access is required for company-authorized exposure checks. See [data source research](docs/DATA_SOURCES.md) for source roles, terms, limitations, and evidence.
- Authentication and roles: System user and admin roles; the admin manages data feeds and repositories; authentication method and detailed access rules UNKNOWN.
- Regulatory or privacy constraints: External publisher content stays at the source; private repository data requires company authorization; other regulatory, privacy, and retention constraints UNKNOWN.
- Target surfaces: Web user interface and API only; mobile excluded from the current scope; automatic exposure checks required; background jobs UNKNOWN.

## Functional Requirements

### News and Articles

- **FR-1.1** The system MUST provide a curated feed of links to cybersecurity news to the user.
- **FR-1.2** The system MUST include links to cybersecurity articles in the news feed.
- **FR-1.3** The system MUST support links to CERT-EU cybersecurity publications.
- **FR-1.4** The system MUST support links to The Register cybersecurity articles.

### Risk Information

- **FR-2.1** The system MUST provide a feed of links to cybersecurity risk information to the user.
- **FR-2.2** The system MUST include links to risk information published at https://radar.cloudflare.com/security/zero-wire in the risk feed.
- **FR-2.3** The system MUST include links to reports of security incidents at third-party vendors in the risk feed.
- **FR-2.4** The system MUST support links to CISA KEV entries for vulnerabilities with known exploitation.
- **FR-2.5** The system MUST support links to CVE records for vulnerability identification.
- **FR-2.6** The system MUST support links to GitHub Advisory Database records for package vulnerability information.
- **FR-2.7** The system MUST support links to FIRST EPSS information for estimates of exploitation likelihood.
- **FR-2.8** The system MUST support links to VERIS Community Database incident records.
- **FR-2.9** The system MUST support links to SEC EDGAR Form 8-K Item 1.05 disclosures for reported vendor incidents.
- **FR-2.10** The system MUST support links to OSV vulnerability records.
- **FR-2.11** The system MUST support links to NVD vulnerability records.
- **FR-2.12** The system MUST support links to official vendor security notices.

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
- **FR-6.3** The system MUST NOT provide a mobile application in the current scope.

### Company Access

- **FR-7.1** The system MUST restrict access to users authorized by the company.
- **FR-7.2** The system MUST NOT provide its feeds to the public.

### Source Links and Publisher Content

- **FR-8.1** The system MUST let the admin add a source link to the feed.
- **FR-8.2** The system MUST let the admin remove a source link from the feed.
- **FR-8.3** The system MUST show the source name with each external link.
- **FR-8.4** The system MUST direct the user to the source website when the user selects an external link.
- **FR-8.5** The system MUST let the admin attach a company-written note to a link.
- **FR-8.6** The system MUST identify company-written notes as company content.
- **FR-8.7** The system MUST NOT copy external publisher articles, feed bodies, or datasets into the system.
- **FR-8.8** The system MUST NOT fetch publisher content to create previews, excerpts, or summaries.
- **FR-8.9** The system MUST NOT embed external publisher content in the web user interface.
- **FR-8.10** The system MUST NOT include copied publisher content in API responses, reports, or alerts.

## Non-Functional Requirements

None stated

## Open Questions

- **OQ-1** Who selects individual news and article links? Must the system discover new links automatically, and what permitted discovery method would supply them without copying feeds or publisher content?
- **OQ-2** Which additional publishers and vendor notice pages are required? Is Okta a required vendor or only an example?
- **OQ-3** Beyond the source name, URL, and company-written note, what information must a link entry contain?
- **OQ-4** What makes a risk item new, and when must it trigger a repository exposure check?
- **OQ-5** Are GitHub Enterprise Server or repository providers other than GitHub.com required?
- **OQ-6** What company-provided risk data will enable automatic exposure checks when external feeds are not copied? Who supplies affected package names, versions, and other exposure criteria?
- **OQ-7** What information must the admin supply to register a repository? How must the system validate it and respond to invalid, duplicate, or inaccessible repositories?
- **OQ-8** What information must the user supply to register a vendor? How must the system identify the vendor, validate the registration, and respond to invalid, duplicate, or unknown vendors?
- **OQ-9** How must the system verify company access through the web user interface and API? How are user and admin roles assigned? Which permissions does each role have for source links, repository registrations, repository data, exposure checks, reports, vendor registrations, and alerts?
- **OQ-10** What retry schedule and user notification must apply when GitHub access fails or an exposure check cannot finish? What must happen when an external link is invalid, changes, or becomes unavailable?
- **OQ-11** What qualifies as a vendor security incident, and what rules match an incident to a registered vendor? How must uncertain matches and conflicting reports be shown?
- **OQ-12** What information must an alert contain, how must it reach the user, and when must it arrive? What must happen if alert delivery fails or an incident changes?
- **OQ-13** What is a repository risk signal? What company data, scope, and format must each report have, and when must the system create or update it? What must reports show when data is missing or a check fails?
- **OQ-14** Which workflows must the web user interface and API each support? What inputs, success responses, validation responses, access-denied responses, and other error responses must each interface provide?
- **OQ-15** Which repository management actions must the admin perform beyond registration? Can other users register or manage repositories? Must users be able to change or remove vendor registrations? What must happen to related checks, reports, and alerts after a registration changes or is removed?
- **OQ-16** What privacy, retention, deletion, or regulatory constraints apply to repository data, registrations, company-written notes, reports, and alerts?
- **OQ-17** Are background jobs part of the required scope beyond the stated automatic exposure checks?
- **OQ-18** What validation and failure responses apply when the admin adds or removes a link? Which URL schemes and destinations are permitted, and how must duplicate links be handled?
- **OQ-19** Which package ecosystems, branches, and dependency types must exposure checks cover? What evidence must each result include?
- **OQ-20** How will the company authorize GitHub access, and may private dependency names or versions be sent to external lookup services?
- **OQ-21** What rules match vendors to legal entities, subsidiaries, former names, and SEC CIK identifiers?
- **OQ-22** What rules identify links that refer to the same risk item? How must corrected or withdrawn information affect existing checks and alerts?
