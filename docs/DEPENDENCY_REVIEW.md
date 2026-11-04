# Dependency review for the architecture

Reviewed **2026-11-04**. [ARCHITECTURE.md](../ARCHITECTURE.md) owns the selected stack and each requirement justification. [REQUIREMENTS.md](../REQUIREMENTS.md), NFR-5.1–NFR-5.5, records the dependency policy supplied during the architecture interview.

This is a review of **proposed** dependencies for a documentation-only repository. No application package manifest, lockfile, runtime dependency or font binary is added by this change. The implementation must repeat the checks against its real lockfile before adding dependencies; this snapshot is not a permanent approval or a claim that the application has been tested.

## Scope and evidence

The review compared live npm names, versions, maintainers and publication times against upstream package manifests, release tags/changelogs and repository status. It inspected official project security-advisory lists, the GitHub Advisory Database where ranges needed clarification, and npm's audit response for the complete resolved tree. It compared the current publisher list with the preceding stable package publication and investigated the one changed list. Upstream projects selected here were not archived or marked deprecated at review time.

A temporary npm project outside the repository resolved exact direct versions with lifecycle scripts disabled. npm 11.16.0 on Node.js 24.16.0 resolved **13 direct packages and 90 transitive package instances: 103 total**, including one optional dependency. This checks the dependency graph on the available review runtime; it does not establish application compatibility on the proposed Node.js 26.13.0 runtime. npm audit reported **zero known vulnerabilities** in that snapshot; this does not establish that the packages are vulnerability-free. npm audit signatures verified **103 registry signatures and 39 provenance attestations**. Registry signatures authenticate registry artifacts; they do not prove source-code safety.

Before the React decision delta below, the reviewed baseline needed no ORM, separate queue/scheduler library, HTTP client SDKs, AI SDKs, GitHub SDK, notification SDK, icon library or font npm packages. Native HTTP, JSON, crypto, streams and worker threads, Fastify's existing schema facilities, PostgreSQL transactions and a small set of application-owned policies meet those needs. Complex parsing, identity protocols, SMTP/MIME and PDF/font handling retain specialized libraries because replacing them would increase correctness or security risk.

## Direct dependency inventory

Transitive counts below are each package's reachable installed dependencies, not additive: shared dependencies are counted in more than one row. Version links in ARCHITECTURE.md point to the corresponding live registry records.

