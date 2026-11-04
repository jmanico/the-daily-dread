# System under review — specification foldback change

Baseline: `../2026-11-04-deep-web-api/05-report.json`, model `daily-dread-spec-tm`, revision `05`.

Review only the specification foldback made after the six-stage run. No implementation, deployment, runtime, test result, risk decision or control effectiveness is supplied.

Change evidence (working-tree SHA-256):

- `REQUIREMENTS.md` — `7dc36b1d4246c0ef42a8d9af122b3c8dd89e79e5f6b7b534f98caa6ca21d1961`
- `ARCHITECTURE.md` — `0cd65c20dfe6566917a13d916761cff5ea2beaac53ed512550044aa16a050be0`
- `SECURITY.md` — `58b5448b1bf70f0513ad9a642ed81a0b16a9e51eab0c2019e5326e4ac7119e85`
- `DESIGN.md` — `1aaa3b4e691d6fc811b794525dc1e39cd1d0311a16d16347b01a9cdfb4d4630a`
- `SECURITY_EVENTS.md` — `bc68ed03dc88ece86cdae506d5b78ab6cd0250d3c7841b2b941b75876dc0ac19`

The change adds specification requirements and allocation for current export authority, operation/property/revision binding, delayed effects, provider-result semantics, restore quarantine, web/API boundary ownership, affected UX and existing security-event mappings. It introduces no new architecture surface, destination, event name, event field, dependency or implementation claim. DQ-8 and OD-001 through OD-005 remain open.
