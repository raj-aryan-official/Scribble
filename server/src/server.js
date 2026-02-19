const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, ""),
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

// Serve static files from the React client
const path = require('path');
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
