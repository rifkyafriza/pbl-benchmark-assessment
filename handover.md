# Handover — PBL Benchmark Assessment

> **Written for the next agent.** This document covers everything done in the current
> session and gives you enough context to continue work without reading the full
> conversation history.

---

## 1. Project Overview

**PBL Benchmark Assessment** is a Next.js 15 (App Router) web app deployed on **Vercel**,
backed by **Supabase** (Postgres + Auth). It is used by a university to manage
**Project-Based Learning (PBL)** assessment:

- Lecturers grade student teams across up to 3 score categories:
  - **b7** — Implementation
  - **c1** — Written Document
  - **c7** — Communication in English
- Grading happens across two assessment periods: **ATS** and **AAS**
- An admin controls semesters, teams, students, and reviewer assignments
- Exported results must match a specific Excel template (Form Assesment Benchmark)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router (`src/app/`) |
| Styling | Vanilla CSS + Tailwind (globals only) |
| Backend | Next.js Server Actions (`'use server'`) |
| Database | Supabase Postgres |
| Auth | Custom session via Supabase (`src/lib/auth.ts`, `src/lib/session.ts`) |
| Excel | `xlsx` (SheetJS) |
| Validation | `zod` |
| Deployment | Vercel (production), GitHub `main` branch |

---

## 2. Repository Structure

```
src/
├── app/
│   ├── admin/               Admin dashboard (page.tsx ~1300 lines, AddTeamModal, etc.)
│   ├── lecturer/            Lecturer portal (login, team list, grading client)
│   ├── api/health/          Health check endpoint (GET /api/health)
│   └── page.tsx             Root — portal selection (Admin / Lecturer)
├── lib/
│   ├── adminActions.ts      Barrel re-export for all admin server actions
│   ├── lecturerActions.ts   Lecturer-specific server actions
│   ├── auth.ts              requireRole() + session helpers
│   ├── session.ts           Cookie-based session management
│   ├── supabaseAdmin.ts     Supabase client (service-role key)
│   ├── types.ts             ActionResult<T>, OK, withActionResult helpers
│   └── actions/admin/
│       ├── importExportActions.ts   Import templates + exportGradesData()
│       ├── progressActions.ts       getProgress() — main data source for admin table
│       ├── semesterActions.ts       CRUD for academic years / semesters
│       ├── teamActions.ts           Teams, students, reviewer assignment + order
│       └── lecturerAdminActions.ts  Lecturer account management
├── components/
│   ├── Toast.tsx            Custom toast system (useToast hook)
│   ├── ConfirmDialog.tsx    Generic confirm modal
│   └── ThemeToggle.tsx      Dark/light toggle
└── __tests__/               Vitest unit tests
```

---

## 3. Database Schema (Key Tables)

```
academic_years
  id, name, active_period ('ATS'|'AAS'), is_active

teams
  id, academic_year_id, name, team_code, kelas, is_deleted
  rpp, laporan_akhir, poster, manual_book, bast, video_demo   ← document links

team_students
  team_id, student_id

students
  id, nim, name, prodi, semester, kelas

team_lecturers
  team_id, lecturer_id, role ('pimpro'|'reviewer')
  reviewer_order smallint CHECK (1|2|3)                        ← ADDED THIS SESSION

users
  id, name, email, role, password_hash

grades
  id, team_id, student_id, lecturer_id, period ('ATS'|'AAS')
  implementation_score, document_score, english_score
  comment, is_locked
```

> **Important:** `reviewer_order` was added this session via Supabase MCP. It controls
> which column (R1 / R2 / R3) each reviewer occupies in the Excel export. All 124
> existing reviewer rows were auto-filled based on alphabetical `lecturer_id` order
> per team. Admins can re-order via the badge UI in the admin dashboard.

---

## 4. What Was Done This Session

### Phase 1 — API & Interface Review Fixes (commit `d215ad1`)

A full API/interface security and quality review was performed. Fixes:

