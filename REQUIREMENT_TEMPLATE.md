# Requirement Template - Web, Mobile & API Applications

Use one copy of this template for each atomic requirement.

Replace bracketed placeholders. Use `N/A` only for a field you evaluated and found not applicable, and `TO BE DECIDED` for an unresolved answer. Uppercase normative terms follow BCP 14 (RFC 2119 and RFC 8174). Split compound behavior into separate requirements.

## Metadata

- **ID**: [REQ-MODULE-###, e.g., REQ-AUTH-010]
- **Title**: [Concise requirement name]
- **Status**: [Draft | In Review | Approved | Implemented | Verified | Deprecated]
- **Owner**: [Person or team responsible]
- **Priority**: [Critical | High | Medium | Low]
- **Requirement Type**: [Functional | Security | Privacy | Compliance | Performance | Reliability | Operational]
- **Source / Parent**: [Source requirement IDs, decision, threat, legal obligation, or other origin]

## Requirement

- **Statement**: [One atomic, unambiguous, independently testable statement of what the system MUST, MUST NOT, SHOULD, SHOULD NOT, or MAY do.]
- **Rationale**: [Why the requirement exists. Adds no required behavior.]
- **Assumptions**: [Assumptions it depends on, or `None`]
- **Out of Scope**: [Behavior explicitly excluded, or `None`]
- **Traceability**: [`REQUIREMENTS.md` IDs; `DESIGN.md` section or `N/A`; `ARCHITECTURE.md` component, boundary, flow, or `DR-*`; `SECURITY.md` `SC-*` IDs or `N/A`; `SECURITY_EVENTS.md` `SEC-*` IDs or `N/A`; `THREAT_MODEL.md` `T-*` IDs or `N/A`]

## Scope

- **Applies To**: [Web Client | Mobile Client | Server-Side Application | API | Background Processing | External Integration | Multiple]
- **Components**: [Logical components as named in `ARCHITECTURE.md`]
- **Interfaces / Operations**: [Pages, screens, workflows, API operations, events, or commands]
- **Actors**: [Users, roles, service identities, administrators, or external systems]
- **Preconditions**: [State that MUST exist first, or `None`]
- **Data Classification**: [Public | Internal | Confidential | Restricted | Multiple | N/A]
- **Personal or Regulated Data**: [None | Personal Data | Sensitive Personal Data | Payment Account Data | Health Data | Financial Data | Other]
- **Jurisdiction / Regulatory Scope**: [Established scope, `N/A`, or `TO BE DECIDED`]

## Security Context

- **Security Objectives**: [Confidentiality | Integrity | Availability | Authenticity | Authorization | Accountability | Privacy | Safety | Multiple | N/A]
- **Control Layers**: [Architecture | Authentication | Authorization | Session Management | Input Validation | Business-Rule Validation | Output Encoding | Sanitization | Data Protection | Logging and Monitoring | Availability | Supply Chain | Other]
- **Threat References**: [Versioned references such as CWE, CAPEC, STRIDE, or an OWASP Top 10:2025 category, or `N/A`]
- **Abuse / Misuse Case**: [What an attacker, unauthorized actor, or compromised dependency may attempt, or `N/A`]
- **Trust Boundary**: [Where untrusted data, identity assertions, commands, or responses enter a more trusted component]
- **Untrusted Inputs or Assertions**: [Inputs, claims, authorization context, external responses, files, or events that MUST be verified before use]
- **Authoritative Enforcement Point**: [Server-side component or trusted boundary that enforces the requirement]
- **Independent Verification**: [Validation or authorization performed independently of the originating client, actor, or system]

## Standards Alignment

List only mappings verified against the cited version. Never guess control identifiers. Use `N/A` when a standard was evaluated and doesn't apply, and `TO BE DECIDED` when it hasn't been assessed.

- **OWASP ASVS 5.0.0**: [e.g., `v5.0.0-1.2.5`, or `N/A`]
- **OWASP AISVS 1.0**: [Requirement ID when an AI-enabled component is involved, or `N/A`]
- **NIST SP 800-53 Rev. 5**: [Control or enhancement ID and catalog release, or `N/A`]
- **NIST SP 800-207**: [Specific Zero Trust tenet or section, or `N/A`. Not a synonym for input validation.]
- **Regulatory**: [Regulation, version or effective date, and section, or `N/A` / `TO BE DECIDED`]
- **Other**: [Versioned RFC, ISO/IEC, industry standard, or organizational policy and section, or `N/A`]
- **Mapping Basis**: [Why each mapping applies]

## Acceptance Criteria

Each criterion describes one observable pass/fail outcome, can be tested on its own, stays within this requirement, and adds no new behavior. Use Given/When/Then.

1. **AC-01 — Expected behavior**: Given [valid preconditions], when [action], then [observable result].
2. **AC-02 — Boundary or failure**: Given [boundary, invalid input, unauthorized action, or dependency failure], when [action], then [safe, observable result with no unauthorized state change or sensitive side effect].
3. **AC-03 — Prohibited behavior**: Given [preconditions], when [action], then [what MUST NOT happen].
4. **AC-04 — Additional criterion**: [Only when needed. Remove otherwise.]

## Failure Behavior

- **On Invalid Input**: [Rejection behavior and error class; confirm no protected state change or side effect]
- **On Authentication Failure**: [Response and disclosure behavior, or `N/A`]
- **On Authorization Failure**: [Deny; response behavior and whether resource existence may be disclosed, or `N/A`]
- **On Security-Decision Failure**: [Deny by default unless a documented risk decision says otherwise]
- **On External Dependency Failure**: [Timeout, retry, idempotency, or degradation behavior, or `N/A`]
- **On System Error**: [Rollback, consistency, and safe error response; no internal state or sensitive data disclosed]
- **Logging / Audit**: [Events from `SECURITY_EVENTS.md`, fields, correlation, redaction, and prohibited data]
- **Alerting**: [Condition, threshold, severity, and destination, or `N/A`]

## Test Strategy

- **Unit Tests**: [Business rules, validation, authorization decisions, and error paths testable in isolation]
- **Integration Tests**: [Cross-component, persistence, identity, external integration, or trust-boundary behavior]
- **Security Tests**: [Negative tests, abuse cases, authorization tests, fuzzing, or manual review items]
- **UI Checks**: [Screens and states to screenshot against `DESIGN.md`, at which widths, or `N/A`]
- **Compliance Evidence**: [Evidence an applicable obligation requires, or `N/A`]
- **Acceptance-Criteria Traceability**: [Test covering each `AC-*`]
- **Required Test Environment**: [Fixtures, identities, roles, simulators, configuration, or data]

Every security-critical decision and error path needs both positive and negative tests.

## Dependencies

- **Upstream Requirements**: [IDs that MUST be satisfied first, or `None`]
- **Downstream Requirements**: [IDs that depend on this one, or `None`]
- **External Dependencies**: [Third-party services, identity providers, APIs, or `None`]
- **Failure Impact**: [Effect of an unavailable, compromised, slow, or malformed dependency]

## Implementation Notes

- **Constraints**: [Mandatory technology, compatibility, latency, migration, legal, or deadline constraints]
- **Prohibited Approaches**: [Anti-patterns, such as client-only enforcement or logging credentials]
- **Implementation Guidance**: [Non-normative guidance that adds no required behavior]
- **Secure-Coding Guidance**: [Sections of `.manicode/secure-coding.md` and `SC-*` rules to read first]
- **Required Human Review**: [Security, privacy, architecture, legal, product, or domain reviewers]
- **Open Decisions**: [Unresolved decisions that block approval or implementation, or `None`]
