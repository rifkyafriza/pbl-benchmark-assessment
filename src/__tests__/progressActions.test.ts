import { overrideStudentGrade } from '@/lib/actions/admin/progressActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'admin1', role: 'admin' }),
}));

jest.mock('@/lib/supabaseAdmin', () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: { active_period: 'ATS' }, error: null });
  chain.upsert = jest.fn(() => chain);
  chain.then = jest.fn((resolve) => resolve({ data: null, error: null }));

  return {
    supabaseAdmin: {
      from: jest.fn(() => chain),
    },
  };
});

describe('Progress Actions - overrideStudentGrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses upsert with correct composite conflict key', async () => {
    const chain = (supabaseAdmin.from('grades') as any);
    await overrideStudentGrade(
      'team-1',
      'student-1',
      'lecturer-1',
      { implementation_score: 5, document_score: 4, english_score: 5 }
    );

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'team-1',
        student_id: 'student-1',
        lecturer_id: 'lecturer-1',
        period: 'ATS',
        implementation_score: 5,
        document_score: 4,
        english_score: 5,
      }),
      { onConflict: 'student_id,team_id,lecturer_id,period' }
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });
});
