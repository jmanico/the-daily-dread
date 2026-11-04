# The Daily Dread Requirements

## Product Scope

- **Purpose:** Give a company a private cybersecurity feed and actionable repository exposure analysis. Rich, evidence-backed vulnerability data is the highest-priority input; news provides additional context.
- **Users:** Company-authorized users and admins. Every admitted user can see all registered repositories' analysis data and reports, regardless of that user's individual GitHub access.
- **Surfaces:** A web application and its private API for authorized users. Public feeds, third-party API integrations, native mobile applications, and native password authentication are outside this release.
- **Repository provider:** GitHub.com only. GitHub Enterprise Server and other repository providers are outside this release.
- **Operation:** Collect enabled sources hourly. New or materially updated news, vulnerability advisories, and vendor incident reports immediately trigger exposure checks. Repository changes alone never trigger checks.
- **Sources:** [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) defines the initial approved catalog and approval policy for sources admins register later. Supported source formats must not require a code release to register another source.
- **Data:** Original source text and structured vulnerability records; source permissions and revisions; ingestion results; vendors, products, aliases, deployments, and owners; repository registrations and analysis snapshots; findings, reports, company notes, user preferences, alerts, delivery attempts, and audit history.
- **Retention:** Stored business records have no automatic expiration. Removal archives registrations and hides their records from the main UI without deleting history.

These requirements incorporate the product interview. Implementation defaults below resolve the remaining details: GitHub App authorization, confidence bands, bounded retries, archive behavior, and validation rules.

## Functional Requirements

### News and Articles

- **FR-1.1** The system MUST automatically curate a private feed focused primarily on major zero-day vulnerabilities and vendor security incidents, without requiring editorial approval.
- **FR-1.2** The system MUST store and display original permitted article and advisory text, including available feed descriptions. When full text is unavailable or not permitted, it MUST retain the permitted description and original link and explain the limitation.
- **FR-1.3** Each item MUST show the source, original publication link, publication time when available, retrieval time, and correction or withdrawal status.
- **FR-1.4** The system MUST favor inclusion when relevance is uncertain, label uncertainty, and explain inclusion. Exploitation evidence, severity, widespread use, and potential company exposure MUST inform relevance; missing severity alone MUST NOT exclude an item.
- **FR-1.5** Feed selection MUST NOT prevent stored vulnerability data from being used for analysis. A vulnerability relevant to a registered repository MUST remain eligible even if it is not a major headline.
- **FR-1.6** Automatic article summaries and translations are outside this release. Source text MUST remain distinct from extracted facts, company notes, and AI analysis or recommendations.

### Risk Information

- **FR-2.1** The system MUST use structured vulnerability data as its primary repository-analysis input and enrich it with permitted news and advisory evidence.
- **FR-2.2** The system MUST ingest only enabled, approved sources from the initial catalog or the admin-managed registry described in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-2.3** The risk feed MUST include reported and suspected vendor security incidents.
- **FR-2.4** Published terms or written permission MUST cover the intended collection, storage, internal display, and analysis. Approval of one collection MUST NOT authorize unrelated material or linked third-party articles.
- **FR-2.5** The initial release MUST support the approved GitHub Advisory Database source alongside existing news sources. Admins MUST be able to register further approved vulnerability databases and vendor advisories.
- **FR-2.6** Risk extraction MUST operate automatically. Structured fields MUST pass schema and ecosystem-specific validation; claims extracted from prose MUST retain supporting passages and be labeled as extracted claims. Human review MUST NOT be required before showing a possible risk.
- **FR-2.7** A definite package-version exposure determination MUST have an unambiguous ecosystem/package identity, usable affected-version criteria, and an observed repository version or revision. Missing, invalid, unsupported, or contradictory criteria MUST yield an incomplete assessment or possible match, never an unsupported definite match or clean result.

### Repository Registration and Exposure Checks

