const xlsx = require('xlsx');

const sourcePath = 'reference/PBL RE Genap 2025-2026_v1.xlsx';
const targetPath = 'reference/import_template_teams.xlsx';

const wbSource = xlsx.readFile(sourcePath);
const sheetSource = wbSource.Sheets['Tim PBL Genap 2025-2026'];
const data = xlsx.utils.sheet_to_json(sheetSource);

const newRows = [];

for (const row of data) {
  const ket = row['KETERANGAN'] || '';
  if (ket.includes('Tidak Daftar Ulang') || ket.includes('Tidak Aktif')) {
    continue; // skip
  }
  if (!row['NIM'] || !row['NAMA']) {
    continue; // skip incomplete
  }

  newRows.push({
    'TAHUN AJARAN': 'Genap 2025/2026',
    'KODE': row['KODE'],
    'JUDUL PROJECT': row['JUDUL PROJECT'],
    'PIMPRO': row['PIMPRO'],
    'PRODI': row['PRODI'],
    'SEMESTER': row['SMT'],
    'NIM': row['NIM'],
    'NAMA': row['NAMA'],
    'KELAS': row['KELAS']
  });
}

const wsTarget = xlsx.utils.json_to_sheet(newRows);
const wbTarget = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbTarget, wsTarget, 'teams');
xlsx.writeFile(wbTarget, targetPath);

console.log(`Exported ${newRows.length} valid rows to ${targetPath}`);
