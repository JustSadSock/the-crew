const { expect } = require('chai');
const io = require('socket.io-client');
const { fork } = require('child_process');
const path = require('path');

const SERVER_PATH = path.resolve(__dirname, '../server/index.js');
const SERVER_PORT = 4000;

function startServer(env = {}) {
  return new Promise((resolve) => {
    const proc = fork(SERVER_PATH, [], {
      env: { PORT: SERVER_PORT, ...env, NODE_ENV: 'test' },
      silent: true,
    });
    proc.stdout.on('data', (data) => {
      if (data.toString().includes('Server listening')) {
        resolve(proc);
      }
    });
  });
}

describe('Server basic flow', function () {
  this.timeout(5000);
  let server;
  before(async () => {
    server = await startServer();
  });

  after(() => {
    server.kill();
  });

  let socket;
  beforeEach(() => {
    socket = io(`http://localhost:${SERVER_PORT}`);
  });

  afterEach(() => {
    socket.close();
  });

  it('creates a room', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      expect(roomId).to.be.a('string').with.lengthOf(4);
      done();
    });
  });

  it('allows another player to join', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, ({ success }) => {
        expect(success).to.equal(true);
        socket2.close();
        done();
      });
    });
  });

  it('runs a minimal gameplay flow', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Alice' }, () => {
        socket.emit('startGame', { roomId });
      });
      socket.on('gameStarted', (state) => {
        expect(state.roomId).to.equal(roomId);
        socket.emit('playCard', { roomId, cardIndex: 0 });
      });
      socket.on('cardPlayed', ({ playerId }) => {
        expect(playerId).to.be.a('string');
        socket2.close();
        done();
      });
    });
  });

  it('removes a room when all players disconnect', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, () => {
        socket.close();
        socket2.close();
        setTimeout(() => {
          const socket3 = io(`http://localhost:${SERVER_PORT}`);
          socket = socket3;
          socket3.emit('joinRoom', { roomId, name: 'Carol' }, ({ success }) => {
            expect(success).to.equal(false);
            done();
          });
        }, 50);
      });
    });
  });

  it('broadcasts ability usage', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Alice' }, () => {
        socket2.on('abilityUsed', ({ playerId, state }) => {
          expect(playerId).to.be.a('string');
          expect(state.roomId).to.equal(roomId);
          socket2.close();
          done();
        });
        socket.emit('useAbility', { roomId });
      });
    });
  });

  it('changes captain to coup initiator when vote passes', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket.on('coupResult', ({ result, captain }) => {
        expect(result).to.equal(true);
        expect(captain).to.equal(socket.id);
        socket2.close();
        done();
      });
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, () => {
        socket.emit('proposeCoup', { roomId, anonymous: false });
        socket.emit('voteCoup', { roomId, vote: true });
        socket2.emit('voteCoup', { roomId, vote: true });
      });
    });
  });

  it('restricts starting the game to the captain', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, () => {
        let started = false;
        socket2.on('gameStarted', () => { started = true; });
        socket2.emit('startGame', { roomId });
        setTimeout(() => {
          expect(started).to.equal(false);
          socket.once('gameStarted', () => {
            socket2.close();
            done();
          });
          socket.emit('startGame', { roomId });
        }, 100);
      });
    });
  });

  it('restricts advancing rounds to the captain', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, () => {
        let currentRound = 0;
        socket.on('newRound', ({ state }) => { currentRound = state.round; });
        socket.once('newRound', () => {
          socket2.emit('nextRound', { roomId });
          setTimeout(() => {
            expect(currentRound).to.equal(1);
            socket.once('newRound', ({ state }) => {
              expect(state.round).to.equal(2);
              socket2.close();
              done();
            });
            socket.emit('nextRound', { roomId });
          }, 100);
        });
        socket.emit('startGame', { roomId });
      });
    });
  });

  it('restricts captain selection to the captain', (done) => {
    socket.emit('createRoom', ({ roomId }) => {
      const socket2 = io(`http://localhost:${SERVER_PORT}`);
      let lastState;
      const stateHandler = (state) => { lastState = state; };
      socket.on('stateUpdate', stateHandler);
      socket2.on('stateUpdate', stateHandler);
      socket2.emit('joinRoom', { roomId, name: 'Bob' }, () => {
        socket.once('newRound', () => {
          socket2.emit('playCard', { roomId, cardIndex: 0 });
        });
        socket.once('cardPlayed', () => {
          socket.once('stateUpdate', () => {
            const chosen = lastState.game.players[socket2.id].chosenCard;
            expect(chosen).to.not.equal(null);
            socket2.emit('captainSelect', { roomId, selectedPlayerId: socket2.id });
            setTimeout(() => {
              expect(lastState.game.players[socket2.id].chosenCard.name).to.equal(chosen.name);
              socket.once('stateUpdate', (state) => {
                expect(state.game.players[socket2.id].chosenCard).to.equal(null);
                socket2.close();
                done();
              });
              socket.emit('captainSelect', { roomId, selectedPlayerId: socket2.id });
            }, 100);
          });
        });
        socket.emit('startGame', { roomId });
      });
    });
  });
});

describe('Offline mode', function () {
  this.timeout(5000);
  let server;
  let socket;
  const OFFLINE_PORT = 4001;

  before(async () => {
    server = await new Promise((resolve) => {
      const proc = fork(SERVER_PATH, [], {
        env: { PORT: OFFLINE_PORT, OFFLINE: '1', BOT_COUNT: '2', NODE_ENV: 'test' },
        silent: true,
      });
      proc.stdout.on('data', (data) => {
        if (data.toString().includes('Server listening')) {
          resolve(proc);
        }
      });
    });
    socket = io(`http://localhost:${OFFLINE_PORT}`);
  });

  after(() => {
    socket.close();
    server.kill();
  });

  it('spawns bots on room creation', (done) => {
    socket.on('stateUpdate', (state) => {
      expect(state.players.length).to.equal(3); // 1 human + 2 bots
      done();
    });
    socket.emit('createRoom', () => {});
  });
});