- **FR-3.1** Only admins MUST be allowed to register, edit, pause, resume, or archive repository registrations and configure issue creation.
- **FR-3.2** Durably storing an accepted new risk item or material source revision MUST immediately enqueue checks for active registered repositories. Workers MUST start available work without a scheduled scan window or intentional batching delay. The UI MUST show queued and running work.
- **FR-3.3** The system MUST use a company-installed GitHub App for selected public and private GitHub.com repositories. Admins MUST select a repository accessible to the installation or supply its GitHub.com URL or `owner/name`.
- **FR-3.4** Authorized users MUST be able to view available dependency data and repository analysis evidence, with credentials and detected secrets redacted.
- **FR-3.5** Checks MUST use accessible repository security advisories and Dependabot alerts as evidence and link to the originals. Unavailable features or permissions MUST be reported as coverage gaps.
- **FR-3.6** Each check MUST report coverage and whether it completed, completed with gaps, failed, or remains queued/running. A completed job MUST NOT imply that incomplete evidence proves safety.
- **FR-3.7** GitHub access failures MUST alert admins. Revoked authorization MUST stop new reads/writes and pause affected registrations until an admin restores and validates access. Retained reports MUST show the last successful access time and resulting coverage gap.
- **FR-3.8** Analysis MUST NOT change repository files, branches, settings, or Dependabot states, execute repository code, or apply fixes. Creating/updating the system's own issues under FR-10 is the only permitted analysis-related GitHub write.
- **FR-3.9** A package-version match MUST NOT be reported as proof of exploitation or compromise.
- **FR-3.10** Material source corrections, withdrawals, or exposure-criteria changes MUST trigger fresh assessment of affected findings and repositories. Unchanged re-ingestion MUST NOT start duplicate work.
- **FR-3.11** Each news-triggered check MUST analyze the default branch and every other branch whose tip commit has a committer timestamp within the preceding 30 days at check start. Selected branches, selection time, and immutable commit identifiers MUST be recorded.
- **FR-3.12** Analysis MUST inspect the entire accessible file tree at each selected commit: source code, manifests, lockfiles, configuration, CI workflows, infrastructure/deployment files, and documentation, plus available repository security settings. Skipped, inaccessible, unsupported, oversized, binary, or externally referenced content MUST be disclosed. Submodules MUST require their own authorized access.
- **FR-3.13** Dependency analysis MUST cover direct and available transitive dependencies, runtime/development dependencies, build tools, GitHub Actions, and declared container/infrastructure components. It MUST preserve scope and dependency paths rather than assume every dependency is deployed in production.
- **FR-3.14** Initial package matching MUST cover npm, PyPI, Maven, NuGet, Go, RubyGems, Composer, Cargo, Hex, Pub, Swift, and GitHub Actions. Other components MUST remain eligible for evidence-based possible findings; missing comparators or advisory coverage MUST be labeled as gaps.
- **FR-3.15** Checks MUST use code, configuration, deployment evidence, and advisories to identify protections that may reduce risk. Reports MUST distinguish verified configuration from inferred protection and MUST NOT assume repository configuration proves the live deployment has that protection.
- **FR-3.16** Registration MUST validate GitHub.com identity, installation authorization, and required read access, and retain GitHub's stable repository identifier. Invalid inputs MUST receive field-level errors; inaccessible repositories MUST NOT become active; duplicates MUST return the existing record.
- **FR-3.17** The GitHub App MUST request only permissions needed to read analysis data and, separately, create/update issues when enabled. Missing issue-write permission MUST NOT prevent read-only analysis.
- **FR-3.18** Commits, pushes, pull requests, registration, and schedule ticks MUST NOT independently trigger checks. Registering/resuming a repository MUST show it as awaiting the next news/advisory event. No separate manual scan workflow is included in this release.
- **FR-3.19** Retries/recovery of news-triggered checks MUST preserve the original event identity. Transient failures MUST receive at most three retries after 1, 5, and 15 minutes, subject to provider limits; permanent failures or revoked access MUST await admin resolution. Exhaustion MUST leave a visible failed check and alert admins. These are continuations of that check, not repository-event or periodic scans.
- **FR-3.20** Pausing/archiving a repository MUST stop new analysis and issue writes, cancel queued work, and prevent running work from sending new alerts. Saved results MUST remain in history.

### Findings and Reports

