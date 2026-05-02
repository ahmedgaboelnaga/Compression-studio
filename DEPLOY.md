# Deployment

This project is a single monorepo with separate deploy targets:

- `frontend/` deploys to Vercel.
- `backend/` deploys to the Azure VM through Docker Compose.

## Frontend on Vercel

Create a Vercel project from this repository and set:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this Vercel environment variable:

```env
VITE_API_URL=https://api.your-domain.com
```

Use the public HTTPS URL for the FastAPI backend on the Azure VM.

## Backend on Azure VM

The GitHub workflow builds and pushes only the backend Docker image to GHCR, then runs:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

The production compose file exposes FastAPI on port `8000`. Put Nginx, Caddy, or Azure networking in front of it for HTTPS, then point `VITE_API_URL` at that HTTPS backend URL.

Required GitHub secrets:

```text
VM_HOST
VM_SSH_KEY
```

## Local Development

Run both services locally:

```bash
docker compose up --build
```

Or run them separately:

```bash
cd backend
uv run uvicorn main:app --reload
```

```bash
cd frontend
npm run dev
```
