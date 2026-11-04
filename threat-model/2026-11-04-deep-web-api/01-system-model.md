# Stage 01 — Composed system model

The model reconstructs a single-company browser application and private API over one shared Fastify gate, protected use-case layer and PostgreSQL store. It separates session/login authority, API operation/resource authority, retained evidence, exports, provider egress, durable work and audit obligations. Every element is marked as a specification claim or proposed design; none is marked observed in operation.

Boundary ownership is explicit: web owns TB-1, TB-2 and TB-9 because those boundaries center on browser request intent, session transitions and rendering/downloads. API owns TB-3 through TB-8 and TB-10 because those boundaries center on service operations, external adapters, response consumption, persistence and restricted configuration. Shared scenarios retain both architecture contributors.

The model separately represents export creation and retrieval, outbound notification payload and provider result, user/admin authority, source and repository input, AI disclosure, durable job state and current-authorization checks. Inbound notification callbacks, public APIs, uploads/previews, service workers and third-party browser code are not applicable to this release.

The principal open topology gaps are the exact UI/API route and authorization matrices, delayed export authority/lifecycle, provider response-field authority and runtime cache/storage behavior. Existing controls remain claimed only; nothing is implemented or tested.
