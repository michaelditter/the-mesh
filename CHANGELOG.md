# Changelog

All notable changes to The Mesh. Because the Meshtastic and Nostr APIs move between
versions, dependencies are pinned exactly and this file records why they change.

## [0.1.0] — pre-launch hardening

### Fixed
- **both-mode was dead on arrival.** `subscribeMany` was called with the filter wrapped
  in an array (correct for nostr-tools 2.7.0, broken since ~2.23). Now passes a single
  filter object, matching the pinned `nostr-tools@2.23.9`. Added an `onclose` handler so a
  failing subscription is no longer silent.
- Reproducible installs: pinned all deps exactly and committed `package-lock.json`;
  `.npmrc` sets `engine-strict=true` so Node ≥ 22 is enforced, not just warned.

### Changed
- **Recording is now opt-in.** Only broadcast mesh messages that start with `!record `
  (configurable via `MESH_RECORD_PREFIX`, `""` to record everything) become records.
  Direct/private messages are never recorded. This is the consent boundary.
- **both-mode is no longer an open transmit proxy.** Notes are forwarded onto the radio
  only if signed by an allowlisted author (`MESH_OUT_AUTHORS`, default: the bridge's own
  key), rate-limited to one transmit per 30s, and deduped across relays.
- **Records now carry authorship.** The sender's mesh node number is written to a
  `mesh_from` tag and prefixed into the note content; the signature attests only that the
  bridge heard the message.
- Relay publishing now reports how many relays accepted a record (`accepted by N/M`)
  instead of declaring success on a single ack.
- Permanence language softened to the honest framing: durable, not eternal — a record
  lives as long as one relay keeps a copy; no single platform can recall it.
- Version dropped from `1.0.0` to `0.1.0` to match the unreleased, not-hardware-tested state.

### Added
- Device-disconnect watch so the daemon warns instead of silently recording nothing.
- Guard that `MESH_NSEC` / the key file is actually an `nsec` (not an `npub`).
- Terminal-control-character sanitizing for mesh-sourced text in the console.
- Byte-accurate (UTF-8) clamp on text forwarded to LoRa so multi-byte text can't overflow.
- README/MESH troubleshooting, Node prerequisite, key-backup, and privacy-disclosure guidance.
