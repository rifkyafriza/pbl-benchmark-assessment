import { importTeamsTemplate, importReviewersTemplate, exportGradesData } from '@/lib/actions/admin/importExportActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock authentication check
jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'admin1', role: 'admin' }),
}));

// Create fluent mock builder
function createMockBuilder(defaultData: any = []) {
  const b: any = {};
  b.eq = jest.fn(() => b);
  b.neq = jest.fn(() => b);
  b.in = jest.fn(() => b);
  b.order = jest.fn(() => b);
  b.select = jest.fn(() => b);
  b.insert = jest.fn(() => b);
  b.update = jest.fn(() => b);
  b.upsert = jest.fn(() => b);
  b.limit = jest.fn(() => b);
  b.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  b.single = jest.fn().mockResolvedValue({ data: null, error: null });
  b.then = jest.fn((resolve) => resolve({ data: defaultData, error: null }));
  return b;
}

const mockBuilders: Record<string, any> = {};

jest.mock('@/lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: jest.fn((table: string) => {
        if (!mockBuilders[table]) {
          mockBuilders[table] = createMockBuilder();
        }
        return mockBuilders[table];
      }),
    },
  };
});

describe('Import/Export Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockBuilders)) {
      delete mockBuilders[key];
    }
  });

  describe('importTeamsTemplate', () => {
    it('aborts and returns errors if required fields are missing', async () => {
      const rows = [
        { 'KODE': 'T01' },
      ];
      const result = await importTeamsTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing JUDUL PROJECT');
    });

    it('detects duplicate students in the file', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'PIMPRO': 'Lec1', 'NIM': '123', 'NAMA': 'John' },
        { 'KODE': 'T02', 'JUDUL PROJECT': 'B', 'PIMPRO': 'Lec2', 'NIM': '123', 'NAMA': 'John' },
      ];
      const result = await importTeamsTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('duplicate student NIM "123" and Name "John"');
    });

    it('processes valid rows successfully', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'PIMPRO': 'Lec1', 'NIM': '123', 'NAMA': 'John' },
      ];

      const usersB = createMockBuilder([{ id: 'lec-1', name: 'Lec1' }]);
      mockBuilders['users'] = usersB;

      const result = await importTeamsTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(true);
      expect(result.teamsProcessed).toBe(1);
      expect(result.studentsProcessed).toBe(1);
    });

    it('resolves PIMPRO with academic degrees, all-caps, and initials without creating new users', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'P1', 'PIMPRO': 'Senanjung Prayoga, S.Pd, M.T', 'NIM': '101', 'NAMA': 'Alice' },
        { 'KODE': 'T02', 'JUDUL PROJECT': 'P2', 'PIMPRO': 'RIFKY AFRIZA', 'NIM': '102', 'NAMA': 'Bob' },
        { 'KODE': 'T03', 'JUDUL PROJECT': 'P3', 'PIMPRO': 'RA', 'NIM': '103', 'NAMA': 'Charlie' },
      ];

      const usersB = createMockBuilder([
        { id: 'lec-1', name: 'Senanjung Prayoga', username: 'yoga', initials: 'SP' },
        { id: 'lec-2', name: 'Rifky Afriza', username: 'rifky', initials: 'RI' },
        { id: 'lec-3', name: 'Rifqi Amalya Fatekha', username: 'rifqi', initials: 'RA' },
      ]);
      mockBuilders['users'] = usersB;

      const result = await importTeamsTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(true);
      expect(result.teamsProcessed).toBe(3);
      expect(result.studentsProcessed).toBe(3);
      expect(usersB.insert).not.toHaveBeenCalled();
    });

    it('rejects import if PIMPRO is not found and does not insert new users', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'PIMPRO': 'Unknown Dosen', 'NIM': '123', 'NAMA': 'John' },
      ];

      const usersB = createMockBuilder([{ id: 'lec-1', name: 'Lec1', username: 'lec1', initials: 'L1' }]);
      mockBuilders['users'] = usersB;

      const result = await importTeamsTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('no lecturer found matching "Unknown Dosen"');
      expect(usersB.insert).not.toHaveBeenCalled();
    });
  });

  describe('importReviewersTemplate', () => {
    it('returns error if team is not found', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'REVIEWER 1': 'Lec1' },
      ];

      const usersB = createMockBuilder([{ id: 'lec-1', name: 'Lec1', username: 'lec1' }]);
      mockBuilders['users'] = usersB;

      const teamsB = createMockBuilder([]);
      mockBuilders['teams'] = teamsB;

      const result = await importReviewersTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('team "T01" not found');
    });

    it('uses onConflict with role when updating reviewer order', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'REVIEWER 1': 'Lec1' },
      ];

      const usersB = createMockBuilder([{ id: 'lec-1', name: 'Lec1', username: 'lec1' }]);
      mockBuilders['users'] = usersB;

      const teamsB = createMockBuilder([{ id: 'team-1', team_code: 'T01', name: 'A' }]);
      mockBuilders['teams'] = teamsB;

      const teamLecB = createMockBuilder([
        { team_id: 'team-1', lecturer_id: 'lec-1', reviewer_order: 2 }
      ]);
      mockBuilders['team_lecturers'] = teamLecB;

      const result = await importReviewersTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(true);
      expect(teamLecB.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ team_id: 'team-1', lecturer_id: 'lec-1', reviewer_order: 1 }),
        ]),
        { onConflict: 'team_id, lecturer_id, role' }
      );
    });

    it('resolves reviewers by initials and degrees', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'REVIEWER 1': 'RA', 'REVIEWER 2': 'Dr. Senanjung Prayoga, M.T' },
      ];

      const usersB = createMockBuilder([
        { id: 'lec-1', name: 'Rifqi Amalya Fatekha', username: 'rifqi', initials: 'RA' },
        { id: 'lec-2', name: 'Senanjung Prayoga', username: 'yoga', initials: 'SP' },
      ]);
      mockBuilders['users'] = usersB;

      const teamsB = createMockBuilder([{ id: 'team-1', team_code: 'T01', name: 'A' }]);
      mockBuilders['teams'] = teamsB;

      const teamLecB = createMockBuilder([]);
      mockBuilders['team_lecturers'] = teamLecB;

      const result = await importReviewersTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(true);
      expect(result.assignmentsApplied).toBe(2);
    });

    it('resolves team even when project title in Excel is truncated', async () => {
      const rows = [
        { 'KODE': 'PBL-01', 'JUDUL PROJECT': 'Mobile Robot: Robot Chassis', 'REVIEWER 1': 'Lec1' },
      ];

      const usersB = createMockBuilder([{ id: 'lec-1', name: 'Lec1', username: 'lec1' }]);
      mockBuilders['users'] = usersB;

      const teamsB = createMockBuilder([
        { id: 'team-1', team_code: 'PBL-01', name: 'Mobile Robot: Robot Chassis Technology and Systems' },
      ]);
      mockBuilders['teams'] = teamsB;

      const teamLecB = createMockBuilder([]);
      mockBuilders['team_lecturers'] = teamLecB;

      const result = await importReviewersTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(true);
      expect(result.assignmentsApplied).toBe(1);
    });
  });

  describe('exportGradesData', () => {
    it('applies limit(10000) to prevent truncation of large cohorts', async () => {
      const teamsB = createMockBuilder([
        { id: 'team-1', name: 'Team Alpha', team_code: 'TA-01' }
      ]);
      mockBuilders['teams'] = teamsB;

      const gradesB = createMockBuilder([]);
      mockBuilders['grades'] = gradesB;

      await exportGradesData('academic-year-1');
      expect(gradesB.limit).toHaveBeenCalledWith(10000);
    });
  });
});
