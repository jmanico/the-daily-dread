# The Daily Dread Requirements

This file owns observable product behavior, including validation, authorization, and failures. [DESIGN.md](DESIGN.md) owns presentation; [ARCHITECTURE.md](ARCHITECTURE.md) owns structure and stack; [SECURITY.md](SECURITY.md) owns controls; [SECURITY_EVENTS.md](SECURITY_EVENTS.md) owns event definitions; [AGENTS.md](AGENTS.md) owns working rules and checks. Relocated IDs below are references, not additional definitions.

## Product Scope

- **Purpose:** Give a company a private cybersecurity feed and actionable repository exposure analysis. Rich, evidence-backed vulnerability data is the highest-priority input; news provides additional context.
- **Installation and capacity:** See NFR-4.1–NFR-4.3.
- **Users and access:** See FR-7.1–FR-7.9.
- **Surfaces:** A web application and its private API for authorized users. Public feeds, third-party API integrations, native mobile applications, and native password authentication are outside this release.
- **Repository provider:** GitHub.com only. GitHub Enterprise Server and other repository providers are outside this release.
- **Operation:** See FR-3.2, FR-3.10, FR-3.18 and FR-8.20 for triggers and collection timing.
- **Sources:** [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) defines the initial approved catalog and approval policy; registration behavior is in FR-8.
- **Data ownership:** See the [architecture component map](ARCHITECTURE.md#components-and-flows).
- **Retention:** See FR-11.

The project is licensed under the [MIT License](LICENSE); font licenses are specified in [DESIGN.md](DESIGN.md#typography), and source-use conditions in FR-2.4 and FR-9.

## Active delivery profile — local workstation

The project lead selected **LOCAL-1** on 2026-11-05: run on Jim Manico's Mac without hosting. [The selected profile](docs/decisions/LOCAL_WORKSTATION.md) resolves installation choices and records their limits. This profile is the current build target; the company-server requirements below remain the separate hosted/enterprise profile, not prerequisites for absent local features.

- **LOCAL-1** The app MUST bind only `127.0.0.1:4173`, serve one local workspace/operator, and require local launch authorization before private access. No public/LAN endpoint, tunnel, cloud host or domain is required. SEC-2 defines the explicit local identity profile; it replaces OIDC-only admission for this profile while retaining server-side scope, revision, expiry, revocation and fresh-action authorization.
- **LOCAL-2** Runtime data MUST stay in owner-only, encrypted local storage outside the source checkout/synchronized folders. Existing PostgreSQL, retention, audit, jobs and restore-quarantine controls remain applicable. Backup/restore instructions and actual recovery evidence are required; no host-loss alert or recovery-time promise is inferred.
- **LOCAL-3** Public feed collection/history, search, notes/preferences and locally supported analysis MUST operate with external AI, messaging and GitHub repository connectors disabled. Enabling an optional integration requires its own credentials, policies and tests; no ambient credential discovery. Repository findings remain explicit samples until actual authorized analysis exists.
- **LOCAL-4** Local acceptance MUST cover one operator, eight browser connections and one running repository check, measuring bounded overload/recovery on the actual Mac/runtime. NFR-4.2's 1,000-repository/100-user target applies to the separate company-server profile. No existing check is weakened; absent-profile checks remain separate from required active-feature checks. Existing browser/theme/PDF rules apply to implemented outputs.

FR-7.1/7.3/7.6–7.9 and NFR-4.1–4.3 are interpreted through this explicit profile only where identity, operator ownership, origin and capacity differ. The original Google/OIDC, remote administration, AI and delivery requirements remain optional future work rather than being declared implemented. Local private activation remains blocked until LOCAL-1's real enforcement tests and the applicable SEC-10 gates pass.

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
- **FR-2.5** The initial release MUST support the approved GitHub Advisory Database source alongside existing news sources, including reviewed, unreviewed and malware records with withdrawal reconciliation. Admins MUST be able to register further approved vulnerability databases and vendor advisories.
- **FR-2.6** Risk extraction MUST operate automatically. Structured fields MUST pass schema and ecosystem-specific validation; claims extracted from prose MUST retain supporting passages and be labeled as extracted claims. Human review MUST NOT be required before showing a possible risk.
- **FR-2.7** A definite package-version exposure determination MUST have an unambiguous ecosystem/package identity, usable affected-version criteria, and an observed repository version or revision. Missing, invalid, unsupported, or contradictory criteria MUST yield an incomplete assessment or possible match, never an unsupported definite match or clean result.

### Repository Registration and Exposure Checks

- **FR-3.1** Only admins MUST be allowed to register, edit, pause, resume, or archive repository registrations and configure issue creation.
- **FR-3.2** Durably storing an accepted new risk item or material source revision MUST immediately enqueue checks for active registered repositories. Workers MUST start available work as soon as an execution slot is free, without a scheduled scan window or intentional batching delay; immediate enqueueing MUST NOT mean unlimited parallel checks. The UI MUST show queued and running work.
- **FR-3.3** The system MUST use a company-installed GitHub App for selected public and private GitHub.com repositories. Admins MUST select a repository accessible to the installation or supply its GitHub.com URL or `owner/name`.
- **FR-3.4** Authorized users MUST be able to view available dependency data and repository analysis evidence, with credentials and detected secrets redacted.
- **FR-3.5** Checks MUST use accessible repository security advisories and Dependabot alerts as evidence and link to the originals. Unavailable features or permissions MUST be reported as coverage gaps.
- **FR-3.6** Each check MUST report coverage and whether it completed, completed with gaps, failed, was canceled, or remains queued/running. A completed job MUST NOT imply that incomplete evidence proves safety.
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
- **FR-3.17** Missing issue-write permission MUST NOT prevent read-only analysis. GitHub App permission controls are in [SECURITY.md](SECURITY.md#sec-5--repository-inspection-and-resource-budgets).
- **FR-3.18** Commits, pushes, pull requests, registration, schedule ticks, and delivery outcomes MUST NOT independently trigger checks. Registering/resuming a repository MUST show it as awaiting the next news/advisory event. No separate manual scan workflow is included in this release.
- **FR-3.19** Retries/recovery of news-triggered checks MUST preserve the original event identity. Transient failures MUST receive at most three retries after 1, 5, and 15 minutes, subject to provider limits; permanent failures or revoked access MUST await admin resolution. Exhaustion MUST leave a visible failed check and alert admins. These are continuations of that check, not repository-event or periodic scans.
- **FR-3.20** Pausing/archiving a repository MUST stop new analysis and issue writes, cancel queued work, and prevent running work from sending new alerts. Saved results MUST remain in history.
- **FR-3.21** Repository checks MUST default to one running check at a time across the installation. Only admins MUST be allowed to increase concurrency. Restarts MUST preserve jobs, attempts, progress, and original risk-event identity. Queue structure is in [ARCHITECTURE.md](ARCHITECTURE.md#queue-contract); resource enforcement is in [SECURITY.md](SECURITY.md#sec-5--repository-inspection-and-resource-budgets).
- **FR-3.22** Each repository page MUST show that repository's queued/running/completed/completed-with-gaps/failed/canceled state, its queue position where applicable, and progress for its originating risk-event batch. For the default sequential queue, a running check may say “Analyzing repository 45 of 734.” The denominator MUST identify the eligible repositories queued for that event; completed, completed-with-gaps, failed, canceled, waiting and running counts MUST remain distinct. The initial batch count MUST include later canceled entries; newly registered/resumed repositories wait for the next qualifying event. Retries MUST NOT inflate the repository count. With multiple workers, the UI MUST show running and finished counts rather than imply that a sequence number proves completion.
- **FR-3.23** **Scheduling behavior:** Due checks MUST be selected in stable enqueue order; delayed retries MUST NOT block unrelated ready work. Provider-imposed waits MUST release the execution slot. Decreasing concurrency MUST stop new claims until running work falls below the limit; increasing it MUST NOT trigger a scan.

### Ecosystem matching contract

FR-3.14 uses the following evidence and comparison semantics. Syntax readers and selected comparators are described in [ARCHITECTURE.md](ARCHITECTURE.md#local-inspection-and-integration-contracts); execution and parser controls are in [SEC-5](SECURITY.md#sec-5--repository-inspection-and-resource-budgets). This is required coverage, not a claim of implemented parsers.

| Ecosystem | Evidence read locally | Comparison contract |
| --- | --- | --- |
| npm | JSON/YAML manifests and locks; dependency paths and scopes | npm SemVer, with actual resolved versions and npm identity normalization |
| PyPI | TOML and pinned requirement/lock records; environment markers retained | PEP 440; marker uncertainty must remain visible |
| Maven | XML declarations and available resolved dependency evidence | Maven coordinate identity and Maven version/range ordering; unresolved properties/BOM inheritance are gaps |
| NuGet | XML declarations and JSON resolved assets/locks | NuGet normalization, four-part versions and prerelease/range semantics; never blindly apply npm rules |
| Go | Module/sum/workspace records and replacement declarations | Go module path/major identity, pseudo-versions and replacements; a checksum record alone does not prove a selected dependency |
| RubyGems | Resolved gem lock records; static declarations where readable | RubyGems version and requirement semantics |
| Composer | JSON manifests and resolved locks | Composer normalized versions, stability, aliases and branch references |
| Cargo | TOML manifests and locks | Cargo ranges, prerelease behavior and resolved registry/Git identity |
| Hex | Static lock/dependency records | Hex/Elixir version requirements and resolved package identity; unsupported expressions remain gaps |
| Pub | YAML manifests and locks | Pub ranges, prerelease behavior and hosted/Git/path source identity |
| Swift | Resolved JSON pins and statically readable declarations | Swift package URL/identity, semantic versions and immutable Git revisions |
| GitHub Actions | Workflow/action YAML and pinned references | Action repository plus immutable commit/tag resolution where authorized; a mutable tag is not a proven immutable version |

### Findings and Reports

- **FR-4.1** A repository risk signal MUST identify evidence connecting a news/advisory risk to a package, code path, configuration, service, vendor product, or other repository asset. Possible connections MUST be included when evidence is incomplete.
- **FR-4.2** Each finding MUST explain the affected asset; what could go wrong; possible business/technical impact; protections reducing risk; and prioritized suggestions for what to do next. Suggestions MUST include reasoning, prerequisites, and a way to verify the result. Unavailable fixes MUST be stated explicitly.
- **FR-4.3** Findings MUST include a confidence score from 0 to 100, its rationale, and missing/conflicting evidence. High confidence is 80–100, medium 50–79, and low 0–49. Scores are assessments, not calibrated probabilities of compromise. Low confidence alone MUST NOT suppress a possible risk.
- **FR-4.4** Confidence, source severity, business impact, and evidence of active exploitation MUST be separate fields. High severity MUST NOT automatically imply high match confidence.
- **FR-4.5** Findings MUST cite source links and exact stored revisions, repository/branch names, commit identifiers, relevant file/dependency paths, observed versions, matching criteria, analysis time, and analysis/model version where applicable. Missing evidence MUST be identified, not invented.
- **FR-4.6** Reports MUST update as individual checks finish, without waiting for every repository. They MUST show assessment status, stale inputs, excluded branches/components, missing evidence, errors, and the last successful assessment. Failure MUST NOT overwrite a previous finding with a clean result.
- **FR-4.7** Users MUST be able to export PDF, CSV, and JSON reports. Exports MUST preserve confidence, status, evidence references, attribution, and export time; CSV/JSON MUST retain structured finding fields. Export request, asynchronous generation, status, and download MUST share an opaque server-issued reference bound to the company and exact report revision. The service MUST reauthorize the current actor and recheck archive and source-use state before generation and every status/download response; possession of a job/result reference or earlier authorization is insufficient. Invalidated work MUST become unavailable without returning protected bytes. Downloadable output expires 15 minutes after generation, or earlier after completed transfer or invalidation; the UI MUST show expiry and allow a newly authorized export from retained report history. ([T-004](THREAT_MODEL.md#t-004))
- **FR-4.8** The system MUST maintain vendor → product → version or service → deployment → owner relationships where evidence exists. Admins MUST be able to supply company context and notes. Missing deployment/ownership information MUST remain unknown. The business-impact field MUST show Unknown until an admin supplies company context. Company-context edits MUST NOT initiate repository scans.
- **FR-4.9** Corrections MUST update current reports while preserving prior versions, source snapshots, and change reasons. Reports MUST distinguish withdrawn/disproven findings from remediated risks.
- **FR-4.10** Severity MUST use the common labels Critical, High, Medium, Low, or Unknown alongside the source's original label, score, scoring system/version, and vector when available. Valid CVSS 3.0, 3.1, and 4.0 base scores MUST map 9.0–10.0 to Critical, 7.0–8.9 to High, 4.0–6.9 to Medium, and 0.1–3.9 to Low, following [FIRST's severity bands](https://www.first.org/cvss/v4.0/specification-document#Qualitative-Severity-Rating-Scale). A zero score MUST retain its original None/0.0 meaning; its common label MUST be Unknown with the explanation that None has no equivalent in the common labels, never a claim that the repository is safe. Without a supported valid base score, explicit source labels critical/high/medium/low MUST map case-insensitively; moderate MUST map to Medium. Other scales, missing values, and invalid data MUST remain Unknown with a reason unless an explicit, versioned source mapping exists. Values MUST NOT be guessed from prose or converted between scoring systems.
- **FR-4.11** Each source assessment MUST retain its own severity and mapping provenance. When one source supplies multiple supported base-score versions, normalization MUST prefer 4.0, then 3.1, then 3.0, while retaining all originals. A valid supported score MUST take precedence over that source's text label, with disagreements shown. A finding's common severity MUST use the highest known normalized severity among its current, non-withdrawn sources, show disagreements and unmapped assessments, and identify the selected source. Unknown MUST NOT be treated as Low. UI filters, alert routing, and exports MUST use the same versioned normalization rules; corrections MUST preserve previous report values.
- **FR-4.12** See [PDF presentation requirements](DESIGN.md#pdf-reports); this ID is defined there.

### Vendor Registration and Incident Matching

- **FR-5.1** Every new user MUST initially follow all 30 vendors listed below and be able to customize their own watchlist without changing anyone else's preferences.
- **FR-5.2** New and materially changed incidents MUST alert followers according to their personal communication preferences and applicable admin-configured Slack routing under FR-10.12.
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
- **FR-6.2** The private API MUST support the same user/admin workflows, company scope, authorization, validation, and content restrictions as the UI. Each UI, API, export, and background operation MUST have the same explicit policy for permitted roles, owner/company scope, function, target objects, and readable/writable properties; an alternate route MUST NOT expand authority. Public access, independent API keys, and third-party integration credentials are outside this release. ([T-003](THREAT_MODEL.md#t-003))
- **FR-6.3** Admin UI/API workflows MUST cover source registration/permission review, repository management, shared vendor catalog, company context, notification connectors, OIDC configuration, ingestion/delivery failures, and archive access.
- **FR-6.4** Create/update requests MUST validate typed fields before mutation. Updates to shared or administrative resources MUST carry the current server-issued revision/precondition; a stale or changed target MUST return a conflict without mutation, external effect, or success audit and require the client to reload before retrying. Successful reads/updates MUST return resource identifiers and current state; creates MUST return the resource; queued work MUST return a job identifier/status. Lists MUST support pagination/filtering. ([T-015](THREAT_MODEL.md#t-015))
- **FR-6.5** The API MUST use HTTP 200/201 for successful reads/updates and creates, 202 for asynchronous acceptance, 400 for malformed requests, 422 for invalid fields, 401 for missing/invalid authentication, 403 for insufficient role, 404 for unavailable resources, 409 for conflicting edits, 429 for rate limits, and 5xx for service failures. Errors MUST include a stable code, safe explanation, request identifier, and applicable field errors.
- **FR-6.6** Repeated registrations/subscriptions MUST return the existing resource without duplication. The UI MUST explain duplicate, permission, validation, pending, and failed states without exposing credentials or stack traces.
- **FR-6.7** Background jobs MUST handle hourly ingestion, extraction, news-triggered analysis, notifications, corrections, retries, and recovery. Long-running work MUST expose status and survive restarts without duplicate findings or sends. Each status/result read and each external effect MUST use the current actor or recorded service authority and current resource revision; a job identifier or enqueue-time authorization alone MUST NOT grant access or permit an effect. ([T-004](THREAT_MODEL.md#t-004), [T-009](THREAT_MODEL.md#t-009))
- **FR-6.8** The first release MUST provide light and dark themes with a System / Light / Dark preference. System MUST be the default and follow device changes; an explicit choice MUST override the device setting and persist for that user within the company. Theme choices MUST NOT change evidence or status meanings. Theme presentation and accessibility are specified in [DESIGN.md](DESIGN.md#light-and-dark-themes).
- **FR-6.9** The authenticated header MUST show The Daily Dread name and product mark alongside the admin-configured company display name. The name MUST come from the authorized company context, never an email-domain guess or arbitrary identity claim. Initial setup MUST require a company name; subsequent edits MUST require an admin and be audited. Company logo uploads and replacement of product branding are outside this release. Header layout is specified in [DESIGN.md](DESIGN.md#components).
- **FR-6.10** Open progress/alert views MUST refresh automatically every 30 seconds and show when their displayed state was last updated. This interval MUST NOT delay background execution or extend the authorization-refresh limit in FR-7.8.

### Company Access and Roles

- **FR-7.1** Authentication MUST use OIDC through one active company-configured provider per installation: Google, Okta, Microsoft Entra, or PingOne. Multiple simultaneous identity providers are outside this release. Local passwords, password recovery, local emergency accounts, and other native authentication MUST NOT be implemented.
- **FR-7.2** Company content, reports, exports, and API responses MUST NOT be publicly accessible.
- **FR-7.3** Configured OIDC group/role claim mappings MUST grant `DAILY-DREAD-USER` or `DAILY-DREAD-ADMIN`. Admins MUST inherit user permissions; identities with neither role MUST be denied. Configuration MUST specify trusted issuer, client, and claim mapping; email domain alone MUST NOT grant access.
- **FR-7.4** Every admitted user MUST be able to read all active repositories' analysis data, findings, company notes, and reports and export reports. Individual GitHub permissions MUST NOT narrow this company-wide visibility.
- **FR-7.5** Users MUST manage only their own watchlists, personal non-Slack notification preferences/destinations, and alert history. Slack connections, individual-recipient mappings, shared-channel destinations and Slack routing MUST be configured only by admins under FR-10.12. Shared source/repository/vendor management, company notes/context changes, OIDC configuration, and notification connector administration MUST require the admin role.
- **FR-7.6** UI/API access MUST require a valid OIDC-derived session or access token issued for this system by a configured provider. ID tokens MUST NOT be accepted as API bearer access tokens. Issuer, audience, signature, expiry, and mapped role MUST be validated.
- **FR-7.7** See [browser sign-in and session controls](SECURITY.md#sec-2--identity-sessions-and-authorization); this ID is defined there.
- **FR-7.8** The initial trusted issuer/admin mapping MUST be provisioned through deployment configuration. Subsequent provider/mapping changes MUST require admins and be audited. Removed roles MUST deny access on the next authorization refresh, at most 15 minutes later.
- **FR-7.9** The header MUST display the first nonempty string from validated OIDC claims in this order: `name`, `preferred_username`, then `email` only when `email_verified` is the boolean `true`. If none is available, it MUST show Signed-in user. The configured identity-provider name MUST always be shown. Missing optional profile claims MUST NOT block otherwise authorized access. Display fallback MUST NOT automatically register a notification destination or grant access. Identity controls are in [SECURITY.md](SECURITY.md#sec-2--identity-sessions-and-authorization); header presentation is in [DESIGN.md](DESIGN.md#trust-and-safety-interactions).

### Source Registration and Data Ingestion

- **FR-8.1** Admins MUST be able to register, approve, enable, edit, pause, resume, and archive news, vulnerability, and vendor-advisory sources. Adding a source in a supported format MUST NOT require a code release. The initial catalog MUST be seeded from [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
- **FR-8.2** Source registration MUST record name, canonical collection URL, retrieval endpoint/method, content type, permission evidence URL or written grant, permitted uses/exclusions, attribution, reviewer, and review date. Runtime registrations MUST be stored in the database without requiring document edits.
- **FR-8.3** Activation MUST reject insufficient permission evidence or invalid retrieval configuration. Admins MUST review approvals and changed terms. Newly ineligible sources MUST be paused immediately and alert admins; retained content MUST follow FR-11.
- **FR-8.4** The system MUST retain permitted original content and structured payloads, not just links. Initial retrieval support MUST include RSS/Atom, documented JSON APIs, and explicitly configured permitted HTML article retrieval. Unsupported formats MUST remain inactive with an explanation; a new format MAY require an adapter.
- **FR-8.5** Source records MUST retain source identity, canonical original URL, supplied publication/update times, retrieval time, permission evidence/version, and attribution/reuse notices.
- **FR-8.6** Risk fields MUST preserve available vulnerability identifiers; ecosystem/package identity; affected/fixed versions; vulnerable functions; products/services; severity scores/vectors and versions; weaknesses; exploit/zero-day evidence; attack conditions; impacts; mitigations/workarounds; vendors; references; and publication/modification/withdrawal times. Missing fields MUST NOT be invented.
- **FR-8.7** Extracted fields MUST link to their exact source revision, extraction method/version, and evidence location. Conflicting values MUST retain provenance rather than be silently overwritten.
- **FR-8.8** Missing fields MUST be unknown. Unsupported ranges, ambiguous packages, invalid severity values, and uncertain extraction MUST be unusable for definite determinations but visible as evidence gaps.
- **FR-8.9** Repository snapshots MUST retain identity, branches, immutable commits, collection time, dependencies/versions/scopes, relevant redacted analysis evidence, and an inventory of inspected/excluded content and coverage gaps for every selected commit. Results MUST cite the exact snapshots/source revisions used, not silently point to newer versions.
- **FR-8.10** See [local matching and disclosure controls](SECURITY.md#sec-6--secrets-retention-and-external-ai); this ID is defined there.
- **FR-8.11** Records missing source identity, canonical URL, permission basis, or a safely parseable payload MUST be rejected/quarantined. Missing optional risk fields alone MUST NOT cause rejection.
- **FR-8.12** Rejected/quarantined records MUST have safe admin-visible reasons and retryability status. A bad item MUST NOT block storage/processing of other valid items.
- **FR-8.13** Item identity MUST use a stable publisher identifier where available, otherwise the canonical original URL within that source. Revision identity MUST combine item identity with a hash of normalized source content. Retrieval-time changes alone MUST NOT create revisions.
- **FR-8.14** Changed content MUST create immutable revisions. New risk events MUST mean a first accepted risk item or revision changing affected assets/versions, severity, exploitation evidence, incident status, mitigations, or other exposure criteria. Formatting-only changes MUST NOT trigger analysis.
- **FR-8.15** Withdrawals/corrections MUST remain recorded and trigger reassessment/correction delivery for affected findings. Inactive repositories MUST receive history/status corrections from stored evidence without new GitHub analysis or issue writes. Disappearance from a feed MUST NOT imply retraction or safety.
- **FR-8.16** Accepted records, revision identities, and pending analysis events MUST be durably committed before success is reported. Unclassified raw records MUST remain pending interpretation, not be reported as accepted risks without their trigger; already validated new/material risks MUST commit their risk event and check intent with acceptance. Partial runs MUST separately report stored/rejected/failed counts. Failed writes MUST NOT advance the affected retrieval checkpoint or publish events for unsaved data.
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
- **FR-9.4** Images, logos, audio, video, separately restricted material, and linked third-party content MUST NOT be ingested under text-only approval. Untrusted-content controls are in [SECURITY.md](SECURITY.md#sec-1--trust-boundaries-and-policy-ownership).
- **FR-9.5** Company notes MUST support a restricted Markdown subset: paragraphs and line breaks, bold, italics, ordered/unordered lists, links, inline code, and fenced code blocks. Editing MUST remain admin-only under FR-7.5. Unsupported markup MUST display as escaped text. The app and PDF exports MUST preserve supported formatting; plain-text channels and CSV MUST use a readable text representation that retains list structure and link destinations. JSON MUST retain the note text and its format identifier. All outputs MUST preserve authorization, redaction, and Company note attribution. Rendering controls are in [SECURITY.md](SECURITY.md#sec-7--rendering-exports-and-external-disclosure); editor presentation is in [DESIGN.md](DESIGN.md#components).

### Alerts and GitHub Issues

- **FR-10.1** Notifications MUST support email, SMS/text, WhatsApp, and Slack through company-configured connectors. Repository findings MUST create GitHub issues when admins enable this and the installation has permission.
- **FR-10.2** Users MUST configure their personal non-Slack channels, validated destinations, fallback order, and routing by event type, severity, confidence, vendor, or repository. Admin-managed Slack delivery MUST follow FR-10.12; users MUST NOT configure Slack destinations or routing. Alerts MUST appear in the app; external delivery MUST follow preferences without assuming an unconfigured channel is authorized.
- **FR-10.3** Alerts MUST identify vendor/asset, event/finding, suspected harm, impact/severity, confidence, status, next steps, source links, and an authenticated report link. External messages MUST minimize private details and link to full internal evidence.
- **FR-10.4** Findings, incidents, and material corrections MUST enqueue alerts as soon as available, without intentional batching. Pending, delivered/accepted, failed, and retrying states MUST be visible. Provider acceptance MUST NOT be described as human readership.
- **FR-10.5** Delivery MUST try the requested channel and at most three retries after 1, 5, and 15 minutes, respecting longer provider intervals. Permanent failures MUST skip futile retries. For personal delivery, exhaustion MUST try up to two user-enabled non-Slack fallback channels in configured order with the same bound, then alert admins and record final failure. Admin-managed Slack routes MUST retain their own bounded attempts, alert admins on final failure and MUST NOT invent a personal fallback.
- **FR-10.6** Personal delivery MUST deduplicate by recipient/event revision/channel and retain provider message IDs; shared Slack-channel delivery MUST use the destination identity under FR-10.12. Unknown send outcomes MUST be reconciled or marked uncertain rather than blindly duplicated. A provider response or acknowledgment MAY update only its documented delivery facts; it MUST NOT grant permission, establish human readership, supply finding evidence, or authorize another business transition. Unknown, malformed, or semantically invalid response fields MUST fail visibly without becoming authoritative. Already accepted external sends MUST NOT be claimed reversible. Failure notifications MUST NOT recursively generate unlimited notifications. ([T-008](THREAT_MODEL.md#t-008), [T-010](THREAT_MODEL.md#t-010))
- **FR-10.7** Admin operational alerts MUST appear in the dashboard and use configured admin channels. Failure of those channels MUST remain visible without claiming external delivery succeeded.
- **FR-10.8** The system MUST maintain one issue per repository/canonical risk, combining branches. It MUST update its own content or add correction comments, link to the internal report, and preserve human comments. It MUST NOT duplicate issues per subscriber/branch or automatically reopen human-closed issues.
- **FR-10.9** Corrections/retractions MUST update in-app alerts and system-created issues and send labeled corrections through currently permitted routes to users or shared Slack destinations that received the original. Previously sent emails/texts MUST NOT be assumed editable. Suppressed or impossible delivery MUST remain visible.
- **FR-10.10** Public issues MUST contain only public source information and public repository evidence. Private company analysis, deployment details, credentials, or private code MUST NOT be published. Missing issue permission MUST be shown and reported to admins without blocking other channels.
- **FR-10.11** Admins MUST configure the company's SMTP server for email. SMS and WhatsApp MUST use a company-owned Twilio account configured by admins; these channels MUST stay disabled until configured. Setup MUST explain that a free trial does not provide free ongoing production messaging, and MUST validate provider-required senders, destination consent and approved WhatsApp templates. Signal is outside the first release.
- **FR-10.12** Slack MUST support direct messages to individuals and shared channels through an admin-configured company Slack app. Only admins MUST configure the connection, allowed destinations, user mappings and routing. Shared-channel sends MUST deduplicate by destination/event revision rather than send one copy per follower. They MUST use an explicit admin routing rule, not an implicit union of personal watchlists; one user unfollowing a vendor MUST cancel their personal vendor alerts without changing a shared-channel rule. Corrections MUST track the original individual or channel destination. Destination access and output minimization MUST be checked before delivery; a Slack destination MUST NOT grant access to internal reports.
- **FR-10.13** No inbound notification-provider callback or public webhook endpoint is required for the first release.

### Retention and Archiving

- **FR-11.1** Stored source revisions, permissions, repository analysis/dependency snapshots, registrations, vendor relationships, notes, findings, report versions, alerts, delivery records, and audit history MUST have no automatic expiration.
- **FR-11.2** Removing a repository, source, or shared vendor registration MUST archive it, stop its future work, and hide it and records supported only by that registration from active lists, default search, and main dashboards. Findings still supported by other active registrations MUST remain visible with their provenance. Explicit admin archive views/exports MUST retain access to history subject to content restrictions.
- **FR-11.3** Source ineligibility MUST stop new collection but retain previously collected material and collection-time permission evidence. Further display/export/analysis MUST be restricted if applicable permissions require it; retention itself MUST NOT grant further use rights.
- **FR-11.4** Restoring sources/repositories MUST require admin validation of current permissions/connectivity. It MUST NOT erase past failures, restore obsolete subscriptions automatically, or trigger a repository scan without a new news/advisory event. After an installation restore, prior sessions/login transactions MUST be invalid, queued external effects MUST remain paused, and connectors MUST remain disabled until an admin revalidates current destinations, source/repository rights, configuration revisions, and credentials. ([T-017](THREAT_MODEL.md#t-017))
- **FR-11.5** Permanent user-facing deletion and automatic retention cleanup are outside this release. Credentials, access tokens, transient raw processing copies, and detected secret values MUST NOT be permanent business records. Evidence MUST retain redacted secret locations, not secret contents.
- **FR-11.6** Company access, source-use conditions, and the privacy rules below MUST apply. No industry-specific compliance certification or additional regulatory workflow is claimed by this release.

### AI Analysis and Private Repository Data

- **FR-12.1** See [AI input and disclosure controls](SECURITY.md#sec-6--secrets-retention-and-external-ai); this ID is defined there.
- **FR-12.2** See [AI input and disclosure controls](SECURITY.md#sec-6--secrets-retention-and-external-ai); this ID is defined there.
- **FR-12.3** See [AI input and disclosure controls](SECURITY.md#sec-6--secrets-retention-and-external-ai); this ID is defined there.
- **FR-12.4** When safe input is insufficient, the system MUST give the best locally supported assessment, explain limitations, lower confidence as warranted, and suggest what to verify next. It MUST NOT relax egress restrictions to improve confidence.
- **FR-12.5** AI recommendations MUST cite evidence, distinguish facts/inferences, and remain advisory. AI MUST NOT change permissions, enable sources, execute repository instructions, or apply remediation.
- **FR-12.6** AI processing of source text MUST stay within approved uses, including any permission needed for third-party processing. Internal-use permission alone MUST NOT authorize external processing of publisher content.
- **FR-12.7** Admins MUST be able to configure and enable OpenAI, Anthropic, or Google as the external AI provider, with at most one active provider per installation. The admin MUST supply the company's credentials and select a supported model. Provider/model changes MUST be audited; each assessment MUST retain its configured model ID, actual provider/model identifier, returned version when available, and analysis version. An unavailable immutable model revision MUST be recorded as Unknown rather than invented. External AI MUST be disabled until configured, and unavailable or unsafe external processing MUST fall back to the locally supported assessment under FR-12.4.

## Non-Functional Requirements

### Source Access and Reliability

- **NFR-1.1** Requests to sources, GitHub, and delivery services MUST stay within published limits and authorized methods.
- **NFR-1.2** Provider retry instructions MUST override local schedules; rate limits MUST NOT cause bypasses or unlimited retries.
- **NFR-1.3** Jobs MUST persist status and recover after restarts. Transactional event recording or equivalent MUST prevent committed risk records from losing their analysis trigger.
- **NFR-1.4** Queue delays, progress, failures, and last-success timestamps MUST be visible. Immediate triggering MUST NOT be described as instantaneous completion, nor hourly polling as instantaneous discovery.

### Data Protection and Auditability

- **NFR-2.1** See [data and credential protection](SECURITY.md#sec-6--secrets-retention-and-external-ai); this ID is defined there.
- **NFR-2.2** See [required audit-event contract](SECURITY_EVENTS.md#required-audit-events); this ID is defined there.
- **NFR-2.3** See [retrieval and imported-content controls](SECURITY.md#sec-4--outbound-requests-and-ssrf); this ID is defined there.
- **NFR-2.4** See [export, notification, and diagnostic disclosure controls](SECURITY.md#sec-7--rendering-exports-and-external-disclosure); this ID is defined there.

### Fonts and Presentation Validation

- **NFR-3.1** See [font packaging requirements](DESIGN.md#typography); this ID is defined there.
- **NFR-3.2** See [presentation acceptance checks](AGENTS.md#presentation-validation); this ID is defined there.

### Installation, Capacity and Operations

- **NFR-4.1** The release MUST support a private installation for exactly one company on a company-operated server. Shared multi-company hosting is outside this release. Deployment structure and technology are specified in [ARCHITECTURE.md](ARCHITECTURE.md#stack).
- **NFR-4.2** Implementation validation MUST exercise 1,000 registered repositories and approximately 100 concurrent users with bounded job execution. The product MUST show backlog and delays rather than promise a fixed completion deadline independent of repository size, server resources or provider limits. Release documentation MUST state tested hardware, data sizes and observed throughput; no unmeasured minimum hardware or performance guarantee is asserted here.
- **NFR-4.3** The company's IT team MUST own backup scheduling, backup storage, recovery objectives and restore operation. The product MUST provide backup and restore instructions covering PostgreSQL, required configuration and separately protected credentials; building automatic backup management into the app is outside this release.
- **NFR-4.4** The web application MUST support the latest two stable major versions of Chrome, Edge, Firefox and Safari at release validation. The validation record MUST identify the exact versions tested. Identifier layout is specified in [DESIGN.md](DESIGN.md#layout).

### Third-Party Dependency Policy

- **NFR-5.1** See [dependency operating policy](AGENTS.md#third-party-libraries); this ID is defined there.
- **NFR-5.2** See [dependency operating policy](AGENTS.md#third-party-libraries); this ID is defined there.
- **NFR-5.3** See [dependency operating policy](AGENTS.md#third-party-libraries); this ID is defined there.
- **NFR-5.4** See [dependency operating policy](AGENTS.md#third-party-libraries); this ID is defined there.
- **NFR-5.5** See [dependency operating policy](AGENTS.md#third-party-libraries); this ID is defined there.

## Open-item decision register — 2026-11-04

Ordered from foundational requirements to downstream acceptance. The user approved the first decisions individually and delegated the rest to best judgment. Resolved proposals are incorporated into their owning sections; deferred items remain under stable IDs. REQUIREMENT_TEMPLATE.md was excluded. Historical threat-model snapshots retain original markers as evidence; the current handoff supersedes them. Runtime/domain values such as Unknown severity or uncertain provider outcome are intentional product states, not missing decisions. No blank Required Inputs/Secure-Coding Inputs sections or leftover template placeholders were found outside the excluded template.

| Order | Items and owning file | Disposition / dependencies |
| --- | --- | --- |
| 1 | FR-3.23, REQUIREMENTS.md | Accepted stable ready-work order, nonblocking retry/provider waits and existing concurrency-change behavior. |
| 2 | Stack and all implementation proposals, ARCHITECTURE.md | Adopted with browser-only React replacing native DOM; includes Linux, service/worker organization, PostgreSQL, source mappings, default follows, polling, queue/lease recovery, API inspection, parsing separation, connectors, DR-1/DR-3 and existing reviewed pins. |
| 3 | AR-001–AR-003, ARCHITECTURE.md | Selected-tree review and frontend tool pins are resolved in AR-001/AR-002; actual application-lockfile/runtime validation and AR-003 installation facts remain acceptance gates. No application package installation was performed. |
| 4 | TOOL-001–TOOL-004, AGENTS.md | Build/check command contracts and the project-local secure-coding guide are resolved. TOOL-003 remains deferred after rejection of a vulnerable candidate tree; build/check implementation and release evidence remain required. |
| 5 | OD-003, SECURITY.md | Resolved minimal company-local personal-data policy; no expanded network/device/session collection. |
| 6 | OD-001/002/004/005, SECURITY.md | OD-001/002/004 project policy selected in docs/decisions/AUDIT_POLICY.md; actual deployment bindings and Wave-0 proof remain required. OD-005 AI audit representation remains deferred. Required existing audit behavior remains mandatory. |
| 7 | Every unavailable_signal row, SECURITY_EVENTS.md | DEFERRED under the existing ledger ID; the owning file enumerates all rows, signal requirements and accountability. No detector or coverage invented. |
| 8 | DQ-8, DESIGN.md; DEC-003/G-008, THREAT_MODEL.md | Resolved exact high-impact phrases; runtime confirmation verification remains required. |
| 9 | DEC-001/002; G-001–G-007/G-009; TR-001–TR-011 and V-001–V-011, THREAT_MODEL.md | Rating deferred, pipeline gate accepted; implementation/evidence work deferred to dependent feature gates with owners. Tests remain not_run. |
| 10 | Source retrieval, runtime/browser/hardware, PDF/theme and release acceptance | Existing requirements retained as implementation/installation acceptance gates, not falsely marked passed. Source-specific formats remain versioned registration inputs. |
| 11 | GitHub backlog | The implementation backlog is tracked by [REQ-EPIC-001](https://github.com/jmanico/the-daily-dread/issues/20), including its coverage matrix, decision issues, workstreams and implementation leaves. GitHub owns live status; issue creation does not establish implementation or release readiness. |
