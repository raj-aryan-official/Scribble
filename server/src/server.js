const express = require('express');
const http = require('http');
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

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, ""),
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

// Serve static files from the React client
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist', 'index.html'));
});

if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

module.exports = { app, server, io };
