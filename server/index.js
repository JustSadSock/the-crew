const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const { decks } = require('./cards');
const { randomEvent } = require('./events');

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
  let game = null;
  if (room.game) {
    game = { ship: { ...room.game.ship }, players: {} };
    Object.entries(room.game.players).forEach(([pid, p]) => {
      game.players[pid] = { ...p };
      delete game.players[pid].objective; // hide personal goals
      delete game.players[pid].saboteur;
    });
  }
  return {
    roomId,
    players: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
    })),
    captain: room.captain,
    round: room.round,
    game,
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
      const player = room.game && room.game.players[bot.id];
      if (!player || player.chosenCard) return;
      const idxCard = Math.floor(Math.random() * player.cards.length);
      const card = player.cards[idxCard];
      player.chosenCard = card;
      io.to(room.captain).emit('cardOffered', { playerId: bot.id, cardName: card.name });
      io.to(roomId).emit('cardPlayed', { playerId: bot.id });
      io.to(roomId).emit('stateUpdate', getState(roomId));
    }, 500 * (idx + 1));
  });
}

function createGameState(room) {
  const ship = {
    temperature: parseInt(process.env.START_TEMPERATURE || '100', 10),
    oxygen: parseInt(process.env.START_OXYGEN || '100', 10),
    hull: parseInt(process.env.START_HULL || '100', 10),
    morale: parseInt(process.env.START_MORALE || '100', 10),
  };
  const roles = ['Engineer', 'Psychologist', 'Navigator', 'Operator'];
  const crewObjectives = [
    'Keep morale above 90',
    'Change the captain once',
    'Keep hull above 50',
  ];
  const sabotageObjectives = [
    'Reduce oxygen below 30',
    'Drop morale below 50',
    'Overheat the ship above 120',
  ];
  const players = {};
  const ids = Object.keys(room.players);
  const shuffled = ids.sort(() => Math.random() - 0.5);
  const sabCount = Math.min(shuffled.length, Math.floor(Math.random() * 2) + 1);
  const saboteurs = new Set(shuffled.slice(0, sabCount));
  ids.forEach((id, idx) => {
    const role = roles[idx % roles.length];
    const isSaboteur = saboteurs.has(id);
    const objArr = isSaboteur ? sabotageObjectives : crewObjectives;
    const objective = objArr[Math.floor(Math.random() * objArr.length)];
    room.players[id].role = role;
    players[id] = {
      role,
      objective,
      saboteur: isSaboteur,
      abilityCharge: 0,
      cooldown: 0,
      chosenCard: null,
      cards: [],
    };
  });
  return { ship, players };
}

function drawCards(role) {
  const deck = decks[role] || [];
  const cards = [];
  for (let i = 0; i < 3; i++) {
    cards.push(deck[Math.floor(Math.random() * deck.length)]);
  }
  return cards;
}

function applyEffect(ship, effect) {
  Object.entries(effect).forEach(([k, v]) => {
    if (ship[k] !== undefined) {
      ship[k] = Math.max(0, Math.min(100, ship[k] + v));
    }
  });
}

function objectiveSuccess(obj, room) {
  const ship = room.game.ship;
  switch (obj) {
    case 'Keep morale above 90':
      return ship.morale > 90;
    case 'Change the captain once':
      return room.captainChanged;
    case 'Keep hull above 50':
      return ship.hull > 50;
    case 'Reduce oxygen below 30':
      return ship.oxygen < 30;
    case 'Drop morale below 50':
      return ship.morale < 50;
    case 'Overheat the ship above 120':
      return ship.temperature > 120;
    default:
      return false;
  }
}

function endGame(roomId, victory) {
  const room = rooms[roomId];
  if (!room || !room.game || room.gameEnded) return;
  room.gameEnded = true;
  const results = Object.entries(room.game.players).map(([pid, p]) => ({
    id: pid,
    name: room.players[pid].name,
    role: p.role,
    saboteur: p.saboteur,
    objective: p.objective,
    success: objectiveSuccess(p.objective, room),
  }));
  io.to(roomId).emit('gameEnded', { victory, results });
}

