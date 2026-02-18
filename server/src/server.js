const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Vite dev server port
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

const socketHandlers = require('./socketHandlers');

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Initialize socket handlers
    socketHandlers(io, socket);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
