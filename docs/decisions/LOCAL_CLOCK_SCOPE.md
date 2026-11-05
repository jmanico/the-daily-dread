# Local clock telemetry scope — REQ-DECISION-052 / #63

Selected 2026-11-05 under Jim Manico's explicit delegation to resolve blocked decisions and continue, followed by his request to run the application only locally for now. Project scope owner: Jim Manico. Installation clock operation remains the local operator's responsibility; production activation remains #23.

## Decision

Exclude the **reserved clock synchronization/change/anomaly detector and `dread.clock.signal` instrumentation** from the initial local application. This uses #63's explicit “exclude after scope review” disposition. No platform signal, detector, collection endpoint, network observation or clock-correction authority is invented. SEC-087 remains `unavailable_signal`, with its existing ID/name/fields retained for future reassessment; it is neither covered nor relabeled not applicable.

#108 may implement the already approved Wave-0 audit pipeline and independent health monitor using monotonic elapsed-time measurements. Its heartbeat sequence, queue/drop counters, storage/pipeline probes and fixed safe status are the signals selected in OD-001/004. None proves UTC correctness, synchronization, reliable timestamps, or a clock-anomaly detector. Clock telemetry is excluded from the acceptance scope of this initial local build; full platform clock coverage remains unestablished.

This does **not** alter authentication expiry, role freshness, login/reauthentication lifetimes, session limits, PostgreSQL leases, audit timestamps, SEC-10 checks, or the approved 42-second controlled silence-test deadline. It does not replace wall-clock claims with a monotonic timestamp or authorize ignoring invalid token times. Later authentication still needs the real provider's acceptance evidence and an adequately maintained local clock. Production clock/runtime/host evidence remains an activation gate under #23. No existing security test is removed or weakened.

## Scope review and evidence

Read #63 and its sole direct dependent #108, SEC-1/8/10/11, SEC-087 and the unavailable-signal policy, ARCHITECTURE.md's TB-10 and AR-003, and OD-001/004. #63 explicitly permits either an evidenced authoritative signal or scope exclusion. No authoritative clock signal is supplied by this checkout. The existing repository recovery wakeup uses elapsed timers; the planned independent monitor must likewise measure elapsed time separately from event UTC timestamps. Neither is a platform synchronization claim.

The existing event ledger supplies a reserved name, not an implemented detector or required external clock collector. No previously covered event, production protection, or successful clock test is removed by excluding this unimplemented detector. All 103 ledger IDs and their evidence dispositions are preserved. A bounded Dread Ledger scope review finds no new event or collection; independent pipeline-health verification remains required before later waves. No clock-skew, NTP/NTS, host-sync or production monitoring test is claimed by this policy document.

## Consequences and reassessment

This closes the application-scope decision and removes #63 as an implementation blocker for #108 and its transitive dependents. It does not complete #108, #106, any leaf acceptance criterion, or independent human review. Other open decisions still block their dependent issues.

Reopen the signal decision before adding `dread.clock.signal`, a platform clock collector, or synchronization/anomaly claims. That change must supply the trusted platform producer, exact permitted fields, current access and consumer owner, failure behavior and observed tests. Deployment evidence cannot be inferred from the local-only choice.
