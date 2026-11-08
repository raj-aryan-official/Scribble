# Scribble Codebase Audit & Bug Report

**Audit Date:** November 8, 2026  
**Repository:** Scribble (React 19 + Vite client, Node + Express + Socket.IO server, shared types)  
**Scope:** `client/src`, `server/src`, `shared`, build tooling, dependencies, and real-time wire protocol.  
**Constraint:** Read-only audit — no application code changes made.

---

## 1. Executive Summary & Verification Suite Status

Before code review, the full automated verification suite was executed:
- **Lint (`npm run lint`):** 0 errors, 0 warnings across client and server.
- **Client Unit Tests (`npm run test:client`):** 13 test files passed, 164 / 164 tests passed.
- **Server Unit Tests (`npm run test:server`):** 17 suites passed, 103 / 103 tests passed.
- **Production Build (`npm run build`):** Built in 1.19s. Output: `dist/assets/index-By1cC2XQ.js` (683 kB minified, 202.7 kB gzipped — under 250 kB limit). Note: Vite emits chunk size warning (>500 kB uncompressed).
- **Dependency Audit (`npm audit`):** 34 vulnerabilities reported (25 High, 7 Moderate, 2 Low).
- **Licenses:** All direct dependencies use permissive open-source licenses (MIT, ISC, Apache-2.0, BSD-2/3-Clause, MPL-2.0). No AGPL or copyleft issues. `package.json` at root and client omit explicit `license` field.

A 3-client simulated game over real TCP sockets was executed (`wire_audit.js`), capturing all network frames and validating event emission, channel isolation, and data payload sanitization.

---

## 2. Checklist Evaluation & Clean Areas

| Checklist Area | Findings Summary |
|---|---|
| **a. Game state machine & timers** | Explicit state machine in `server/src/game/machine.js` cleanly prevents illegal state transitions. Room timers (`interval`, `wordSelection`, `intermission`, `turnWait`, `drawerAway`, `hostGrace`, `pausedGrace`, `emptyCleanup`, `saveDebounceTimer`) are cleared on room deletion. |
| **b. Event trust** | `safeOn` validates payload shapes. Drawing handlers enforce drawer-only actions, room membership, and point limits (2000 points/stroke, 3000 strokes/room). Settings updates and game start are host-restricted. **One exception found: `KICK_PLAYER` allows host to kick themselves via `playerId` (BUG-08).** |
| **c. Data leaks** | **Zero secret leaks found.** Wire inspection confirmed guessers never receive `wordToGuess` until guess or round end; `tokenHash`, `rejoinToken`, and `sessionId` are never leaked in `toPublicRoom`, `toPublicPlayer`, or broadcasts. |
| **d. Reconnect & rejoin** | Full state snapshotting (`STATE_SNAPSHOT`), token authentication (`crypto.timingSafeEqual`), drawer turn pausing, acting host handover, and E6 superseded session handling function as specified. |
| **e. Ordering & concurrency** | `enqueueRoomAction` serializes all room actions into sequential per-room promise chains. **However, client omits `turnId` in payloads, causing E20 stale-packet rejection to be bypassed (BUG-01).** |
| **f. Memory and cleanup** | Socket listeners in `SocketContext` and `useCanvas` remove listeners properly on unmount. **However, `socketMessageTimestamps` in `chat.js` and token buckets in `rateLimiter.js` grow without bound (BUG-02, BUG-03).** |
| **g. React lifecycle & state** | State management is generally clean. **However, `state.scores` is mutated in place in `STATE_SNAPSHOT` (BUG-07), and `JOIN_ROOM` erroneously flips `joinedMidRound: true` for all players on mid-game room updates (BUG-06).** |
| **h. Canvas & coordinate mapping** | Canvas uses fixed 4:3 letterboxing with container queries and 0–1 normalized floating point coordinates. Aspect ratio, devicePixelRatio scaling, undo, and clear remain synchronized across viewports. |
| **i. Voice (WebRTC)** | Implements W3C Perfect Negotiation with deterministic `shouldInitiate` (smaller socket ID initiates), polite peer rollback on collision, and pre-remote-description ICE candidate queueing. 6-player limit enforced on server. |
| **j. Text & Unicode** | NFKC normalization and control character stripping prevent injection. **Stripping `\u200D` (ZWJ) decomposes composite emoji (BUG-09).** |
| **k. Config & deploy** | `render.yaml` sets `CLIENT_URL` to bare host, causing Socket.IO CORS failure on Render (BUG-04). `client/.env.example` has UTF-16LE encoding (BUG-10). |
| **l. Dependencies & licenses** | 34 vulnerabilities reported by `npm audit` (BUG-11). Permissive licensing throughout. |
| **m. Error handling & logging** | Calm error screens (`StatusScreen`, `ReconnectBanner`, `ErrorBoundary`, `EdgeState`) provide user-friendly copy with single actions. |

