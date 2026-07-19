const fs = require('fs');

function renameFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Rename 'semester' to 'academicYear' / 'academic_year' globally
  code = code.replace(/semester_id/g, 'academic_year_id');
  code = code.replace(/semesters/g, 'academic_years');
  code = code.replace(/getActiveSemester/g, 'getActiveAcademicYear');
  code = code.replace(/activeSemester/g, 'activeAcademicYear');
  code = code.replace(/semesterId/g, 'academicYearId');
  code = code.replace(/active_semester/g, 'active_academic_year');

  // 2. Rename 'smt' to 'semester'
  code = code.replace(/smt/g, 'semester');
  code = code.replace(/SMT/g, 'SEMESTER');
  
  // 3. Import template header
  code = code.replace(/'SEMESTER'\?: string;/g, "'TAHUN AJARAN'?: string;");
  
  fs.writeFileSync(filePath, code);
}

renameFile('src/lib/adminActions.ts');
renameFile('src/lib/lecturerActions.ts');
