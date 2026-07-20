import { importTeamsTemplate, importReviewersTemplate } from '@/lib/actions/admin/importExportActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock authentication check
jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'admin1', role: 'admin' }),
}));

// Mock Supabase client
jest.mock('@/lib/supabaseAdmin', () => {
  const chainable: any = {};
  chainable.eq = jest.fn(() => chainable);
  chainable.in = jest.fn(() => chainable);
  chainable.select = jest.fn(() => chainable);
  chainable.insert = jest.fn(() => chainable);
  chainable.update = jest.fn(() => chainable);
  chainable.upsert = jest.fn(() => chainable);
  chainable.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  chainable.then = jest.fn((resolve) => resolve({ data: [], error: null })); // Allow awaiting the chain, default to empty array

  return {
    supabaseAdmin: {
      from: jest.fn(() => chainable),
    },
  };
});

describe('Import/Export Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('importTeamsTemplate', () => {
    it('aborts and returns errors if required fields are missing', async () => {
      const rows = [
        { 'KODE': 'T01' }, // Missing other fields
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
      
      const mockIn = ((supabaseAdmin.from('users').select() as any).eq('role', 'lecturer').in as jest.Mock);
      mockIn.mockResolvedValueOnce({ data: [{ id: 'lec-1', name: 'Lec1' }], error: null }); // lecturers
      mockIn.mockResolvedValueOnce({ data: [], error: null }); // teams
      mockIn.mockResolvedValueOnce({ data: [], error: null }); // team_lecturers
      mockIn.mockResolvedValueOnce({ data: [], error: null }); // students
      mockIn.mockResolvedValueOnce({ data: [], error: null }); // team_students

      const result = await importTeamsTemplate(rows, 'academic-year-1');
      // Some mocks might fall back to defaults, but we mainly want to ensure it doesn't fail fast
      expect(result.success).toBe(true);
      expect(result.teamsProcessed).toBe(1);
      expect(result.studentsProcessed).toBe(1);
    });
  });

  describe('importReviewersTemplate', () => {
    it('returns error if team is not found', async () => {
      const rows = [
        { 'KODE': 'T01', 'JUDUL PROJECT': 'A', 'REVIEWER 1': 'Lec1' },
      ];
      
      // Setup mock to return no team
      const mockMaybeSingle = ((supabaseAdmin.from('teams').select() as any).eq('a', 'b').eq('c', 'd').maybeSingle as jest.Mock);
      mockMaybeSingle.mockResolvedValueOnce({ data: null });

      const result = await importReviewersTemplate(rows, 'academic-year-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('team "T01" with project "A" not found');
    });
  });
});