---

## 3. Comprehensive Findings Table

Sorted strictly by severity (`P0` to `P3`):

| ID | Sev | Area | File & Function | What Happens | Repro / Verification Status | Suggested Fix | Effort |
|---|---|---|---|---|---|---|:---:|
| **BUG-01** | **P1** | Concurrency / Ordering | `client/src/components/Game/GuessPanel.jsx` (`handleSubmit`), `client/src/hooks/useCanvas.js`, `client/src/components/Game/WordChoice.jsx` | Client omits `turnId` in `SEND_MESSAGE`, `CHOOSE_WORD`, and drawing stroke packets. Server E20 guard (`if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId)`) only checks if `payload.turnId` is truthy. Because client never sends `turnId`, late packets from earlier turns bypass turn validation. | **Confirmed.** Inspect `GuessPanel.jsx:102`, `useCanvas.js:338`, `WordChoice.jsx:88`. Emit `SEND_MESSAGE` without `turnId`; server accepts guess regardless of turn transitions. | Include `turnId: state.turnInfo?.turnId \|\| state.turnId` in `SEND_MESSAGE`, `CHOOSE_WORD`, and stroke events. | **S** |
| **BUG-02** | **P1** | Memory & Cleanup | `server/src/handlers/chat.js` (`socketMessageTimestamps`) | `socketMessageTimestamps` stores chat rate-limiting arrays per socket ID. Sockets that disconnect are never deleted from this Map. In long-running servers with many players, the Map grows indefinitely. | **Confirmed.** Connect and send chat messages across multiple sockets; inspect `socketMessageTimestamps.size`; entries are never evicted on disconnect. | Add `socket.on('disconnect')` cleanup to delete `socketMessageTimestamps.get(socket.id)`, or add a periodic sweep for timestamps older than 3 seconds. | **S** |
| **BUG-03** | **P1** | Memory & Cleanup | `server/src/handlers/rateLimiter.js` (`socketBuckets`, `ipBuckets`) | Token buckets for socket IDs and IPs are stored in `socketBuckets` and `ipBuckets` Maps. Neither Map has TTL expiration, max size eviction, or disconnect cleanup. Sockets and IPs accumulate forever in memory. | **Confirmed.** Trigger `checkLimit` with 1,000 distinct socket IDs or IPs; inspect `socketBuckets.size`; entries persist permanently. | Evict `socketBuckets` on socket disconnect; use an LRU cache or periodic TTL sweep (e.g. 10 minutes idle) for `ipBuckets`. | **S** |
| **BUG-04** | **P1** | Config & Deploy | `render.yaml` (lines 13–17) & `server/src/server.js` (lines 95–97) | `render.yaml` populates `CLIENT_URL` via Render's service `host` property (e.g., `scribble.onrender.com`), which omits `https://`. `server.js` checks Socket.IO CORS with `origin: (process.env.CLIENT_URL ...).replace(/\/$/, "")`. Browsers connecting from `https://scribble.onrender.com` are rejected with a CORS handshake error. | **Confirmed.** Set `CLIENT_URL=scribble.onrender.com` and connect with `Origin: https://scribble.onrender.com`; Socket.IO server rejects connection. | In `server.js`, normalize `CLIENT_URL` by prepending `https://` if no protocol is present. | **S** |
| **BUG-05** | **P2** | Game State & Scoring | `server/src/handlers/chat.js` (line 108) & `server/src/game/loop.js` (lines 167, 178) | `room.playerGuessTimes` is keyed by ephemeral `socket.id` instead of persistent `playerId`. If a player reconnects mid-game, their guess times are split across different socket IDs. When `calculateAwards` evaluates `fastestGuesser`, `room.players.find(p => p.id === bestGuesserId)` compares the new socket ID with the old socket ID, returns `undefined`, and awards `fastestGuesser: null`. | **Confirmed.** Player 1 has fastest guess in Turn 1, reconnects with new socket ID in Turn 2, game ends in Turn 3. `fastestGuesser` is `null`. | Key `room.playerGuessTimes` by `record.playerId`, and look up winner in `room.records`. | **S** |
| **BUG-06** | **P2** | React / State Management | `client/src/context/GameContext.jsx` (`gameReducer` case `JOIN_ROOM`, line 91) | When any player joins, rejoins, updates avatar, or resolves seat claim during a game, the server broadcasts `ROOM_JOINED`. `SocketContext` dispatches `JOIN_ROOM`. The reducer sets `joinedMidRound: Boolean(gameState !== 'LOBBY')`. This erroneously marks existing players (including the original host) with `joinedMidRound: true`, displaying the "You joined mid-round" notice on their screens. | **Confirmed.** Host starts game from lobby. A third player joins during round 1. Host receives `ROOM_JOINED`; `state.joinedMidRound` flips to `true`. | Preserve existing flag in `JOIN_ROOM` reducer: `joinedMidRound: state.joinedMidRound ?? false`. | **S** |
| **BUG-07** | **P2** | React / State Management | `client/src/context/GameContext.jsx` (`gameReducer` case `STATE_SNAPSHOT`, lines 112–114) | When `room?.scores` is undefined in snapshot, `updatedScores` assigns directly to `state.scores`. Then `updatedScores[myId] = snapshot.ownRecord.score` mutates the existing state object in place, potentially bypassing React re-renders. | **Confirmed.** Trigger snapshot where `publicRoom.scores` is undefined; `state.scores` object reference is mutated directly. | Create a shallow copy: `const updatedScores = { ...(room?.scores \|\| state.scores) };`. | **S** |
| **BUG-08** | **P2** | Event Trust & Auth | `server/src/handlers/room.js` (`KICK_PLAYER`, line 590) | The self-kick guard checks `if (targetId === socket.id)`. However, `targetId` can be the player's public `playerId` (e.g., `p_abc123`). Because `socket.id !== playerId`, a host can kick themselves from the room, permanently adding their own `playerId` to `kickedPlayerIds` and stranding the room. | **Confirmed.** Run node test with host sending `kickPlayer` with their own `playerId`; server emits `KICKED` to host and adds them to `kickedPlayerIds`. | Update check: `if (targetId === socket.id \|\| targetId === hostPlayer.playerId \|\| effectivePlayerId === hostRecord.playerId) return rejectWithError(socket, 'Cannot kick yourself');`. | **S** |
| **BUG-09** | **P2** | Text & Unicode | `server/src/sanitise.js` (`sanitiseText`, line 14) | `sanitiseText` strips `\u200D` (Zero-Width Joiner) as part of `\u200B-\u200D`. Stripping `\u200D` decomposes composite emoji sequences (e.g. family `👨‍👩‍👧‍👦` becomes `👨👩👧👦`, skin tone handshakes `🤝🏽` decompose into two separate glyphs). | **Confirmed.** `sanitiseText('👨‍👩‍👧‍👦')` returns `'👨👩👧👦'`. | Exclude `\u200D` from zero-width removal when adjacent to emoji code points, or strip only `\u200B` and `\uFEFF`. | **S** |
| **BUG-10** | **P2** | Config & Tooling | `client/.env.example` | File is encoded in UTF-16LE with Byte Order Mark (`\xFF\xFE`) instead of UTF-8. Copying to `.env` causes standard Unix/Vite dotenv parsers to fail or parse keys with embedded NUL (`\x00`) bytes. | **Confirmed.** `file client/.env.example` reports `Unicode text, UTF-16, little-endian text`. | Re-save `client/.env.example` as standard UTF-8 text without BOM. | **S** |
| **BUG-11** | **P3** | Dependencies | `package-lock.json` | 34 vulnerabilities reported by `npm audit` (25 High, 7 Moderate, 2 Low) in indirect dependencies (`ws`, `vite`, `rollup`, `socket.io-parser`, `brace-expansion`, `engine.io`, `ajv`, `flatted`). | **Confirmed.** `npm audit` exit code 1; 34 advisories found. | Run `npm audit fix` for non-breaking packages; update Vite and Socket.IO dependencies to patched minor releases. | **M** |
| **BUG-12** | **P3** | React / Accessibility | `client/src/pages/Game.jsx` (lines 485, 520) & `client/src/components/Chat/MessageList.jsx` (lines 91, 104) | `Game.jsx` renders both mobile and desktop `<GuessPanel>` elements simultaneously, hiding one via CSS (`md:hidden` vs `hidden md:flex`). Both instances maintain active screen reader live regions (`role="status" aria-live="polite"`), causing screen readers to announce messages twice. `MessageList` also uses `key={idx}` for chat lines. | **Confirmed.** Inspect DOM tree; two `<aside aria-label="Chat and guesses">` elements exist in the DOM simultaneously. | Conditionally mount mobile vs desktop GuessPanel using window size or container query rather than keeping both in DOM, and use unique message IDs for list keys. | **M** |
| **BUG-13** | **P3** | Reconnect / Network | `client/src/context/SocketContext.jsx` (`handleVisibilityChange`, line 94) | When a mobile device resumes from background sleep, `handleVisibilityChange` only invokes `attemptRejoin()` if `socket.connected` is true. If the OS severed the WebSocket while suspended, the socket is disconnected. Instead of reconnecting immediately, it waits for Socket.IO's exponential backoff timer (up to 5 seconds). | **Confirmed.** Code inspection of `handleVisibilityChange`; if `!socket.connected`, no reconnect is triggered until the auto-reconnect timer fires. | In `handleVisibilityChange`: `if (!socket.connected) socket.connect(); else attemptRejoin();`. | **S** |
| **BUG-14** | **P3** | Game State / History | `server/src/game/loop.js` (line 600) | When saving round drawings into `matchDrawings`, `room.players.find(p => p.id === room.drawerId)` checks only `p.id` against `room.drawerId`. If the drawer disconnected or is away, `room.drawerId` is their `playerId` rather than `socket.id`, causing `drawer` to be undefined and storing `drawerName: 'Unknown'`. | **Confirmed.** Code inspection; if drawer disconnected before round end, `drawer` lookup fails and defaults to `'Unknown'`. | Check `room.records?.get(room.drawerId)?.username \|\| drawer?.username \|\| 'Unknown'`. | **S** |
| **BUG-15** | **P3** | Chat / Masking | `server/src/handlers/chat.js` (`maskWord`, line 27) | `maskWord` replaces regex of the exact word. If players use custom words containing spaces (e.g. "hot dog"), and a user types "hotdog" inside a sentence, `maskWord` regex `/hot dog/gi` does not match, leaking the word in chat. | **Confirmed.** `maskWord('i think it is hotdog', 'hot dog')` returns unmasked `'i think it is hotdog'`. | In `maskWord`, also mask the normalized variant without spaces (`normWord.replace(/\s+/g, '')`). | **S** |

