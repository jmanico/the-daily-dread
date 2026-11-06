# Current skipped issues — 2026-11-05

Read from GitHub after local-session issue #254 was created. There are 139 original implementation leaves plus four scoped demo/local leaves (#232, #249, #252, #254): **143 open implementation issues**. Draft implementations are not closed/merged issues. This is not an estimate of work remaining for the smaller local milestone.

The explicit upstream dependency fields, traversed transitively through open implementation issues, leave **21 leaves skipped because an open REQ-DECISION is still required**. Each is listed below. #23 is closed; hosting/OIDC registration is no longer an unanswered local-installation prerequisite. The other 122 leaves are not automatically ready: existing implementation, scope reconciliation, acceptance and review prerequisites still apply. Historical per-leaf progress is in [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).

All 21 current decision-blocked leaves depend on #31. External AI is disabled in LOCAL-1. Several report/export/local-analysis leaves inherited that dependency from the original combined design; their templates must be explicitly split/narrowed to an AI-independent local path before implementing them. This report does not silently waive their current prerequisites.

| Skipped issue | Requirement | Why skipped |
| --- | --- | --- |
| [#140](https://github.com/jmanico/the-daily-dread/issues/140) | Retain redacted commit snapshots and coverage inventory | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#141](https://github.com/jmanico/the-daily-dread/issues/141) | Determine local exposure from unambiguous evidence | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#142](https://github.com/jmanico/the-daily-dread/issues/142) | Explain findings with separate confidence impact and next steps | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#143](https://github.com/jmanico/the-daily-dread/issues/143) | Version findings and publish per-check report progress | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#144](https://github.com/jmanico/the-daily-dread/issues/144) | Apply source corrections to active and inactive histories | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#151](https://github.com/jmanico/the-daily-dread/issues/151) | Authorize export request generation status and download | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#152](https://github.com/jmanico/the-daily-dread/issues/152) | Expire protected temporary export output | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#153](https://github.com/jmanico/the-daily-dread/issues/153) | Render CSV with safe formulas and structured evidence | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#154](https://github.com/jmanico/the-daily-dread/issues/154) | Render explicit JSON report and note projections | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#155](https://github.com/jmanico/the-daily-dread/issues/155) | Render printer-friendly PDF narrative and evidence | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#156](https://github.com/jmanico/the-daily-dread/issues/156) | Paginate PDF tables and formatted notes without evidence loss | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#157](https://github.com/jmanico/the-daily-dread/issues/157) | Parse restricted notes into one inert shared representation | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#167](https://github.com/jmanico/the-daily-dread/issues/167) | Publish one system-owned issue per repository and canonical risk | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#168](https://github.com/jmanico/the-daily-dread/issues/168) | Gate issue writes on current permissions and public evidence | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#173](https://github.com/jmanico/the-daily-dread/issues/173) | Classify and redact raw input before retention or AI preparation | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#174](https://github.com/jmanico/the-daily-dread/issues/174) | Validate final AI bytes and keep identifier mappings local | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#175](https://github.com/jmanico/the-daily-dread/issues/175) | Resolve advisory AI output only against supplied local evidence | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#176](https://github.com/jmanico/the-daily-dread/issues/176) | Activate one audited provider and record assessment model provenance | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#177](https://github.com/jmanico/the-daily-dread/issues/177) | Adapt OpenAI Responses requests and typed results | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#178](https://github.com/jmanico/the-daily-dread/issues/178) | Adapt Anthropic Messages requests and typed results | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |
| [#179](https://github.com/jmanico/the-daily-dread/issues/179) | Adapt Gemini generateContent requests and typed results | Open #31: unresolved versioned AI-egress audit representation, directly or through the existing upstream dependency chain. |

The other nine open decision/evidence issues are not upstream implementation prerequisites in those leaf dependency fields, but remain their applicable review/release gates:

- #32: threat ratings remain unrated; no evidence-based rubric/acceptance is invented.
- #64 (G-001): complete the concrete implementation/evidence handoff; local scope selection does not prove it.
- #65 (G-002): complete route/use-case authorization evidence, including the new local profile.
- #66 (G-003): complete scoped authorization/property and commitment-boundary evidence.
- #67 (G-004): complete its recorded implementation/verification evidence; no documentary closure.
- #68 (G-005): complete its recorded implementation/verification evidence; no documentary closure.
- #69 (G-006): complete its recorded implementation/verification evidence; no documentary closure.
- #70 (G-007): complete its recorded implementation/verification evidence; no documentary closure.
- #72: actual local backup/restore evidence remains outstanding; local data still needs verified recovery.

No new issue was skipped in the local-session slice; #254 has no open decision prerequisite. Private activation remains incomplete integration, including required audit and HTTP/browser/launcher enforcement. No unchanged threat or ledger status was promoted by passing credential-owner tests.
