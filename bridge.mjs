#!/usr/bin/env node
// ============================================================
// The Mesh — bridge a Meshtastic (LoRa) node to Nostr.
//
//   mesh → nostr : mesh messages that opt in (prefixed !record) become a
//                  durable, signed public record — replicated across relays,
//                  recallable by no single platform (a "sermon" that outlives the air).
//   nostr → mesh : (optional) notes tagged #mesh-out from an allowlisted author
//                  are spoken back onto the mesh, so the record can reach people
//                  who are off the internet.
//
// The bridge's key ATTESTS that this bridge heard a given message at a given time.
// It does NOT prove who spoke: authorship, when known, is carried in the mesh_from
// tag, not the signature. Durable, not eternal — a record lives as long as one
// relay keeps a copy.
//
// REQUIRES A MESHTASTIC NODE. This is real radio — there is no software-only mode,
// and that is the honest point of this layer. See MESH.md to get on the mesh (~$25).
//
// Run:  MESH_HOST=192.168.1.42 node bridge.mjs
// Env:  MESH_HOST (node IP/hostname, default meshtastic.local)
//       MESH_DIRECTION     = mesh-to-nostr | both     (default mesh-to-nostr)
//       MESH_RELAYS        = comma-separated wss URLs
//       MESH_NSEC          = your signing key (else generated + saved to ~/.the-mesh/key)
//       MESH_RECORD_PREFIX = prefix a mesh message must start with to be recorded
//                            (default "!record "; set to "" to record everything —
//                            only on a channel whose members have all consented)
//       MESH_OUT_AUTHORS   = comma-separated npub/hex authors allowed to drive the
//                            radio in both-mode (default: the bridge's own key only)
// ============================================================
import { MeshDevice } from '@meshtastic/core';
import { TransportHTTP } from '@meshtastic/transport-http';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import * as nip19 from 'nostr-tools/nip19';
import * as NostrTools from 'nostr-tools';
import { buildRecord, signRecord, publishRecord, recordLinks } from '@youcannoteat/record-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = process.env.MESH_HOST || 'meshtastic.local';
const DIRECTION = process.env.MESH_DIRECTION || 'mesh-to-nostr';
const RELAYS = (process.env.MESH_RELAYS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
  .split(',').map((s) => s.trim()).filter(Boolean);
// Only mesh messages starting with this prefix become records. This is the consent
// boundary: a neighbor's radio chatter is NOT recorded unless they opt in with the
// prefix. Set MESH_RECORD_PREFIX="" to record everything (dedicated consented channel only).
const RECORD_PREFIX = process.env.MESH_RECORD_PREFIX ?? '!record ';
// LoRa payloads are ~233 bytes; keep forwarded text under a safe byte budget.
const MAX_MESH_BYTES = 200;

// --- signing key (same convention as The Record) ---
const KEY_DIR = join(homedir(), '.the-mesh');
const KEY_FILE = join(KEY_DIR, 'key');
function decodeNsec(str, sourceLabel) {
  const decoded = nip19.decode(str.trim());
  if (decoded.type !== 'nsec') {
    throw new Error(`${sourceLabel} is a ${decoded.type}, not an nsec secret key. The Mesh needs the bridge's own nsec to sign records.`);
  }
  return decoded.data;
}
function loadKey() {
  if (process.env.MESH_NSEC) return decodeNsec(process.env.MESH_NSEC, 'MESH_NSEC');
  if (existsSync(KEY_FILE)) return decodeNsec(readFileSync(KEY_FILE, 'utf8'), KEY_FILE);
  const s = generateSecretKey();
  mkdirSync(KEY_DIR, { recursive: true });
  writeFileSync(KEY_FILE, nip19.nsecEncode(s) + '\n', { mode: 0o600 });
  console.log('● New mesh identity created — back it up:', KEY_FILE);
  return s;
}
const SK = loadKey();
const PUBKEY = getPublicKey(SK);
const pool = new SimplePool();

// Authors allowed to drive the radio in both-mode. Default: the bridge's own key
// only, because the operator's radio transmits on a shared license-free band.
function parseAuthors() {
  const raw = process.env.MESH_OUT_AUTHORS;
  if (!raw) return [PUBKEY];
  const out = [];
  for (const token of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (token.startsWith('npub')) {
      const decoded = nip19.decode(token);
      if (decoded.type === 'npub') out.push(decoded.data);
      else throw new Error(`MESH_OUT_AUTHORS entry "${token}" is not an npub.`);
    } else if (/^[0-9a-f]{64}$/i.test(token)) {
      out.push(token.toLowerCase());
    } else {
      throw new Error(`MESH_OUT_AUTHORS entry "${token}" is neither an npub nor a 64-char hex pubkey.`);
    }
  }
  return out.length ? out : [PUBKEY];
}

// Strip terminal control characters (mesh-sourced text lands in the operator's console).
function sanitizeForConsole(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '');
}

// Truncate a string so its UTF-8 byte length fits the LoRa payload budget.
function clampBytes(s, maxBytes) {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= maxBytes) return s;
  let out = s;
  while (enc.encode(out).length > maxBytes) out = out.slice(0, -1);
  return out;
}

