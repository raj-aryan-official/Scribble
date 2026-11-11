const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const roomManager = require('./RoomManager');
const socketHandlers = require('./socketHandlers');
const logger = require('./logger');

// Process-level error handlers that log and exit non-zero
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const app = express();
app.use(cors());

// Health check endpoint returning 200 with room count
app.get('/healthz', (req, res) => {
    res.status(200).json({ rooms: roomManager.rooms.size });
});

// In-memory rate limiter: 20 requests per minute per IP (configurable for test runs)
const ipPreviewRateLimits = new Map();
const PREVIEW_RATE_LIMIT_MAX = Number(process.env.PREVIEW_RATE_LIMIT_MAX) || 20;

const previewRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = PREVIEW_RATE_LIMIT_MAX;

    let record = ipPreviewRateLimits.get(ip);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
        ipPreviewRateLimits.set(ip, record);
    } else {
        record.count++;
    }

    if (record.count > maxRequests) {
        return res.status(429).json({ error: 'Too many preview requests, please try again later.' });
    }

    if (ipPreviewRateLimits.size > 1000) {
        for (const [key, value] of ipPreviewRateLimits.entries()) {
            if (now > value.resetTime) {
                ipPreviewRateLimits.delete(key);
            }
        }
    }

    next();
};

// Room Preview API: returns only public fields for invite link previews
app.get('/api/rooms/:code/preview', previewRateLimiter, (req, res) => {
    const roomCode = (req.params.code || '').trim().toUpperCase();
    const room = roomManager.getRoom(roomCode);

    if (!room) {
        return res.status(200).json({
            exists: false,
            playerCount: 0,
            maxPlayers: 0,
            hostName: null,
            hostAvatar: null,
            state: null,
            round: 0,
            totalRounds: 0,
        });
    }

    const host = room.players.find(p => p.isHost) || room.players[0];

    return res.status(200).json({
        exists: true,
        playerCount: room.players.length,
        maxPlayers: room.settings?.maxPlayers || 12,
        hostName: host ? host.username : null,
        hostAvatar: host ? host.avatar : null,
        state: room.gameState,
        round: room.currentRound || 1,
        totalRounds: room.settings?.rounds || room.totalRounds || 3,
    });
});

const server = http.createServer(app);
const normalizeOrigin = (value) => {
    if (!value) return null;
    const trimmed = value.trim().replace(/\/$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const CLIENT_URL = normalizeOrigin(process.env.CLIENT_URL);

const io = new Server(server, {
    cors: {
        // Reflect any origin unless CLIENT_URL pins the frontend host
        origin: CLIENT_URL || true,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    // Initialize socket handlers
    socketHandlers(io, socket);

    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.id}`);
    });
});

// Serve the React build when present (single-service deploys); API-only
// deploys (client hosted separately) have no client/dist to serve
const clientDistDir = path.join(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDistDir, 'index.html'))) {
    app.use(express.static(clientDistDir));

    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDistDir, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({ service: 'Scribble API', status: 'ok', health: '/healthz' });
    });
}

if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

module.exports = { app, server, io };