| Package and official project | Exact pin | Published | License | Reachable transitives |
| --- | --- | --- | --- | --- |
| [fastify](https://github.com/fastify/fastify) | 5.12.8 | 2026-11-02 | MIT | 47 |
| [pg](https://github.com/brianc/node-postgres) | 8.23.1 | 2026-09-30 | MIT | 13 |
| [openid-client](https://github.com/panva/openid-client) | 6.8.9 | 2026-11-02 | MIT | 2 |
| [jose](https://github.com/panva/jose) | 6.2.15 | 2026-11-01 | MIT | 0 |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | 5.12.0 | 2026-11-03 | MIT | 7 |
| [parse5](https://github.com/inikulin/parse5) | 8.1.0 | 2026-11-01 | MIT | 1 |
| [markdown-it](https://github.com/markdown-it/markdown-it) | 15.0.3 | 2026-10-16 | MIT | 6 |
| [pdfkit](https://github.com/foliojs/pdfkit) | 0.20.2 | 2026-08-30 | MIT | 18 |
| [semver](https://github.com/npm/node-semver) | 7.8.6 | 2026-11-02 | ISC | 0 |
| [nodemailer](https://github.com/nodemailer/nodemailer) | 10.3.1 | 2026-10-29 | MIT-0 | 0 |
| [yaml](https://github.com/eemeli/yaml) | 2.9.1 | 2026-09-11 | ISC | 0 |
| [smol-toml](https://github.com/squirrelchat/smol-toml) | 1.9.1 | 2026-10-09 | BSD-3-Clause | 0 |
| [@renovatebot/pep440](https://github.com/renovatebot/pep440) | 6.0.0 | 2026-10-28 | Apache-2.0 | 0 |

Fastify's 47 reachable dependencies are the largest group, but the framework is an explicit user choice and supplies routing, validation, serialization and logging that would otherwise require separate libraries. PDFKit's 18 support font layout/embedding, line breaking and PDF output required by FR-4.12; there is no added Chromium renderer or PDF service. `pg` is the protocol client for the required database. `jose` is also an `openid-client` dependency and resolves to the same installed package; its explicit direct use supports API JWT verification without a second cryptography stack. `semver` likewise shares the framework's resolved version. YAML, TOML, SMTP and PEP 440 packages add no runtime transitives.

The XML library also brings builder/entity helpers even though the application only parses. A smaller alternative, [saxes](https://github.com/lddubeau/saxes), was inspected and rejected because its repository is archived. Minimizing dependency count does not justify selecting an abandoned parser. Full repository-scanning suites and language runtimes are not selected: inspection remains local, read-only and non-executing, using the explicit ecosystem acceptance matrix in ARCHITECTURE.md.

## Release age, ownership and maintenance

Several pins are days old. They were checked against their official release records rather than accepted from a `latest` tag alone:

- [Fastify 5.12.8](https://github.com/fastify/fastify/releases/tag/v5.12.8) includes a security fix. Fastify 6 alpha is excluded; the current stable major remains 5.
- [openid-client 6.8.9](https://github.com/panva/openid-client/releases/tag/v6.8.9) addresses TypeScript optional-property compatibility; [jose 6.2.15](https://github.com/panva/jose/releases/tag/v6.2.15) adjusts decompression bounds and rejects invalid negative tolerance/cache settings. No existing application migration is involved.
- [fast-xml-parser 5.12.0](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.12.0) is the patched release for the stop-node scanning advisory below. Entity/DOCTYPE restrictions and bounded parsing remain required even on a patched parser.
- [parse5 8.1.0](https://github.com/inikulin/parse5/releases/tag/v8.1.0) was cross-checked against its monorepo's `packages/parse5/package.json`, rather than confusing the root build-tool manifest with the published package.
- [semver 7.8.6](https://github.com/npm/node-semver/releases/tag/v7.8.6) changes range parsing performance and test coverage. The registry maintainer list replaced `owlstronaut` with `martinrrm`; the established npm maintainers remained. Investigation found the official npm-owned release/tag/package manifest and a GitHub Actions trusted-publisher identity continuous with the previous release; its installed artifact passed the signature/attestation verification. This corroborates the publication path, not the absence of all supply-chain risk.
- [markdown-it 15's changelog](https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md) changes package exports and linkification behavior. Use the supported root API, no internal imports or plugins, and the application-owned restricted-note renderer. The selected patch fixes parsing denial-of-service cases; default HTML/linkification is not the product's rendering policy.
- [PDFKit 0.20.2](https://github.com/foliojs/pdfkit/releases/tag/v0.20.2) fixes font-metric packaging and linked unwrapped text. [Open issues](https://github.com/foliojs/pdfkit/issues) include layout work, so multipage wrapping/links/fonts require NFR-3.2 validation. Its larger dependency group is retained for required font and PDF correctness.
- [node-postgres's changelog](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md) explicitly records Node.js 26 support in the selected major. Its unresolved issue/PR queue is not proof of abandonment, but transaction/error-path integration tests remain required; the application will not depend on optional native bindings or new pipelining behavior.
- [yaml 2.9.1](https://github.com/eemeli/yaml/releases/tag/v2.9.1) is stable; version 3 is prerelease. The maintainer's 2.9.0 notes classify parser stack exhaustion as a bug rather than a security vulnerability. The application must therefore catch parser failures and enforce finite parsing budgets even when an audit is clean.
- [smol-toml 1.9.1](https://github.com/squirrelchat/smol-toml/releases/tag/v1.9.1) follows a parser rewrite with null-prototype results and denial-of-service fixes. Consumers must not assume inherited object methods, and fixtures must cover invalid numeric/date input.
- [PEP 440 6.0.0](https://github.com/renovatebot/pep440/releases/tag/6.0.0) raises its Node.js floor to 24.10.0, satisfied by the proposed runtime. [Nodemailer 10.3.1](https://github.com/nodemailer/nodemailer/releases/tag/v10.3.1) is stable, has no runtime dependencies and follows earlier address-parser security patches. Its new OTP feature is not needed or enabled.

All selected upstreams had ongoing repository activity, supported releases and no deprecation/archive flag at review time. Public issue/PR and security histories were sampled; this is not an assertion that every unresolved issue was exhaustively reviewed. The substantial Fastify and PDFKit groups deserve continuing update review. No speculative update, forced override or unrelated migration was performed.

## Advisories and applicability

Official repository security-advisory endpoints and the [GitHub Advisory Database](https://github.com/advisories) were checked on **2026-11-04**, alongside the full-tree npm audit. The following examples explain why the selected patched versions matter for this untrusted-input application; the snapshot audit also checked indirect dependencies.

| Advisory | Affected versions relevant to this selection | Selected version and applicability |
| --- | --- | --- |
| [Fastify streaming timeout exception](https://github.com/fastify/fastify/security/advisories/GHSA-3qgw-9275-xf8w) | 5.8.0 through versions below 5.12.8 | 5.12.8 contains the fix; HTTP exception handling matters to all surfaces. |
| [XML stop-node scanning CPU use](https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-474x-hrwr-fgx4) | Up to 5.11.2 | 5.12.0 is the patched release; imported XML is untrusted. |
| [Repeated XML DOCTYPE expansion](https://github.com/advisories/GHSA-8r6m-32jq-jx6q) | At least 5.9.3 and below 5.10.1 in the global advisory | 5.12.0 is beyond the patch. The repository endpoint omitted the upper bound while also naming 5.10.1 as patched; the global record and advisory text resolve that discrepancy. |
| [Markdown reference-definition parsing](https://github.com/markdown-it/markdown-it/security/advisories/GHSA-gfr2-rv44-r23c) | 14.1.0–below 14.3.3 and 15.0.0–below 15.0.3 | 15.0.3 includes the fix; admin-authored notes remain untrusted input. |
| [Nodemailer address-parser recipient confusion](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8) | 3.0.0–below 10.1.4 | 10.3.1 includes the fix; destination validation remains application policy. |
| [YAML nested-collection exhaustion](https://github.com/eemeli/yaml/security/advisories/GHSA-48c2-rrv3-qjmp) | 2.0.0–below 2.8.3; older 1.x also affected | 2.9.1 includes the fix; parsing budgets still apply. |
| [TOML repeated-key scanning](https://github.com/squirrelchat/smol-toml/security/advisories/GHSA-r4xh-jqrq-34v2) | Up to 1.8.0 | 1.9.1 is beyond the 1.9.0 patch. |
| [JOSE compressed JWE exhaustion](https://github.com/panva/jose/security/advisories/GHSA-hhhv-q57g-882q) | Legacy release lines, including 4.x through 4.15.4 | Selected 6.2.15 is outside the listed affected lines; do not add JWE processing merely because the library supports it. |

The [Node.js 26.13.0 release](https://nodejs.org/en/blog/release/v26.13.0) is the current LTS selection; the LTS transition itself changes metadata, and the official Linux binaries require libatomic. [Docker Engine 29.9.3](https://docs.docker.com/engine/release-notes/29/) is a recent security patch and the proposed container validation target. [PostgreSQL 18.6](https://www.postgresql.org/docs/release/18.6/) is the verified database pin. Base-image/system-package inventories must be reviewed when actual container images exist; this npm audit does not cover them.

## Licenses and shipped assets

The resolved package licenses are MIT (87, including `png-js` whose package manifest omitted a license field but whose shipped LICENSE is MIT), ISC (5), BSD-3-Clause (5), BSD-2-Clause (2), Apache-2.0 (2), PSF-2.0 (1), and MIT-0 (1). No copyleft license appeared in the resolved runtime tree. These are the reviewed declarations for an MIT-distributed application, not a substitute for retaining upstream notices. Preserve applicable copyright/license text, Apache notices and PSF attribution in the implementation distribution.

Some transitives put their license in a README rather than a root LICENSE file (`pg-types`, `pgpass`, `abstract-logging`, `brotli`, `dfa`); `fontkit` and `@nodable/entities` require collecting upstream license notices where the published artifact omits them. License collection must cover these packages explicitly instead of relying only on package metadata or a naive filename scan. If the implementation cannot establish required notice text for its resolved version, NFR-5.3 blocks adding/distributing that dependency until reviewed.

The font choices are immutable source/release pins in ARCHITECTURE.md, with regular, bold, italic and bold-italic styles as required. Retain the upstream SIL OFL 1.1 and copyright notices from [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next/blob/7925f50f649b3813257faf2f4c0b381011f434f1/OFL.txt), [Source Serif](https://github.com/adobe-fonts/source-serif/blob/4.005R/LICENSE.md), and [IBM Plex](https://github.com/IBM/plex/blob/2f9ba1b25957d958db71a849e85d72e3ecfb845a/LICENSE.txt). Use local font files, not a font npm package or third-party font service. The older Source Serif 4.005R pin is its current published release, not an arbitrary downgrade; font stability alone does not imply abandonment. Record checksums for the exact selected binaries when packaging them.

## Implementation handoff

Before creating the implementation manifest, repeat the identity, publisher, license, support and advisory checks against the actual resolved tree. Use the runtime-bundled npm version documented in ARCHITECTURE.md to avoid a separate package-manager upgrade; the review environment's npm version is recorded above for transparency. Use a generated lockfile and preserve integrity/provenance evidence. Recheck current advisories before release, validate native-runtime and container compatibility, and run the required ecosystem, authorization, adverse-input and PDF acceptance checks. No open product decision or additional provider approval is implied by this implementation gate.

Review-only lockfile SHA-256: `69f4c1e3e9ac8eac618b2760ac930f0d1a2a42f61208844de1868ae0b070374d`. The temporary review tree is not the application lockfile.

## React decision delta — 2026-11-04

The user selected browser-only React 19, replacing the native-DOM proposal. Live npm metadata and the [official upstream release](https://github.com/react/react/releases/tag/v19.3.1) identify `react` and `react-dom` 19.3.1, MIT, with repository `https://github.com/react/react`. No packages or lockfiles were added. The prior native-client dependency review does not cover this addition. AR-001 explicitly defers installation until publisher/ownership, package contents, transitive resolution/licenses, support, issues, migration and official/database advisory checks are complete. AR-002 likewise gates any bundler/checker. This is a selected version target, not a completed NFR-5 approval or vulnerability-free claim. User preference for a component-based UI justifies the direct dependency cost against FR-6.1/6.8–6.10; do not add optional routing/state/UI frameworks without their own requirement and review.