---

## 4. Top 10 to Fix First

1. **BUG-01 (P1): Attach `turnId` to client chat, drawing, and word choice payloads.**  
   *Why:* Core synchronization guardrail E20 is completely inactive because client payloads omit `turnId`. Simple fix, high architectural value.
2. **BUG-04 (P1): Sanitize `CLIENT_URL` in `server/src/server.js` for Render deployments.**  
   *Why:* Direct blocker for production deployments on Render. A missing `https://` protocol will cause every incoming browser WebSocket handshake to fail CORS.
3. **BUG-02 (P1): Clean up `socketMessageTimestamps` on socket disconnect.**  
   *Why:* Prevents slow memory leak in chat rate-limiting store on persistent server instances.
4. **BUG-03 (P1): Add eviction/TTL to `socketBuckets` and `ipBuckets` in `rateLimiter.js`.**  
   *Why:* Unbounded memory growth in rate limiting maps for every unique socket connection and client IP.
5. **BUG-05 (P2): Key `playerGuessTimes` by `playerId` instead of `socket.id`.**  
   *Why:* Restores Fastest Guesser award calculation for players who reconnect during a game session.
6. **BUG-08 (P2): Prevent host self-kick via `playerId` in `KICK_PLAYER`.**  
   *Why:* Closes authorization loophole where the host can accidentally or maliciously kick themselves and break room ownership.
