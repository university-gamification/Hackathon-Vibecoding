---

## Monorepo Structure

```
Hackathon-09-26/
  ├─ frontend/              # React + TypeScript (Vite)
  │  ├─ index.html
  │  ├─ vite.config.ts
  │  ├─ package.json
  │  └─ src/
  ├─ backend/               # FastAPI app
  │  ├─ app/
  │  │  ├─ main.py
  │  │  ├─ core/
  │  │  │  ├─ config.py
  │  │  │  └─ db.py
  │  │  └─ routers/
  │  │     ├─ health.py
  │  │     └─ sample.py
  │  ├─ data/               # Default SQLite location
  │  ├─ requirements.txt
  │  └─ run.py
  └─ mcp_servers/
     ├─ echo_server.py
     └─ README.md
```

## Frontend: React + TypeScript (Vite)

1. Install deps
```
cd frontend
npm install
```

2. Run dev server
```
npm run dev
```

Vite dev server proxies `/api` to `http://127.0.0.1:8000` (see `frontend/vite.config.ts`).

## Backend: FastAPI

1. Create a virtual environment and install deps
```
cd backend
python -m venv .venv
.venv\\Scripts\\activate  # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Run the API (auto-reload)
```
python run.py
```

3. Test endpoints
- Health: GET http://127.0.0.1:8000/api/health → { "status": "ok" }
- Echo:   GET http://127.0.0.1:8000/api/echo?msg=Hello → { "reply": "Hello" }

## Database

- Default database is SQLite at `backend/data/app.db` (see `backend/app/core/config.py`).
- Connection URL is controlled by env var `DATABASE_URL`. Examples:
  - SQLite (default): `sqlite:///./backend/data/app.db`
  - Postgres: `postgresql+psycopg2://USER:PASS@HOST:5432/DBNAME`

To switch to Postgres, set `DATABASE_URL` before running the backend:
```
set DATABASE_URL=postgresql+psycopg2://USER:PASS@HOST:5432/DBNAME
python backend/run.py
```

`backend/app/core/db.py` provides a SQLAlchemy `engine` and `SessionLocal`. Extend with models and Alembic migrations as needed.

## MCP Servers

`mcp_servers/echo_server.py` is a minimal JSON-RPC style stdio loop to adapt for MCP-compatible clients. It exposes:
- `list_tools` → returns available tools
- `call_tool` with `name="echo"` → echoes back the provided text

Run:
```
python mcp_servers/echo_server.py
```

## Git

Initialize a new repo and set `main` as default branch:
```
git init -b main
git add .
git commit -m "chore: scaffold frontend (vite+react+ts), backend (fastapi), mcp skeleton"
```

Optionally add a remote and push:
```
git remote add origin <YOUR_REPO_URL>
git push -u origin main
