# Points.ai

This repo contains a minimal prototype for searching AMEX transfer partners. It includes a Node.js backend and an HTML frontend.

## Prerequisites

- Node.js 18 or newer
- npm (comes with Node)

## Install dependencies

```bash
npm install
```

## Running the server

Start the Express server with:

```bash
npm start
```

The server listens on port `3000` by default and serves the `v1.html` file. After starting the server, open your browser to:

```
http://localhost:3000/v1.html
```

From there you can submit a search, which will call the `/search` endpoint.

The scraping logic currently uses placeholder URLs and selectors, so you will need to update `server.js` with real partner endpoints.

## Tests

This project does not yet include tests. Running `npm test` simply prints a placeholder message.
