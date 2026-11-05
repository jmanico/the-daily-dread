# Build disposition — 2026-11-05

The project lead redirected this build to a demonstrable UI, then explicitly requested real feed data. Demo issue #232 was added under the web workstream. No original production leaf is closed by the demo. States below were read from GitHub in this build session.

An open decision blocks dependent work transitively. The overnight build resumed foundation work after the requested demo milestone. Eligible leaves below are distinguished from decision-blocked leaves. Production implementation remains incomplete.

Latest combined validation: [CI run 42050354966](https://github.com/jmanico/the-daily-dread/actions/runs/42050354966), head `0e6f6d3b709b312af238f0d9c23dc8cc99c1a896` in [draft PR #242](https://github.com/jmanico/the-daily-dread/pull/242), passes **both implementation and runtime audit** on Node 26.13.0/npm 11.20.0. It includes 90 standard tests, native DNS, 17 isolated outbound tests, parser capacity, build/types/import/dependency/artifact/advisory/signature and committed-range whitespace checks. The runtime checker evaluated 204 official records with zero matches. The actual local Node 24.16.0 audit correctly fails with 30 conservative matches; the selected CI runtime is the passing target. [TOOL-003's decision and evidence](decisions/RUNTIME_AUDIT.md) replace the former unconditional failing gate without skipping a check.

Audit policy decisions #28–#30 are resolved under the project lead's delegated authority in [PR #240](https://github.com/jmanico/the-daily-dread/pull/240); actual company activation facts remain #23. [PR #241](https://github.com/jmanico/the-daily-dread/pull/241) begins #106 with an immutable bounded envelope; it does not complete Wave 0. No PR has merged. The earlier seven PR branches still retain their historical runtime-gate failures until the selected checker reaches them; current-stack CI does not complete their acceptance criteria or required reviews.

Demo #233 has the scoped keyboard, theme/storage, reduced-motion, two-tab preference and 390/1440 screenshot evidence in [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md), plus Safari 27.2, Firefox 156.0 and Edge 156.0.4314.58 desktop smoke results. The complete two-major-version/browser/screen and assistive-technology matrix remains unverified. Earlier private architectural reviews cover foundation snapshot `24d8e40` and UI/CI endpoint changes through `63c78ea`; they preserve 17 open threats and 11 unrun production verification plans and are not human/merge approval. The new policy, envelope and runtime checker still need their applicable pre-merge reviews. Private artifacts remain private. Per-issue historical evidence below retains its tested scope; no production leaf is closed by these additions.

| Issue | Requirement | Disposition / reason |
| --- | --- | --- |
| [#92](https://github.com/jmanico/the-daily-dread/issues/92) | REQ-PLATFORM-010 | Deferred at NFR-5 revalidation: selected pg 8.23.1 accepts an invalid startup handshake; reproduced locally, upstream fix pending. See [build security evidence](BUILD_SECURITY_EVIDENCE.md). No driver added. |
| [#93](https://github.com/jmanico/the-daily-dread/issues/93) | REQ-PLATFORM-011 | Deferred: durable PostgreSQL owner work depends on the currently unavailable persistence foundation in #92; queue/lease/recovery behavior is not implemented or claimed from pure helper tests. |
| [#94](https://github.com/jmanico/the-daily-dread/issues/94) | REQ-PLATFORM-012 | Deferred: durable PostgreSQL owner work depends on the currently unavailable persistence foundation in #92; queue/lease/recovery behavior is not implemented or claimed from pure helper tests. |
| [#95](https://github.com/jmanico/the-daily-dread/issues/95) | REQ-PLATFORM-013 | Deferred: durable PostgreSQL owner work depends on the currently unavailable persistence foundation in #92; queue/lease/recovery behavior is not implemented or claimed from pure helper tests. |
| [#96](https://github.com/jmanico/the-daily-dread/issues/96) | REQ-PLATFORM-014 | In progress ([draft PR #239](https://github.com/jmanico/the-daily-dread/pull/239)): shared two-worker/100-pending admission, bounded JSON tasks and pure cumulative-counter transitions; 69-test combined suite (including later build regressions) and parser RSS/saturation checks pass locally and on selected Linux CI. Durable owner/PostgreSQL fencing, full capacity, review and runtime audit remain unmet. See [evidence](PARSER_WORKER_EVIDENCE.md). |
| [#97](https://github.com/jmanico/the-daily-dread/issues/97) | REQ-PLATFORM-015 | In progress: draft PR #235; 23 standard, one DNS and nine real socket tests pass on selected Linux runtime. Private reviews cover the `24d8e40` foundation snapshot and subsequent UI/CI diff through `63c78ea`; production integration, human review and runtime audit remain unmet. See [evidence](OUTBOUND_DESTINATION_EVIDENCE.md). |
| [#98](https://github.com/jmanico/the-daily-dread/issues/98) | REQ-PLATFORM-016 | In progress: draft PR #236; bounded HTTP/TLS retrieval and shared byte/time/redirect budgets. Combined CI passes 37 standard, one DNS and 17 socket/HTTP tests. Production integration, human review and runtime audit remain unmet; private reviews cover the earlier foundation snapshot and UI/CI follow-ups through `63c78ea`. See [evidence](OUTBOUND_RETRIEVAL_EVIDENCE.md). |
| [#99](https://github.com/jmanico/the-daily-dread/issues/99) | REQ-PLATFORM-017 | In progress: draft PR #237; strict Fastify factory, bounded worker JSON/query parsing and native framing/cancellation tests. Selected Linux CI passes 45 standard, one DNS and 17 socket/HTTP tests; ingress agreement, production auth/use-case integration, Wave 0, review and runtime audit remain unmet. See [evidence](HTTP_BOUNDARY_EVIDENCE.md). |
| [#100](https://github.com/jmanico/the-daily-dread/issues/100) | REQ-PLATFORM-018 | In progress ([draft PR #238](https://github.com/jmanico/the-daily-dread/pull/238)): shared error/status vocabulary, strict response projections and bounded pagination with registered-handler/native cancellation tests. Production workflow/UI parity, identity/persistence integration, reviews and runtime audit remain unmet. See [evidence](API_OUTCOME_EVIDENCE.md). |
| [#101](https://github.com/jmanico/the-daily-dread/issues/101) | REQ-PLATFORM-019 | Deferred: credential envelope/rotation acceptance requires durable nonce reservations, scoped transactions and restore evidence; persistence foundation #92 is unavailable. No partial cryptographic envelope is claimed complete. |
| [#102](https://github.com/jmanico/the-daily-dread/issues/102) | REQ-PLATFORM-020 | Deferred: credential envelope/rotation acceptance requires durable nonce reservations, scoped transactions and restore evidence; persistence foundation #92 is unavailable. No partial cryptographic envelope is claimed complete. |
| [#103](https://github.com/jmanico/the-daily-dread/issues/103) | REQ-PLATFORM-021 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23) |
| [#104](https://github.com/jmanico/the-daily-dread/issues/104) | REQ-PLATFORM-022 | In progress: reviewed-graph, runtime import/security, artifact and failure-preserving build checks plus confined CI. Draft; TOOL-003 (#26), human/change review and production acceptance remain unmet. |
| [#105](https://github.com/jmanico/the-daily-dread/issues/105) | REQ-PLATFORM-023 | In progress: fatal process termination, five-second graceful shutdown and HTTP admission cancellation implemented; 106 combined local tests pass. Durable recovery, production supervisor/monitoring, capacity and merge reviews remain unmet. See [evidence](PROCESS_BOUNDARY_EVIDENCE.md). |
| [#106](https://github.com/jmanico/the-daily-dread/issues/106) | REQ-AUDIT-010 | In progress: audit decisions #28–#30 resolved under delegated policy; bounded Wave-0 envelope projection and safe Fastify HTTP capture implemented; 99 combined local tests pass. Authority/security-event consumer/persistence integration, independent health, full Wave-0 verification and merge gates remain unmet. See [evidence](AUDIT_ENVELOPE_EVIDENCE.md). |
| [#107](https://github.com/jmanico/the-daily-dread/issues/107) | REQ-AUDIT-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106. |
| [#108](https://github.com/jmanico/the-daily-dread/issues/108) | REQ-AUDIT-012 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#109](https://github.com/jmanico/the-daily-dread/issues/109) | REQ-AUDIT-013 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #107. |
| [#110](https://github.com/jmanico/the-daily-dread/issues/110) | REQ-AUTH-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#111](https://github.com/jmanico/the-daily-dread/issues/111) | REQ-AUTH-011 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#112](https://github.com/jmanico/the-daily-dread/issues/112) | REQ-AUTH-012 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#113](https://github.com/jmanico/the-daily-dread/issues/113) | REQ-AUTH-013 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#114](https://github.com/jmanico/the-daily-dread/issues/114) | REQ-AUTH-014 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#115](https://github.com/jmanico/the-daily-dread/issues/115) | REQ-AUTH-015 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#116](https://github.com/jmanico/the-daily-dread/issues/116) | REQ-AUTH-016 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#117](https://github.com/jmanico/the-daily-dread/issues/117) | REQ-AUTH-017 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106. |
| [#118](https://github.com/jmanico/the-daily-dread/issues/118) | REQ-SOURCE-010 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#119](https://github.com/jmanico/the-daily-dread/issues/119) | REQ-SOURCE-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#120](https://github.com/jmanico/the-daily-dread/issues/120) | REQ-SOURCE-012 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#121](https://github.com/jmanico/the-daily-dread/issues/121) | REQ-SOURCE-013 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#122](https://github.com/jmanico/the-daily-dread/issues/122) | REQ-SOURCE-014 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#123](https://github.com/jmanico/the-daily-dread/issues/123) | REQ-SOURCE-015 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#124](https://github.com/jmanico/the-daily-dread/issues/124) | REQ-SOURCE-016 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#125](https://github.com/jmanico/the-daily-dread/issues/125) | REQ-SOURCE-017 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#126](https://github.com/jmanico/the-daily-dread/issues/126) | REQ-SOURCE-018 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#127](https://github.com/jmanico/the-daily-dread/issues/127) | REQ-SOURCE-019 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#128](https://github.com/jmanico/the-daily-dread/issues/128) | REQ-RISK-010 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106, #124. |
| [#129](https://github.com/jmanico/the-daily-dread/issues/129) | REQ-RISK-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106, #124. |
| [#130](https://github.com/jmanico/the-daily-dread/issues/130) | REQ-RISK-012 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106, #124. |
| [#131](https://github.com/jmanico/the-daily-dread/issues/131) | REQ-RISK-013 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106, #124. |
| [#132](https://github.com/jmanico/the-daily-dread/issues/132) | REQ-RISK-014 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106, #124. |
| [#133](https://github.com/jmanico/the-daily-dread/issues/133) | REQ-RISK-015 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#134](https://github.com/jmanico/the-daily-dread/issues/134) | REQ-REPO-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#135](https://github.com/jmanico/the-daily-dread/issues/135) | REQ-REPO-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#136](https://github.com/jmanico/the-daily-dread/issues/136) | REQ-REPO-012 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#137](https://github.com/jmanico/the-daily-dread/issues/137) | REQ-REPO-013 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106. |
| [#138](https://github.com/jmanico/the-daily-dread/issues/138) | REQ-REPO-014 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #96, #97, #98, #106, #137. |
| [#139](https://github.com/jmanico/the-daily-dread/issues/139) | REQ-REPO-015 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#140](https://github.com/jmanico/the-daily-dread/issues/140) | REQ-REPO-016 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#141](https://github.com/jmanico/the-daily-dread/issues/141) | REQ-REPORT-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#142](https://github.com/jmanico/the-daily-dread/issues/142) | REQ-REPORT-011 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#143](https://github.com/jmanico/the-daily-dread/issues/143) | REQ-REPORT-012 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#144](https://github.com/jmanico/the-daily-dread/issues/144) | REQ-REPORT-013 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#145](https://github.com/jmanico/the-daily-dread/issues/145) | REQ-VENDOR-010 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106. |
| [#146](https://github.com/jmanico/the-daily-dread/issues/146) | REQ-VENDOR-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #106. |
| [#147](https://github.com/jmanico/the-daily-dread/issues/147) | REQ-VENDOR-012 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#148](https://github.com/jmanico/the-daily-dread/issues/148) | REQ-PREF-010 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#149](https://github.com/jmanico/the-daily-dread/issues/149) | REQ-PREF-011 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#150](https://github.com/jmanico/the-daily-dread/issues/150) | REQ-PREF-012 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#151](https://github.com/jmanico/the-daily-dread/issues/151) | REQ-EXPORT-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#152](https://github.com/jmanico/the-daily-dread/issues/152) | REQ-EXPORT-011 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#153](https://github.com/jmanico/the-daily-dread/issues/153) | REQ-EXPORT-012 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#154](https://github.com/jmanico/the-daily-dread/issues/154) | REQ-EXPORT-013 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#155](https://github.com/jmanico/the-daily-dread/issues/155) | REQ-EXPORT-014 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#156](https://github.com/jmanico/the-daily-dread/issues/156) | REQ-EXPORT-015 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#157](https://github.com/jmanico/the-daily-dread/issues/157) | REQ-EXPORT-016 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#158](https://github.com/jmanico/the-daily-dread/issues/158) | REQ-DELIVERY-010 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#159](https://github.com/jmanico/the-daily-dread/issues/159) | REQ-DELIVERY-011 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#160](https://github.com/jmanico/the-daily-dread/issues/160) | REQ-DELIVERY-012 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23) |
| [#161](https://github.com/jmanico/the-daily-dread/issues/161) | REQ-DELIVERY-013 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23) |
| [#162](https://github.com/jmanico/the-daily-dread/issues/162) | REQ-DELIVERY-014 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23) |
| [#163](https://github.com/jmanico/the-daily-dread/issues/163) | REQ-DELIVERY-015 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#164](https://github.com/jmanico/the-daily-dread/issues/164) | REQ-DELIVERY-016 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#165](https://github.com/jmanico/the-daily-dread/issues/165) | REQ-DELIVERY-017 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#166](https://github.com/jmanico/the-daily-dread/issues/166) | REQ-DELIVERY-018 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#167](https://github.com/jmanico/the-daily-dread/issues/167) | REQ-ISSUE-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#168](https://github.com/jmanico/the-daily-dread/issues/168) | REQ-ISSUE-011 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#169](https://github.com/jmanico/the-daily-dread/issues/169) | REQ-LIFE-010 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #106. |
| [#170](https://github.com/jmanico/the-daily-dread/issues/170) | REQ-LIFE-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #106. |
| [#171](https://github.com/jmanico/the-daily-dread/issues/171) | REQ-LIFE-012 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #93, #106. |
| [#172](https://github.com/jmanico/the-daily-dread/issues/172) | REQ-LIFE-013 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#173](https://github.com/jmanico/the-daily-dread/issues/173) | REQ-AI-010 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#174](https://github.com/jmanico/the-daily-dread/issues/174) | REQ-AI-011 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#175](https://github.com/jmanico/the-daily-dread/issues/175) | REQ-AI-012 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#176](https://github.com/jmanico/the-daily-dread/issues/176) | REQ-AI-013 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#177](https://github.com/jmanico/the-daily-dread/issues/177) | REQ-AI-014 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#178](https://github.com/jmanico/the-daily-dread/issues/178) | REQ-AI-015 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#179](https://github.com/jmanico/the-daily-dread/issues/179) | REQ-AI-016 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#31](https://github.com/jmanico/the-daily-dread/issues/31), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#180](https://github.com/jmanico/the-daily-dread/issues/180) | REQ-MATCH-010 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#181](https://github.com/jmanico/the-daily-dread/issues/181) | REQ-MATCH-011 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #180. |
| [#182](https://github.com/jmanico/the-daily-dread/issues/182) | REQ-MATCH-012 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#183](https://github.com/jmanico/the-daily-dread/issues/183) | REQ-MATCH-013 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #182. |
| [#184](https://github.com/jmanico/the-daily-dread/issues/184) | REQ-MATCH-014 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#185](https://github.com/jmanico/the-daily-dread/issues/185) | REQ-MATCH-015 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #184. |
| [#186](https://github.com/jmanico/the-daily-dread/issues/186) | REQ-MATCH-016 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#187](https://github.com/jmanico/the-daily-dread/issues/187) | REQ-MATCH-017 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #186. |
| [#188](https://github.com/jmanico/the-daily-dread/issues/188) | REQ-MATCH-018 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#189](https://github.com/jmanico/the-daily-dread/issues/189) | REQ-MATCH-019 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #188. |
| [#190](https://github.com/jmanico/the-daily-dread/issues/190) | REQ-MATCH-020 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#191](https://github.com/jmanico/the-daily-dread/issues/191) | REQ-MATCH-021 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #190. |
| [#192](https://github.com/jmanico/the-daily-dread/issues/192) | REQ-MATCH-022 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#193](https://github.com/jmanico/the-daily-dread/issues/193) | REQ-MATCH-023 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #192. |
| [#194](https://github.com/jmanico/the-daily-dread/issues/194) | REQ-MATCH-024 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#195](https://github.com/jmanico/the-daily-dread/issues/195) | REQ-MATCH-025 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #194. |
| [#196](https://github.com/jmanico/the-daily-dread/issues/196) | REQ-MATCH-026 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#197](https://github.com/jmanico/the-daily-dread/issues/197) | REQ-MATCH-027 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #196. |
| [#198](https://github.com/jmanico/the-daily-dread/issues/198) | REQ-MATCH-028 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#199](https://github.com/jmanico/the-daily-dread/issues/199) | REQ-MATCH-029 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #198. |
| [#200](https://github.com/jmanico/the-daily-dread/issues/200) | REQ-MATCH-030 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#201](https://github.com/jmanico/the-daily-dread/issues/201) | REQ-MATCH-031 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #200. |
| [#202](https://github.com/jmanico/the-daily-dread/issues/202) | REQ-MATCH-032 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106. |
| [#203](https://github.com/jmanico/the-daily-dread/issues/203) | REQ-MATCH-033 | Deferred: recorded decision prerequisites resolved; incomplete implementation prerequisites #92, #96, #106, #202. |
| [#204](https://github.com/jmanico/the-daily-dread/issues/204) | REQ-WEB-010 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#205](https://github.com/jmanico/the-daily-dread/issues/205) | REQ-WEB-012 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#206](https://github.com/jmanico/the-daily-dread/issues/206) | REQ-WEB-013 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#207](https://github.com/jmanico/the-daily-dread/issues/207) | REQ-WEB-014 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#208](https://github.com/jmanico/the-daily-dread/issues/208) | REQ-WEB-015 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#209](https://github.com/jmanico/the-daily-dread/issues/209) | REQ-WEB-016 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#210](https://github.com/jmanico/the-daily-dread/issues/210) | REQ-WEB-017 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#211](https://github.com/jmanico/the-daily-dread/issues/211) | REQ-WEB-018 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#212](https://github.com/jmanico/the-daily-dread/issues/212) | REQ-WEB-019 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#213](https://github.com/jmanico/the-daily-dread/issues/213) | REQ-WEB-020 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#214](https://github.com/jmanico/the-daily-dread/issues/214) | REQ-WEB-021 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#215](https://github.com/jmanico/the-daily-dread/issues/215) | REQ-WEB-022 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#216](https://github.com/jmanico/the-daily-dread/issues/216) | REQ-WEB-023 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#217](https://github.com/jmanico/the-daily-dread/issues/217) | REQ-WEB-024 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#218](https://github.com/jmanico/the-daily-dread/issues/218) | REQ-WEB-025 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#219](https://github.com/jmanico/the-daily-dread/issues/219) | REQ-PLATFORM-024 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#220](https://github.com/jmanico/the-daily-dread/issues/220) | REQ-PLATFORM-025 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#221](https://github.com/jmanico/the-daily-dread/issues/221) | REQ-PLATFORM-026 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#222](https://github.com/jmanico/the-daily-dread/issues/222) | REQ-PLATFORM-027 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#223](https://github.com/jmanico/the-daily-dread/issues/223) | REQ-PLATFORM-028 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#224](https://github.com/jmanico/the-daily-dread/issues/224) | REQ-PLATFORM-029 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#225](https://github.com/jmanico/the-daily-dread/issues/225) | REQ-PLATFORM-030 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#226](https://github.com/jmanico/the-daily-dread/issues/226) | REQ-PLATFORM-031 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#227](https://github.com/jmanico/the-daily-dread/issues/227) | REQ-PLATFORM-032 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#228](https://github.com/jmanico/the-daily-dread/issues/228) | REQ-PLATFORM-033 | Skipped: open decision prerequisites [#23](https://github.com/jmanico/the-daily-dread/issues/23), [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#229](https://github.com/jmanico/the-daily-dread/issues/229) | REQ-PLATFORM-034 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |
| [#230](https://github.com/jmanico/the-daily-dread/issues/230) | REQ-WEB-011 | Skipped: open decision prerequisites [#63](https://github.com/jmanico/the-daily-dread/issues/63) |

Current counts after delegated audit decisions (2026-11-05): 139 original leaves; 76 blocked by open decisions, 8 in-progress draft implementations, and 55 deferred/not yet started. Decision closure does not complete implementation prerequisites or merge gates.

Open decision titles:

- #23 — [REQ-DECISION-012] Supply and validate company installation inputs
- #31 — [REQ-DECISION-020] Resolve versioned AI-egress audit representation
- #32 — [REQ-DECISION-021] Resolve evidence-based threat risk ratings
- #33 — [REQ-DECISION-022] Resolve authoritative signal for SEC-002
- #34 — [REQ-DECISION-023] Resolve authoritative signal for SEC-003
- #35 — [REQ-DECISION-024] Resolve authoritative signal for SEC-005
- #36 — [REQ-DECISION-025] Resolve authoritative signal for SEC-006
- #37 — [REQ-DECISION-026] Resolve authoritative signal for SEC-007
- #38 — [REQ-DECISION-027] Resolve authoritative signal for SEC-008
- #39 — [REQ-DECISION-028] Resolve authoritative signal for SEC-009
- #40 — [REQ-DECISION-029] Resolve authoritative signal for SEC-010
- #41 — [REQ-DECISION-030] Resolve authoritative signal for SEC-011
- #42 — [REQ-DECISION-031] Resolve authoritative signal for SEC-012
- #43 — [REQ-DECISION-032] Resolve authoritative signal for SEC-013
- #44 — [REQ-DECISION-033] Resolve authoritative signal for SEC-014
- #45 — [REQ-DECISION-034] Resolve authoritative signal for SEC-020
- #46 — [REQ-DECISION-035] Resolve authoritative signal for SEC-022
- #47 — [REQ-DECISION-036] Resolve authoritative signal for SEC-032
- #48 — [REQ-DECISION-037] Resolve authoritative signal for SEC-035
- #49 — [REQ-DECISION-038] Resolve authoritative signal for SEC-039
- #50 — [REQ-DECISION-039] Resolve authoritative signal for SEC-046
- #51 — [REQ-DECISION-040] Resolve authoritative signal for SEC-048
- #52 — [REQ-DECISION-041] Resolve authoritative signal for SEC-059
- #53 — [REQ-DECISION-042] Resolve authoritative signal for SEC-063
- #54 — [REQ-DECISION-043] Resolve authoritative signal for SEC-064
- #55 — [REQ-DECISION-044] Resolve authoritative signal for SEC-066
- #56 — [REQ-DECISION-045] Resolve authoritative signal for SEC-067
- #57 — [REQ-DECISION-046] Resolve authoritative signal for SEC-069
- #58 — [REQ-DECISION-047] Resolve authoritative signal for SEC-070
- #59 — [REQ-DECISION-048] Resolve authoritative signal for SEC-071
- #60 — [REQ-DECISION-049] Resolve authoritative signal for SEC-072
- #61 — [REQ-DECISION-050] Resolve authoritative signal for SEC-075
- #62 — [REQ-DECISION-051] Resolve authoritative signal for SEC-079
- #63 — [REQ-DECISION-052] Resolve authoritative signal for SEC-087
- #64 — [REQ-DECISION-053] Close deferred evidence handoff G-001
- #65 — [REQ-DECISION-054] Close deferred evidence handoff G-002
- #66 — [REQ-DECISION-055] Close deferred evidence handoff G-003
- #67 — [REQ-DECISION-056] Close deferred evidence handoff G-004
- #68 — [REQ-DECISION-057] Close deferred evidence handoff G-005
- #69 — [REQ-DECISION-058] Close deferred evidence handoff G-006
- #70 — [REQ-DECISION-059] Close deferred evidence handoff G-007
- #71 — [REQ-DECISION-060] Close deferred evidence handoff G-009
- #72 — [REQ-DECISION-061] Obtain external evidence for residual SEC-047 subcases
- #73 — [REQ-DECISION-062] Obtain external evidence for residual SEC-058 subcases
- #74 — [REQ-DECISION-063] Obtain external evidence for residual SEC-073 subcases
- #75 — [REQ-DECISION-064] Obtain external evidence for residual SEC-074 subcases
