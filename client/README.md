# Scribble Client (React + Vite)

This is the front-end client for Scribble, built with React 19, Vite, and Tailwind CSS.

## WebRTC Voice Chat Configuration

Scribble supports custom STUN and TURN servers for reliable voice chat across firewalls and symmetric NATs.

Set the `VITE_ICE_SERVERS` environment variable in your `.env` file as a JSON array of `RTCIceServer` configurations:

```env
VITE_ICE_SERVERS='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478"],"username":"user","credential":"pass"}]'
```

If not provided, Scribble falls back to public Google and Twilio STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:global.stun.twilio.com:3478`

## Development
```bash
npm install
npm run dev
npm run build
```
