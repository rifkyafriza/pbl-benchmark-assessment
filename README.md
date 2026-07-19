# PBL Benchmark Assessment

Web app replacing the Google Form-based PBL benchmark assessment workflow at Politeknik Negeri Batam. Mobile-first, admin-managed team/lecturer data, lecturer-facing scoring.

## Stack

- Next.js (App Router, TypeScript, Turbopack)
- Tailwind CSS
- Supabase (Postgres + service-role access via Server Actions; RLS enabled with no policies by design — all writes go through server-side code, never the anon key)
- `xlsx` for Excel import/export, `bcryptjs` for password hashing

## Core concepts

- **Semester** — one active semester at a time. Each semester has two assessment periods: **ATS** (mid-semester) and **AAS** (end-semester), independently scored (a lecturer scores the same student separately per period, no overwrite). Admin sets which period is currently active.
- **Team (PBL)** — has exactly one **Pimpro** (project lead lecturer, reference only) and up to **3 Reviewers** (distinct lecturers, no duplicates) who actually score students.
- **Auth** — username + password only, no email, no SSO. One admin account; lecturer accounts are created/edited/reset by the admin.
- **Scoring** — per student, per reviewer, per period: 3 scores (implementation, document, English communication) 0–5 + optional comment. Reviewer can lock/finalize; admin can unlock.
- **Import** — two Excel templates (team+student+pimpro roster, and reviewer assignment with fuzzy username/full-name matching). All rows validated before any commit; any row failure aborts the whole import with a full error report.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real Supabase project values
npm run dev
```

Open http://localhost:3000.

**Note (WSL users):** if this project lives on a Windows drive mounted under `/mnt/`, run `npm run dev`/`npm run build` natively from Windows (PowerShell/cmd), not from WSL — Turbopack's file-locking does not work reliably over NTFS mounts from WSL and will crash right after "Ready".

## Environment variables

See `.env.example`. Never commit `.env.local` (already gitignored).

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by `src/lib/supabaseAdmin.ts`. Never expose client-side.
- `SESSION_SECRET` — random 32+ byte secret for signing the session cookie (`openssl rand -base64 32`).

## Project structure

- `src/app/admin/` — admin dashboard: semester/period control, team & lecturer CRUD, import/export, grading progress.
- `src/app/lecturer/` — lecturer login, dashboard (teams where the lecturer is assigned as reviewer for the active period), per-team scoring page.
- `src/lib/` — server actions (`adminActions.ts`, `lecturerActions.ts`), auth/session (`auth.ts`, `session.ts`), Supabase clients (`supabase.ts` client-side, `supabaseAdmin.ts` server-only).
- `src/middleware.ts` — route guards for `/admin/*` and `/lecturer/dashboard`+`/lecturer/team/*`.
- `reference/` — internal source spreadsheets/notes used during migration. Not tracked in git, not part of the app.

## Deployment

Intended target: Vercel (app) + Supabase (free tier), per the project PRD.
