import { setTeamAssignment, addStudentToTeam, updateStudent } from '@/lib/actions/admin/teamActions';
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
  chainable.neq = jest.fn(() => chainable);
  chainable.delete = jest.fn(() => chainable);
  chainable.update = jest.fn(() => chainable);
  chainable.select = jest.fn(() => chainable);
  chainable.insert = jest.fn(() => chainable);
  chainable.single = jest.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  chainable.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  chainable.then = jest.fn((resolve) => resolve({ data: null, error: null })); // Allow awaiting the chain

  return {
    supabaseAdmin: {
      from: jest.fn(() => chainable),
    },
  };
});

describe('Team Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setTeamAssignment', () => {
    it('rejects invalid UUID for teamId', async () => {
      await expect(setTeamAssignment('invalid-id', 'pimpro', null)).rejects.toThrow(/Invalid ID format/);
    });

    it('rejects invalid UUID for lecturerId', async () => {
      await expect(setTeamAssignment('123e4567-e89b-12d3-a456-426614174000', 'pimpro', 'invalid')).rejects.toThrow(/Invalid ID format/);
    });

    it('processes valid UUIDs correctly', async () => {
      await setTeamAssignment('123e4567-e89b-12d3-a456-426614174000', 'pimpro', null);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('team_lecturers');
    });
  });

  describe('addStudentToTeam', () => {
    it('rejects empty NIM and Name', async () => {
      await expect(addStudentToTeam('123e4567-e89b-12d3-a456-426614174000', '', ' ')).rejects.toThrow();
    });

    it('processes valid student data', async () => {
      await addStudentToTeam('123e4567-e89b-12d3-a456-426614174000', '123456789', 'John Doe');
      expect(supabaseAdmin.from).toHaveBeenCalledWith('students');
    });
  });

  describe('updateStudent', () => {
    it('rejects invalid UUID for studentId', async () => {
      await expect(updateStudent('invalid', '123456789', 'John Doe')).rejects.toThrow(/Invalid ID format/);
    });
  });
});
