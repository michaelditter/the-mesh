# Get on the mesh in ~20 minutes

Off-grid mesh is real radio, so it needs a real radio. The good news: one costs
about **$25**, and flashing it takes a few minutes in your browser. Here's the
whole path.

## 1. Buy a node (~$25–40)
Any [Meshtastic-supported](https://meshtastic.org/docs/hardware/devices/) LoRa
board works. Good first picks:
- **Heltec V3** (~$25) — cheap, has a small screen, USB-C.
- **LilyGO T-Beam** (~$35) — built-in GPS and a bigger battery, great for carrying.
- **RAK WisBlock** (~$30+) — modular, low power, good for a fixed node.

Buy the board for **your region's frequency** (US 915 MHz, EU 868 MHz) and an
antenna. **Never power a LoRa board on without its antenna attached** — it can
damage the radio.

## 2. Flash Meshtastic (in your browser)
1. Plug the board into your computer by USB.
2. Open the [**Meshtastic Web Flasher**](https://flasher.meshtastic.org) in Chrome or Edge.
3. Pick your device, click **Flash**. It installs the firmware over USB. (3 minutes.)

## 3. Set it up
Open the [Meshtastic web client](https://client.meshtastic.org) (or the phone app),
connect to your node, and set:
- **Region** (US / EU / …) — required before it will transmit.
- A **node name**.
- **Wi-Fi** credentials, and enable the **HTTP API** — this is how The Mesh bridge
  talks to it. Note the node's IP address (or use `meshtastic.local`).

You now have a working mesh node. With two or more, they relay for each other —
no internet, no tower, no subscription.

## 4. Run the bridge
First install **Node.js ≥ 22** ([nodejs.org](https://nodejs.org), or `nvm install 22`).
The bridge needs it, and it isn't the same thing as the radio — the radio is off-grid,
but the record-keeping runs on a computer with internet to reach the relays.

```bash
git clone https://github.com/michaelditter/the-mesh && cd the-mesh
npm ci                                  # reproducible install from the lockfile
MESH_HOST=<your-node-ip> node bridge.mjs
```
Send a **broadcast** text from the Meshtastic app that starts with `!record ` — you'll
see it become a durable public record with an `njump.me` link. Only messages that start
with `!record ` become records; ordinary chatter and direct messages are left alone. That
prefix is the consent boundary, so tell your mesh community a bridge is running.

To also forward records onto the mesh, run with `MESH_DIRECTION=both` and post a Nostr note
tagged `#mesh-out`. Note that `#mesh-out` is a **public tag anyone can post to**, and your
radio transmits on a shared band — so the bridge forwards only notes signed by an
allowlisted author (`MESH_OUT_AUTHORS`, default: the bridge's own key).

## Troubleshooting
- **`meshtastic.local` doesn't resolve?** Use the node's IP directly (`MESH_HOST=192.168.1.42`).
  Find it in the Meshtastic client under the node's network info.
- **HTTP API not reachable?** In the Meshtastic client, open the node's **Config → Network**
  settings and enable the Web/HTTP server (available on current firmware); confirm the node
  is joined to your Wi-Fi. Without it, the bridge can't connect.
- **`WebSocket is not defined`?** You're on Node < 22. Upgrade Node.
- **`(no relay accepted it)`?** The relays rejected or were unreachable. Try different
  `MESH_RELAYS`, and confirm the bridge machine has internet.

## Notes
- **USB instead of Wi-Fi?** Install `@meshtastic/transport-node-serial` and swap the
  transport import in `bridge.mjs` — the rest is the same.
- **Range:** a rooftop node with a decent antenna covers a town; nodes relay to extend it.
- **Verify the event API:** Meshtastic's JS packet/event names shift between versions.
  The bridge looks the event up defensively and tells you what to change if needed.
- **Two bridges on one mesh (both-mode):** each will re-record the other's forwarded
  `#mesh-out` transmissions as fresh mesh→nostr records, so N bridges produce N copies of a
  forwarded message. Run one bridge per mesh, or accept the duplication.
- This is the layer you can't fake — but it's also the one that works when the
  internet doesn't. That's why it's in the book.
