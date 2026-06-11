#!/usr/bin/env node
// ============================================================
// The Mesh — bridge a Meshtastic (LoRa) node to Nostr.
//
//   mesh → nostr : every text heard on the off-grid mesh becomes a
//                  permanent, signed public record (a "sermon" that outlives the air).
//   nostr → mesh : (optional) notes tagged #mesh-out are spoken back onto the mesh,
//                  so the permanent record can reach people who are off the internet.
//
// REQUIRES A MESHTASTIC NODE. This is real radio — there is no software-only mode,
// and that is the honest point of this layer. See MESH.md to get on the mesh (~$25).
//
// Run:  MESH_HOST=192.168.1.42 node bridge.mjs
// Env:  MESH_HOST (node IP/hostname, default meshtastic.local)
//       MESH_DIRECTION = mesh-to-nostr | both     (default mesh-to-nostr)
//       MESH_RELAYS    = comma-separated wss URLs
//       MESH_NSEC      = your signing key (else generated + saved to ~/.the-mesh/key)
// ============================================================
import { MeshDevice } from '@meshtastic/core';
import { TransportHTTP } from '@meshtastic/transport-http';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import * as nip19 from 'nostr-tools/nip19';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = process.env.MESH_HOST || 'meshtastic.local';
const DIRECTION = process.env.MESH_DIRECTION || 'mesh-to-nostr';
const RELAYS = (process.env.MESH_RELAYS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
  .split(',').map((s) => s.trim()).filter(Boolean);

// --- signing key (same convention as The Record) ---
const KEY_DIR = join(homedir(), '.the-mesh');
const KEY_FILE = join(KEY_DIR, 'key');
function loadKey() {
  if (process.env.MESH_NSEC) return nip19.decode(process.env.MESH_NSEC.trim()).data;
  if (existsSync(KEY_FILE)) return nip19.decode(readFileSync(KEY_FILE, 'utf8').trim()).data;
  const s = generateSecretKey();
  mkdirSync(KEY_DIR, { recursive: true });
  writeFileSync(KEY_FILE, nip19.nsecEncode(s) + '\n', { mode: 0o600 });
  console.log('● New mesh identity created — back it up:', KEY_FILE);
  return s;
}
const SK = loadKey();
const pool = new SimplePool();

async function recordToNostr(text, from) {
  const ev = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'therecord'], ['t', 'youcannoteat'], ['t', 'mesh'], ['client', 'the-mesh']],
    content: text
  }, SK);
  try {
    await Promise.any(pool.publish(RELAYS, ev));
    console.log(`mesh→nostr  from ${from}: "${text}"  →  https://njump.me/${nip19.noteEncode(ev.id)}`);
  } catch (e) {
    console.error('  (no relay accepted it)', (e && e.message) || e);
  }
}

async function main() {
  console.log(`The Mesh — connecting to node at ${HOST} …`);
  const connection = await TransportHTTP.create(HOST);
  const device = new MeshDevice(connection);

  // Receive decoded text packets from the mesh and record each one.
  // NOTE: @meshtastic/core exposes decoded streams under device.events.* . The text-message
  // stream and the packet shape are version-sensitive — verify against your installed
  // @meshtastic/core (this targets ^2.6). If the event name differs, adjust here only.
  const onText = device.events?.onMessagePacket || device.events?.onTextPacket;
  if (!onText || typeof onText.subscribe !== 'function') {
    throw new Error('Could not find the text-message event on this @meshtastic/core version — check device.events and update the subscribe() line.');
  }
  onText.subscribe((packet) => {
    const text = (packet && (packet.data ?? packet.text ?? packet.payload));
    const from = (packet && (packet.from ?? packet.fromNodeNum)) ?? 'unknown';
    if (typeof text === 'string' && text.trim()) recordToNostr(text.trim(), from);
  });

  await device.configure();
  console.log(`Listening. Mesh text → ${RELAYS.length} relays. Signing as ${nip19.npubEncode(getPublicKey(SK))}.`);

  // Optional: forward Nostr notes tagged #mesh-out onto the mesh.
  if (DIRECTION === 'both') {
    pool.subscribeMany(RELAYS, [{ kinds: [1], '#t': ['mesh-out'], since: Math.floor(Date.now() / 1000) }], {
      onevent(ev) {
        const msg = (ev.content || '').slice(0, 200); // LoRa packets are small
        device.sendText(msg).then(() => console.log('nostr→mesh:', msg)).catch((e) => console.error('  send failed', e));
      }
    });
    console.log('Also forwarding #mesh-out notes onto the mesh.');
  }
}

main().catch((e) => { console.error('Bridge error:', (e && e.message) || e); process.exit(1); });
