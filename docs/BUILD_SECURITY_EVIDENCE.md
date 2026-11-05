# Build security evidence — REQ-PLATFORM-022 (#104)

Reviewer: Codex. Date: 2026-11-05 UTC (November 4 Pacific). This is implementation evidence, not human approval or production acceptance. This change is stacked on the separately reviewed demo branch/PR #233; it introduces no application dependency or security event.

## Implemented boundary

SEC-1, SEC-3, SEC-5, SEC-8, SEC-9 and SEC-10 and the complete #104 template were read before implementation, together with the project-local secure-coding guide. The controls' Node/OWASP sources were read during this build; PostgreSQL transaction, isolation and serialization-retry sources were also re-read during the #92 readiness review.

- `check-dependencies.mjs` requires a private package, exact reviewed direct versions, generated lock agreement, registry URLs/integrities, the reviewed transitive graph fingerprint, and lifecycle scripts disabled. Graph changes require new NFR-5 evidence and an explicit reviewed fingerprint change. It does not replace registry signature verification or current advisory checks.
- `check-runtime.mjs` parses the actual checked runtime files, requires explicit import review per module, and detects dangerous runtime names, dynamic imports, common HTML/code sinks, computed global access, empty catches, async `forEach`, Promise-valued decisions and unowned Promise statements. Newly introduced or excluded `demo/` and `src/` modules fail. The two local-server entry modules are checked too. Tooling and test harnesses are outside runtime capability policy.
- The guard uses TypeScript 7.0.2's shipped `unstable/sync` and `unstable/ast` APIs with its native compiler. Their instability is contained by the exact pin and adverse fixtures; API/parser failure fails the check. The old compiler API is unavailable in 7.0.2. The current typescript-eslint 8.72.1 peer range ends before 6.1, so it was not installed or forced onto 7.0.2. See [Microsoft's API notice](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) and [supported linter versions](https://typescript-eslint.io/users/dependency-versions/).
- These lint checks do not prove full data-flow confinement or async ownership. Alias chains, dynamically constructed access and all Promise collection patterns are not exhaustively analyzed. Review and actual boundary tests remain mandatory; there are no file-wide suppression switches.
- `check-artifact.mjs` inspects every allowed output file, rejects missing/unexpected files, symlinks, source-map references, credential patterns, supplied synthetic/secret environment canaries and byte-budget overflow. Pattern and exact-value scans are not proof that all encoded secrets are absent.
- The build stages and verifies output before publication. Compilation/asset/verification failure, pre-publication cancellation or a competing build preserves the prior artifact. A failed recovery retains the recovery directory. This is build-output handling, not a production deployment or database transaction implementation.

## CI confinement and selected actions

The workflow uses `pull_request` and branch `push`, a read-only contents token, no persisted checkout credentials, no submodules, no dependency caches, no production secrets, no publishing permissions and no artifact upload. It uses GitHub-hosted Ubuntu 24.04 and explicitly checks Node 26.13.0/npm 11.20.0. Lifecycle scripts remain disabled. See [GitHub's secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use).

Official release metadata, action definitions, release notes and README migration/configuration guidance were inspected on the date above. Both immutable commits have GitHub-verified commit signatures:

| Action | Release / immutable revision | Review consequence |
| --- | --- | --- |
| actions/checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), `3d3c42e5aac5ba805825da76410c181273ba90b1` | Node 24 action runtime; persisted credentials explicitly disabled; no unsafe PR checkout mode |
| actions/setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), `949feb2413d6458794dcd2491c4babbbce0c15c1` | Node 24 action runtime; installs exact application runtime; automatic caching explicitly disabled; no registry authentication configuration |

These actions are CI tools, not application dependencies. Pin verification and signatures do not prove their bundled code is vulnerability-free. Official security advisory pages were consulted; current application dependency advisories/signatures are checked separately by npm in CI.

## Actual results and limits

Local macOS arm64, Node 24.16.0/npm 11.16.0: strict type checking, runtime guard and dependency/artifact checks passed. Seven new tests passed, including adverse compiler fixtures, dependency-policy mutations, output leakage/bounds and preservation of the last build on failure/cancellation/contention. The full combined suite passed: 16 tests, zero failures/skips. A fresh `npm ci --ignore-scripts` passed; npm audit reported zero known advisories; 12 signatures and six attestations verified. All 18 artifact SHA-256 hashes matched across a clean build and a build with a synthetic secret environment canary. Remote CI is pending. Local results do not establish the selected Linux runtime.

The `runtime-audit` CI job deliberately fails while TOOL-003/#26 remains open. It is neither skipped nor replaced by npm dependency audit. The rejected auditor was not installed. No green release status is claimed. Production service/container/ingress evidence, remaining UI acceptance, Grim Prompter change review and required human reviews remain outstanding. No production leaf may close or merge on the strength of these checks alone.

## PostgreSQL dependency revalidation finding

Before adding pg for #92, the live registry, upstream maintenance/issues/changelog, official advisory page and GitHub Advisory Database were rechecked. pg 8.23.1 remains latest stable; publisher is brianc, Node >=16, MIT, active upstream. @types/pg 8.23.1 comes from DefinitelyTyped/Microsoft's types publisher. An isolated temporary review install (outside the application) resolved 17 packages; npm reported no known advisories and verified 17 signatures/one attestation. None was added to this repository.

Inspection found [open upstream PR #3844](https://github.com/brianc/node-postgres/pull/3844): pg accepts `ReadyForQuery` before `AuthenticationOk`. A controlled loopback TCP server returning only that six-byte message reproduced successful `client.connect()` with synthetic credentials on the exact selected package. This is a protocol-validation failure; it does not establish that TLS server verification is bypassed or that a correctly configured PostgreSQL server is exploitable. The actual deployment/applicability review is unresolved. The no-advisory audit result does not erase this evidence.

[Open upstream PR #3843](https://github.com/brianc/node-postgres/pull/3843) also describes uncaught malformed/unsupported authentication-message errors. The resolved pg-protocol 1.16.1 source contains the uncaught parser path; that second failure was inspected but not independently reproduced here. Per NFR-5.2/NFR-5.4, the application addition is deferred pending a reviewed upstream correction or explicit risk disposition. No custom driver, forced transitive override, or unreviewed replacement was introduced. #92 therefore remains unimplemented.
