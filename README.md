# InkBoard

Two apps. `shared` is the code they both import. You need Node 22 and FFmpeg.

## API

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Listens on http://127.0.0.1:8787. Put the Postgres and Redis URLs in `backend/.env`.

## Site

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The site sends `/api` to the API on port 8787. Start the API first.
