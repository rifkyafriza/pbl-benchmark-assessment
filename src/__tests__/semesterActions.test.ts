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

// Shared mock references so assertions can inspect them after action calls.
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockOrder = jest.fn().mockResolvedValue({ data: [{ id: '1', name: 'Semester 1' }] });

// Mock Supabase client
// addSemester chains: .from(...).select(...).eq(...).limit(...)
// listSemesters chains: .from(...).select(...).order(...)
// makeQueryBuilder() wires all methods onto a single fluent object so any
// chain depth resolves correctly without "is not a function" errors.
jest.mock('@/lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: jest.fn(() => {
        const builder: Record<string, jest.Mock> = {};
        builder.select = jest.fn().mockReturnValue(builder);
        builder.eq = jest.fn().mockReturnValue(builder);
        builder.limit = jest.fn().mockResolvedValue({ data: [] });
        builder.order = mockOrder;
        builder.insert = mockInsert;
        return builder;
      }),
    },
  };
});

describe('Semester Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset insert/order to their default resolved values after clearAllMocks
    mockInsert.mockResolvedValue({ error: null });
    mockOrder.mockResolvedValue({ data: [{ id: '1', name: 'Semester 1' }] });
  });

  it('lists semesters correctly', async () => {
    const semesters = await listSemesters();
    expect(semesters).toHaveLength(1);
    expect(semesters[0].name).toBe('Semester 1');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
  });

  it('adds a valid semester successfully and auto-activates when none is active', async () => {
    // mockLimit returns { data: [] } (no active semester) → shouldAutoActivate = true
    await addSemester('2024/2025 ODD');

    expect(supabaseAdmin.from).toHaveBeenCalledWith('academic_years');
    // The action calls insert with is_active: true because no active semester exists
    expect(mockInsert).toHaveBeenCalledWith({
      name: '2024/2025 ODD',
      is_active: true,
    });
  });

  it('rejects an empty semester name due to Zod validation', async () => {
    await expect(addSemester('   ')).rejects.toThrow();
    // insert must not be called — boundary validation blocked it
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
