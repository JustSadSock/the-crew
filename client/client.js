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
const offeredEl = document.getElementById('offered');
const timerEl = document.getElementById('timer');
const objectiveEl = document.getElementById('objective');
const abilityBtn = document.getElementById('ability');
const coupBtn = document.getElementById('coup');
const voteDiv = document.getElementById('vote');
const voteYesBtn = document.getElementById('voteYes');
const voteNoBtn = document.getElementById('voteNo');
const endBtn = document.getElementById('end');

let roomId = null;
let currentState = null;
let myCards = [];
let offeredCards = [];
let timerInterval = null;
let myObjective = '';

function addMsg(msg) {
  const p = document.createElement('p');
  p.classList.add('typewriter');
  chat.appendChild(p);
  let i = 0;
  function type() {
    p.textContent = msg.slice(0, i);
    i += 1;
    if (i <= msg.length) {
      setTimeout(type, 30);
    } else {
      p.classList.remove('typewriter');
      chat.scrollTop = chat.scrollHeight;
    }
  }
  type();
}

function renderState(state) {
  currentState = state;
  if (!state) return;

  roundEl.textContent = 'Round: ' + (state.round || 0);

  if (state.game && state.game.ship) {
    let alarm = false;
    for (const [k, v] of Object.entries(state.game.ship)) {
      if (shipEls[k]) {
        shipEls[k].textContent = v;
        shipEls[k].style.setProperty('--value', v + '%');
        if (v < 30 || v > 120) alarm = true;
      }
    }
    document.body.classList.toggle('alarm', alarm);
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
    objectiveEl.textContent = 'Objective: ' + myObjective;

    cardsEl.innerHTML = '';
    if (myData.chosenCard === null) {
      myCards.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.classList.add('card');
        btn.textContent = c.name;
        btn.title = c.description;
        btn.onclick = () => {
          socket.emit('playCard', { roomId, cardIndex: i });
        };
        cardsEl.appendChild(btn);
      });
    } else {
      cardsEl.textContent = 'Card sent';
    }
  }

  if (!myData) {
    objectiveEl.textContent = '';
  }

  renderOffered();
}

function renderOffered() {
  offeredEl.innerHTML = '';
  if (currentState && currentState.captain === socket.id) {
    offeredCards.forEach((c) => {
      const btn = document.createElement('button');
      btn.classList.add('card');
      btn.textContent = c.playerName + ': ' + c.cardName;
      btn.onclick = () => {
        socket.emit('captainSelect', { roomId, selectedPlayerId: c.playerId });
        offeredCards = [];
        renderOffered();
        clearInterval(timerInterval);
      };
      offeredEl.appendChild(btn);
    });
  }
}

function startTimer() {
  clearInterval(timerInterval);
  let time = 60;
  timerEl.textContent = 'Time: ' + time;
  timerInterval = setInterval(() => {
    time -= 1;
    timerEl.textContent = 'Time: ' + time;
    if (time <= 0) clearInterval(timerInterval);
  }, 1000);
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

endBtn.onclick = () => {
  socket.emit('endGame', { roomId });
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

socket.on('dealCards', (cards) => {
  myCards = cards;
  renderState(currentState);
});

socket.on('cardPlayed', ({ playerId }) => {
  addMsg(playerId + ' offered a card');
});

socket.on('cardOffered', ({ playerId, cardName }) => {
  if (currentState && currentState.captain === socket.id) {
    const name = (currentState.players.find(p => p.id === playerId) || {}).name || playerId;
    offeredCards.push({ playerId, cardName, playerName: name });
    renderOffered();
  }
});

socket.on('newRound', ({ event, state }) => {
  addMsg('New round ' + state.round);
  renderState(state);
  startTimer();
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

socket.on('personalObjective', ({ text }) => {
  myObjective = text;
  objectiveEl.textContent = 'Objective: ' + myObjective;
});

socket.on('gameEnded', ({ results }) => {
  addMsg('Game Over');
  results.forEach(r => {
    addMsg(`${r.name} - ${r.role}${r.saboteur ? ' (Saboteur)' : ''} | ` +
      `${r.success ? 'Succeeded' : 'Failed'}: ${r.objective}`);
  });
});
