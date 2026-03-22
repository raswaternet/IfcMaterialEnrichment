# IFC Material Enrichment

Hackathon prototype for enriching IFC models with bSDD-backed material data and exporting an enriched IFC for Digital Material Passport workflows.

## Stack
- Frontend: React + Vite
- Viewer: That Open / web-ifc iframe bundle in `frontend/public/viewer`
- Backend: FastAPI + IfcOpenShell
- Deployment: Docker Compose

## Local development

### Frontend app
```bash
cd frontend
npm install
npm run build
```

### Viewer bundle
```bash
cd frontend/viewer-src
npm install --ignore-engines
npm run build
```

### Backend
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Full stack
```bash
docker compose up --build
```

The frontend expects the backend at `/api/*` and serves the iframe viewer from `/viewer/index.html`.
