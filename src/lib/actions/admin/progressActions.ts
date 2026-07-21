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
      id, name, team_code, kelas,
      rpp, laporan_akhir, poster, manual_book, bast, video_demo,
      team_lecturers (team_id, lecturer_id, role, users(name)),
      team_students (team_id, student_id, students(kelas, nim, name)),
      grades (team_id, student_id, lecturer_id, is_locked, period, implementation_score, document_score, english_score)
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
    const team_kelas = t.kelas || null;

    const activeGrades = (t.grades || []).filter((g: any) => g.period === period);
    
    const reviewers = reviewersForTeam.map((r: any) => {
      const teamGrades = activeGrades.filter((g: any) => g.lecturer_id === r.lecturer_id);
      const finalized = teamGrades.filter((g: any) => g.is_locked).length;
      const status = teamGrades.length === 0 ? 'Not Started' : finalized === totalStudents && totalStudents > 0 ? 'Completed' : 'In Progress';
      const studentDetails = (t.team_students || []).map((ts: any) => {
        const grade = teamGrades.find((g: any) => g.student_id === ts.student_id);
        const hasScore = grade && ((grade.implementation_score || 0) > 0 && (grade.document_score || 0) > 0 && (grade.english_score || 0) > 0);
        return {
          id: ts.student_id,
          nim: ts.students?.nim || 'Unknown',
          name: ts.students?.name || 'Unknown',
          is_graded: !!grade,
          is_locked: !!grade?.is_locked,
          implementation_score: grade?.implementation_score,
          document_score: grade?.document_score,
          english_score: grade?.english_score,
          is_completed_grading: !!hasScore
        };
      });

      const graded_students = studentDetails.filter((s: any) => s.is_completed_grading).length;

      return {
        lecturer_id: r.lecturer_id,
        lecturer_name: r.lecturer_name,
        status,
        finalized_students: finalized,
        graded_students,
        students: studentDetails
      };
    });

    const isValidLink = (url: any) => {
      if (!url) return false;
      const str = String(url).trim();
      return str !== '' && str !== '-' && str.toLowerCase() !== 'n/a';
    };

    let completedLinks = 0;
    if (isValidLink(t.rpp)) completedLinks++;
    if (isValidLink(t.laporan_akhir)) completedLinks++;
    if (isValidLink(t.poster)) completedLinks++;
    if (isValidLink(t.manual_book)) completedLinks++;
    if (isValidLink(t.bast)) completedLinks++;
    if (isValidLink(t.video_demo)) completedLinks++;

    return {
      team_id: t.id, team_name: t.name, team_code: t.team_code, academic_year_id: academicYearId,
      pimpro_id: pimproId, pimpro_name: pimproName,
      team_kelas: team_kelas,
      total_students: totalStudents, reviewers,
      completed_links: completedLinks,
      links: {
        rpp: t.rpp,
        laporan_akhir: t.laporan_akhir,
        poster: t.poster,
        manual_book: t.manual_book,
        bast: t.bast,
        video_demo: t.video_demo,
      }
    };
  }).sort((a: any, b: any) => (a.team_name || '').localeCompare(b.team_name || ''));
}