7. **BUG-06 (P2): Preserve `joinedMidRound` in `JOIN_ROOM` reducer.**  
   *Why:* Fixes misleading "You joined mid-round" UI banner appearing on existing players' screens when someone joins or updates settings mid-game.
8. **BUG-07 (P2): Avoid in-place mutation of `state.scores` in `STATE_SNAPSHOT` reducer.**  
   *Why:* Follows strict React immutability rules to ensure components consuming scores re-render accurately.
9. **BUG-10 (P2): Convert `client/.env.example` to UTF-8.**  
   *Why:* Prevents developer environment setup failures and subtle dotenv parsing bugs caused by UTF-16LE encoding.
10. **BUG-13 (P3): Trigger immediate `socket.connect()` on mobile `visibilitychange`.**  
    *Why:* Eliminates up to 5-second connection delay when unlocking a mobile phone during a game.

---

## 5. Things That Look Wrong But Are Fine

1. **"Chat messages appearing twice on the client"**  
   - *Observation:* Hypothesized in earlier review notes.  
   - *Audit finding:* Verified clean. The server emits `MESSAGE_RECEIVED` exactly once per message. The client does not use optimistic message dispatch in `GuessPanel.jsx`. In `SocketContext.jsx`, `socket.off(EVENTS.MESSAGE_RECEIVED)` removes all listeners on unmount. On `STATE_SNAPSHOT`, `state.messages` is replaced with `recentChat`, not appended. Chat messages appear exactly once.
