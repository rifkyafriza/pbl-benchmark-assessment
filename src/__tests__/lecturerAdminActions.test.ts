import { createLecturerAccount } from '@/lib/actions/admin/lecturerAdminActions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock authentication check
jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn().mockResolvedValue({ id: 'admin1', role: 'admin' }),
  hashPassword: jest.fn().mockResolvedValue('hashedpassword123'),
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword123'),
}));

// Mock Supabase client
jest.mock('@/lib/supabaseAdmin', () => {
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null }); // No existing user

  return {
    supabaseAdmin: {
      from: jest.fn(() => ({
        insert: mockInsert,
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      })),
    },
  };
});

describe('Lecturer Admin Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLecturerAccount', () => {
    it('rejects short passwords', async () => {
      await expect(createLecturerAccount('John Doe', 'john', '12345')).rejects.toThrow(/Password must be at least 6 characters/);
    });

    it('rejects empty name or username', async () => {
      await expect(createLecturerAccount('', 'john', '123456')).rejects.toThrow();
      await expect(createLecturerAccount('John Doe', '', '123456')).rejects.toThrow();
    });

    it('creates a lecturer account successfully with valid data', async () => {
      await createLecturerAccount('John Doe', 'johndoe', 'securepassword');
      
      const insertMock = (supabaseAdmin.from('users').insert as jest.Mock);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          username: 'johndoe',
          password_hash: 'hashedpassword123',
          role: 'lecturer',
        })
      );
    });
  });
});
