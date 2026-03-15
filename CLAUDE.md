# Virtual Fitting Room

AI-powered virtual clothing try-on service.

## Stack
- Frontend: Next.js 14 PWA (src/app router)
- Backend: FastAPI (Python 3.11)
- AI: rembg (segmentation), CLIP (classification), Replicate IDM-VTON (try-on)
- Storage: Supabase Storage (S3-compatible)
- DB: Supabase PostgreSQL with RLS
- Auth: Supabase Auth

## Project Structure
- `frontend/` — Next.js app
- `backend/` — FastAPI app
- `supabase/migrations/` — SQL migrations

## Running locally
1. Copy `.env.example` to `.env.local` and fill in values
2. Run `docker-compose up` OR:
   - Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
   - Frontend: `cd frontend && npm install && npm run dev`

## Key files
- `backend/app/services/segmentation.py` — rembg clothing background removal
- `backend/app/services/classification.py` — CLIP zero-shot clothing classification
- `backend/app/services/tryon.py` — Replicate IDM-VTON integration
- `backend/app/routers/upload.py` — main pipeline orchestrator with SSE
- `frontend/src/app/upload/page.tsx` — upload flow with camera and SSE progress
- `supabase/migrations/003_rls_policies.sql` — security policies

## Environment variables
See `.env.example`