- **FR-4.1** A repository risk signal MUST identify evidence connecting a news/advisory risk to a package, code path, configuration, service, vendor product, or other repository asset. Possible connections MUST be included when evidence is incomplete.
- **FR-4.2** Each finding MUST explain the affected asset; what could go wrong; possible business/technical impact; protections reducing risk; and prioritized suggestions for what to do next. Suggestions MUST include reasoning, prerequisites, and a way to verify the result. Unavailable fixes MUST be stated explicitly.
- **FR-4.3** Findings MUST include a confidence score from 0 to 100, its rationale, and missing/conflicting evidence. High confidence is 80–100, medium 50–79, and low 0–49. Scores are assessments, not calibrated probabilities of compromise. Low confidence alone MUST NOT suppress a possible risk.
- **FR-4.4** Confidence, source severity, business impact, and evidence of active exploitation MUST be separate fields. High severity MUST NOT automatically imply high match confidence.
- **FR-4.5** Findings MUST cite source links and exact stored revisions, repository/branch names, commit identifiers, relevant file/dependency paths, observed versions, matching criteria, analysis time, and analysis/model version where applicable. Missing evidence MUST be identified, not invented.
- **FR-4.6** Reports MUST update as individual checks finish, without waiting for every repository. They MUST show assessment status, stale inputs, excluded branches/components, missing evidence, errors, and the last successful assessment. Failure MUST NOT overwrite a previous finding with a clean result.
- **FR-4.7** Users MUST be able to export PDF, CSV, and JSON reports. Exports MUST preserve confidence, status, evidence references, attribution, and export time; CSV/JSON MUST retain structured finding fields.
- **FR-4.8** The system MUST maintain vendor → product → version or service → deployment → owner relationships where evidence exists. Admins MUST be able to supply company context and notes. Missing deployment/ownership information MUST remain unknown. Company-context edits MUST NOT initiate repository scans.
- **FR-4.9** Corrections MUST update current reports while preserving prior versions, source snapshots, and change reasons. Reports MUST distinguish withdrawn/disproven findings from remediated risks.

### Vendor Registration and Incident Matching

- **FR-5.1** Every new user MUST initially follow all 30 vendors listed below and be able to customize their own watchlist without changing anyone else's preferences.
- **FR-5.2** New and materially changed incidents MUST alert followers according to their communication preferences.
- **FR-5.3** Incidents MUST retain original source links, supporting statements, publication/retrieval times, and confirmed, suspected, disputed, or withdrawn status.
- **FR-5.4** Incidents MUST include reported unauthorized access, stolen/exposed data, ransomware, and suspected attacks. A product vulnerability or ordinary service outage alone MUST NOT be labeled a confirmed vendor breach.
- **FR-5.5** Following a vendor MUST cover its products, former names, and owned companies when supported by a recorded relationship. Each match MUST explain the relationship and evidence. Ambiguous names or ownership MUST lower confidence rather than silently become confirmed matches.
- **FR-5.6** Vendors MUST have stable identifiers, canonical names, official domains, aliases, and dated parent/subsidiary relationships. Matching MUST use relationships applicable to the event where known. Similar names alone MUST NOT merge legal entities.
- **FR-5.7** Users MUST select an existing vendor or propose a new one with a name and official domain. Malformed values MUST receive field-level errors; duplicate follows MUST return the existing subscription. Unknown/ambiguous vendors MUST remain visibly pending until an admin resolves identity, without blocking other subscriptions.
- **FR-5.8** Admins MUST maintain the shared vendor catalog and resolve aliases, merges, and pending identities. Registering a vendor MUST NOT approve its website as an ingestion source.
- **FR-5.9** Unfollowing MUST cancel that user's pending vendor alerts and stop future vendor alerts while retaining history. It MUST NOT erase company findings or disable repository analysis.
- **FR-5.10** Conflicting reports MUST be shown together with evidence and uncertainty. Corrections/retractions MUST update current incidents, reports, alerts, and system-created issues while retaining history.

