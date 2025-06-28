# The Crew

## Game Overview

**The Crew** is a cooperative browser strategy thriller for two to six players. Styled as a late‑1980s retrofuturistic console, the game strands everyone on a failing transport ship drifting through a dangerous sector. The team must survive fifteen rounds to make one last jump, while one or more players may secretly act as saboteurs trying to destroy the ship early.

> **Note:** This repository is only a minimal prototype. It currently implements basic room creation and a text chat. The full card system, role logic and event progression remain TODO.

Each player receives a profession. The captain has an overview of the ship but only sees color indicators (green/yellow/orange/red). Specialists such as the engineer, psychologist, navigator and operator view exact numbers for two stats in their area. Everyone also gets a personal objective that can influence their choices. Saboteurs receive destructive goals like reducing oxygen to zero.

Rounds begin with a random event that changes the ship's parameters. Specialists draw three action cards unique to their role and pass one to the captain. The captain has sixty seconds to pick a card to resolve. Players also charge a special ability that can be triggered when full. Any player may start a vote to replace the captain at any time.

## Quickstart

1. Install dependencies and run the server:

```bash
cd server
npm install
npm start
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser and create or join a room to try the basic round flow.

### Offline mode

Start the server with local bots for a single‑player or hotseat session:

```bash
npm run offline
```

Use `BOT_COUNT` to control how many bots join automatically (default is `3`).

## Development

Automated tests live in the `tests` directory. Run them from the `server` folder:

```bash
npm test
```

## License

This project is licensed under the [MIT License](LICENSE).
