'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function resolveLecturer(
  value: string,
  lecturers: { id: string; name: string; username: string | null }[]
): { id: string; name: string } | { error: string } {
  const input = normalize(value);

  const usernameHit = lecturers.find((l) => l.username && normalize(l.username) === input);
  if (usernameHit) return { id: usernameHit.id, name: usernameHit.name };

  const exactNameHit = lecturers.find((l) => normalize(l.name) === input);
  if (exactNameHit) return { id: exactNameHit.id, name: exactNameHit.name };

  const inputWords = input.split(' ').filter(Boolean);
  const candidates = lecturers.filter((l) => {
    const name = normalize(l.name);
    // if database name contains the input, or input (with degrees) contains database name
    if (name.includes(input) || input.includes(name)) return true;
    
    // check if all words of the database name are in the input, or vice versa
    const nameWords = name.split(' ').filter(Boolean);
    const hasAllNameWords = nameWords.every((w) => inputWords.includes(w));
    const hasAllInputWords = inputWords.every((w) => nameWords.includes(w));
    return hasAllNameWords || hasAllInputWords;
  });

  if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
  if (candidates.length === 0) return { error: `no lecturer found matching "${value}"` };
  
  // Sort candidates by length (closest match first) to try and find the best one, if not throw ambiguous
  const bestMatch = candidates.sort((a, b) => Math.abs(a.name.length - input.length) - Math.abs(b.name.length - input.length))[0];
  if (bestMatch) return { id: bestMatch.id, name: bestMatch.name };

  return { error: `"${value}" matches multiple lecturers ambiguously (${candidates.map((c) => c.name).join(', ')}) — use a username or fuller name` };
}

type SiapPblImportRow = {
  'ID'?: string | number;
  'Judul Usulan PBL'?: string;
  'Jenis Proyek'?: string;
  'Tipe Proyek'?: string;
  'Manpro'?: string;
  'Nama Tim'?: string;
  'MHS'?: string;
  'Matakuliah'?: string;
  'RPP'?: string;
  'Laporan Akhir'?: string;
  'Poster'?: string;
  'Manual Book'?: string;
  'BAST'?: string;
  'Video Demo'?: string;
};