function checkGameEnd(roomId) {
  const room = rooms[roomId];
  if (!room || !room.game) return false;
  const ship = room.game.ship;
  if (Object.values(ship).some(v => v <= 0)) {
    endGame(roomId, false);
    return true;
  }
  if (room.round >= 15) {
    endGame(roomId, true);
    return true;
  }
  return false;
}

function startRound(roomId, initial = false) {
  const room = rooms[roomId];
  if (!room || !room.game) return;
  room.round += 1;
  if (checkGameEnd(roomId)) return;
  const event = randomEvent();
  applyEffect(room.game.ship, event.effect);
  if (checkGameEnd(roomId)) return;
  Object.entries(room.game.players).forEach(([pid, p]) => {
    p.cards = drawCards(p.role);
    p.chosenCard = null;
    if (!initial) {
      if (p.cooldown > 0) {
        p.cooldown -= 1;
      } else {
        p.abilityCharge = Math.min(100, p.abilityCharge + 20);
      }
    }
    const hand = p.cards.map(c => ({ name: c.name, description: c.description }));
    io.to(pid).emit('dealCards', hand);
  });
  io.to(roomId).emit('newRound', { event: event.name, state: getState(roomId) });
  io.to(roomId).emit('stateUpdate', getState(roomId));
  if (OFFLINE) runBots(roomId);
}


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
      captainChanged: false,
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
    if (socket.id !== room.captain) return;
    room.gameStarted = true;
    room.round = 0;
    room.game = createGameState(room);
    if (room.game && room.game.players) {
      Object.entries(room.game.players).forEach(([pid, p]) => {
        if (!room.players[pid].bot) {
          io.to(pid).emit('personalObjective', { text: p.objective });
        }
      });
    }
    io.to(roomId).emit('gameStarted', getState(roomId));
    startRound(roomId, true);
  });

  socket.on('playCard', ({ roomId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    const player = room.game.players[socket.id];
    if (player && player.cards[cardIndex]) {
      const card = player.cards[cardIndex];
      player.chosenCard = card;
      io.to(room.captain).emit('cardOffered', { playerId: socket.id, cardName: card.name });
      io.to(roomId).emit('cardPlayed', { playerId: socket.id });
      io.to(roomId).emit('stateUpdate', getState(roomId));
    }
  });

  socket.on('captainSelect', ({ roomId, selectedPlayerId }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    if (socket.id !== room.captain) return;
    const player = room.game.players[selectedPlayerId];
    if (!player) return;
    const card = player.chosenCard;
    if (!card) return;
    applyEffect(room.game.ship, card.effect || {});
    player.chosenCard = null;
    player.abilityCharge = Math.min(100, player.abilityCharge + 20);
    io.to(roomId).emit('stateUpdate', getState(roomId));
    checkGameEnd(roomId);
  });

  socket.on('useAbility', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.game && room.game.players[socket.id];
    if (player && player.abilityCharge >= 100 && player.cooldown === 0) {
      const effect = ABILITY_EFFECTS[player.role] || {};
      applyEffect(room.game.ship, effect);
      player.abilityCharge = 0;
      player.cooldown = 4;
    }
    io.to(roomId).emit('abilityUsed', { playerId: socket.id, state: getState(roomId) });
    io.to(roomId).emit('stateUpdate', getState(roomId));
    checkGameEnd(roomId);
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
        if (room.captain !== room.coupInitiator) {
          room.captain = room.coupInitiator;
          room.captainChanged = true;
        }
      }
      delete room.coupInitiator;
      io.to(roomId).emit('coupResult', { result, captain: room.captain });
    }
  });

  socket.on('nextRound', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.captain) return;
    if (!checkGameEnd(roomId)) {
      startRound(roomId);
    }
  });

  socket.on('chatPublic', ({ roomId, text }) => {
    io.to(roomId).emit('chatMessage', { from: socket.id, text, private: false });
  });

  socket.on('chatPrivate', ({ roomId, to, text }) => {
    const room = rooms[roomId];
    if (!room) return;
    io.to(to).emit('chatMessage', { from: socket.id, text, private: true });
    socket.emit('chatMessage', { from: socket.id, text, to, private: true });
    if (room.captain) {
      io.to(room.captain).emit('chatNotice', { from: socket.id, to });
    }
  });

  socket.on('endGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    endGame(roomId, false);
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
