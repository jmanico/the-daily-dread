# Agent instructions

@REQUIREMENTS.md
@ARCHITECTURE.md
@SECURITY.md
@SECURITY_EVENTS.md
@DESIGN.md

## Implementation and issues

- Before writing code in an area, read the matching sections of `.manicode/secure-coding.md` and every applicable `SEC-*` control section in [SECURITY.md](SECURITY.md) that names the component. Read the secure-coding file on demand; do not import it. The authoritative project-local reading guide is `.manicode/secure-coding.md`; SECURITY.md continues to own the controls.
- Every leaf implementation issue follows `REQUIREMENT_TEMPLATE.md`. Use the actual `SEC-1`–`SEC-11` control IDs from SECURITY.md for its `SC-*` placeholders; zero-padded `SEC-001`–`SEC-090` and `SEC-APP-*` identify event-ledger entries. Epic, workstream, and decision issues use short, purpose-specific bodies linking the affected spec IDs and issues.

## Third-party libraries

Packages listed in [ARCHITECTURE.md](ARCHITECTURE.md#stack) are already approved; everything else goes through this policy. Approval does not replace the per-addition/upgrade verification below. Build and supply-chain enforcement is specified in [SEC-9](SECURITY.md#sec-9--build-and-deployment).

- **NFR-5.1** Minimize dependencies; prefer standard-library/platform APIs and existing project functionality. Each new direct package needs an exact pin, requirement ID, and reason native/baseline capabilities are insufficient, with its maintenance, security and upgrade burden justified. Small, verifiable local implementations may handle narrow functionality. Use or retain established libraries/vetted platform APIs for cryptography, authentication, complex parsing and other specialized work where replacement increases security, correctness or maintenance risk. Avoid large transitive trees for lightly used functionality; explain substantial increases and their update burden.
- **NFR-5.2** Before adding/upgrading, verify the exact package name and publisher against upstream documentation/repository and the live registry; never rely on registry metadata alone or model memory. Investigate lookalikes, ownership changes and unfamiliar packages. Inspect the package-manager-resolved transitive tree, maintenance/support, unresolved issues, security responsiveness, supported-runtime compatibility, release notes, migration guidance and constraints. Release frequency is only one maintenance signal. Reject archived, deprecated or abandoned projects.
- **NFR-5.3** Check direct/transitive licenses against the project's MIT distribution, any project license policy and intended uses; preserve required notices and flag unclear/incompatible terms for maintainer review before proceeding. Use the latest stable supported compatible release, respecting any release-age policy; explain older selections. Scrutinize very recent releases and unexpected maintainer/release changes rather than assuming safety.
- **NFR-5.4** Check official project advisories and relevant vulnerability databases before additions/upgrades. Record sources, date, affected versions and project applicability; avoid known applicable vulnerable versions. If advisory lookup or any required verification is unavailable, stop before adding/upgrading unless the user explicitly accepts the identified risk. Never describe an unchecked version or absence of reported advisories as proof of safety.
- **NFR-5.5** Keep dependency changes in scope, use the project package manager, and preserve behavior/runtime compatibility. Consider unused/redundant libraries and unnecessary optional integrations for removal only after checking code, dynamic loading, plugins, configuration, scripts, tests and build tooling; verify changes and explain justified retention. Avoid unrelated upgrades, forced overrides and manual lockfile edits that bypass constraints; prefer compatible parent updates. Explain concrete migration effects. If a broader migration or compatibility blocker arises, stop and report evidence/options before expanding scope; resume only with new evidence or an agreed plan, without repeated speculative fixes. Record any explicit override and its reason.

## Toolchain

Run the applicable checks before calling implementation work done.

| Check | Command |
| --- | --- |
| Build | TOOL-001 selected: `node scripts/build.mjs` using esbuild 0.28.2; command implementation belongs to REQ-PLATFORM-022. Not yet runnable in this specification-only checkout. |
| Type-check | TOOL-002 selected: `tsc --project jsconfig.json --noEmit` using TypeScript 7.0.2 with checked JavaScript/JSDoc and client contracts; configuration belongs to REQ-PLATFORM-022. No TypeScript-source migration is selected. |
| Test | `node --test` |
| Dependency audit | `npm audit --audit-level=high` |
| Runtime audit | DEFERRED TOOL-003 — runtime audit tool requires NFR-5 verification and an approved locked dev dependency; no ad-hoc npx execution. |

## Presentation validation

- **NFR-3.2** Before release, validate both screen themes, System preference changes and saved overrides, keyboard focus, reduced motion, and missing profile-claim fallbacks. Check PDFs in grayscale on A4 and US Letter with long identifiers, multi-page tables, formatted notes and labeled hatching. Record actual results; the static light-theme preview does not establish application/PDF implementation or acceptance.
- Before calling UI work done, check screenshots at 390 px and 1440 px against [DESIGN.md](DESIGN.md) and [design/preview.html](design/preview.html).
- Runtime compatibility and capacity acceptance evidence follows [NFR-4.2/NFR-4.4](REQUIREMENTS.md#installation-capacity-and-operations).

## Security-event implementation workflow

Use the [Dread Ledger runbook](https://github.com/jmanico/dread-ledger/blob/main/runbook.md) and the [event ledger](SECURITY_EVENTS.md). Start with Wave 0 only: safe Fastify serialization/capture, audit integration, bounded failure handling and independent health verification under [SEC-8](SECURITY.md#sec-8--durable-jobs-errors-and-audit), [SEC-10](SECURITY.md#sec-10--required-verification-and-review-evidence) and [SEC-11](SECURITY.md#sec-11--security-event-enforcement). Do not instrument later waves until the local foundation passes; unresolved deployment decisions remain separate blockers.

For missing ledger rows, implement at the named component, resolve applicable OD items and verify emission plus its consumer. For unavailable rows, establish the authoritative signal and owner/access boundary first. Reassess absent rows when excluded features are introduced; reserved names do not authorize new detectors. Preserve ledger IDs and evidence status during change reviews.

## Change reviews

- Once `THREAT_MODEL.md` exists, run a Grim Prompter change review against the saved threat-model JSON before merging any change that crosses a trust boundary named in `ARCHITECTURE.md`.
- For any change that adds, removes, or alters a security event, run a Dread Ledger change review using [`prompts/09-change-review.md`](https://github.com/jmanico/dread-ledger/blob/main/prompts/09-change-review.md) against `SECURITY_EVENTS.md`.

## Toolchain handoff

TOOL-001 and TOOL-002 have selected commands and reviewed tool pins under AR-002; implementation of the build/check configuration remains in [REQ-PLATFORM-022](https://github.com/jmanico/the-daily-dread/issues/104). A command selection is not a successful application build. TOOL-003 remains deferred: the reviewed `is-my-node-vulnerable` 1.6.1 candidate was rejected because its resolved tree introduces high-severity advisories; see [the dependency review](docs/DEPENDENCY_REVIEW.md#backlog-decision-review--2026-11-04). Do not install that candidate or force a transitive override. The release maintainer owns this remaining runtime-audit gate.

TOOL-004 is resolved to this repository's [.manicode/secure-coding.md](.manicode/secure-coding.md). This newly established project-local guide points to the owning controls; it does not claim discovery of a previously missing external pack. Read it on demand before implementation. G-009's location/provenance handoff is satisfied; additional concrete prescription gaps must still be recorded if encountered.