Initial vendor watchlist: Microsoft, AWS, Google, Oracle, SAP, Salesforce, ServiceNow, IBM, Cisco, Broadcom, Adobe, Workday, Okta, CyberArk, Ping Identity, SailPoint, Palo Alto Networks, Fortinet, CrowdStrike, Zscaler, Cloudflare, F5, Citrix, Ivanti, Atlassian, GitLab, Snowflake, Databricks, Progress Software, and Veeam. These are tracking names; product and ownership relationships require evidence rather than assumptions from this list.

### Web Interface and Private API

- **FR-6.1** The web UI MUST support reading/filtering the feed; viewing source text, evidence, findings, and report history; exporting reports; managing personal watchlists and communication preferences; and viewing alert history.
- **FR-6.2** The private API MUST support the same user/admin workflows, company scope, authorization, validation, and content restrictions as the UI. Public access, independent API keys, and third-party integration credentials are outside this release.
- **FR-6.3** Admin UI/API workflows MUST cover source registration/permission review, repository management, shared vendor catalog, company context, notification connectors, OIDC configuration, ingestion/delivery failures, and archive access.
- **FR-6.4** Create/update requests MUST validate typed fields before mutation. Successful reads/updates MUST return resource identifiers and current state; creates MUST return the resource; queued work MUST return a job identifier/status. Lists MUST support pagination/filtering.
- **FR-6.5** The API MUST use HTTP 200/201 for successful reads/updates and creates, 202 for asynchronous acceptance, 400 for malformed requests, 422 for invalid fields, 401 for missing/invalid authentication, 403 for insufficient role, 404 for unavailable resources, 409 for conflicting edits, 429 for rate limits, and 5xx for service failures. Errors MUST include a stable code, safe explanation, request identifier, and applicable field errors.
- **FR-6.6** Repeated registrations/subscriptions MUST return the existing resource without duplication. The UI MUST explain duplicate, permission, validation, pending, and failed states without exposing credentials or stack traces.
- **FR-6.7** Background jobs MUST handle hourly ingestion, extraction, news-triggered analysis, notifications, corrections, retries, and recovery. Long-running work MUST expose status and survive restarts without duplicate findings or sends.

### Company Access and Roles

- **FR-7.1** Authentication MUST use OIDC through company-configured Google, Okta, Microsoft Entra, or PingOne providers. Local passwords, password recovery, and other native authentication MUST NOT be implemented.
- **FR-7.2** Company content, reports, exports, and API responses MUST NOT be publicly accessible.
- **FR-7.3** Configured OIDC group/role claim mappings MUST grant `DAILY-DREAD-USER` or `DAILY-DREAD-ADMIN`. Admins MUST inherit user permissions; identities with neither role MUST be denied. Configuration MUST specify trusted issuer, client, and claim mapping; email domain alone MUST NOT grant access.
- **FR-7.4** Every admitted user MUST be able to read all active repositories' analysis data, findings, company notes, and reports and export reports. Individual GitHub permissions MUST NOT narrow this company-wide visibility.
- **FR-7.5** Users MUST manage only their own watchlists, notification preferences/destinations, and alert history. Shared source/repository/vendor management, company notes/context changes, OIDC configuration, and notification connector administration MUST require the admin role.
- **FR-7.6** UI/API access MUST require a valid OIDC-derived session or access token issued for this system by a configured provider. ID tokens MUST NOT be accepted as API bearer access tokens. Issuer, audience, signature, expiry, and mapped role MUST be validated.
- **FR-7.7** Browser sign-in MUST use authorization code flow with PKCE and state/nonce validation. Sessions MUST use secure, HTTP-only cookies; cookie-authenticated mutations MUST have CSRF protection. No local password-based emergency account is included.
- **FR-7.8** The initial trusted issuer/admin mapping MUST be provisioned through deployment configuration. Subsequent provider/mapping changes MUST require admins and be audited. Removed roles MUST deny access on the next authorization refresh, at most 15 minutes later.

### Source Registration and Data Ingestion

