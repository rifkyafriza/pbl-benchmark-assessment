'use server';
// Server actions for the lecturer scoring flow — all DB access goes through
// supabaseAdmin (service_role) after a session/role check, since RLS has no
// policies for anon/authenticated roles by design (see README).
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';

export async function getMyReviewTeams() {
  const session = await requireRole('lecturer');

  const { data: activeAcademicYear } = await supabaseAdmin
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (!activeAcademicYear) return { lecturerName: session.name, teams: [] as any[] };

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select(`
      id, name, team_code, kelas,
      team_lecturers!inner(lecturer_id, role),
      team_students (students(kelas))
    `)
    .eq('academic_year_id', activeAcademicYear.id)
    .eq('is_deleted', false)
    .eq('team_lecturers.lecturer_id', session.id)
    .eq('team_lecturers.role', 'reviewer')
    .order('team_code');

  const teamsWithKelas = (teams || []).map((t: any) => {
    return {
      id: t.id,
      name: t.name,
      team_code: t.team_code,
      team_kelas: t.kelas || null
    };
  });

  return { lecturerName: session.name, teams: teamsWithKelas };
}

// Fetches the currently active semester's active_period (defaults to 'ATS' if
// no active semester is set — matches the DB column default).
async function getActivePeriod(): Promise<'ATS' | 'AAS'> {
  const { data } = await supabaseAdmin.from('academic_years').select('active_period').eq('is_active', true).maybeSingle();
  return (data?.active_period as 'ATS' | 'AAS') || 'ATS';
}

export async function getTeamForGrading(teamId: string) {
  const session = await requireRole('lecturer');

  // Fetch all necessary data concurrently
  const [
    { data: assignment },
    { data: activeYearData },
    { data: team },
    { data: ts },
    { data: grades }
  ] = await Promise.all([
    supabaseAdmin.from('team_lecturers').select('team_id').eq('team_id', teamId).eq('lecturer_id', session.id).eq('role', 'reviewer').maybeSingle(),
    supabaseAdmin.from('academic_years').select('active_period').eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('teams').select('*').eq('id', teamId).single(),
    supabaseAdmin.from('team_students').select('student_id, students(id, name, nim, kelas)').eq('team_id', teamId),
    supabaseAdmin.from('grades').select('*').eq('team_id', teamId).eq('lecturer_id', session.id)
  ]);

  if (!assignment) return null;

  const period = (activeYearData?.active_period as 'ATS' | 'AAS') || 'ATS';
  const students = (ts || []).map((r: any) => r.students).filter(Boolean);
  const activeGrades = (grades || []).filter((g: any) => g.period === period);

  return { team, students, grades: activeGrades, lecturerId: session.id, period };
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

  const period = await getActivePeriod();

  // Refuse edits if already locked (defense in depth; UI also disables inputs).
  const { data: existingLocked } = await supabaseAdmin
    .from('grades')
    .select('is_locked')
    .eq('team_id', teamId)
    .eq('lecturer_id', session.id)
    .eq('period', period)
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
    period,
    implementation_score: clampScore(e.implementation_score),
    document_score: clampScore(e.document_score),
    english_score: clampScore(e.english_score),
    comment: e.comment || null,
    is_locked: finalize,
    submitted_at: finalize ? now : null,
    updated_at: now,
  }));

  // One row per (student, reviewer, period) — upsert on the natural key.
  const { error } = await supabaseAdmin
    .from('grades')
    .upsert(rows, { onConflict: 'student_id,team_id,lecturer_id,period' });
  if (error) throw new Error(error.message);

  revalidatePath(`/lecturer/team/${teamId}`);
  revalidatePath('/lecturer/dashboard');
}