| # | Problem | Fix |
|---|---------|-----|
| 1 | No UUID validation on action inputs | Added `z.string().uuid()` via zod on all IDs |
| 2 | Service-role key exposed to client via `NEXT_PUBLIC_` | Removed public prefix; key is now server-only |
| 3 | Non-atomic import in `importTeamsTemplate` (insert then update) | Replaced with upsert for atomicity |
| 4 | No health endpoint | Added `GET /api/health` → `{ ok: true, timestamp }` |
| 5 | Dead/unreachable code | Removed across multiple files |
| 6 | No canonical result type for actions | Added `ActionResult<T>`, `OK`, `withActionResult` to `src/lib/types.ts` |

### Phase 2 — Export Function Rewrite (commit `aa84e59`)

**Goal:** The old export produced a flat CSV-style dump. The new export must match
the reference Excel file: `reference/Form Assesment Benchmark Semester Ganjil 2025_2026_Done v2.xlsx`

#### DB Migration Applied

```sql
-- Add column
ALTER TABLE public.team_lecturers
  ADD COLUMN reviewer_order smallint CHECK (reviewer_order IN (1, 2, 3));

-- Auto-fill existing rows
WITH ranked AS (
  SELECT team_id, lecturer_id,
    ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY lecturer_id) AS rn
  FROM public.team_lecturers WHERE role = 'reviewer'
)
UPDATE public.team_lecturers tl
SET reviewer_order = ranked.rn
FROM ranked
WHERE tl.team_id = ranked.team_id
  AND tl.lecturer_id = ranked.lecturer_id
  AND tl.role = 'reviewer';
-- Result: 48 × R1, 48 × R2, 28 × R3
```

#### New `exportGradesData()` — Column Layout (A–Z)

| Col | Header | Content |
|-----|--------|---------|
| A | Nama | `"b7. Implementation [NIM\tName]"` |
| B | NIM | Student NIM |
| C | Nama Mahasiswa | Student name |
| D | Level b7 R1 | Reviewer 1 implementation level (e.g. `"Level 3"`) |
| E | Level b7 R2 | Reviewer 2 implementation level |
| F | Level b7 R3 | Reviewer 3 (empty string if only 2 reviewers) |
| G | Level c1 R1 | Reviewer 1 document level |
| H | Level c1 R2 | Reviewer 2 document level |
| I | Level c1 R3 | Reviewer 3 (empty if ≤2) |
| J | Level c7 R1 | Reviewer 1 english level |
| K | Level c7 R2 | Reviewer 2 english level |
| L | Level c7 R3 | Reviewer 3 (empty if ≤2) |
| M | Nilai b7 R1 | Numeric score (0/47/62/77/90/100) |
| N | Nilai b7 R2 | Numeric score |
| O | Nilai b7 R3 | Numeric score (empty if ≤2) |
| P | Avg b7 | `avg(M, N [, O])` — divides by actual reviewer count |
| Q | Nilai c1 R1 | Numeric score |
| R | Nilai c1 R2 | Numeric score |
| S | Nilai c1 R3 | Numeric score (empty if ≤2) |
| T | Avg c1 | `avg(Q, R [, S])` |
| U | Nilai c7 R1 | Numeric score |
| V | Nilai c7 R2 | Numeric score |
| W | Nilai c7 R3 | Numeric score (empty if ≤2) |
| X | Avg c7 | `avg(U, V [, W])` |
| Y | PR (b7) | Same as Avg b7 (= P) |
| Z | PP ((c1+c7)/2) | `(Avg c1 + Avg c7) / 2` |

**Level → Score mapping:**
```
0→0   1→47   2→62   3→77   4→90   5→100
```

**Rules:**
- 3rd reviewer column (F/I/L/O/S/W) is `""` if that student only has 2 reviewer grades
- Averages divide by actual number of reviewers with data (2 or 3)
- Missing reviewer for a slot (no grade row) → `"Level 0"` / `0`
- Output: **two sheets** (`ATS` and `AAS`) in one `.xlsx` file
- Filename: `Form_Assesment_Benchmark.xlsx`
- Built using `XLSX.utils.aoa_to_sheet()` (array-of-arrays for exact column control)

#### Files Changed

