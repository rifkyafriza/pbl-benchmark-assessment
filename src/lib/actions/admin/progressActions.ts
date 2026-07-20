'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';

export async function getProgress(academicYearId: string) {
  await requireRole('admin');

  const [
    { data: semester },
    { data: teams }
  ] = await Promise.all([
    supabaseAdmin.from('academic_years').select('active_period').eq('id', academicYearId).single(),
    supabaseAdmin.from('teams').select(`
      id, name, team_code,
      team_lecturers (team_id, lecturer_id, role, users(name)),
      team_students (team_id, students(kelas)),
      grades (team_id, lecturer_id, is_locked, period)
    `).eq('academic_year_id', academicYearId).eq('is_deleted', false)
  ]);
  const period = semester?.active_period || 'ATS';

  if (!teams || teams.length === 0) return [];

  return teams.map((t: any) => {
    let pimproId: string | null = null;
    let pimproName: string | null = null;
    const reviewersForTeam: any[] = [];
    (t.team_lecturers || []).forEach((l: any) => {
       if (l.role === 'pimpro') {
           pimproId = l.lecturer_id;
           pimproName = l.users?.name || 'Unknown';
       }
       if (l.role === 'reviewer') reviewersForTeam.push({ lecturer_id: l.lecturer_id, lecturer_name: l.users?.name || 'Unknown' });
    });

    const totalStudents = (t.team_students || []).length;
    let team_kelas = null;
    if (t.team_students && t.team_students.length > 0) {
      team_kelas = t.team_students[0].students?.kelas || null;
    }

    const activeGrades = (t.grades || []).filter((g: any) => g.period === period);
    
    const reviewers = reviewersForTeam.map((r: any) => {
      const teamGrades = activeGrades.filter((g: any) => g.lecturer_id === r.lecturer_id);
      const finalized = teamGrades.filter((g: any) => g.is_locked).length;
      const status = teamGrades.length === 0 ? 'Not Started' : finalized === totalStudents && totalStudents > 0 ? 'Completed' : 'In Progress';
      return {
        lecturer_id: r.lecturer_id, lecturer_name: r.lecturer_name,
        graded_students: teamGrades.length, finalized_students: finalized, status,
      };
    });

    return {
      team_id: t.id, team_name: t.name, team_code: t.team_code, academic_year_id: academicYearId,
      pimpro_id: pimproId, pimpro_name: pimproName,
      team_kelas: team_kelas,
      total_students: totalStudents, reviewers,
    };
  });
}
