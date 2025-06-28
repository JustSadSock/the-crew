const socket = io();
const login = document.getElementById('login');
const game = document.getElementById('game');
const statusEl = document.getElementById('status');
const chat = document.getElementById('chat');

let roomId = null;

function addMsg(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('create').onclick = () => {
  const name = document.getElementById('name').value;
  socket.emit('createRoom', ({ roomId: id }) => {
    roomId = id;
    addMsg('Created room ' + roomId);
    socket.emit('joinRoom', { roomId, name }, () => {});
    login.style.display = 'none';
    game.style.display = 'block';
    statusEl.textContent = 'Room ' + roomId;
  });
};

document.getElementById('join').onclick = () => {
  const name = document.getElementById('name').value;
  roomId = document.getElementById('room').value.toUpperCase();
  socket.emit('joinRoom', { roomId, name }, (res) => {
    if (res.success) {
      addMsg('Joined room ' + roomId);
      login.style.display = 'none';
      game.style.display = 'block';
      statusEl.textContent = 'Room ' + roomId;
    } else {
      alert(res.error);
    }
  });
};

document.getElementById('start').onclick = () => {
  socket.emit('startGame', { roomId });
};

document.getElementById('play').onclick = () => {
  socket.emit('playCard', { roomId, cardIndex: 0 });
};

document.getElementById('next').onclick = () => {
  socket.emit('nextRound', { roomId });
};

document.getElementById('send').onclick = () => {
  const text = document.getElementById('text').value;
  socket.emit('chatPublic', { roomId, text });
  document.getElementById('text').value = '';
};

socket.on('chatMessage', (msg) => {
  addMsg((msg.private ? '(private) ' : '') + msg.from + ': ' + msg.text);
});

socket.on('gameStarted', (state) => {
  addMsg('Game started');
});

socket.on('cardPlayed', ({ playerId, cardIndex }) => {
  addMsg(playerId + ' played card ' + cardIndex);
});

socket.on('newRound', ({ event, state }) => {
  addMsg('New round ' + state.round);
});