export async function importSiapPblTemplate(rows: SiapPblImportRow[], academicYearId: string) {
  await requireRole('admin');

  const { data: lecturers } = await supabaseAdmin.from('users').select('id, name, username').eq('role', 'lecturer');
  const lecturerList = lecturers || [];

  const errors: string[] = [];
  
  // Extract all students from all rows
  const parsedRows: Array<{
    teamCode: string,
    projectName: string,
    manproRaw: string,
    manproId: string,
    links: {
      rpp: string | null,
      laporan_akhir: string | null,
      poster: string | null,
      manual_book: string | null,
      bast: string | null,
      video_demo: string | null,
    },
    students: Array<{ nim: string, name: string }>
  }> = [];

  rows.forEach((r, i) => {
    const line = i + 2;
    const teamCode = String(r['Nama Tim'] || '').trim();
    const projectName = String(r['Judul Usulan PBL'] || '').trim();
    const manproRaw = String(r['Manpro'] || '').trim();
    const mhsStr = String(r['MHS'] || '').trim();

    if (!teamCode) errors.push(`Row ${line}: missing Nama Tim`);
    if (!projectName) errors.push(`Row ${line}: missing Judul Usulan PBL`);
    if (!manproRaw) errors.push(`Row ${line}: missing Manpro`);
    if (!mhsStr) errors.push(`Row ${line}: missing MHS`);

    if (!teamCode || !projectName || !manproRaw || !mhsStr) return;

    const resolvedLecturer = resolveLecturer(manproRaw, lecturerList);
    if ('error' in resolvedLecturer) {
      errors.push(`Row ${line}: Manpro "${manproRaw}": ${resolvedLecturer.error}`);
      return;
    }

    const students: Array<{ nim: string, name: string }> = [];
    const matches = [...mhsStr.matchAll(/([^(,]+)\s*\((\d+)\)/g)];
    if (matches.length === 0) {
      errors.push(`Row ${line}: MHS column is incorrectly formatted, unable to extract any students (expected "Name (NIM), ...")`);
      return;
    }
    for (const match of matches) {
      students.push({
        name: match[1].trim(),
        nim: match[2].trim()
      });
    }

    const existingRow = parsedRows.find(r => r.teamCode === teamCode && r.projectName === projectName);
    if (existingRow) {
      existingRow.students.push(...students);
      // Merge links if present in this row but missing in the previous one
      if (r['RPP'] && !existingRow.links.rpp) existingRow.links.rpp = String(r['RPP']).trim();
      if (r['Laporan Akhir'] && !existingRow.links.laporan_akhir) existingRow.links.laporan_akhir = String(r['Laporan Akhir']).trim();
      if (r['Poster'] && !existingRow.links.poster) existingRow.links.poster = String(r['Poster']).trim();
      if (r['Manual Book'] && !existingRow.links.manual_book) existingRow.links.manual_book = String(r['Manual Book']).trim();
      if (r['BAST'] && !existingRow.links.bast) existingRow.links.bast = String(r['BAST']).trim();
      if (r['Video Demo'] && !existingRow.links.video_demo) existingRow.links.video_demo = String(r['Video Demo']).trim();
    } else {
      parsedRows.push({
        teamCode,
        projectName,
        manproRaw,
        manproId: resolvedLecturer.id,
        links: {
          rpp: r['RPP'] ? String(r['RPP']).trim() : null,
          laporan_akhir: r['Laporan Akhir'] ? String(r['Laporan Akhir']).trim() : null,
          poster: r['Poster'] ? String(r['Poster']).trim() : null,
          manual_book: r['Manual Book'] ? String(r['Manual Book']).trim() : null,
          bast: r['BAST'] ? String(r['BAST']).trim() : null,
          video_demo: r['Video Demo'] ? String(r['Video Demo']).trim() : null,
        },
        students
      });
    }
  });

  if (errors.length > 0) return { success: false, error: `Import aborted, no rows were applied. Errors:\n${errors.join('\n')}` };

  // 1. Process Teams
  const teamCodes = parsedRows.map(r => r.teamCode);
  const { data: existingTeams, error: existingTeamsErr } = await supabaseAdmin
    .from('teams')
    .select('id, team_code, name, is_deleted')
    .eq('academic_year_id', academicYearId)
    .in('team_code', teamCodes);
  if (existingTeamsErr) return { success: false, error: 'Failed to fetch existing teams' };
  
  const existingTeamsList = existingTeams || [];
  const teamMap = new Map<string, string>(); // teamCode_projectName -> id
  
  const newTeamsToInsert = [];
  const teamsToUpdate = [];
  
  for (const r of parsedRows) {
    const existing = existingTeamsList.find(t => t.team_code === r.teamCode && t.name === r.projectName);
    
    if (existing) {
      teamMap.set(`${r.teamCode}_${r.projectName}`, existing.id);
      teamsToUpdate.push({
        id: existing.id,
        academic_year_id: academicYearId,
        team_code: r.teamCode,
        name: r.projectName,
        is_deleted: false,
        ...r.links
      });
    } else {
      newTeamsToInsert.push({ 
        academic_year_id: academicYearId, 
        team_code: r.teamCode, 
        name: r.projectName,
        ...r.links
      });
    }
  }
  
  if (teamsToUpdate.length > 0) {
     const { error: updateErr } = await supabaseAdmin.from('teams').upsert(teamsToUpdate);
     if (updateErr) return { success: false, error: `Failed to update teams: ${updateErr.message}` };
  }
  
  if (newTeamsToInsert.length > 0) {
     const { data: insertedTeams, error: insertTeamsErr } = await supabaseAdmin.from('teams').insert(newTeamsToInsert).select('id, team_code, name');
     if (insertTeamsErr) return { success: false, error: `Failed to create new teams: ${insertTeamsErr.message}` };
     insertedTeams?.forEach(t => teamMap.set(`${t.team_code}_${t.name}`, t.id));
  }

  // 2. Process Team Lecturers (Manpro)
  const teamLecturerLinks = [];
  for (const r of parsedRows) {
    const teamId = teamMap.get(`${r.teamCode}_${r.projectName}`);
    if (teamId) {
       teamLecturerLinks.push({ team_id: teamId, lecturer_id: r.manproId, role: 'pimpro' });
    }
  }
  
  const teamIds = Array.from(teamMap.values());
  if (teamIds.length > 0) {
    const { data: existingPimproLinks, error: existingPimproLinksErr } = await supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id').eq('role', 'pimpro').in('team_id', teamIds);
    if (existingPimproLinksErr) return { success: false, error: `Failed to fetch existing pimpro links: ${existingPimproLinksErr.message}` };
    const existingPimproMap = new Map((existingPimproLinks || []).map(l => [l.team_id, l]));
    
    const newPimproLinks = [];
    const updatePromises = [];
    for (const link of teamLecturerLinks) {
       const existing = existingPimproMap.get(link.team_id);
       if (existing) {
          if (existing.lecturer_id !== link.lecturer_id) {
             updatePromises.push(supabaseAdmin.from('team_lecturers').update({ lecturer_id: link.lecturer_id }).eq('team_id', existing.team_id).eq('role', 'pimpro'));
          }
       } else {
          newPimproLinks.push(link);
       }
    }
    if (updatePromises.length > 0) await Promise.all(updatePromises);
    if (newPimproLinks.length > 0) {
       const { error: insertPimproErr } = await supabaseAdmin.from('team_lecturers').insert(newPimproLinks);
       if (insertPimproErr) return { success: false, error: `Failed to assign pimpros: ${insertPimproErr.message}` };
    }
  }

  // 3. Process Students
  const allStudents = parsedRows.flatMap(r => r.students);
  const allNims = Array.from(new Set(allStudents.map(s => s.nim)));
  
  const { data: existingStudents, error: existingStudentsErr } = await supabaseAdmin.from('students').select('id, nim').in('nim', allNims);
  if (existingStudentsErr) return { success: false, error: `Failed to fetch students: ${existingStudentsErr.message}` };
  
  const existingStudentMap = new Map((existingStudents || []).map(s => [s.nim, s.id]));
  const studentsToInsert = [];
  const studentsToUpdate = [];
  
  for (const s of allStudents) {
    const existingId = existingStudentMap.get(s.nim);
    if (existingId) {
      studentsToUpdate.push({ id: existingId, nim: s.nim, name: s.name });
    } else {
      studentsToInsert.push({ nim: s.nim, name: s.name });
    }
  }

  // deduplicate updates/inserts just in case
  const uniqueStudentsToInsert = Array.from(new Map(studentsToInsert.map(s => [s.nim, s])).values());
  const uniqueStudentsToUpdate = Array.from(new Map(studentsToUpdate.map(s => [s.nim, s])).values());

  if (uniqueStudentsToInsert.length > 0) {
    const { data: insertedStudents, error: insertStudentsErr } = await supabaseAdmin.from('students').insert(uniqueStudentsToInsert).select('id, nim');
    if (insertStudentsErr) return { success: false, error: `Failed to insert students: ${insertStudentsErr.message}` };
    insertedStudents?.forEach(s => existingStudentMap.set(s.nim, s.id));
  }
  
  if (uniqueStudentsToUpdate.length > 0) {
     const { error: updateStudentsErr } = await supabaseAdmin.from('students').upsert(uniqueStudentsToUpdate);
     if (updateStudentsErr) return { success: false, error: `Failed to update students: ${updateStudentsErr.message}` };
  }
  
  // 4. Link Students to Teams
  const studentTeamLinks = [];
  for (const r of parsedRows) {
    const teamId = teamMap.get(`${r.teamCode}_${r.projectName}`);
    for (const s of r.students) {
      const studentId = existingStudentMap.get(s.nim);
      if (teamId && studentId) {
         studentTeamLinks.push({ team_id: teamId, student_id: studentId });
      }
    }
  }
  
  if (teamIds.length > 0) {
    const { data: existingStudentLinks, error: existingStudentLinksErr } = await supabaseAdmin.from('team_students').select('team_id, student_id').in('team_id', teamIds);
    if (existingStudentLinksErr) return { success: false, error: `Failed to fetch existing student links: ${existingStudentLinksErr.message}` };
    const existingStudentLinkSet = new Set((existingStudentLinks || []).map(l => `${l.team_id}_${l.student_id}`));
    
    const newStudentLinks = studentTeamLinks.filter(l => !existingStudentLinkSet.has(`${l.team_id}_${l.student_id}`));
    if (newStudentLinks.length > 0) {
       const { error: insertStudentLinkErr } = await supabaseAdmin.from('team_students').insert(newStudentLinks);
       if (insertStudentLinkErr) return { success: false, error: `Failed to insert team-student links: ${insertStudentLinkErr.message}` };
    }
  }

  revalidatePath('/admin');
  return { success: true, teamsProcessed: parsedRows.length, studentsProcessed: allStudents.length };
}

export type ReviewersImportRow = {
  KODE: string | number;
  'JUDUL PROJECT'?: string | number;
  [key: string]: any; // Allows 'REVIEWER 1', 'REVIEWER 2', etc.
};

export async function importReviewersTemplate(rows: ReviewersImportRow[], academicYearId: string) {
  await requireRole('admin');

  const { data: lecturers } = await supabaseAdmin.from('users').select('id, name, username').eq('role', 'lecturer');
  const lecturerList = lecturers || [];

  const errors: string[] = [];
  const teamCodeCache = new Map<string, string | null>();
  const toApply: { teamId: string; lecturerId: string; order: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    if (!r['KODE'] || !String(r['KODE']).trim()) {
      errors.push(`Row ${line}: missing KODE`);
      continue;
    }
    const code = String(r['KODE']).trim();
    const projectName = r['JUDUL PROJECT'] ? String(r['JUDUL PROJECT']).trim() : '';
    const uniqueKey = `${code}_${projectName}`;
    
    if (!teamCodeCache.has(uniqueKey)) {
      let query = supabaseAdmin.from('teams').select('id').eq('academic_year_id', academicYearId).eq('team_code', code);
      if (projectName) {
        query = query.eq('name', projectName);
      }
      const { data: t } = await query.maybeSingle();
      teamCodeCache.set(uniqueKey, t?.id ?? null);
    }
    const teamId = teamCodeCache.get(uniqueKey);
    if (!teamId) {
      errors.push(`Row ${line}: team "${code}" with project "${projectName}" not found in this tahun ajaran`);
      continue;
    }

    const slots: { label: string; value?: string }[] = [
      { label: 'REVIEWER 1', value: r['REVIEWER 1'] },
      { label: 'REVIEWER 2', value: r['REVIEWER 2'] },
      { label: 'REVIEWER 3', value: r['REVIEWER 3'] },
    ];
    const rowLecturerIds = new Set<string>();
    for (const slot of slots) {
      const raw = slot.value ? String(slot.value).trim() : '';
      if (!raw) continue;
      const resolved = resolveLecturer(raw, lecturerList);
      if ('error' in resolved) {
        errors.push(`Row ${line}: team ${code} ${slot.label}: ${resolved.error}`);
        continue;
      }
      if (rowLecturerIds.has(resolved.id)) {
        errors.push(`Row ${line}: team ${code} ${slot.label}: "${raw}" (${resolved.name}) is already assigned to another reviewer slot in this row`);
        continue;
      }
      rowLecturerIds.add(resolved.id);
      toApply.push({ teamId, lecturerId: resolved.id, order: slot.label === 'REVIEWER 1' ? 1 : slot.label === 'REVIEWER 2' ? 2 : 3 });
    }
  }

  if (errors.length > 0) return { success: false, error: `Import aborted, no rows were applied. Errors:\n${errors.join('\n')}` };

  if (toApply.length > 0) {
    const { data: existingAll } = await supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id, reviewer_order').eq('role', 'reviewer').in('team_id', toApply.map(x => x.teamId));
    const existingMap = new Map((existingAll||[]).map(x => [`${x.team_id}_${x.lecturer_id}`, x]));
    
    const newInserts = [];
    const updates = [];
    for (const apply of toApply) {
       const key = `${apply.teamId}_${apply.lecturerId}`;
       const existing = existingMap.get(key);
       if (!existing) {
         newInserts.push({ team_id: apply.teamId, lecturer_id: apply.lecturerId, role: 'reviewer', reviewer_order: apply.order });
       } else if (existing.reviewer_order !== apply.order) {
         updates.push({ team_id: apply.teamId, lecturer_id: apply.lecturerId, role: 'reviewer', reviewer_order: apply.order });
       }
    }
    if (newInserts.length > 0) {
       await supabaseAdmin.from('team_lecturers').insert(newInserts);
    }
    if (updates.length > 0) {
       await supabaseAdmin.from('team_lecturers').upsert(updates, { onConflict: 'team_id, lecturer_id' });
    }
  }

  revalidatePath('/admin');
  return { success: true, rowsProcessed: rows.length, assignmentsApplied: toApply.length };
}

// ─── Score ↔ Level helpers ────────────────────────────────────────────────────

function scoreToLevelStr(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  return `Level ${score}`;
}

// ─── Header (A–Z) ─────────────────────────────────────────────────────────────

const EXPORT_HEADER_1: (string | number)[] = [
  'Kode PBL', 'NIM', 'Nama Mahasiswa',       // A B C
  'Level b7. Implementation', '', '',        // D E F
  'Level c1. Document', '', '',              // G H I
  'Level c7. English', '', '',               // J K L
  'Nilai b7', '', '', 'Avg b7',              // M N O P
  'Nilai c1', '', '', 'Avg c1',              // Q R S T
  'Nilai c7', '', '', 'Avg c7',              // U V W X
  'PR (b7)',                                 // Y
  'PP ((c1+c7)/2)',                          // Z
];

const EXPORT_HEADER_2: (string | number)[] = [
  '', '', '',                                // A B C
  'R1', 'R2', 'R3',                          // D E F
  'R1', 'R2', 'R3',                          // G H I
  'R1', 'R2', 'R3',                          // J K L
  'R1', 'R2', 'R3', '',                      // M N O P
  'R1', 'R2', 'R3', '',                      // Q R S T
  'R1', 'R2', 'R3', '',                      // U V W X
  '',                                        // Y
  '',                                        // Z
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns grade data as two arrays of rows (ATS and AAS) matching the
 * reference Benchmark Assessment template. Each row array is A–Z (26 cols)
 * ready for XLSX.utils.aoa_to_sheet().
 *
 * Reviewer slots that have no grade data default to Level 0 / 0.
 * The 3rd reviewer column (F/I/L/O/S/W) is empty string when only 2
 * reviewers graded; averages divide by the actual reviewer count.
 */
export async function exportGradesData(academicYearId: string): Promise<{
  ats: (string | number)[][];
  aas: (string | number)[][];
}> {
  await requireRole('admin');

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, team_code')
    .eq('academic_year_id', academicYearId)
    .eq('is_deleted', false)
    .order('team_code');

  if (!teams || teams.length === 0) return { ats: [], aas: [] };
  const teamIds = teams.map((t) => t.id);

  const [
    { data: teamStudents },
    { data: grades },
    { data: reviewerLinks },
  ] = await Promise.all([
    supabaseAdmin
      .from('team_students')
      .select('team_id, student_id, students(name, nim)')
      .in('team_id', teamIds),
    supabaseAdmin
      .from('grades')
      .select('team_id, student_id, lecturer_id, period, implementation_score, document_score, english_score')
      .in('team_id', teamIds),
    supabaseAdmin
      .from('team_lecturers')
      .select('team_id, lecturer_id, reviewer_order')
      .eq('role', 'reviewer')
      .in('team_id', teamIds),
  ]);

  // reviewer_order map: "teamId_lecturerId" → order number
  const reviewerOrderMap = new Map<string, number>();
  const reviewerTeamIds = new Set<string>();
  for (const rl of reviewerLinks || []) {
    reviewerOrderMap.set(`${rl.team_id}_${rl.lecturer_id}`, rl.reviewer_order ?? 99);
    reviewerTeamIds.add(rl.team_id);
  }

  const teamCodeMap = new Map<string, string>();
  for (const t of teams) {
    teamCodeMap.set(t.id, t.team_code || '');
  }

  function buildRows(period: 'ATS' | 'AAS'): (string | number)[][] {
    const periodGrades = (grades || []).filter((g) => g.period === period);
    const rows: (string | number)[][] = [EXPORT_HEADER_1, EXPORT_HEADER_2];

    for (const ts of (teamStudents || [])) {
      if (!reviewerTeamIds.has(ts.team_id)) continue;

      const student = ts.students as any;
      const nim = student?.nim || '';
      const name = (student?.name || '').trim();
      const kodePBL = teamCodeMap.get(ts.team_id) || '';

      // All grades for this student this period, sorted by reviewer_order then lecturer_id
      const sg = periodGrades
        .filter((g) => g.team_id === ts.team_id && g.student_id === ts.student_id)
        .sort((a, b) => {
          const oa = reviewerOrderMap.get(`${a.team_id}_${a.lecturer_id}`) ?? 99;
          const ob = reviewerOrderMap.get(`${b.team_id}_${b.lecturer_id}`) ?? 99;
          return oa !== ob ? oa - ob : (a.lecturer_id || '').localeCompare(b.lecturer_id || '');
        });

      const g1 = sg[0] ?? null;
      const g2 = sg[1] ?? null;
      const g3 = sg[2] ?? null;

      // Level strings
      const levB7R1 = scoreToLevelStr(g1?.implementation_score);
      const levB7R2 = scoreToLevelStr(g2?.implementation_score);
      const levB7R3 = g3 ? scoreToLevelStr(g3.implementation_score) : '';
      const levC1R1 = scoreToLevelStr(g1?.document_score);
      const levC1R2 = scoreToLevelStr(g2?.document_score);
      const levC1R3 = g3 ? scoreToLevelStr(g3.document_score) : '';
      const levC7R1 = scoreToLevelStr(g1?.english_score);
      const levC7R2 = scoreToLevelStr(g2?.english_score);
      const levC7R3 = g3 ? scoreToLevelStr(g3.english_score) : '';

      const rowNum = rows.length + 1; // 1-based, +1 because EXPORT_HEADER takes 2 rows
      
      const nB7R1 = { t: 'n', f: `IF(D${rowNum}="Level 5",100,IF(D${rowNum}="Level 4",90,IF(D${rowNum}="Level 3",77,IF(D${rowNum}="Level 2",62,IF(D${rowNum}="Level 1",47,IF(D${rowNum}="Level 0",0,""))))))` };
      const nB7R2 = { t: 'n', f: `IF(E${rowNum}="Level 5",100,IF(E${rowNum}="Level 4",90,IF(E${rowNum}="Level 3",77,IF(E${rowNum}="Level 2",62,IF(E${rowNum}="Level 1",47,IF(E${rowNum}="Level 0",0,""))))))` };
      const nB7R3 = { t: 'n', f: `IF(F${rowNum}="Level 5",100,IF(F${rowNum}="Level 4",90,IF(F${rowNum}="Level 3",77,IF(F${rowNum}="Level 2",62,IF(F${rowNum}="Level 1",47,IF(F${rowNum}="Level 0",0,""))))))` };
      
      const nC1R1 = { t: 'n', f: `IF(G${rowNum}="Level 5",100,IF(G${rowNum}="Level 4",90,IF(G${rowNum}="Level 3",77,IF(G${rowNum}="Level 2",62,IF(G${rowNum}="Level 1",47,IF(G${rowNum}="Level 0",0,""))))))` };
      const nC1R2 = { t: 'n', f: `IF(H${rowNum}="Level 5",100,IF(H${rowNum}="Level 4",90,IF(H${rowNum}="Level 3",77,IF(H${rowNum}="Level 2",62,IF(H${rowNum}="Level 1",47,IF(H${rowNum}="Level 0",0,""))))))` };
      const nC1R3 = { t: 'n', f: `IF(I${rowNum}="Level 5",100,IF(I${rowNum}="Level 4",90,IF(I${rowNum}="Level 3",77,IF(I${rowNum}="Level 2",62,IF(I${rowNum}="Level 1",47,IF(I${rowNum}="Level 0",0,""))))))` };
      
      const nC7R1 = { t: 'n', f: `IF(J${rowNum}="Level 5",100,IF(J${rowNum}="Level 4",90,IF(J${rowNum}="Level 3",77,IF(J${rowNum}="Level 2",62,IF(J${rowNum}="Level 1",47,IF(J${rowNum}="Level 0",0,""))))))` };
      const nC7R2 = { t: 'n', f: `IF(K${rowNum}="Level 5",100,IF(K${rowNum}="Level 4",90,IF(K${rowNum}="Level 3",77,IF(K${rowNum}="Level 2",62,IF(K${rowNum}="Level 1",47,IF(K${rowNum}="Level 0",0,""))))))` };
      const nC7R3 = { t: 'n', f: `IF(L${rowNum}="Level 5",100,IF(L${rowNum}="Level 4",90,IF(L${rowNum}="Level 3",77,IF(L${rowNum}="Level 2",62,IF(L${rowNum}="Level 1",47,IF(L${rowNum}="Level 0",0,""))))))` };
      
      const avgB7 = { t: 'n', f: `IFERROR(AVERAGE(M${rowNum}:O${rowNum}), 0)` };
      const avgC1 = { t: 'n', f: `IFERROR(AVERAGE(Q${rowNum}:S${rowNum}), 0)` };
      const avgC7 = { t: 'n', f: `IFERROR(AVERAGE(U${rowNum}:W${rowNum}), 0)` };
      
      const pp = { t: 'n', f: `IFERROR(AVERAGE(T${rowNum},X${rowNum}), 0)` };

      rows.push([
        kodePBL, nim, name,                                 // A B C
        levB7R1, levB7R2, levB7R3,                          // D E F
        levC1R1, levC1R2, levC1R3,                          // G H I
        levC7R1, levC7R2, levC7R3,                          // J K L
        nB7R1,  nB7R2,  nB7R3,  avgB7,                      // M N O P
        nC1R1,  nC1R2,  nC1R3,  avgC1,                      // Q R S T
        nC7R1,  nC7R2,  nC7R3,  avgC7,                      // U V W X
        avgB7,                                              // Y  PR(b7)
        pp,                                                 // Z  PP
      ]);
    }

    return rows;
  }

  return { ats: buildRows('ATS'), aas: buildRows('AAS') };
}


type TeamsImportRow = {
  'TAHUN AJARAN'?: string;
  'KODE'?: string;
  'JUDUL PROJECT'?: string;
  'PIMPRO'?: string;
  'PRODI'?: string;
  'SEMESTER'?: string | number;
  'NIM'?: string | number;
  'NAMA'?: string;
  'KELAS'?: string;
};

export async function importTeamsTemplate(rows: TeamsImportRow[], academicYearId: string) {
  await requireRole('admin');

  const errors: string[] = [];
  const seenTeamCodes = new Set<string>();
  const seenStudents = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    if (!r['KODE'] || !String(r['KODE']).trim()) errors.push(`Row ${line}: missing KODE`);
    if (!r['JUDUL PROJECT'] || !String(r['JUDUL PROJECT']).trim()) errors.push(`Row ${line}: missing JUDUL PROJECT`);
    if (!r['PIMPRO'] || !String(r['PIMPRO']).trim()) errors.push(`Row ${line}: missing PIMPRO`);
    if (!r['NIM'] || !String(r['NIM']).trim()) errors.push(`Row ${line}: missing NIM`);
    if (!r['NAMA'] || !String(r['NAMA']).trim()) errors.push(`Row ${line}: missing NAMA`);
    if (!r['NIM'] || !r['NAMA']) return;

    const nim = String(r['NIM']).trim();
    const name = String(r['NAMA']).trim();
    const studentKey = `${nim}::${name}`;
    if (seenStudents.has(studentKey)) {
      errors.push(`Row ${line}: duplicate student NIM "${nim}" and Name "${name}" already listed in this file`);
    }
    seenStudents.add(studentKey);
    seenTeamCodes.add(String(r['KODE']).trim());
  });

  if (errors.length > 0) return { success: false, error: `Import aborted, no rows were applied. Errors:\n${errors.join('\n')}` };

  const pimproNames = Array.from(new Set(rows.map((r) => String(r['PIMPRO']).trim())));
  const lecturerMap = new Map<string, string>();
  
  const { data: existingLecturers, error: existingLecturersErr } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('role', 'lecturer')
    .in('name', pimproNames);
  if (existingLecturersErr) return { success: false, error: 'Failed to fetch lecturers' };

  const existingLecturersList = existingLecturers || [];
  const existingLecturerNames = new Set(existingLecturersList.map(l => l.name));
  
  const newLecturers = pimproNames.filter(n => !existingLecturerNames.has(n)).map(name => ({ name, role: 'lecturer' }));
  
  if (newLecturers.length > 0) {
    const { data: insertedLecturers, error: insertLecturersErr } = await supabaseAdmin
      .from('users')
      .insert(newLecturers)
      .select('id, name');
    if (insertLecturersErr) return { success: false, error: `Failed to create new lecturers: ${insertLecturersErr.message}` };
    existingLecturersList.push(...(insertedLecturers || []));
  }
  
  existingLecturersList.forEach(l => lecturerMap.set(l.name, l.id));

  const teamRows = Array.from(new Map(rows.map((r) => [`${String(r['KODE']).trim()}_${String(r['JUDUL PROJECT']).trim()}`, r])).values());
  const teamMap = new Map<string, string>();
  
  const teamCodes = teamRows.map(r => String(r['KODE']).trim());
  const { data: existingTeams, error: existingTeamsErr } = await supabaseAdmin
    .from('teams')
    .select('id, team_code, name, is_deleted')
    .eq('academic_year_id', academicYearId)
    .in('team_code', teamCodes);
  if (existingTeamsErr) return { success: false, error: 'Failed to fetch existing teams' };
  
  const existingTeamsList = existingTeams || [];
  const newTeamsToInsert = [];
  const teamsToRestore = [];
  
  for (const r of teamRows) {
    const code = String(r['KODE']).trim();
    const projectName = String(r['JUDUL PROJECT']).trim();
    const existing = existingTeamsList.find(t => t.team_code === code && t.name === projectName);
    
    if (existing) {
      teamMap.set(`${code}_${projectName}`, existing.id);
      if (existing.is_deleted) teamsToRestore.push(existing.id);
    } else {
      newTeamsToInsert.push({ academic_year_id: academicYearId, team_code: code, name: projectName });
    }
  }
  
  if (teamsToRestore.length > 0) {
     const { error: restoreErr } = await supabaseAdmin.from('teams').update({ is_deleted: false }).in('id', teamsToRestore);
     if (restoreErr) return { success: false, error: 'Failed to restore teams' };
  }
  
  if (newTeamsToInsert.length > 0) {
     const { data: insertedTeams, error: insertTeamsErr } = await supabaseAdmin.from('teams').insert(newTeamsToInsert).select('id, team_code, name');
     if (insertTeamsErr) return { success: false, error: `Failed to create new teams: ${insertTeamsErr.message}` };
     insertedTeams?.forEach(t => teamMap.set(`${t.team_code}_${t.name}`, t.id));
  }

  const teamLecturerLinks = [];
  for (const r of teamRows) {
    const code = String(r['KODE']).trim();
    const projectName = String(r['JUDUL PROJECT']).trim();
    const teamId = teamMap.get(`${code}_${projectName}`);
    const lecturerId = lecturerMap.get(String(r['PIMPRO']).trim());
    if (teamId && lecturerId) {
       teamLecturerLinks.push({ team_id: teamId, lecturer_id: lecturerId, role: 'pimpro' });
    }
  }
  
  const teamIds = Array.from(teamMap.values());
  if (teamIds.length > 0) {
    const { data: existingPimproLinks, error: existingPimproLinksErr } = await supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id').eq('role', 'pimpro').in('team_id', teamIds);
    if (existingPimproLinksErr) return { success: false, error: `Failed to fetch existing pimpro links: ${existingPimproLinksErr.message}` };
    const existingPimproMap = new Map((existingPimproLinks || []).map(l => [l.team_id, l]));
    
    const newPimproLinks = [];
    const updatePromises = [];
    for (const link of teamLecturerLinks) {
       const existing = existingPimproMap.get(link.team_id);
       if (existing) {
          if (existing.lecturer_id !== link.lecturer_id) {
             updatePromises.push(supabaseAdmin.from('team_lecturers').update({ lecturer_id: link.lecturer_id }).eq('team_id', existing.team_id).eq('role', 'pimpro'));
          }
       } else {
          newPimproLinks.push(link);
       }
    }
    if (updatePromises.length > 0) await Promise.all(updatePromises);
    if (newPimproLinks.length > 0) {
       const { error: insertPimproErr } = await supabaseAdmin.from('team_lecturers').insert(newPimproLinks);
       if (insertPimproErr) return { success: false, error: `Failed to assign pimpros: ${insertPimproErr.message}` };
    }
  }

  const allNims = Array.from(new Set(rows.map(r => String(r['NIM']).trim())));
  const { data: existingStudents, error: existingStudentsErr } = await supabaseAdmin.from('students').select('id, nim').in('nim', allNims);
  if (existingStudentsErr) return { success: false, error: `Failed to fetch students: ${existingStudentsErr.message}` };
  
  const existingStudentMap = new Map((existingStudents || []).map(s => [s.nim, s.id]));
  const studentsToInsert = [];
  const studentsToUpdate = [];
  
  for (const r of rows) {
    const nim = String(r['NIM']).trim();
    const studentData = {
      nim,
      name: String(r['NAMA']).trim(),
      prodi: r['PRODI'] ? String(r['PRODI']).trim() : null,
      semester: r['SEMESTER'] ? String(r['SEMESTER']).trim() : null,
      kelas: r['KELAS'] ? String(r['KELAS']).trim() : null,
    };
    const existingId = existingStudentMap.get(nim);
    if (existingId) {
      studentsToUpdate.push({ id: existingId, ...studentData });
    } else {
      studentsToInsert.push(studentData);
    }
  }

  if (studentsToInsert.length > 0) {
    const { data: insertedStudents, error: insertStudentsErr } = await supabaseAdmin.from('students').insert(studentsToInsert).select('id, nim');
    if (insertStudentsErr) return { success: false, error: `Failed to insert students: ${insertStudentsErr.message}` };
    insertedStudents?.forEach(s => existingStudentMap.set(s.nim, s.id));
  }
  
  if (studentsToUpdate.length > 0) {
     const { error: updateStudentsErr } = await supabaseAdmin.from('students').upsert(studentsToUpdate);
     if (updateStudentsErr) return { success: false, error: `Failed to update students: ${updateStudentsErr.message}` };
  }
  
  const studentTeamLinks = [];
  for (const r of rows) {
    const nim = String(r['NIM']).trim();
    const teamId = teamMap.get(`${String(r['KODE']).trim()}_${String(r['JUDUL PROJECT']).trim()}`);
    const studentId = existingStudentMap.get(nim);
    if (teamId && studentId) {
       studentTeamLinks.push({ team_id: teamId, student_id: studentId });
    }
  }
  
  if (teamIds.length > 0) {
    const { data: existingStudentLinks, error: existingStudentLinksErr } = await supabaseAdmin.from('team_students').select('team_id, student_id').in('team_id', teamIds);
    if (existingStudentLinksErr) return { success: false, error: `Failed to fetch existing student links: ${existingStudentLinksErr.message}` };
    const existingStudentLinkSet = new Set((existingStudentLinks || []).map(l => `${l.team_id}_${l.student_id}`));
    
    const newStudentLinks = studentTeamLinks.filter(l => !existingStudentLinkSet.has(`${l.team_id}_${l.student_id}`));
    if (newStudentLinks.length > 0) {
       const { error: insertStudentLinkErr } = await supabaseAdmin.from('team_students').insert(newStudentLinks);
       if (insertStudentLinkErr) return { success: false, error: `Failed to insert team-student links: ${insertStudentLinkErr.message}` };
    }
  }

  revalidatePath('/admin');
  return { success: true, teamsProcessed: teamRows.length, studentsProcessed: rows.length };
}
