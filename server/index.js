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
    players: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
    })),
    captain: room.captain,
    round: room.round,
    game: room.game,
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

function createGameState(room) {
  const ship = { temperature: 100, oxygen: 100, hull: 100, morale: 100 };
  const roles = ['Engineer', 'Psychologist', 'Navigator', 'Operator'];
  const objectives = [
    'Keep morale above 90',
    'Change the captain once',
    'Keep hull above 50',
    'Reduce oxygen below 30',
  ];
  const players = {};
  const ids = Object.keys(room.players);
  ids.forEach((id, idx) => {
    const role = roles[idx % roles.length];
    const objective = objectives[idx % objectives.length];
    room.players[id].role = role;
    players[id] = {
      role,
      objective,
      abilityCharge: 0,
      cooldown: 0,
      chosenCard: null,
    };
  });
  return { ship, players };
}

const CARD_EFFECTS = [
  { hull: -5 },
  { oxygen: -5 },
  { morale: 5 },
];

const ABILITY_EFFECTS = {
  Engineer: { hull: 20 },
  Psychologist: { morale: 20 },
  Navigator: { oxygen: 20 },
  Operator: { temperature: -10 },
};

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
    room.round = 1;
    room.game = createGameState(room);
    io.to(roomId).emit('gameStarted', getState(roomId));
    io.to(roomId).emit('stateUpdate', getState(roomId));
    if (OFFLINE) runBots(roomId);
  });

  socket.on('playCard', ({ roomId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    if (room.game.players[socket.id]) {
      room.game.players[socket.id].chosenCard = cardIndex;
    }
    io.to(roomId).emit('cardPlayed', { playerId: socket.id, cardIndex });
    io.to(roomId).emit('stateUpdate', getState(roomId));
  });

  socket.on('captainSelect', ({ roomId, selectedPlayerId }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    const player = room.game.players[selectedPlayerId];
    if (!player) return;
    const cardIdx = player.chosenCard;
    const effect = CARD_EFFECTS[cardIdx] || {};
    Object.entries(effect).forEach(([k, v]) => {
      if (room.game.ship[k] !== undefined) {
        room.game.ship[k] = Math.max(0, Math.min(100, room.game.ship[k] + v));
      }
    });
    player.chosenCard = null;
    player.abilityCharge = Math.min(100, player.abilityCharge + 20);
    io.to(roomId).emit('stateUpdate', getState(roomId));
  });

  socket.on('useAbility', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.game && room.game.players[socket.id];
    if (player && player.abilityCharge >= 100 && player.cooldown === 0) {
      const effect = ABILITY_EFFECTS[player.role] || {};
      Object.entries(effect).forEach(([k, v]) => {
        if (room.game.ship[k] !== undefined) {
          room.game.ship[k] = Math.max(0, Math.min(100, room.game.ship[k] + v));
        }
      });
      player.abilityCharge = 0;
      player.cooldown = 4;
    }
    io.to(roomId).emit('abilityUsed', { playerId: socket.id, state: getState(roomId) });
    io.to(roomId).emit('stateUpdate', getState(roomId));
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
    if (!room || !room.game) return;
    room.round += 1;
    const keys = Object.keys(room.game.ship);
    const key = keys[Math.floor(Math.random() * keys.length)];
    room.game.ship[key] = Math.max(0, room.game.ship[key] - 5);
    Object.values(room.game.players).forEach(p => {
      if (p.cooldown > 0) {
        p.cooldown -= 1;
      } else {
        p.abilityCharge = Math.min(100, p.abilityCharge + 20);
      }
    });
    io.to(roomId).emit('newRound', { event: key, state: getState(roomId) });
    io.to(roomId).emit('stateUpdate', getState(roomId));
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