async function recordToNostr(text, from, fromName) {
  // Built through record-core (the shared CRP core). Authorship is carried in the
  // mesh_from tag, not the signature: the bridge key attests only that this bridge
  // heard the message. The legacy 'therecord' hashtag is kept for continuity.
  const template = buildRecord({
    content: `[node ${from}] ${text}`, // prefix for humans on njump (most clients ignore custom tags)
    client: 'the-mesh',
    type: 'mesh',
    meshFrom: from,
    meshFromName: fromName,
    extraTags: [['t', 'therecord']]
  });
  const ev = signRecord(template, SK, NostrTools);
  const report = await publishRecord(ev, RELAYS, NostrTools);
  const safe = sanitizeForConsole(text);
  if (report.accepted === 0) {
    console.error(`  (no relay accepted it) from ${from}: "${safe}"`);
  } else {
    const { njump } = recordLinks(ev, NostrTools, RELAYS);
    console.log(`mesh→nostr  from ${from}: "${safe}"  →  accepted by ${report.accepted}/${report.total} relays  →  ${njump}`);
  }
}

async function main() {
  console.log(`The Mesh — connecting to node at ${HOST} …`);
  const connection = await TransportHTTP.create(HOST);
  const device = new MeshDevice(connection);

  // Watch device connection status: a "durable record" daemon must not run blind
  // if the node's Wi-Fi drops or the HTTP poll dies.
  const onStatus = device.events?.onDeviceStatus;
  if (onStatus && typeof onStatus.subscribe === 'function') {
    onStatus.subscribe((status) => {
      if (String(status).toLowerCase().includes('disconnect')) {
        console.error(`● Device status: ${status} — not recording until the node reconnects.`);
      }
    });
  }

  // Receive decoded text packets from the mesh and record ones that opt in.
  // NOTE: @meshtastic/core exposes decoded streams under device.events.* . The text-message
  // stream and the packet shape are version-sensitive — verify against your installed
  // @meshtastic/core (this targets ^2.6). If the event name differs, adjust here only.
  const onText = device.events?.onMessagePacket;
  if (!onText || typeof onText.subscribe !== 'function') {
    throw new Error('Could not find the text-message event (device.events.onMessagePacket) on this @meshtastic/core version — check device.events and update the subscribe() line.');
  }
  onText.subscribe((packet) => {
    const raw = (packet && (packet.data ?? packet.text ?? packet.payload));
    if (typeof raw !== 'string') return;
    const text = raw.trim();
    if (!text) return;
    // Consent boundary #1: only record broadcast messages, never direct/private messages.
    const to = packet && (packet.to ?? packet.toNodeNum);
    const isBroadcast = to === undefined || to === null || to === 0xffffffff || to === 4294967295 || to === 'broadcast';
    if (!isBroadcast) return;
    // Consent boundary #2: only record messages that opt in with the record prefix.
    if (RECORD_PREFIX && !text.startsWith(RECORD_PREFIX)) return;
    const body = RECORD_PREFIX ? text.slice(RECORD_PREFIX.length).trim() : text;
    if (!body) return;
    const from = (packet && (packet.from ?? packet.fromNodeNum)) ?? 'unknown';
    recordToNostr(body, from);
  });

  await device.configure();
  console.log(`Listening. Recording opt-in mesh text (prefix ${RECORD_PREFIX ? `"${RECORD_PREFIX}"` : 'DISABLED — recording everything'}) → ${RELAYS.length} relays. Signing as ${nip19.npubEncode(PUBKEY)}.`);

  // Optional: forward Nostr notes tagged #mesh-out onto the mesh.
  // #mesh-out is a PUBLIC tag — anyone can post to it — and this radio transmits on a
  // shared license-free band. So we forward ONLY notes signed by allowlisted authors
  // (default: the bridge's own key), rate-limit, and dedupe across relays.
  if (DIRECTION === 'both') {
    const ALLOWED = parseAuthors();
    const FORWARD_MIN_INTERVAL_MS = 30_000;
    const seen = new Set();
    let lastForward = 0;
    // nostr-tools 2.23.x subscribeMany takes a SINGLE filter object (not an array).
    pool.subscribeMany(RELAYS, { kinds: [1], '#t': ['mesh-out'], authors: ALLOWED, since: Math.floor(Date.now() / 1000) }, {
      onevent(ev) {
        if (seen.has(ev.id)) return;
        seen.add(ev.id);
        if (!ALLOWED.includes(ev.pubkey)) return; // defense in depth; relays may ignore authors filter
        const now = Date.now();
        if (now - lastForward < FORWARD_MIN_INTERVAL_MS) {
          console.error(`  rate-limited: dropping #mesh-out ${ev.id.slice(0, 8)} (min ${FORWARD_MIN_INTERVAL_MS / 1000}s between transmits)`);
          return;
        }
        lastForward = now;
        const msg = clampBytes((ev.content || '').trim(), MAX_MESH_BYTES); // LoRa packets are small
        if (!msg) return;
        device.sendText(msg)
          .then(() => console.log('nostr→mesh:', sanitizeForConsole(msg)))
          .catch((e) => console.error('  send failed', (e && e.message) || e));
      },
      onclose(reasons) {
        console.error('nostr→mesh subscription closed:', reasons);
      }
    });
    console.log(`Also forwarding #mesh-out notes from ${ALLOWED.length} allowlisted author(s) onto the mesh.`);
  }
}

main().catch((e) => { console.error('Bridge error:', (e && e.message) || e); process.exit(1); });
