# Scribble

A real-time multiplayer drawing and guessing game with **built-in peer-to-peer voice chat**, six game modes, ten turn twists, and a 3,714-word database organized across four difficulty tiers.

No accounts, no downloads, no external voice app. Open a room, share the link, talk while you draw.

---

## Table of Contents

- [Why Scribble is different](#why-scribble-is-different)
- [Voice chat, built in](#voice-chat-built-in)
- [Game modes](#game-modes)
- [Rule twists](#rule-twists)
- [Word database](#word-database)
- [Fair guessing and scoring](#fair-guessing-and-scoring)
- [Canvas and controls](#canvas-and-controls)
- [Reliability and reconnection](#reliability-and-reconnection)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Testing](#testing)
- [CI and deployment](#ci-and-deployment)
- [STUN and TURN configuration](#stun-and-turn-configuration)
- [Privacy and security](#privacy-and-security)

---

## Why Scribble is different

Most online drawing games are a single canvas, a small word list, and a chat box. Scribble is built as a complete party-game platform:

| | Typical online drawing game | Scribble |
| --- | --- | --- |
| **Voice** | Third-party app, or none at all | Built-in WebRTC mesh voice chat with speaker rings, mute, and deafen |
| **Game modes** | One classic mode | Classic, Speed, Team, Relay, Hard, and Custom |
| **Rule variety** | Fixed rules | 10 optional twists that change how each turn is drawn or scored |
| **Word bank** | A few hundred words | 3,714 unique words across Easy, Medium, Hard, and Expert, plus 15 themed packs and host custom words |
| **Word fairness** | Random, often repetitive | Tier-balanced selection, recently-offered-word avoidance, and no repeats across a full game |
| **Authority** | Client-trusted state | Authoritative server for timers, scoring, strokes, turns, and word secrecy |
| **Reconnection** | Refresh and lose your score | Secret rejoin token restores your seat, score, rank, and turn |
| **Guessing** | Exact string match | Unicode-aware Levenshtein matching with "close!" feedback and spoiler-safe guess routing |
| **Devices** | Desktop-first | Verified from 360 px phones to 1920 px desktops, including landscape phones and open keyboards |
| **Accessibility** | Often overlooked | Keyboard shortcuts, ARIA labels, reduced-motion support, and axe accessibility checks in e2e |
| **Sign-up** | Account required | Nickname only |

### The short list

- **Talk while you play.** Voice is part of the game, not a bolt-on. Up to six players per room get low-latency, peer-to-peer audio.
- **Six ways to play.** Swap between classic play, fast rounds, team competition, shared-paper relay, hard mode, or fully custom rules without leaving the lobby.
- **Twists keep rounds unpredictable.** Mirror drawing, upside-down paper, blindfold, limited ink, wobbly pen, and more.
- **A word pool that stays fresh.** Over 3,700 drawable words, four difficulty tiers, 20 categories, 15 themed packs, and a selector that avoids recent repeats.
- **Built to recover.** Drop a connection, refresh a phone, or lose the host and the room keeps its state.

---

## Voice chat, built in

Voice is a first-class feature, not a link to Discord. Scribble creates a **peer-to-peer WebRTC mesh** between players in the same room, so audio goes directly between browsers instead of through the game server.

### What players get

- **Opt-in microphone.** Joining a room starts you in receive-only mode. The browser only asks for microphone permission when you first press the mic button.
- **Mute and deafen.** Mic state and voice output are separate toggles, and the voice output preference persists in settings.
- **Active speaker rings.** Each player avatar gets a live ring driven by Web Audio RMS analysis, so you can see who is talking.
- **Clear error recovery.** Denied permissions, missing devices, insecure contexts, and autoplay blocking each produce a human-readable message with a one-tap recovery path.
- **Room-size guard.** Voice is enabled for rooms of up to six players. Larger rooms keep full text chat and see an explicit explanation on the voice controls.

### How it stays stable

A naive WebRTC mesh breaks when both peers try to call each other at once. Scribble handles that with deterministic negotiation:

1. **Exactly one initiator per pair.** The peer with the lexicographically smaller socket id creates the offer.
2. **Polite-peer rollback.** The peer with the larger socket id yields on an offer collision and rolls back its local description.
3. **Serialized signaling.** Offer, answer, and ICE candidate handling is queued per peer to prevent race conditions.
4. **Candidate buffering.** ICE candidates that arrive before the remote description are queued and flushed in order.
5. **Duplicate-offer suppression.** Repeated offers with the same SDP are ignored.

### Voice architecture

```text
Player A browser  <==== Opus audio (P2P, DTLS-SRTP) ====>  Player B browser
        \                                                    /
         \____ Socket.IO signaling only (offer/answer/ICE) ___/
                              |
                        Scribble server
```

- Audio never passes through or is stored on the server.
- The server only relays WebRTC signaling events (`voiceJoin`, `voiceOffer`, `voiceAnswer`, `voiceLeave`).
- No recording, transcription, or voice data persistence exists.
- Default STUN servers are Google and Twilio. Symmetric NAT or strict corporate networks need a TURN relay (see [STUN and TURN configuration](#stun-and-turn-configuration)).

---

## Game modes

Six modes, each with its own defaults and rules:

| Mode | Rounds | Draw time | What makes it different |
| --- | --- | --- | --- |
| **Classic** | 3 | 60 s | Standard turn-based drawing and guessing |
| **Speed** | 8 | 30 s | Short turns, easy-word pool, fast scoring loop |
| **Team** | 3 | 60 s | 2-4 teams, shared team scores, only teammates guess for the team |
| **Relay** | 3 | 10 s per segment | One secret word; every player draws a segment on the same paper, then everyone guesses |
| **Hard** | 3 | 60 s | Hard word pool, only one hint ever, 1.5x points |
| **Custom** | Host choice | Host choice | Host controls time, hints, rounds, and score multiplier |

Mode behavior is implemented server-side in `server/src/modes/`, so the client cannot drift from the real rules.

---

## Rule twists

The host can leave twists off, enable them sometimes, apply them every turn, or choose exactly which ones are active. Twists are announced on a turn-intro card and applied authoritatively by the server.

| Twist | Effect |
| --- | --- |
| **One colour** | Colour locked to a single shade for the turn |
| **Limited ink** | Ink drains as you draw; undo refunds ink, eraser is free |
| **No undo or eraser** | Every mark is final for the turn |
| **Thin line** | Brush size locked at 2 px |
| **Mirror** | Every stroke is mirrored across the vertical centre line |
| **Upside-down** | The drawer's paper is rotated upside-down |
| **Blindfold** | After three seconds the drawer's paper goes dark |
| **Speed** | Half the draw time and double points |
| **Wobbly pen** | Jitter is added to every stroke |
| **First guesser bonus** | The first correct guesser scores double |

---

## Word database

Scribble currently ships **3,714 unique words**, generated and validated from category source files.

| Tier | Words | Examples |
| --- | --- | --- |
| **Easy** | 797 | sun, apple, dog, house, ball, tree |
| **Medium** | 1,353 | helicopter, telescope, dinosaur, waterfall, backpack |
| **Hard** | 1,022 | microscope, submarine, chandelier, archaeologist, parachute |
| **Expert** | 542 | uncommon but still drawable and guessable concepts |

### Categories

Animals, fruits and vegetables, food and drinks, household objects, electronics, vehicles, nature, human body, sports, professions, buildings, music, science and space, fantasy, clothing, tools, actions, funny words, school, and travel.

### Themed packs

The lobby exposes 15 packs: **Animals, Food & Drink, Objects, Places, Nature, Actions, Sports, Jobs, Science & Space, Fantasy, Music, Vehicles, Human Body, School, and Funny**. Packs map to one or more category files through `shared/wordPacks.json`, so the server, lobby chips, and tests all read the same source of truth.

### How words are chosen

- **Tier modes** draw only from the selected difficulty.
- **Mixed mode** offers three distinct tiers, guaranteeing an approachable word (Easy or Medium) and a challenging word (Hard or Expert).
- **Recently offered words are avoided**, even if they were not chosen, when alternatives exist.
- **Used words do not repeat** across a full game.
- **Pool-dry recovery** resets the used set but keeps the last ten words blocked.
- **Custom words** are sanitized (3-20 characters, blocklist-checked, max 50) and mixed in at roughly 30% weight.
- **Unknown packs are ignored** rather than crashing selection.

### Source of truth

```text
server/src/words/categories/*.json   <- edit these
        |
        v  npm run sync:words
server/src/words/{easy,medium,hard,expert}.json   <- generated, do not edit
```

The generator enforces lowercase 3-14 letter words, rejects blocklisted entries, fails on duplicate words anywhere in the database, and verifies that every category belongs to a pack. `npm run check:words` fails CI if the generated files are stale.

---

## Fair guessing and scoring

- Guesses are normalized with Unicode NFC, diacritic stripping, punctuation removal, and grapheme-aware comparison.
- **Close guesses** use Levenshtein distance and show non-spoiling feedback.
- Correct guessers join an isolated `:guessed` channel so their answers do not leak to players still guessing.
- The drawer can never submit a guess for their own word.
- Chat messages are profanity-filtered and the secret word is masked in chat.
- Guess points scale with time remaining: `50 + 450 * (timeLeft / drawTime)`.
- The first correct guesser gets a bonus; the drawer earns a share of guess points.
- Hard mode multiplies points by 1.5; custom mode uses the host's multiplier.

---

## Canvas and controls

- Fixed **4:3 paper** backing store with pointer-curve batching and midpoint smoothing for consistent strokes.
- **Pencil, eraser, and paint-bucket fill** tools, adjustable brush size (including a fine slider), and a colour palette.
- **Undo and clear**, with twist-aware disabling.
- **Keyboard shortcuts:** `P` pencil, `E` eraser, `F` fill, `[` / `]` brush size, `1-9` colour swatches, `Ctrl/Cmd+Z` undo.
- Stroke history is replayed to late joiners and reconnecting players.
- The game layout is measured against the paper, so word cards, timers, hints, and overlays stay inside the play area on short screens.

---

## Reliability and reconnection

- **Authoritative server:** game state, timers, turn order, stroke limits, scoring, and word secrecy live on the server.
- **Split identity:** a public per-room `playerId` plus a secret 32-byte hex rejoin token. Only the SHA-256 hash is stored, and comparison uses `crypto.timingSafeEqual`.
- **Away seats:** a disconnected player keeps their seat and score, transitions to `away`, then `left` after 90 seconds. Rejoining with the token restores score, rank, avatar, and turn state.
- **Seat claim:** a player without a token can request their old seat and the host accepts or declines.
- **Host continuity:** if the host drops, an acting host takes over; the original host regains control on rejoin.
- **Persistence:** `RoomStore` defaults to memory and can persist debounced snapshots to disk with `ROOM_STORE_DIR`. Active rooms are restored on boot with players marked `away`.
- **Failure handling:** React `ErrorBoundary`, calm edge-state screens, and process-level handlers for uncaught exceptions and unhandled rejections.

> Free hosting tiers with ephemeral filesystems can wipe disk snapshots on redeploy or spin-down unless a persistent volume is attached.

---

## Architecture

```text
.
├── client/                  React 19 + Vite 7 + Tailwind CSS 4
│   └── src/
│       ├── components/      Lobby, Game, Canvas, Chat, Voice controls, UI
│       ├── context/         Socket, settings, voice, game state
│       ├── hooks/           useSocket, useCanvas, useVoiceChat, useSound
│       └── utils/           voice math, difficulty lookup, pure helpers
├── server/                  Express 4 + Socket.IO 4 (in-memory rooms)
│   └── src/
│       ├── game/            turn loop, scoring, snapshots, turns
│       ├── handlers/        room, game, drawing, chat, reactions, voice, moderation
│       ├── modes/           classic, speed, team, relay, hard, custom
│       ├── words/           generated tiers + category source files
│       ├── RoomManager.js   settings validation, room lifecycle
│       ├── RoomStore.js     memory/disk persistence
│       └── wordBank.js      pack building and word selection
├── shared/
│   ├── types.js             event names, states, modes, twists (ESM source)
│   ├── types.cjs            generated CommonJS mirror for the server
│   └── wordPacks.json       pack id/label/category mapping
├── scripts/
│   ├── sync-shared.js       generates shared/types.cjs
│   └── build-word-db.js     validates categories, generates tier files
└── tests/e2e/               Playwright multiplayer and responsive scenarios
```

### Key event flow

1. Host creates a room; the server returns a room code and the host's rejoin token.
2. Players join by code or invite link and receive a public room snapshot.
3. The server starts a turn, offers three secret words only to the drawer (or assigns one random word), then starts the drawing phase.
4. Drawing strokes stream in batches; guessers receive strokes, hints, timer updates, and chat.
5. Correct guesses are scored server-side; the round ends when everyone guesses or time expires.
6. Between rounds, the server advances the turn queue and broadcasts scores and standings.

---

## Quick start

### Prerequisites

- Node.js 22+
- npm 10+
- A modern browser with WebRTC support for voice chat

### Install

```bash
npm install
```

### Environment

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

`server/.env.example` uses port **3001**:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
```

`client/.env.example` points at that server:

```env
VITE_API_URL=http://localhost:3001
# Optional STUN/TURN override:
# VITE_ICE_SERVERS=[{"urls":["stun:stun.l.google.com:19302"]}]
```

If no `.env` file is present, the server listens on port **3000**, and the client falls back to `http://localhost:3000` on localhost or the deployed API URL otherwise.

### Run

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open `http://localhost:5173`, create a room, and share the invite link. A game needs at least **2 players** (maximum **12**). Voice chat is available in rooms of up to **6** players.

> For microphone access, use `localhost` or HTTPS. Browsers block `getUserMedia` on plain HTTP origins that are not localhost.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` (inside `client` / `server`) | Start the Vite client or nodemon server |
| `npm run sync:shared` | Regenerate `shared/types.cjs` after editing `shared/types.js` |
| `npm run sync:words` | Validate category files and regenerate the four tier lists |
| `npm run check:words` | Fail if generated tier lists are stale |
| `npm run lint` | ESLint for client and server |
| `npm run test` | Client Vitest suite and server `node:test` suite |
| `npm run test:client` | Client unit and component tests |
| `npm run test:server` | Server unit, integration, and socket tests |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run build` | Production client build |
| `npm run check` | Shared sync, word-DB check, lint, all tests, e2e, and build |
| `npm run start --prefix server` | Start the production server |

---

## Testing

- **Client:** 259 Vitest tests across 20 files (components, hooks, reducers, pure functions, voice math).
- **Server:** 170 `node:test` tests across 15 files (rooms, turns, modes, scoring, guessing, word bank, security, persistence).
- **End-to-end:** 43 Playwright scenarios covering a full multiplayer game, drawing sync, chat deduplication, reconnection, host migration, seat claims, game modes, twists, reactions, sound, accessibility, responsive layouts from 360 px to 1920 px, and live word-database wiring.

Run everything with:

```bash
npm run check
```

The first Playwright run needs browsers installed:

```bash
npx playwright install
```

### Word database verification

```bash
npm run check:words   # generated files match category sources
npm run test:server   # includes dedupe, tier coverage, and pack coverage tests
npx playwright test tests/e2e/expandedWordDatabase.spec.js
```

---

## CI and deployment

### GitHub Actions

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

1. Node.js 22
2. `npm ci`
3. `npm run check`

### Render blueprint

Scribble deploys as a single Node web service. The Express server serves the built React app from `client/dist`.

- **Build command:** `npm ci && npm run build:client`
- **Start command:** `node server/src/server.js`
- **Health check:** `/healthz`
- **Environment:** `NODE_ENV=production`, `PORT=10000`, `CLIENT_URL=<service URL>`

Connect the repository as a Render **Blueprint**. No extra configuration is required unless you need a TURN server.

---

## STUN and TURN configuration

Voice chat uses a peer-to-peer mesh. Public STUN servers handle most home networks. Symmetric NAT, strict firewalls, and some cellular carriers require a TURN relay so audio can flow.

Set `VITE_ICE_SERVERS` in `client/.env` or in your hosting provider:

```env
VITE_ICE_SERVERS='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp"],"username":"my-user","credential":"my-password"}]'
```

Notes:

- The value must be valid JSON.
- Invalid JSON falls back to the default STUN servers with a console warning.
- TURN credentials should be short-lived and issued by your TURN provider, not hard-coded in a public repository.
- Voice is a mesh, so upload bandwidth grows with room size. Scribble caps voice at six players for this reason.

---

## Privacy and security

- **No accounts.** Players identify themselves with a nickname.
- **Voice audio is peer-to-peer.** The server relays signaling only; it never receives, records, or stores audio.
- **Word secrecy is server-enforced.** Only the drawer receives word choices. Non-drawers never receive the secret word in snapshots or events.
- **Guess privacy.** Correct guesses are routed to an isolated channel so active guessers do not see spoilers.
- **Rejoin tokens are hashed** with SHA-256 and compared in constant time.
- **Input sanitation.** Nicknames, chat, and custom words are trimmed, length-limited, profanity-filtered, and escaped by React rendering.
- **Rate limiting.** Chat and preview endpoints are rate-limited.
- **Environment secrets stay server-side.** Only `VITE_*` values are embedded in the client bundle; never put TURN credentials in a public build.

---

## Known limitations

- Voice chat is limited to rooms of up to six players because it is a peer-to-peer mesh.
- Rooms are held in memory by default; disk persistence is opt-in and unsuitable for ephemeral free hosting without a volume.
- There is no spectator role separate from players.
- TURN is not bundled. Networks that block direct peer connections need your own relay.
