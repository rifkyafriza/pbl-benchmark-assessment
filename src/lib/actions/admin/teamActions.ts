'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

const idSchema = z.string().uuid('Invalid ID format');
const optionalIdSchema = z.string().uuid('Invalid ID format').nullable();
const studentSchema = z.object({
  nim: z.string().min(1, 'NIM is required').max(50),
  name: z.string().min(1, 'Name is required').max(150),
  prodi: z.string().max(100).nullable().optional(),
  semester: z.string().max(50).nullable().optional(),
  kelas: z.string().max(50).nullable().optional(),
});


export async function setTeamAssignment(teamId: string, role: 'pimpro', lecturerId: string | null) {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const validLecturerId = optionalIdSchema.parse(lecturerId);
  
  const { error: delError } = await supabaseAdmin.from('team_lecturers').delete().eq('team_id', validTeamId).eq('role', role);
  if (delError) throw new Error(delError.message);
  if (validLecturerId) {
    const { error } = await supabaseAdmin.from('team_lecturers').insert({ team_id: validTeamId, lecturer_id: validLecturerId, role });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

export async function setTeamReviewer(teamId: string, previousLecturerId: string | null, newLecturerId: string | null) {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const validPrevId = optionalIdSchema.parse(previousLecturerId);
  const validNewId = optionalIdSchema.parse(newLecturerId);

  if (validNewId) {
    const { data: existing } = await supabaseAdmin
      .from('team_lecturers')
      .select('lecturer_id')
      .eq('team_id', validTeamId)
      .eq('role', 'reviewer')
      .neq('lecturer_id', validPrevId ?? '00000000-0000-0000-0000-000000000000');
    if ((existing || []).some((r) => r.lecturer_id === validNewId)) {
      throw new Error('This lecturer is already assigned as a reviewer for this team in another slot.');
    }
  }

  if (validPrevId) {
    const { error: delError } = await supabaseAdmin
      .from('team_lecturers').delete()
      .eq('team_id', validTeamId).eq('role', 'reviewer').eq('lecturer_id', validPrevId);
    if (delError) throw new Error(delError.message);
  }
  if (validNewId) {
    const { error } = await supabaseAdmin.from('team_lecturers').insert({ team_id: validTeamId, lecturer_id: validNewId, role: 'reviewer' });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

export async function getTeamCount(academicYearId: string) {
  await requireRole('admin');
  const { count } = await supabaseAdmin
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('academic_year_id', academicYearId)
    .eq('is_deleted', false);
  return count || 0;
}

export async function toggleTeamReviewerLock(teamId: string, lecturerId: string, academicYearId: string, lock: boolean) {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const validLecturerId = idSchema.parse(lecturerId);
  const validAcademicYearId = idSchema.parse(academicYearId);
  
  const { data: semester } = await supabaseAdmin.from('academic_years').select('active_period').eq('id', validAcademicYearId).single();
  const period = semester?.active_period || 'ATS';
  const { error } = await supabaseAdmin
    .from('grades')
    .update({ is_locked: lock })
    .eq('team_id', validTeamId)
    .eq('lecturer_id', validLecturerId)
    .eq('period', period);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteTeam(teamId: string) {
  await requireRole('admin');
  const validId = idSchema.parse(teamId);
  
  await supabaseAdmin.from('grades').delete().eq('team_id', validId);
  await supabaseAdmin.from('team_students').delete().eq('team_id', validId);
  await supabaseAdmin.from('team_lecturers').delete().eq('team_id', validId);
  const { error } = await supabaseAdmin.from('teams').delete().eq('id', validId);
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin');
}

export async function getTeamStudents(teamId: string) {
  await requireRole('admin');
  const { data: teamStudents, error } = await supabaseAdmin
    .from('team_students')
    .select('student_id, students(nim, name, prodi, semester, kelas)')
    .eq('team_id', teamId);
  if (error) throw new Error(error.message);
  return (teamStudents || []).map((ts: any) => ({
    id: ts.student_id,
    nim: ts.students.nim,
    name: ts.students.name,
    prodi: ts.students.prodi,
    semester: ts.students.semester,
    kelas: ts.students.kelas,
  }));
}

export async function updateStudent(studentId: string, nim: string, name: string, prodi?: string, semester?: string, kelas?: string) {
  await requireRole('admin');
  const validId = idSchema.parse(studentId);
  const parsed = studentSchema.parse({ nim: nim.trim(), name: name.trim(), prodi: prodi?.trim(), semester: semester?.trim(), kelas: kelas?.trim() });
  
  const { error } = await supabaseAdmin.from('students').update(parsed).eq('id', validId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function addStudentToTeam(teamId: string, nim: string, name: string, prodi?: string, semester?: string, kelas?: string) {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const parsed = studentSchema.parse({ nim: nim.trim(), name: name.trim(), prodi: prodi?.trim(), semester: semester?.trim(), kelas: kelas?.trim() });
  
  let { data: student } = await supabaseAdmin.from('students').select('id').eq('nim', parsed.nim).maybeSingle();
  if (!student) {
    const { data, error } = await supabaseAdmin.from('students').insert(parsed).select('id').single();
    if (error) throw new Error(error.message);
    student = data;
  } else {
    await supabaseAdmin.from('students').update(parsed).eq('id', student.id);
  }

  const { data: link } = await supabaseAdmin.from('team_students').select('team_id').eq('team_id', validTeamId).eq('student_id', student!.id).maybeSingle();
  if (!link) {
    const { error } = await supabaseAdmin.from('team_students').insert({ team_id: validTeamId, student_id: student!.id });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

export async function removeStudentFromTeam(teamId: string, studentId: string) {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const validStudentId = idSchema.parse(studentId);
  const { error } = await supabaseAdmin.from('team_students').delete().eq('team_id', validTeamId).eq('student_id', validStudentId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function addTeamManual(
  academicYearId: string,
  teamCode: string,
  teamName: string,
  pimproId: string | null,
  kelas: string | null,
  students: { nim: string, name: string }[],
  links?: {
    rpp?: string;
    laporan_akhir?: string;
    poster?: string;
    manual_book?: string;
    bast?: string;
    video_demo?: string;
  }
) {
  await requireRole('admin');
  const validAcademicYearId = idSchema.parse(academicYearId);
  if (!teamCode || !teamName) throw new Error('Team Code and Team Name are required.');

  // 1. Create team
  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .insert({
      academic_year_id: validAcademicYearId,
      team_code: teamCode.trim(),
      name: teamName.trim(),
      kelas: kelas,
      is_deleted: false,
      rpp: links?.rpp || null,
      laporan_akhir: links?.laporan_akhir || null,
      poster: links?.poster || null,
      manual_book: links?.manual_book || null,
      bast: links?.bast || null,
      video_demo: links?.video_demo || null,
    })
    .select('id')
    .single();

  if (teamError) throw new Error('Failed to create team: ' + teamError.message);
  const newTeamId = team.id;

  // 2. Assign pimpro (manpro) if provided
  if (pimproId) {
    const validPimproId = idSchema.parse(pimproId);
    const { error: pimproError } = await supabaseAdmin
      .from('team_lecturers')
      .insert({ team_id: newTeamId, lecturer_id: validPimproId, role: 'pimpro' });
    if (pimproError) throw new Error('Failed to assign Manpro: ' + pimproError.message);
  }

  // 3. Process students
  for (const s of students) {
    if (!s.nim || !s.name) continue;
    
    // Check if student exists
    let { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('nim', s.nim.trim())
      .maybeSingle();

    let studentId = existingStudent?.id;

    if (!studentId) {
      // Insert new student
      const { data: newStudent, error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          nim: s.nim.trim(),
          name: s.name.trim(),
        })
        .select('id')
        .single();
      
      if (studentError) throw new Error('Failed to create student: ' + studentError.message);
      studentId = newStudent.id;
    } else {
      // Update existing student name
      await supabaseAdmin
        .from('students')
        .update({ name: s.name.trim() })
        .eq('id', studentId);
    }

    // Link student to team
    const { error: linkError } = await supabaseAdmin
      .from('team_students')
      .insert({ team_id: newTeamId, student_id: studentId });
    if (linkError) throw new Error('Failed to link student to team: ' + linkError.message);
  }

  revalidatePath('/admin');
  return newTeamId;
}

export async function updateTeamClass(teamId: string, kelas: string | null) {
  await requireRole('admin');
  const validId = idSchema.parse(teamId);
  const { error } = await supabaseAdmin.from('teams').update({ kelas }).eq('id', validId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function updateTeamLinks(
  teamId: string, 
  links: {
    rpp?: string;
    laporan_akhir?: string;
    poster?: string;
    manual_book?: string;
    bast?: string;
    video_demo?: string;
  }
) {
  await requireRole('admin');
  const validId = idSchema.parse(teamId);
  
  // Only update fields that are defined
  const updateData: any = {};
  if (links.rpp !== undefined) updateData.rpp = links.rpp;
  if (links.laporan_akhir !== undefined) updateData.laporan_akhir = links.laporan_akhir;
  if (links.poster !== undefined) updateData.poster = links.poster;
  if (links.manual_book !== undefined) updateData.manual_book = links.manual_book;
  if (links.bast !== undefined) updateData.bast = links.bast;
  if (links.video_demo !== undefined) updateData.video_demo = links.video_demo;

  if (Object.keys(updateData).length === 0) return;

  const { error } = await supabaseAdmin.from('teams').update(updateData).eq('id', validId);
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin');
}

const reviewerOrderSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]);

/** Set or clear the reviewer order (1|2|3|null) for a reviewer on a team. */
export async function setReviewerOrder(
  teamId: string,
  lecturerId: string,
  order: 1 | 2 | 3 | null,
): Promise<void> {
  await requireRole('admin');
  const validTeamId = idSchema.parse(teamId);
  const validLecturerId = idSchema.parse(lecturerId);
  const validOrder = reviewerOrderSchema.parse(order);

  const { error } = await supabaseAdmin
    .from('team_lecturers')
    .update({ reviewer_order: validOrder })
    .eq('team_id', validTeamId)
    .eq('lecturer_id', validLecturerId)
    .eq('role', 'reviewer');

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

/** Fetch reviewers for a team with their current order, sorted by reviewer_order. */
export async function getTeamReviewers(teamId: string) {
  await requireRole('admin');
  const validId = idSchema.parse(teamId);

  const { data, error } = await supabaseAdmin
    .from('team_lecturers')
    .select('lecturer_id, reviewer_order, users(name)')
    .eq('team_id', validId)
    .eq('role', 'reviewer')
    .order('reviewer_order', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    lecturerId: r.lecturer_id,
    name: r.users?.name || 'Unknown',
    order: r.reviewer_order as 1 | 2 | 3 | null,
  }));
}
