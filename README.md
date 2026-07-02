# The Mesh

**Bridge an off-grid radio mesh to a durable public record.**

A small bridge between a [Meshtastic](https://meshtastic.org) LoRa node and [Nostr](https://nostr.com): a mesh message that opts in (by starting with `!record`) becomes a **durable, signed public record** — replicated across relays, recallable by no single platform — and, optionally, records can be spoken back onto the mesh to reach people who have no internet. This is the **sermon and post layers** from *[You Cannot Eat Code](https://youcannoteat.codes)* — community broadcast and distribution that need no company, no tower, and no subscription.

Durable, not eternal: a record lives as long as one relay keeps a copy. No single platform can recall it, but no one can promise it lives forever.

> A sermon needed no infrastructure but a voice and a room. Mesh radio needs no internet — every node relays for its neighbors. The post rider's range, no permission.

## Honest first: this one needs a radio

Unlike the other tools in this series, **The Mesh is not software-only — and that's the point.** Off-grid mesh is *real radio*. No browser trick transmits over LoRa; anything claiming to would be a simulation, which this project refuses to ship. To run The Mesh for real you need a Meshtastic node — about **$25**. The code here is real and complete; it just needs a device to talk to. **[→ MESH.md](MESH.md)** gets you on the mesh in about 20 minutes.

## What it does

**Prerequisite: Node.js ≥ 22.** nostr-tools uses the global `WebSocket`, which does not exist in Node before v22 — on older Node you'll get `WebSocket is not defined` at connect time. Install from [nodejs.org](https://nodejs.org) (or `nvm install 22`), then:

```bash
npm ci                                          # reproducible install from package-lock.json
MESH_HOST=192.168.1.42 node bridge.mjs          # your node's IP/hostname
```
```
The Mesh — connecting to node at 192.168.1.42 …
Listening. Recording opt-in mesh text (prefix "!record ") → 3 relays. Signing as npub1…
mesh→nostr  from 1128074276: "Trail closed past the bridge — water's up."  →  accepted by 2/3 relays  →  https://njump.me/note1…
```
- **mesh → nostr** (default): a mesh message that starts with `!record ` is signed and published to several relays — a durable record of what was said off-grid, that no single platform can recall. **Only messages that start with `!record ` become records.** Ordinary radio chatter and direct (private) messages are never recorded. This is the consent boundary: your neighbors' traffic is not published unless they opt in. Set `MESH_RECORD_PREFIX=""` to record everything — only do this on a channel whose members have all consented.
- **nostr → mesh** (`MESH_DIRECTION=both`): notes tagged `#mesh-out` are spoken onto the mesh, so the record reaches people who are off the internet. `#mesh-out` is a **public tag anyone can post to**, and your radio transmits on a shared license-free band — so the bridge forwards **only notes signed by an allowlisted author** (`MESH_OUT_AUTHORS`, default: the bridge's own key), rate-limited to one transmit per 30s. It will not relay a stranger's content over your transmitter.

**What the signature attests:** the bridge's key signs a *relay* of what it heard — it attests that this bridge heard a given message at a given time. It does **not** prove who spoke. The mesh node number of the sender is carried in the `mesh_from` tag (and prefixed into the note text for readability), not in the signature.

**Recording requires internet.** The mesh itself is off-grid, but the bridge machine needs both Wi-Fi to your node *and* an internet path to the relays to publish. The mesh is off-grid; the record-keeping is not.

**Tell your mesh community.** If you run a bridge, announce it: people on your mesh should know that messages prefixed `!record` become durable public records.

Config via env: `MESH_HOST`, `MESH_DIRECTION`, `MESH_RELAYS`, `MESH_RECORD_PREFIX`, `MESH_OUT_AUTHORS`, `MESH_NSEC` (else a key is generated and saved to `~/.the-mesh/key`).

## Why this is the honest version
- The bridge connects over your node's HTTP API (`@meshtastic/core` + `@meshtastic/transport-http`) — works with a node on your Wi-Fi; swap in `@meshtastic/transport-node-serial` for a USB-tethered node.
- Dependencies are **pinned exactly** and a `package-lock.json` is committed, because the Meshtastic and Nostr APIs both move between versions (a breaking `nostr-tools` change already bit an earlier draft). Use `npm ci` for a reproducible install. Requires **Node ≥ 22** (enforced via `.npmrc` `engine-strict`).
- The Meshtastic event/packet API moves between versions. This targets `@meshtastic/core` `2.6.7`; the bridge looks up the text event defensively and tells you exactly what to adjust if your version differs. **Not run-tested against live hardware** — verify against your node (which is the whole spirit of this layer).
- Signing reuses the same key model as [The Record](https://github.com/michaelditter/the-record): a key is generated once and saved to `~/.the-mesh/key` (mode `0600`, git-ignored, never printed).

## Your key is your identity — back it up
The bridge's identity **is** its key. If `~/.the-mesh/key` is lost, the record continues under a new npub and the old identity cannot be recovered — there is no reset. Copy the file somewhere safe the first time it's created. To sign the mesh record under the **same** identity as [The Record](https://github.com/michaelditter/the-record) (so both tools speak as one town voice), export that tool's nsec and pass it here as `MESH_NSEC` instead of letting the bridge generate its own.

## Troubleshooting
- **`meshtastic.local` doesn't resolve** → pass the node's IP directly: `MESH_HOST=192.168.1.42`.
- **`WebSocket is not defined`** → you're on Node < 22. Upgrade Node.
- **Nothing gets recorded** → messages must start with `!record ` (the consent prefix) and be broadcast, not direct. Check the connect log line for the active prefix.
- **`(no relay accepted it)`** → the relays rejected or were unreachable; try different `MESH_RELAYS`, and confirm the bridge machine has internet.
- **HTTP API errors on connect** → enable the HTTP/Web API in the Meshtastic client's Network settings on a recent firmware, and confirm the node is on your Wi-Fi.

## The recording method, made real
One of *one real tool per recording layer*:
- **Print → Nostr:** [The Record](https://github.com/michaelditter/the-record).
- **Correspondence → CRDT:** [The Correspondence](https://github.com/michaelditter/the-correspondence).
- **Oath → Ostrom charter:** [The Charter](https://github.com/michaelditter/the-charter).
- **Sermon + post → LoRa mesh:** this — records *through* The Record.

MIT licensed. Built for *You Cannot Eat Code*.
