'use server';
// Server actions for the lecturer scoring flow — all DB access goes through
// supabaseAdmin (service_role) after a session/role check, since RLS has no
// policies for anon/authenticated roles by design (see README).
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';

export async function getMyReviewTeams() {
  const session = await requireRole('lecturer');

  const { data: activeSemester } = await supabaseAdmin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (!activeSemester) return { lecturerName: session.name, teams: [] as any[] };

  const { data: assignments } = await supabaseAdmin
    .from('team_lecturers')
    .select('team_id')
    .eq('lecturer_id', session.id)
    .eq('role', 'reviewer'); // pimpro-only assignments must NOT surface here

  const teamIds = (assignments || []).map((a) => a.team_id);
  if (teamIds.length === 0) return { lecturerName: session.name, teams: [] as any[] };

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, team_code')
    .in('id', teamIds)
    .eq('semester_id', activeSemester.id)
    .eq('is_deleted', false)
    .order('team_code');

  return { lecturerName: session.name, teams: teams || [] };
}

export async function getTeamForGrading(teamId: string) {
  const session = await requireRole('lecturer');

  // Confirm this lecturer is assigned as reviewer for this team (defense in depth).
  const { data: assignment } = await supabaseAdmin
    .from('team_lecturers')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('lecturer_id', session.id)
    .eq('role', 'reviewer')
    .maybeSingle();
  if (!assignment) return null;

  const { data: team } = await supabaseAdmin.from('teams').select('*').eq('id', teamId).single();

  const { data: ts } = await supabaseAdmin
    .from('team_students')
    .select('student_id, students(id, name, nim)')
    .eq('team_id', teamId);

  const students = (ts || []).map((r: any) => r.students).filter(Boolean);

  const { data: grades } = await supabaseAdmin
    .from('grades')
    .select('*')
    .eq('team_id', teamId)
    .eq('lecturer_id', session.id);

  return { team, students, grades: grades || [], lecturerId: session.id };
}

const clampScore = (n: any) => Math.max(0, Math.min(5, Math.round(Number(n) || 0)));

export async function saveGrades(
  teamId: string,
  entries: { studentId: string; implementation_score: number; document_score: number; english_score: number; comment: string }[],
  finalize: boolean
) {
  const session = await requireRole('lecturer');

  const { data: assignment } = await supabaseAdmin
    .from('team_lecturers')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('lecturer_id', session.id)
    .eq('role', 'reviewer')
    .maybeSingle();
  if (!assignment) throw new Error('Not authorized for this team.');

  // Refuse edits if already locked (defense in depth; UI also disables inputs).
  const { data: existingLocked } = await supabaseAdmin
    .from('grades')
    .select('is_locked')
    .eq('team_id', teamId)
    .eq('lecturer_id', session.id)
    .eq('is_locked', true)
    .limit(1);
  if (existingLocked && existingLocked.length > 0 && !finalize) {
    throw new Error('Scores are locked. Ask the admin to unlock before editing.');
  }

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    student_id: e.studentId,
    team_id: teamId,
    lecturer_id: session.id,
    implementation_score: clampScore(e.implementation_score),
    document_score: clampScore(e.document_score),
    english_score: clampScore(e.english_score),
    comment: e.comment || null,
    is_locked: finalize,
    submitted_at: finalize ? now : null,
    updated_at: now,
  }));

  // One row per (student, reviewer) — upsert on the natural key.
  const { error } = await supabaseAdmin
    .from('grades')
    .upsert(rows, { onConflict: 'student_id,team_id,lecturer_id' });
  if (error) throw new Error(error.message);

  revalidatePath(`/lecturer/team/${teamId}`);
  revalidatePath('/lecturer/dashboard');
}
