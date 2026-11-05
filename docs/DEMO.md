# Local presentation demo

Run from the repository:

```sh
npm ci --ignore-scripts
node scripts/build.mjs
node scripts/serve-demo.mjs
```

Open http://127.0.0.1:4173. The listener is restricted to loopback and serves only a fixed list of public compiled assets. It is not a company installation. Stop it with Ctrl+C.

The Feed contains **real public GitHub Advisory Database records**, retrieved on 2026-11-05 at 00:26 UTC (November 4, 16:26 Pacific). It is a dated snapshot, not an automatically updating ingestion service. Reviewed, unreviewed and malware records remain distinct. Fifteen records pass the display projection; one record with more than 100 affected-package entries is omitted with a visible coverage notice. These bounds were retained rather than raised to accommodate that record.

The rest of the interface uses **fictional company/repository records**. Findings, repository checks, vendor follows, identity and alerts do not represent real integrations or authorization. No credentials are requested. “End demo” clears the visible sample views; it is not server-side logout. Only the theme preference is saved in local storage.

Presentation walkthrough:

1. Filter the real Feed by title, CVE, package, severity or record type.
2. Open an advisory to inspect original source text, affected packages, supplied credits, publication/update/retrieval times and the original GitHub link.
3. Use “Explore sample finding” to demonstrate confidence, evidence and coverage gaps. No real advisory is connected to this sample finding.
4. Explore Repositories, Vendors, Alerts and Admin; toggle the missing-profile-claims example.
5. Switch System / Light / Dark, then end and restart the demo.

## Source provenance and refresh

The permitted collection is VULN-1 in [DATA_SOURCES.md](DATA_SOURCES.md). Operator retrieval used the installed GitHub CLI against the documented global advisory endpoint, separately requesting `reviewed` (8), `unreviewed` (4) and `malware` (4), sorted by publication descending. No private package names or repository information were sent. Source prose remains unchanged; metadata is selected/reformatted and credits are retained. No external reference, image or embedded content is fetched. Reuse is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The reviewed snapshot is committed in `demo/live-feed.json`. There is deliberately no automatic refresh control claiming the blocked production ingestion requirements. A future snapshot requires the same public-source review, bounded projection, attribution and tests. Production source ingestion remains in #118–#127, with audit/authorization prerequisites open.

## Verification and remaining gates

See [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) for actual results and limitations. This branch does not complete production build issue #104 or any production WEB issue. The full disposition of the original 139 leaves is in [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).
