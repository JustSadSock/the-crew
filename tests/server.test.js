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
      socket.on('cardPlayed', ({ cardIndex }) => {
        expect(cardIndex).to.equal(0);
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
