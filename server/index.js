const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.resolve(__dirname, '../client')));

const rooms = {};

const OFFLINE = process.env.OFFLINE === '1' || process.env.OFFLINE === 'true';
const BOT_COUNT = parseInt(process.env.BOT_COUNT || '3', 10);

function createRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id;
  do {
    id = '';
    for (let i = 0; i < 4; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[id]);
  return id;
}

function getState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;
  return {
    roomId,
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name })),
    captain: room.captain,
    round: room.round,
  };
}

function spawnBots(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  for (let i = 1; i <= BOT_COUNT; i++) {
    const id = `bot${i}`;
    room.players[id] = { id, name: `Bot ${i}`, bot: true };
  }
}

function runBots(roomId) {
  if (!OFFLINE) return;
  const room = rooms[roomId];
  if (!room) return;
  const bots = Object.values(room.players).filter(p => p.bot);
  bots.forEach((bot, idx) => {
    setTimeout(() => {
      io.to(roomId).emit('cardPlayed', { playerId: bot.id, cardIndex: Math.floor(Math.random() * 3) });
    }, 500 * (idx + 1));
  });
}

io.on('connection', (socket) => {
  socket.on('createRoom', (callback) => {
    const roomId = createRoomId();
    rooms[roomId] = {
      players: {},
      captain: socket.id,
      gameStarted: false,
      round: 0,
      votes: {},
    };
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { id: socket.id, name: 'Captain' };
    if (OFFLINE) {
      spawnBots(roomId);
    }
    callback({ roomId });
    if (OFFLINE) {
      io.to(roomId).emit('stateUpdate', getState(roomId));
    }
  });

  socket.on('joinRoom', ({ roomId, name }, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ success: false, error: 'Room not found' });
    room.players[socket.id] = { id: socket.id, name };
    socket.join(roomId);
    callback({ success: true });
    io.to(roomId).emit('stateUpdate', getState(roomId));
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.gameStarted = true;
    io.to(roomId).emit('gameStarted', getState(roomId));
    if (OFFLINE) runBots(roomId);
  });

  socket.on('playCard', ({ roomId, cardIndex }) => {
    io.to(roomId).emit('cardPlayed', { playerId: socket.id, cardIndex });
  });

  socket.on('captainSelect', ({ roomId, selectedPlayerId }) => {
    io.to(roomId).emit('stateUpdate', getState(roomId));
  });

  socket.on('useAbility', ({ roomId }) => {
    io.to(roomId).emit('abilityUsed', { playerId: socket.id, state: getState(roomId) });
  });

  socket.on('proposeCoup', ({ roomId, anonymous }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.votes = {};
    room.coupInitiator = socket.id;
    io.to(roomId).emit('voteStarted', { initiator: anonymous ? null : socket.id });
  });

  socket.on('voteCoup', ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.votes[socket.id] = vote;
    const total = Object.keys(room.players).length;
    if (Object.keys(room.votes).length >= total) {
      const yes = Object.values(room.votes).filter(v => v).length;
      const result = yes > total / 2;
      if (result) {
        room.captain = room.coupInitiator;
      }
      delete room.coupInitiator;
      io.to(roomId).emit('coupResult', { result, captain: room.captain });
    }
  });

  socket.on('nextRound', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.round += 1;
    io.to(roomId).emit('newRound', { event: 'event', state: getState(roomId) });
    if (OFFLINE) runBots(roomId);
  });

  socket.on('chatPublic', ({ roomId, text }) => {
    io.to(roomId).emit('chatMessage', { from: socket.id, text, private: false });
  });

  socket.on('chatPrivate', ({ roomId, to, text }) => {
    io.to(to).emit('chatMessage', { from: socket.id, text, private: true });
    socket.emit('chatMessage', { from: socket.id, text, to, private: true });
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('stateUpdate', getState(roomId));
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