- **FR-8.1** Admins MUST be able to register, approve, enable, edit, pause, resume, and archive news, vulnerability, and vendor-advisory sources. The initial catalog MUST be seeded from [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-8.2** Source registration MUST record name, canonical collection URL, retrieval endpoint/method, content type, permission evidence URL or written grant, permitted uses/exclusions, attribution, reviewer, and review date. Runtime registrations MUST be stored in the database without requiring document edits.
- **FR-8.3** Activation MUST reject insufficient permission evidence or invalid retrieval configuration. Admins MUST review approvals and changed terms. Newly ineligible sources MUST be paused immediately and alert admins; retained content MUST follow FR-11.
- **FR-8.4** The system MUST retain permitted original content and structured payloads, not just links. Initial retrieval support MUST include RSS/Atom, documented JSON APIs, and explicitly configured permitted HTML article retrieval. Unsupported formats MUST remain inactive with an explanation; a new format MAY require an adapter.
- **FR-8.5** Source records MUST retain source identity, canonical original URL, supplied publication/update times, retrieval time, permission evidence/version, and attribution/reuse notices.
- **FR-8.6** Risk fields MUST preserve available vulnerability identifiers; ecosystem/package identity; affected/fixed versions; vulnerable functions; products/services; severity scores/vectors and versions; weaknesses; exploit/zero-day evidence; attack conditions; impacts; mitigations/workarounds; vendors; references; and publication/modification/withdrawal times. Missing fields MUST NOT be invented.
- **FR-8.7** Extracted fields MUST link to their exact source revision, extraction method/version, and evidence location. Conflicting values MUST retain provenance rather than be silently overwritten.
- **FR-8.8** Missing fields MUST be unknown. Unsupported ranges, ambiguous packages, invalid severity values, and uncertain extraction MUST be unusable for definite determinations but visible as evidence gaps.
- **FR-8.9** Repository snapshots MUST retain identity, branches, immutable commits, collection time, dependencies/versions/scopes, relevant redacted analysis evidence, and coverage gaps. Results MUST cite the exact snapshots/source revisions used, not silently point to newer versions.
- **FR-8.10** Matching MUST use stored data inside the company's system. Private package names, versions, repository identifiers, or code MUST NOT be sent to external vulnerability lookup services.
- **FR-8.11** Records missing source identity, canonical URL, permission basis, or a safely parseable payload MUST be rejected/quarantined. Missing optional risk fields alone MUST NOT cause rejection.
- **FR-8.12** Rejected/quarantined records MUST have safe admin-visible reasons and retryability status. A bad item MUST NOT block storage/processing of other valid items.
- **FR-8.13** Item identity MUST use a stable publisher identifier where available, otherwise the canonical original URL within that source. Revision identity MUST combine item identity with a hash of normalized source content. Retrieval-time changes alone MUST NOT create revisions.
- **FR-8.14** Changed content MUST create immutable revisions. New risk events MUST mean a first accepted risk item or revision changing affected assets/versions, severity, exploitation evidence, incident status, mitigations, or other exposure criteria. Formatting-only changes MUST NOT trigger analysis.
- **FR-8.15** Withdrawals/corrections MUST remain recorded and trigger reassessment/correction delivery for affected findings. Disappearance from a feed MUST NOT imply retraction or safety.
- **FR-8.16** Accepted records, revision identities, and pending analysis events MUST be durably committed before success is reported. Partial runs MUST separately report stored/rejected/failed counts. Failed writes MUST NOT advance the affected retrieval checkpoint or publish events for unsaved data.
- **FR-8.17** Retrieval, validation, and storage failures MUST appear in the admin dashboard immediately. Source failure notifications/pauses MUST follow FR-8.20; exhausted storage retries MUST also alert admins.
- **FR-8.18** Sources MUST show last attempt, last successful retrieval/storage, latest publisher timestamp when available, next attempt, and active/retrying/degraded/paused status. Overdue collection or partial failures MUST mark freshness stale/degraded without implying an infrequent publisher must publish hourly.
- **FR-8.19** Failed ingestion, stale data, missing repository access, or absent evidence MUST NOT imply no risk exists.
- **FR-8.20** Enabled sources MUST be polled hourly. Failed collection MUST retry the next hour. After failures span 24 hours from the first failure without successful recovery, the system MUST alert admins and pause the source until an admin re-enables it. Recovery MUST reset the failure window. Provider retry instructions override earlier scheduled attempts.
- **FR-8.21** Database writes MUST receive at most three retries after the initial attempt, after 1, 5, and 15 minutes, unless errors are permanent. Retries MUST reuse item/revision identities and preserve committed records. Exhausted records MUST remain visibly failed and eligible for the next permitted ingestion or admin retry without duplicate events.
- **FR-8.22** Cross-source records MUST link through explicit shared vulnerability identifiers or corroborated vendor/incident/product evidence. Title similarity alone MUST NOT merge risks. Canonical risks MUST retain supporting and conflicting records.
- **FR-8.23** Sources without accessible RSS MUST use a documented API or approved collection-specific HTML retrieval if available. Unsupported/inaccessible sources MUST show failure and follow the hourly retry/pause policy, without bypassing controls or silently substituting an unapproved source.
- **FR-8.24** Ingestion MUST support deduplication, pagination/checkpoints, conditional retrieval where available, and recoverable jobs. Successful empty/unchanged responses MUST be distinguished from retrieval/parsing failures.

### Source Attribution and Content Use

- **FR-9.1** Displays, exports, alerts, and issues reproducing source material MUST carry required credit, original links, and reuse notices.
- **FR-9.2** Extraction, redaction, or other changes MUST be identified where permissions require it. Original text MUST be preserved separately from analysis.
- **FR-9.3** Company notes and AI recommendations MUST be labeled separately from publisher statements.
- **FR-9.4** Images, logos, audio, video, separately restricted material, and linked third-party content MUST NOT be ingested under text-only approval. External content MUST be treated as untrusted data, not instructions to the app or AI.

### Alerts and GitHub Issues

- **FR-10.1** Notifications MUST support email, SMS/text, Signal, WhatsApp, and Slack through company-configured connectors. Repository findings MUST create GitHub issues when admins enable this and the installation has permission.
- **FR-10.2** Users MUST configure channels, validated destinations, fallback order, and routing by event type, severity, confidence, vendor, or repository. Alerts MUST appear in the app; external delivery MUST follow preferences without assuming an unconfigured channel is authorized.
- **FR-10.3** Alerts MUST identify vendor/asset, event/finding, suspected harm, impact/severity, confidence, status, next steps, source links, and an authenticated report link. External messages MUST minimize private details and link to full internal evidence.
- **FR-10.4** Findings, incidents, and material corrections MUST enqueue alerts as soon as available, without intentional batching. Pending, delivered/accepted, failed, and retrying states MUST be visible. Provider acceptance MUST NOT be described as human readership.
- **FR-10.5** Delivery MUST try the requested channel and at most three retries after 1, 5, and 15 minutes, respecting longer provider intervals. Permanent failures MUST skip futile retries. Exhaustion MUST try up to two user-enabled fallback channels in configured order with the same bound, then alert admins and record final failure.
- **FR-10.6** Delivery MUST deduplicate by recipient/event revision/channel and retain provider message IDs. Unknown send outcomes MUST be reconciled or marked uncertain rather than blindly duplicated. Failure notifications MUST NOT recursively generate unlimited notifications.
- **FR-10.7** Admin operational alerts MUST appear in the dashboard and use configured admin channels. Failure of those channels MUST remain visible without claiming external delivery succeeded.
- **FR-10.8** The system MUST maintain one issue per repository/canonical risk, combining branches. It MUST update its own content or add correction comments, link to the internal report, and preserve human comments. It MUST NOT duplicate issues per subscriber/branch or automatically reopen human-closed issues.
- **FR-10.9** Corrections/retractions MUST update in-app alerts and system-created issues and send labeled corrections through currently permitted channels to users who received the original. Previously sent emails/texts MUST NOT be assumed editable. Suppressed or impossible delivery MUST remain visible.
- **FR-10.10** Public issues MUST contain only public source information and public repository evidence. Private company analysis, deployment details, credentials, or private code MUST NOT be published. Missing issue permission MUST be shown and reported to admins without blocking other channels.

### Retention and Archiving

- **FR-11.1** Stored source revisions, permissions, repository analysis/dependency snapshots, registrations, vendor relationships, notes, findings, report versions, alerts, delivery records, and audit history MUST have no automatic expiration.
- **FR-11.2** Removing a repository, source, or shared vendor registration MUST archive it, stop its future work, and hide it and records supported only by that registration from active lists, default search, and main dashboards. Findings still supported by other active registrations MUST remain visible with their provenance. Explicit admin archive views/exports MUST retain access to history subject to content restrictions.
- **FR-11.3** Source ineligibility MUST stop new collection but retain previously collected material and collection-time permission evidence. Further display/export/analysis MUST be restricted if applicable permissions require it; retention itself MUST NOT grant further use rights.
- **FR-11.4** Restoring sources/repositories MUST require admin validation of current permissions/connectivity. It MUST NOT erase past failures, restore obsolete subscriptions automatically, or trigger a repository scan without a new news/advisory event.
- **FR-11.5** Permanent user-facing deletion and automatic retention cleanup are outside this release. Credentials, access tokens, transient raw processing copies, and detected secret values MUST NOT be permanent business records. Evidence MUST retain redacted secret locations, not secret contents.
- **FR-11.6** Company access, source-use conditions, and the privacy rules below MUST apply. No industry-specific compliance certification or additional regulatory workflow is claimed by this release.

### AI Analysis and Private Repository Data

- **FR-12.1** Repository inspection, sensitive-data detection, and preparation of AI input MUST occur inside the company's system before external AI processing.
- **FR-12.2** External AI input MUST contain only essential de-identified facts or redacted snippets. Credentials, secrets, company/repository identities, internal URLs/hosts, personal data, private package names/versions, and unnecessary proprietary code MUST be excluded. Raw private files and complete repository trees MUST NOT be sent.
- **FR-12.3** Private identifiers MUST use placeholders whose mappings stay local. Outgoing payloads MUST be validated; data that cannot be safely reduced MUST stay local. Removing only a repository name MUST NOT count as sufficient anonymization.
- **FR-12.4** When safe input is insufficient, the system MUST give the best locally supported assessment, explain limitations, lower confidence as warranted, and suggest what to verify next. It MUST NOT relax egress restrictions to improve confidence.
- **FR-12.5** AI recommendations MUST cite evidence, distinguish facts/inferences, and remain advisory. AI MUST NOT change permissions, enable sources, execute repository instructions, or apply remediation.
- **FR-12.6** AI processing of source text MUST stay within approved uses, including any permission needed for third-party processing. Internal-use permission alone MUST NOT authorize external processing of publisher content.

## Non-Functional Requirements

### Source Access and Reliability

- **NFR-1.1** Requests to sources, GitHub, and delivery services MUST stay within published limits and authorized methods.
- **NFR-1.2** Provider retry instructions MUST override local schedules; rate limits MUST NOT cause bypasses or unlimited retries.
- **NFR-1.3** Jobs MUST persist status and recover after restarts. Transactional event recording or equivalent MUST prevent committed risk records from losing their analysis trigger.
- **NFR-1.4** Queue delays, progress, failures, and last-success timestamps MUST be visible. Immediate triggering MUST NOT be described as instantaneous completion, nor hourly polling as instantaneous discovery.

### Data Protection and Auditability

- **NFR-2.1** Company data MUST be protected in transit and at rest. Provider credentials and OIDC client secrets MUST use restricted secret storage and MUST NOT appear in logs, reports, exports, source records, or AI payloads.
- **NFR-2.2** Source/repository registration, permission/role changes, archive/restore actions, issue writes, exports, and delivery failures MUST record actor/service, time, affected record, outcome, and safe reason in an audit trail.
- **NFR-2.3** Retrieval URLs MUST be limited to authorized source endpoints. Fetches/redirects to local, private-network, metadata-service, or otherwise unapproved endpoints MUST be blocked. Imported content MUST render without executing active content.
- **NFR-2.4** Exports and notifications MUST preserve authorization/redaction rules. CSV exports MUST neutralize formulas in untrusted values; errors and observability data MUST NOT expose sensitive inputs.