2. **"The 'drawerWord' listener is never removed in SocketContext"**  
   - *Observation:* Hypothesized in earlier review notes.  
   - *Audit finding:* Verified clean. Line 318 in `client/src/context/SocketContext.jsx` explicitly executes `socket.off(EVENTS.DRAWER_WORD);` in the `useEffect` cleanup return block.
3. **"The effect in SocketContext re-subscribes on every render because useSound returns a new play function"**  
   - *Observation:* Hypothesized in earlier review notes.  
   - *Audit finding:* Verified clean. In `client/src/hooks/useSound.js` (line 22), `play` is wrapped in `useCallback((name) => { audioManager.play(name); }, [])` with an empty dependency array. The function reference is referentially stable across renders and does not trigger re-subscription in `SocketContext.jsx`.
4. **"RoomStore saveDebounceTimer recreating deleted room"**  
   - *Observation:* `scheduleRoomSave` schedules a 1000 ms debounce timer. If `deleteRoom` runs before the timer fires, one might suspect the debounce callback would save the room back into the store.  
   - *Audit finding:* Verified clean. In `server/src/RoomManager.js` (lines 192–195), `clearRoomTimers(room)` explicitly checks and cancels `room.saveDebounceTimer`:  
     ```javascript
     if (room.saveDebounceTimer) {
         clearTimeout(room.saveDebounceTimer);
         room.saveDebounceTimer = null;
     }
     ```  
     Empirical test verified that deleted rooms are not resurrected.
5. **"Double WebRTC offers causing signaling deadlock on simultaneous voice join"**  
   - *Observation:* In a peer-to-peer mesh, two users joining voice at the same moment could trigger colliding offers.  
   - *Audit finding:* Verified clean. `shouldInitiate(myId, peerId)` strictly dictates that only the socket with the lexicographically smaller ID generates an offer. The polite peer pattern (`isPolitePeer`, `rollback`) resolves any race condition deterministically.
6. **"Token exposure in public broadcasts"**  
   - *Observation:* `room.records` holds `tokenHash`, `rejoinToken`, and `sessionId`.  
   - *Audit finding:* Verified clean. `toPublicRoom` and `toPublicPlayer` explicitly whitelist only public presentation fields. Wire analysis confirmed secret tokens never appear in broadcasts.
7. **"Action queue deadlock when an event handler throws"**  
   - *Observation:* If an action in `enqueueRoomAction` throws an uncaught error, could subsequent actions in that room be blocked forever?  
   - *Audit finding:* Verified clean. `enqueueRoomAction` catches errors, logs them, rejects safely, and calls `roomChains.delete(roomCode)` in `.finally()`. Next actions continue unaffected.

