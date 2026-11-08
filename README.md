# Scribble 🎨

A fast, real-time multiplayer drawing and guessing game built with React 19, Vite, Tailwind CSS, Node.js, Express, Socket.IO, and WebRTC Voice Chat.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 22+
- npm 10+

### 1. Installation
Install all dependencies across the monorepo:
```bash
npm install
```

### 2. Environment Variables
Copy the example environment configurations:
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```
- `client/.env`: `VITE_API_URL=http://localhost:3001` (optional: `VITE_ICE_SERVERS`)
- `server/.env`: `PORT=3001`, `CLIENT_URL=http://localhost:5173`

### 3. Running Locally
Start both backend and frontend servers:

```bash
# Terminal 1: Backend server
cd server && npm run dev

# Terminal 2: Frontend client
cd client && npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Quality Checks & Testing

A single root command verifies the entire repository:
```bash
npm run check
```
This runs:
1. `npm run sync:shared`: Synchronizes ESM shared event types into CommonJS for the server.
2. `npm run lint`: Runs ESLint on both `client` (with `react-hooks` rules) and `server`.
3. `npm run test`: Runs client unit tests via Vitest and 59 automated server tests via `node:test`.
4. `npm run build`: Generates the production build of the React client.

### Running Individual Tests
```bash
# Server tests (node:test)
npm run test:server

# Client tests (Vitest)
npm run test:client

# Linting
npm run lint
```

---

## Continuous Integration (CI)

A GitHub Actions workflow is located at `.github/workflows/ci.yml`. On every pull request and push to `main`, it runs:
- Node.js 22 environment
- `npm ci`
- `npm run check`

---

## Deployment (Render Blueprint)

Scribble is deployed as a single web service via Render's Infrastructure-as-Code blueprint (`render.yaml`). The Express backend serves the pre-built React application from `client/dist`.

### Blueprint Configuration (`render.yaml`)
- **Service Type**: Single Web Service (`node`)
- **Build Command**: `npm ci --prefix client && npm run build --prefix client && npm ci --prefix server`
- **Start Command**: `node server/src/server.js`
- **Health Check Endpoint**: `/healthz`
- **Environment**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000`
  - `CLIENT_URL`: Automatically linked to the service's own URL

To deploy, connect your repository to Render as a **Blueprint**. No configuration is required beyond optional `VITE_ICE_SERVERS`.

---

## WebRTC Voice Chat & Custom ICE / TURN Servers

Scribble includes peer-to-peer mesh voice chat for up to 6 players per room. By default, Google and Twilio public STUN servers are used for NAT traversal.

In symmetric NAT or restrictive firewall environments (e.g., cellular networks), peer-to-peer connections may require a **TURN relay server**.

### Configuring Custom STUN / TURN Servers
Set the `VITE_ICE_SERVERS` environment variable in `client/.env` (or in your hosting provider):

```env
VITE_ICE_SERVERS='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp"],"username":"my-user","credential":"my-password"}]'
```

---

## Features

- **Authoritative Server**: Server is the sole authority for game state, timer ticks, stroke limits, and word secrecy.
- **Opt-in Voice Chat**:
  - Receive-only mode on join; microphone permission requested only on first mic click.
  - Lexicographically deterministic initiator rule and polite peer negotiation.
  - Active speaker detection with dynamic audio analyser rings.
  - Autoplay blocking detection with a one-tap recovery banner.
- **Fair & Safe Guessing**:
  - Pure Levenshtein distance matching for close guesses.
  - Isolated `:guessed` channel preventing spoiler leaks to active guessers.
  - Real-time profanity filtering.
- **Word Packs & Custom Words**:
  - Clean, concrete drawable words partitioned across Easy, Medium, and Hard tiers.
  - Themed packs: Animals, Food, Places, Objects, Actions.
  - Host-configured custom words mixed in at ~30% weight.
- **Live Canvas**:
  - 4:3 letterboxed fixed paper backing store.
  - Batch streamed pointer curves with midpoint smoothing.
- **Resilience**:
  - 60-second disconnect grace periods with automatic state snapshots on rejoin.
  - React `ErrorBoundary` with fallback UI and reload button.
  - Process-level `uncaughtException` and `unhandledRejection` handlers.
