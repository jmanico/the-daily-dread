## Required Requirement Inputs

- Project purpose: Provide a curated cybersecurity news feed, risk data, repository exposure checks, reports, and alerts about third-party vendors.
- Users and actors: A user who registers repositories and third-party vendors; other actors UNKNOWN.
- Core workflows: Read news and articles; receive risk data; register repositories; automatically check repository exposure to new risk items; view risk reports; register vendors of interest; receive alerts about vendor security incidents.
- Data entities: News items, articles, risk items, repositories, repository registrations, third-party vendors, vendor registrations, risk signals, exposure reports, and alerts.
- External integrations: Include https://radar.cloudflare.com/security/zero-wire in the risk data feed; other risk and vendor incident data sources UNKNOWN; repository integration UNKNOWN; GitHub integration UNKNOWN.
- Authentication and roles: UNKNOWN.
- Regulatory or privacy constraints: UNKNOWN.
- Target surfaces: Web user interface and API only; mobile excluded from the current scope; automatic exposure checks required; background jobs UNKNOWN.

## Functional Requirements

### News and Articles

- **FR-1.1** The system MUST provide a curated feed of cybersecurity news to the user.
- **FR-1.2** The system MUST include cybersecurity articles in the news feed.

### Risk Data

- **FR-2.1** The system MUST provide a feed of cybersecurity risk data to the user.
- **FR-2.2** The system MUST include risk data from https://radar.cloudflare.com/security/zero-wire in the risk data feed.
- **FR-2.3** The system MUST include data about security incidents at third-party vendors in the risk data feed.

### Repository Registration and Exposure Checks

- **FR-3.1** The system MUST let the user register repositories for exposure checks.
- **FR-3.2** The system MUST automatically check registered repositories for exposure to each new risk item.

### Reports

- **FR-4.1** The system MUST provide reports that show risk signals in repositories.
- **FR-4.2** The system MUST provide reports that show risk exposure.

### Vendor Registration and Alerts

- **FR-5.1** The system MUST let the user register third-party vendors of interest.
- **FR-5.2** The system MUST send the user an alert about a security incident at a vendor that the user registered.

### User Interfaces

- **FR-6.1** The system MUST provide a web user interface.
- **FR-6.2** The system MUST provide an API.
- **FR-6.3** The system MUST NOT provide a mobile application in the current scope.

## Non-Functional Requirements

None stated

## Open Questions

- **OQ-1** Who selects the news and articles, and what rules determine which items enter the curated feed?
- **OQ-2** Which data sources supply news, articles, risk items, and vendor incidents in addition to the specified Cloudflare source? Is Okta a required vendor or only an example?
- **OQ-3** Which data must each feed item contain? Must the system show full content, summaries, links, or a combination of these?
- **OQ-4** What makes a risk item new, and when must the system obtain new data and check registered repositories?
- **OQ-5** Which repository providers must the system support? Must it support GitHub, and must it support public repositories, private repositories, or both?
- **OQ-6** What repository data must the system check, and what criteria determine exposure to a risk item? What results and evidence must an exposure check provide to the user?
- **OQ-7** What information must the user supply to register a repository? How must the system validate it and respond to invalid, duplicate, or inaccessible repositories?
- **OQ-8** What information must the user supply to register a vendor? How must the system identify the vendor, validate the registration, and respond to invalid, duplicate, or unknown vendors?
- **OQ-9** Must users authenticate? Which roles and access rules apply to feeds, repository registrations, repository data, exposure checks, reports, vendor registrations, and alerts?
- **OQ-10** What must the system do when a data source is unavailable, source data is invalid, repository access fails, or an exposure check cannot finish? What response must the user receive for each failure?
- **OQ-11** What qualifies as a vendor security incident, and what rules match an incident to a registered vendor?
- **OQ-12** What information must an alert contain, how must it reach the user, and when must it arrive? What must happen if alert delivery fails or an incident changes?
- **OQ-13** What is a repository risk signal? What data, scope, and format must each report have, and when must the system create or update it? What must reports show when data is missing or a check fails?
- **OQ-14** Which workflows must the web user interface and API each support? What inputs, success responses, validation responses, access-denied responses, and other error responses must each interface provide?
- **OQ-15** Must users be able to change or remove repository and vendor registrations? If so, what must happen to related checks, reports, and alerts?
- **OQ-16** What privacy, retention, deletion, or regulatory constraints apply to repository data, registrations, reports, and alerts?
- **OQ-17** Are background jobs part of the required scope beyond the stated automatic exposure checks?
