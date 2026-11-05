# Local workspace preparation — REQ-LOCAL-010 (#252)

2026-11-05. This slice prepares the local state boundary selected in AR-006. It does not start a private application, issue authentication credentials, provision a database or establish backup/capacity readiness. The public live demo remains separate.

The trusted CLI derives its home and UID from Node `os.userInfo()` rather than HOME, browser claims or path arguments. It accepts exactly `init` or `check` on selected macOS Node 26.13.0. The owner validates each fixed home-relative directory, rejects symlinks and unsafe ownership/write modes, requires a 0700 application directory and a 0600 regular single-link manifest, and uses a bounded no-follow/nonblocking descriptor read plus the existing duplicate-aware JSON worker. A closed manifest fixes the loopback origin/profile and disables all optional integrations. Actor/workspace UUIDs are opaque references, not credentials.

Initialization uses one exclusive bounded staging file, fsync and no-overwrite atomic publication. Repeated checks preserve identity. Interrupted staging remains visible as `incomplete` until explicit operator recovery; the code never deletes an unknown staging file, adopts foreign data, fixes permissions automatically or overwrites existing identity. Same-account/privileged host compromise remains outside the selected local isolation boundary; this does not claim descriptor-relative openat containment or prove arbitrary synchronization software is absent.

## Actual results

- Node 26.13.0/npm 11.20.0, macOS 27.2 arm64: **157 standard tests pass**, zero failures/skips. The new owner contributes 17 cases including nested subtests.
- Actual filesystem checks cover initialization/repeat, concurrent publication, wrong supplied UID, unsafe home/root/manifest modes, each directory symlink, manifest symlink/hardlink/directory/FIFO, duplicate/malformed/deep/oversized/invalid-UTF-8 JSON, forged listener/integration settings, unknown/accessor fields, interrupted staging, unavailable storage, cancellation before/during setup, preserved foreign-file canaries and CLI argument rejection.
- Type-check, runtime/import guard, reviewed dependency graph, build and artifact checks pass. Dependency audit reports zero vulnerabilities; signatures and actual runtime audit are recorded in the PR with their exact results. No dependency or existing test was changed or weakened.
- Actual authorized `init` and `check` both succeeded on Jim's Mac. Metadata showed a 0700 directory and a 0600, 257-byte manifest under the selected Application Support location. No manifest identity or secret was printed by the command. This observed setup does not prove authentication, database integration, encrypted backup or eventual private-service acceptance.

## Use

With the selected Node runtime active, run from the repository:

```sh
node scripts/local-workspace.mjs init
node scripts/local-workspace.mjs check
```

The command intentionally reports that the private application remains inactive. A `missing` result from check requires initialization. `unsafe`, `incomplete`, `invalid` or `unavailable` requires inspection; there is no force/repair/overwrite option. Stop local setup/application processes before recovery. Preserve existing configuration and any pending file for review rather than deleting or adopting it automatically. The manifest contains no login secret, so copying its references never authenticates a caller.

Read before implementation: the issue template, local secure-coding guide and applicable SEC-1/3/5/6/9/10, AR-006, [Node filesystem flags](https://nodejs.org/api/fs.html#file-system-flags) and [OS userInfo](https://nodejs.org/api/os.html#osuserinfooptions). No UI changed, so no new screenshot check applies. No security event was introduced; new authentication/event composition remains downstream. Saved-model trust-boundary review and human review are required before merge. Local private activation, actual data-mount encryption, database/runtime composition, backup/restore and capacity evidence remain unfulfilled.
