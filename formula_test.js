const XLSX = require('xlsx');

const aoa = [
  ['NIM', 'Nama Mahasiswa', 'Level b7 R1', 'Nilai b7 R1'],
  ['123', 'John Doe', 'Level 4', { t: 'n', f: 'IF(C2="Level 5",100,IF(C2="Level 4",90,0))' }]
];

const worksheet = XLSX.utils.aoa_to_sheet(aoa);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Test');
XLSX.writeFile(workbook, 'formula_test.xlsx');
console.log('Done formula test');
