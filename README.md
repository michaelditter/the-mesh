# The Mesh

**Bridge an off-grid radio mesh to the permanent record.**

A small bridge between a [Meshtastic](https://meshtastic.org) LoRa node and [Nostr](https://nostr.com): every text message heard on the off-grid mesh becomes a **permanent, signed public record**, and — optionally — records can be spoken back onto the mesh to reach people who have no internet. This is the **sermon and post layers** from *[You Cannot Eat Code](https://youcannoteat.codes)* — community broadcast and distribution that need no company, no tower, and no subscription.

> A sermon needed no infrastructure but a voice and a room. Mesh radio needs no internet — every node relays for its neighbors. The post rider's range, no permission.

## Honest first: this one needs a radio

Unlike the other tools in this series, **The Mesh is not software-only — and that's the point.** Off-grid mesh is *real radio*. No browser trick transmits over LoRa; anything claiming to would be a simulation, which this project refuses to ship. To run The Mesh for real you need a Meshtastic node — about **$25**. The code here is real and complete; it just needs a device to talk to. **[→ MESH.md](MESH.md)** gets you on the mesh in about 20 minutes.

## What it does
```bash
npm install
MESH_HOST=192.168.1.42 node bridge.mjs        # your node's IP/hostname
```
```
The Mesh — connecting to node at 192.168.1.42 …
Listening. Mesh text → 3 relays. Signing as npub1…
mesh→nostr  from 1128074276: "Trail closed past the bridge — water's up."  →  https://njump.me/note1…
```
- **mesh → nostr** (default): each text on the mesh is signed and broadcast to several relays — a permanent record of what was said off-grid, that no platform can recall.
- **nostr → mesh** (`MESH_DIRECTION=both`): notes tagged `#mesh-out` are spoken onto the mesh, so the permanent record reaches people who are off the internet.

Config via env: `MESH_HOST`, `MESH_DIRECTION`, `MESH_RELAYS`, `MESH_NSEC` (else a key is generated and saved to `~/.the-mesh/key`).

## Why this is the honest version
- The bridge connects over your node's HTTP API (`@meshtastic/core` + `@meshtastic/transport-http`) — works with a node on your Wi-Fi; swap in `@meshtastic/transport-node-serial` for a USB-tethered node.
- The Meshtastic event/packet API moves between versions. This targets `@meshtastic/core` `^2.6`; the bridge looks up the text event defensively and tells you exactly what to adjust if your version differs. **Not run-tested without a node** — verify against your hardware (which is the whole spirit of this layer).
- Signing reuses the same key model as [The Record](https://github.com/michaelditter/the-record).

## The recording method, made real
One of *one real tool per recording layer*:
- **Print → Nostr:** [The Record](https://github.com/michaelditter/the-record).
- **Correspondence → CRDT:** [The Correspondence](https://github.com/michaelditter/the-correspondence).
- **Oath → Ostrom charter:** [The Charter](https://github.com/michaelditter/the-charter).
- **Sermon + post → LoRa mesh:** this — records *through* The Record.

MIT licensed. Built for *You Cannot Eat Code*.
