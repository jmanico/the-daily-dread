# Local presentation demo

Run from the repository:

```sh
npm ci --ignore-scripts
node scripts/build.mjs
node scripts/serve-demo.mjs
```

Open http://127.0.0.1:4173. The listener is restricted to loopback and serves only a fixed list of public compiled assets. It is not a company installation. Stop it with Ctrl+C.

The Feed contains **real public GitHub Advisory Database records**. At startup and every five minutes, the server retrieves up to ten recent records of each type: reviewed, unreviewed and malware. The browser updates automatically, preserving filters and any advisory currently being read. Last-check and next-check times are visible. This bounded sample does not provide complete history or withdrawal reconciliation.

Until the first successful refresh, the UI shows the committed snapshot retrieved on 2026-11-05 at 00:26 UTC. Failed refreshes retain the last successful data with a visible status. Provider rate limits or access denial pause collection until restart. Invalid records are omitted with a visible count; validation bounds are never raised automatically.

The rest of the interface uses **fictional company/repository records**. Findings, repository checks, vendor follows, identity and alerts do not represent real integrations or authorization. No credentials are requested. “End demo” clears the visible sample views; it is not server-side logout. Only the theme preference is saved in local storage.

Presentation walkthrough:

1. Filter the real Feed by title, CVE, package, severity or record type.
2. Open an advisory to inspect original source text, affected packages, supplied credits, publication/update/retrieval times and the original GitHub link.
3. Use “Explore sample finding” to demonstrate confidence, evidence and coverage gaps. No real advisory is connected to this sample finding.
4. Explore Repositories, Vendors, Alerts and Admin; toggle the missing-profile-claims example.
5. Switch System / Light / Dark, then end and restart the demo.

## Source provenance and refresh

The permitted collection is VULN-1 in [DATA_SOURCES.md](DATA_SOURCES.md). Automatic refresh uses three serial, unauthenticated requests to the fixed GitHub global advisory endpoint, sorted by publication descending. No private package names, repository information, tokens or browser cookies are sent. Source prose remains unchanged; metadata is selected/reformatted and credits are retained. No external reference, image or embedded content is fetched. Reuse is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The fallback snapshot is committed in `demo/live-feed.json`. Automatic collection retains only the current public sample in memory, with a shared 2 MiB response budget and a 30-second deadline. At most eight browser streams receive validated projections. Browser requests cannot trigger provider checks. Production source ingestion remains in #118–#127, with audit/authorization prerequisites open.

## Verification and remaining gates

See [LIVE_REFRESH_EVIDENCE.md](LIVE_REFRESH_EVIDENCE.md) for the automatic-refresh checks and [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) for historical presentation results. This branch does not complete production build issue #104 or any production WEB issue. The full disposition of the original 139 leaves is in [BUILD_DISPOSITION.md](BUILD_DISPOSITION.md).
