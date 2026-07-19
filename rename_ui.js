const fs = require('fs');
const glob = require('glob'); // Use glob if available, or just manually specify

const files = [
  'src/app/admin/page.tsx',
  'src/app/lecturer/dashboard/TeamList.tsx',
  'src/app/page.tsx',
];

files.forEach(filePath => {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Replace 'Smt' with 'Semester'
  code = code.replace(/Smt/g, 'Semester');
  code = code.replace(/smt/g, 'semester');
  code = code.replace(/SMT/g, 'SEMESTER');

  // Replace 'Semester' UI labels with 'Tahun Ajaran'
  code = code.replace(/Semester/g, 'Tahun Ajaran');
  // Revert 'Smt' replacement's 'Semester' to just 'Semester' where it was actually referring to 'smt'
  // Actually, this order is bad. Let's do it carefully.
});
