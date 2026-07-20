import { addSemester, listSemesters } from '@/lib/actions/admin/semesterActions';
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
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockSelect = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockResolvedValue({ data: [] });
  const mockOrder = jest.fn().mockResolvedValue({ data: [{ id: '1', name: 'Semester 1' }] });

  return {
    supabaseAdmin: {
      from: jest.fn(() => ({
        select: mockSelect,
        insert: mockInsert,
        limit: mockLimit,
        order: mockOrder,
      })),
    },
  };
});

describe('Semester Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists semesters correctly', async () => {
    const semesters = await listSemesters();
    expect(semesters).toHaveLength(1);
    expect(semesters[0].name).toBe('Semester 1');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
  });

  it('adds a valid semester successfully', async () => {
    await addSemester('2024/2025 ODD');
    
    // Get the mock implementation of insert
    const insertMock = (supabaseAdmin.from('academic_years').insert as jest.Mock);
    
    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
    expect(insertMock).toHaveBeenCalledWith({
      name: '2024/2025 ODD',
      is_active: true,
    });
  });

  it('rejects an empty semester name due to Zod validation', async () => {
    await expect(addSemester('   ')).rejects.toThrow();
    
    const insertMock = (supabaseAdmin.from('academic_years').insert as jest.Mock);
    expect(insertMock).not.toHaveBeenCalled(); // DB is protected from empty strings
  });
});
