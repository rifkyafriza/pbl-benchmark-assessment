import { saveGrades } from '@/lib/lecturerActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'lecturer-1', role: 'lecturer', name: 'Dr. Lecturer' }),
}));

const mockChain: any = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.maybeSingle = jest.fn();
mockChain.limit = jest.fn();
mockChain.upsert = jest.fn(() => mockChain);
mockChain.then = jest.fn((resolve) => resolve({ data: null, error: null }));

jest.mock('@/lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: jest.fn(() => mockChain),
    },
  };
});

describe('Lecturer Actions - saveGrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.maybeSingle.mockResolvedValue({ data: { team_id: 'team-1', active_period: 'ATS' }, error: null });
    mockChain.limit.mockResolvedValue({ data: [], error: null });
  });

  it('rejects editing even if finalize is true when scores are locked', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { team_id: 'team-1' }, error: null }) // assignment check
      .mockResolvedValueOnce({ data: { active_period: 'ATS' }, error: null }); // active period check

    mockChain.limit.mockResolvedValueOnce({ data: [{ is_locked: true }], error: null }); // existing locked

    const entries = [
      { studentId: 'student-1', implementation_score: 5, document_score: 4, english_score: 4, comment: 'Good' },
    ];

    await expect(saveGrades('team-1', entries, true)).rejects.toThrow(
      'Scores are locked. Ask the admin to unlock before editing.'
    );
    expect(mockChain.upsert).not.toHaveBeenCalled();
  });
});
