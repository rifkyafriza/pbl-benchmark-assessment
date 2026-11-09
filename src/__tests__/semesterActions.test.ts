import { addSemester, listSemesters, setActiveSemester } from '@/lib/actions/admin/semesterActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock authentication check
jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'admin1', role: 'admin' }),
}));

// Shared mock references so assertions can inspect them after action calls.
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockOrder = jest.fn().mockResolvedValue({ data: [{ id: '1', name: 'Semester 1' }] });
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockNeq = jest.fn();
let queryResult = { data: [] as any[], error: null as any };

// Mock Supabase client
jest.mock('@/lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: jest.fn(() => {
        const builder: Record<string, any> = {};
        builder.select = jest.fn().mockReturnValue(builder);
        builder.eq = mockEq.mockImplementation(() => builder);
        builder.neq = mockNeq.mockImplementation(() => builder);
        builder.limit = jest.fn().mockResolvedValue({ data: [] });
        builder.order = mockOrder;
        builder.insert = mockInsert;
        builder.update = mockUpdate.mockImplementation(() => builder);
        builder.then = jest.fn((resolve) => resolve(queryResult));
        return builder;
      }),
    },
  };
});

describe('Semester Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResult = { data: [], error: null };
    mockInsert.mockResolvedValue({ error: null });
    mockOrder.mockResolvedValue({ data: [{ id: '1', name: 'Semester 1' }] });
    mockUpdate.mockImplementation(function (this: any) { return this; });
    mockEq.mockImplementation(function (this: any) { return this; });
    mockNeq.mockImplementation(function (this: any) { return this; });
  });

  it('lists semesters correctly', async () => {
    const semesters = await listSemesters();
    expect(semesters).toHaveLength(1);
    expect(semesters[0].name).toBe('Semester 1');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
  });

  it('adds a valid semester successfully and auto-activates when none is active', async () => {
    await addSemester('2024/2025 ODD');

    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
    expect(mockInsert).toHaveBeenCalledWith({
      name: '2024/2025 ODD',
      is_active: true,
    });
  });

  it('rejects an empty semester name due to Zod validation', async () => {
    await expect(addSemester('   ')).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  describe('setActiveSemester', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('sets active semester successfully with valid UUID', async () => {
      await setActiveSemester(validUuid);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(mockNeq).toHaveBeenCalledWith('id', validUuid);
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
      expect(mockEq).toHaveBeenCalledWith('id', validUuid);
      expect(revalidatePath).toHaveBeenCalledWith('/admin');
    });

    it('rejects invalid UUID format', async () => {
      await expect(setActiveSemester('invalid-uuid')).rejects.toThrow(/Invalid ID format/);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('throws error when database update fails', async () => {
      queryResult = { data: [], error: { message: 'Database connection failed' } };
      await expect(setActiveSemester(validUuid)).rejects.toThrow('Database connection failed');
    });
  });
});