| File | What Changed |
|------|-------------|
| `src/lib/actions/admin/importExportActions.ts` | Rewrote `exportGradesData()`. Added helper functions `SCORE_TO_LEVEL`, `scoreToLevelStr()`, `scoreToNum()`, `smartAvg()`, `EXPORT_HEADER` above the function. |
| `src/lib/actions/admin/teamActions.ts` | Added `setReviewerOrder()` and `getTeamReviewers()` server actions |
| `src/lib/actions/admin/progressActions.ts` | Added `reviewer_order` to the `team_lecturers` select; each reviewer object in the return now includes `reviewer_order` |
| `src/app/admin/page.tsx` | Updated `exportGrades()` handler; imported `setReviewerOrder`; added clickable R1/R2/R3 order badge to the reviewer progress rows |

---

## 5. Key Patterns to Follow

### Server Actions
- All admin actions live in `src/lib/actions/admin/` and are re-exported from `src/lib/adminActions.ts`
- Every action starts with `await requireRole('admin')` (or `'lecturer'`)
- All ID parameters are validated with `z.string().uuid()` before touching the DB
- Mutations call `revalidatePath('/admin')` at the end
- Prefer `ActionResult<T>` from `src/lib/types.ts` for mutations that need structured results

### Database Access
- Always use `supabaseAdmin` (service role key) — **never** the anon client in server actions
- Soft-delete on teams: always include `.eq('is_deleted', false)`
- Grade locking: `is_locked = true` means finalized by admin

### Error Handling & UI
- Toast: `const { toast } = useToast()` — use `toast.success/error/info()`
- **Never** use `alert()` or `window.confirm()` — use `<ConfirmDialog>` instead
- Modals must be rendered at the **root level** of the page component (not inside table cells
  or divs with `backdrop-filter`) to avoid CSS clipping bugs

---

## 6. Known Issues for Next Agent

| Priority | Issue | Location |
|----------|-------|----------|
| Low | `(r as any).reviewer_order` cast in reviewer badge — `ReviewerProgress` type (inline ~line 31 of `admin/page.tsx`) doesn't declare `reviewer_order` yet | `src/app/admin/page.tsx` |
| Medium | Supabase TypeScript types not regenerated after `reviewer_order` column was added — `database.types.ts` is stale or missing | Run `generate_typescript_types` via Supabase MCP |
| Low | `importReviewersTemplate` doesn't read or set `reviewer_order` when bulk-importing reviewers from Excel | `importExportActions.ts` |
| Low | Unit tests for new export helpers (`scoreToLevelStr`, `smartAvg`) not written | `src/__tests__/` |

---

## 7. Vercel & Environment

- **Repo:** `github.com/rifkyafriza/pbl-benchmark-assessment`
- **Auto-deploy:** push to `main` → Vercel deploys automatically
- **Health check:** `GET /api/health` → `{ ok: true, timestamp: "..." }`

Required environment variables (set in Vercel dashboard):
```
NEXT_PUBLIC_SUPABASE_URL         # public
NEXT_PUBLIC_SUPABASE_ANON_KEY    # public (anon/safe key only)
SUPABASE_SERVICE_ROLE_KEY        # server-only — never NEXT_PUBLIC_
SESSION_SECRET                   # cookie signing secret
```

---

## 8. Suggested Next Tasks

1. **Fix `ReviewerProgress` type** — add `reviewer_order: 1 | 2 | 3 | null` to the
   inline type at `admin/page.tsx` ~line 31 to remove the `as any` cast.

2. **Regenerate Supabase types** — run `generate_typescript_types` via Supabase MCP
   (project ID: `ssatzkxucirvztitwgoz`) and save to `src/lib/database.types.ts`.

3. **Add `REVIEWER_ORDER` column to reviewer import template** — update
   `importReviewersTemplate` to read an optional `REVIEWER_ORDER` (1/2/3) column from
   the Excel import and write it to `team_lecturers.reviewer_order`.

4. **Unit tests for export helpers** — add tests for `scoreToLevelStr`, `scoreToNum`,
   `smartAvg` and a snapshot test for `exportGradesData` output shape.

5. **Export loading indicator** — wire `isExporting` state to visually disable and show
   a spinner on the Export button while the async export is running.
