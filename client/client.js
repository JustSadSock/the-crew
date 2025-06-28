const socket = io();
const login = document.getElementById('login');
const game = document.getElementById('game');
const statusEl = document.getElementById('status');
const chat = document.getElementById('chat');
const roundEl = document.getElementById('round');
const shipEls = {
  temperature: document.getElementById('ship-temperature'),
  oxygen: document.getElementById('ship-oxygen'),
  hull: document.getElementById('ship-hull'),
  morale: document.getElementById('ship-morale'),
};
const playersEl = document.getElementById('players');
const cardsEl = document.getElementById('cards');
const abilityBtn = document.getElementById('ability');
const coupBtn = document.getElementById('coup');
const voteDiv = document.getElementById('vote');
const voteYesBtn = document.getElementById('voteYes');
const voteNoBtn = document.getElementById('voteNo');

let roomId = null;
let currentState = null;

function addMsg(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
}

function renderState(state) {
  currentState = state;
  if (!state) return;

  roundEl.textContent = 'Round: ' + (state.round || 0);

  if (state.game && state.game.ship) {
    for (const [k, v] of Object.entries(state.game.ship)) {
      if (shipEls[k]) shipEls[k].textContent = v;
    }
  }

  playersEl.innerHTML = '';
  if (state.players) {
    state.players.forEach(p => {
      const div = document.createElement('div');
      let role = p.id === socket.id ? p.role : '???';
      if (state.captain === p.id) role += ' (Captain)';
      div.textContent = p.name + ' - ' + role;
      playersEl.appendChild(div);
    });
  }

  const myData = state.game && state.game.players && state.game.players[socket.id];
  if (myData) {
    abilityBtn.disabled = !(myData.abilityCharge >= 100 && myData.cooldown === 0);
    abilityBtn.textContent = 'Use Ability (' + myData.abilityCharge + '%)';

    cardsEl.innerHTML = '';
    if (myData.chosenCard === null) {
      for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.textContent = 'Card ' + (i + 1);
        btn.onclick = () => {
          socket.emit('playCard', { roomId, cardIndex: i });
        };
        cardsEl.appendChild(btn);
      }
    } else {
      cardsEl.textContent = 'Played card ' + (myData.chosenCard + 1);
    }
  }
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

document.getElementById('next').onclick = () => {
  socket.emit('nextRound', { roomId });
};

abilityBtn.onclick = () => {
  socket.emit('useAbility', { roomId });
};

coupBtn.onclick = () => {
  socket.emit('proposeCoup', { roomId, anonymous: false });
};

voteYesBtn.onclick = () => {
  socket.emit('voteCoup', { roomId, vote: true });
  voteDiv.style.display = 'none';
};

voteNoBtn.onclick = () => {
  socket.emit('voteCoup', { roomId, vote: false });
  voteDiv.style.display = 'none';
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
  renderState(state);
});

socket.on('cardPlayed', ({ playerId, cardIndex }) => {
  addMsg(playerId + ' played card ' + (cardIndex + 1));
});

socket.on('newRound', ({ event, state }) => {
  addMsg('New round ' + state.round);
  renderState(state);
});

socket.on('abilityUsed', ({ playerId, state }) => {
  addMsg(playerId + ' used their ability');
  if (state) renderState(state);
});

socket.on('stateUpdate', (state) => {
  renderState(state);
});

socket.on('voteStarted', ({ initiator }) => {
  addMsg('Vote started');
  voteDiv.style.display = 'block';
});

socket.on('coupResult', ({ result, captain }) => {
  addMsg('Coup ' + (result ? 'succeeded' : 'failed'));
  voteDiv.style.display = 'none';
  if (currentState) {
    currentState.captain = captain;
    renderState(currentState);
  }
});
