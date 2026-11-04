# Agent instructions

@REQUIREMENTS.md
@ARCHITECTURE.md
@SECURITY.md
@SECURITY_EVENTS.md
@DESIGN.md

## Implementation and issues

- Before writing code in an area, read the matching sections of `.manicode/secure-coding.md` and every `SC-*` rule in `SECURITY.md` that names the component. Read the secure-coding file on demand; do not import it.
- Every leaf implementation issue follows `REQUIREMENT_TEMPLATE.md`. Epic, workstream, and decision issues use short, purpose-specific bodies linking the affected spec IDs and issues.

## Third-party libraries

- Minimize third-party dependencies to reduce ongoing updates and maintenance. Prefer the standard library, supported platform APIs, or functionality already available in the project when they meet the requirements.
- Add a library only when its benefits justify its ongoing maintenance, security, and upgrade costs. For simple, narrowly scoped functionality, consider a small local implementation when it is easier to maintain and verify. For security-sensitive functionality, especially cryptography, authentication, and complex parsing, use or retain established libraries or vetted platform APIs rather than hand-rolling replacements. Retain other specialized libraries when replacement would increase security, correctness, or maintenance risk.
- Inspect the resolved transitive dependency tree before adding or upgrading a library. Prefer suitable options with fewer transitive dependencies, and avoid bringing in large dependency trees for functionality the project barely uses. Explain why any substantial increase is necessary and assess its update burden.
- When changing existing dependency usage, identify unused or redundant libraries and unnecessary optional integrations as removal candidates. Remove them only within the authorized task scope and after checking code, dynamic loading, plugins, configuration, scripts, tests, and build tooling. Preserve behavior and supported runtime compatibility, verify the changes, and explain justified retention.
- Before adding or upgrading a library, verify the exact package name and publisher against the project's own documentation or repository, and check its registry entry live. Do not trust registry metadata alone. Never select package names or versions from model memory. Investigate lookalike names, unexpected ownership changes, and unfamiliar new packages before proceeding.
- Use the latest stable, supported release compatible with the project and its release-age policy, if any. Scrutinize very recent releases and unexpected maintainer or release changes; absence of an advisory is not evidence that a release is safe. Explain any choice of an older release.
- Before adding or upgrading a library, check its license and those of its transitive dependencies against the project's license policy, if any, and intended use and distribution. Preserve required notices and flag unclear or incompatible terms for maintainer review before proceeding.
- Assess maintenance through support status, unresolved issues, security responsiveness, and compatibility with supported runtimes. Treat release frequency as one signal; a mature, stable library may need few releases. Reject archived, deprecated, or abandoned projects.
- Check current security advisories from official project sources and relevant advisory databases. Report the sources and date checked, affected versions, and applicability to this project. Avoid versions with known applicable vulnerabilities. If advisory lookup is unavailable, stop and report that limitation before adding or upgrading the dependency; do not describe an unchecked version as vulnerability-free.
- Keep updates scoped to the task. Use the project's package manager to resolve transitive dependencies; avoid unrelated upgrades, forced overrides, and manual lockfile edits that bypass compatibility constraints. Prefer a compatible parent-library update when a transitive dependency needs remediation.
- Before updating, review release notes, migration guidance, and dependency constraints for breaking changes. Explain concrete effects on this project and the required migration work. If an update requires a broader migration or hits a compatibility blocker, stop and report the evidence and options before expanding scope. Do not repeatedly attempt speculative upgrades or fixes; resume only with new evidence or an agreed migration plan.
- If you cannot verify these requirements, stop and report the blocker. Do not add or upgrade the dependency unless the user explicitly accepts the identified risk.

Packages listed in `ARCHITECTURE.md` are already approved; everything else goes through this policy.

## Toolchain

Run the applicable checks before calling implementation work done.

| Check | Command |
| --- | --- |
| Build | TO BE DECIDED — the architecture does not select a build recipe. |
| Type-check | TO BE DECIDED — the architecture does not select a type-checking tool. |
| Test | `node --test` |
| Dependency audit | `npm audit --audit-level=high` |
| Runtime audit | TO BE DECIDED — the baseline's `is-my-node-vulnerable` needs an approved, locked dev dependency. |

## Change reviews

- Before calling UI work done, check screenshots at 390 px and 1440 px against `DESIGN.md` and `design/preview.html`.
- Once `THREAT_MODEL.md` exists, run a Grim Prompter change review against the saved threat-model JSON before merging any change that crosses a trust boundary named in `ARCHITECTURE.md`.
- For any change that adds, removes, or alters a security event, run a Dread Ledger change review using [`prompts/09-change-review.md`](https://github.com/jmanico/dread-ledger/blob/main/prompts/09-change-review.md) against `SECURITY_EVENTS.md`.
