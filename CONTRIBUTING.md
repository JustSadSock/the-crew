# Contributing to The Crew

Thank you for taking the time to contribute!

## Environment Setup

1. Install [Node.js](https://nodejs.org/) (version 18 or higher is recommended).
2. Install project dependencies:

```bash
cd server
npm install
```

## Running the Project Locally

Start the development server from the `server` directory:

```bash
npm start
```

Open <http://localhost:3000> in your browser to use the web client. To run the server with local bots for a single‑player or hotseat session, start it in offline mode:

```bash
npm run offline
```

The number of bots can be adjusted via the `BOT_COUNT` environment variable (defaults to `3`).

## Running Tests

Automated tests are located in the `tests` directory. Execute them with:

```bash
npm test
```

## Submitting Pull Requests

1. Fork the repository and create a feature branch.
2. Make your changes and add tests where appropriate.
3. Ensure `npm test` completes without failures.
4. Open a pull request targeting the `main` branch and describe your changes.

## Reporting Issues

If you encounter a problem, please open an issue on GitHub with a clear description and steps to reproduce. Include any relevant logs or screenshots and specify your environment (operating system, Node.js version, browser, etc.).

We appreciate all contributions and feedback!
