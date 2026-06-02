# Conan Online Quiz

Thai-language realtime Detective Conan character quiz. Players join a room with nicknames, race to answer from a searchable 50-character roster, and the first correct answer wins each round.

## Local Development

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev:client
```

Open `http://localhost:5173`.

## Environment Variables

Server:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Client:

```env
VITE_BACKEND_URL=http://localhost:4000
```

For production, set `CLIENT_ORIGIN` on Railway to the Vercel URL and set `VITE_BACKEND_URL` on Vercel to the Railway public URL.

## Game Rules

- 10 rounds per match.
- 20 seconds per round.
- 5 text clues appear at the start of each round.
- 50 searchable character names.
- First correct answer wins the round and gets 1 point.
- Wrong answers do not stop other players from trying.
- Round ends immediately on the first correct answer or when time expires.

## Deployment

- Deploy the frontend to Vercel with the root project directory and `vercel.json`.
- Deploy the backend to Railway with the root project directory and `railway.json`.
- After both deploys exist, update the two production environment variables so the browser can reach Railway and Railway accepts the Vercel origin.
