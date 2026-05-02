# Deployment

This repository can be deployed to one Vercel project using **Vercel Services**:

- Frontend (`frontend/`) at `/`
- FastAPI backend (`backend/main.py`) at `/api`

The root [`vercel.json`](./vercel.json) defines both services.

## One-time Vercel setup

1. Login:

```bash
vercel login
```

2. Link this repo from the root directory:

```bash
vercel link
```

3. In Vercel Dashboard, set **Framework Preset** to **Services**.

## Deploy

Preview deployment:

```bash
vercel
```

Production deployment:

```bash
vercel --prod
```

## Environment variables

- `VITE_API_URL` is optional.
- If not set, frontend uses:
  - `http://localhost:8000` in development
  - `/api` in production

Only set `VITE_API_URL` if you want the frontend to call a different API origin.

## Local development

Run both services with Vercel routing:

```bash
vercel dev -L
```

Or run separately:

```bash
cd backend
uv run uvicorn main:app --reload
```

```bash
cd frontend
npm run dev
```
