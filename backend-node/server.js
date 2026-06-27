const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send({ status: 'Signaling server is running', timestamp: new Date() });
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // In production, replace with specific frontend domains
    methods: ['GET', 'POST']
  }
});

// Maps socket.id to user details { roomId, userId, username }
const users = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', ({ roomId, userId, username }) => {
    socket.join(roomId);
    
    // Register user details
    users.set(socket.id, { roomId, userId, username });
    console.log(`User ${username} (${userId}) joined room ${roomId}`);

    // Get list of all other users already in the room
    const otherUsers = [];
    users.forEach((value, key) => {
      if (value.roomId === roomId && key !== socket.id) {
        otherUsers.push({
          socketId: key,
          userId: value.userId,
          username: value.username
        });
      }
    });

    // Send the list of existing users to the newly joined user
    socket.emit('all-users-in-room', otherUsers);

    // Notify other users in the room that a new user joined
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      username
    });
  });

  // Relay WebRTC signals (Offers, Answers, ICE Candidates)
  socket.on('send-signal', ({ targetSocketId, signalData }) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    // Relay to the target peer
    io.to(targetSocketId).emit('receive-signal', {
      senderSocketId: socket.id,
      signalData,
      senderUsername: sender.username,
      senderUserId: sender.userId
    });
  });

  // Real-time Chat
  socket.on('send-message', ({ messageText, time }) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const chatMessage = {
      senderSocketId: socket.id,
      userId: sender.userId,
      username: sender.username,
      text: messageText,
      time: time || new Date().toISOString()
    };

    // Broadcast to everyone in the room (including sender to confirm receipt or let frontend handle it locally)
    io.to(sender.roomId).emit('new-message', chatMessage);
  });

  // Whiteboard drawings synchronisation
  socket.on('draw-stroke', (drawData) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    // Broadcast to other users in the same room
    socket.to(sender.roomId).emit('receive-stroke', drawData);
  });

  // Clear Whiteboard
  socket.on('clear-whiteboard', () => {
    const sender = users.get(socket.id);
    if (!sender) return;

    // Broadcast to other users
    socket.to(sender.roomId).emit('clear-whiteboard');
  });

  // File Upload Notification
  socket.on('file-uploaded-notify', () => {
    const sender = users.get(socket.id);
    if (!sender) return;

    // Broadcast to other users in the room
    socket.to(sender.roomId).emit('file-uploaded');
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`User ${user.username} (${socket.id}) disconnected`);
      
      // Notify other users in the room
      socket.to(user.roomId).emit('user-disconnected', {
        socketId: socket.id,
        userId: user.userId,
        username: user.username
      });
      
      users.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
