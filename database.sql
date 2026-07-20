-- Supabase Database Schema Template for PBL Benchmark Assessment

-- Enable pgcrypto for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: users (Admin & Lecturers)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'lecturer')),
    initials TEXT
);

-- Table: academic_years
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    active_period TEXT NOT NULL DEFAULT 'ATS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: students
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nim TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    prodi TEXT,
    semester TEXT,
    kelas TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_code TEXT,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    rpp TEXT,
    laporan_akhir TEXT,
    poster TEXT,
    manual_book TEXT,
    bast TEXT,
    video_demo TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: team_students (Many-to-Many between teams and students)
CREATE TABLE IF NOT EXISTS public.team_students (
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, student_id)
);

-- Table: team_lecturers (Many-to-Many between teams and users/lecturers with roles like reviewer, pimpro)
CREATE TABLE IF NOT EXISTS public.team_lecturers (
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    lecturer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'reviewer',
    PRIMARY KEY (team_id, lecturer_id, role)
);

-- Table: grades
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    lecturer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL DEFAULT 'ATS',
    implementation_score INTEGER,
    document_score INTEGER,
    english_score INTEGER,
    comment TEXT,
    is_locked BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(student_id, team_id, lecturer_id, period)
);

-- Default Admin Account (Change password after login!)
-- Note: 'password123' bcrypt hash is typically '/nJ.Z6u8i6K7Oa/qE50XzYJ3lB7S2'
INSERT INTO public.users (name, username, password_hash, role, initials)
VALUES (
    'Administrator',
    'admin',
    '$2b$12$KIXeW444L1Xh25bUuF6mKueZ/nJ.Z6u8i6K7Oa/qE50XzYJ3lB7S2',
    'admin',
    'ADM'
) ON CONFLICT DO NOTHING;
