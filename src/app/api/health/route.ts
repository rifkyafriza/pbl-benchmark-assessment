import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // Check DB connection
    const { error } = await supabaseAdmin.from('academic_years').select('id').limit(1);
    
    if (error) {
      return NextResponse.json({ status: 'error', message: 'Database connection failed' }, { status: 503 });
    }

    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'pbl-benchmark-assessment'
    }, { status: 200 });
  } catch (err: unknown) {
    console.error('[health] DB check failed:', err);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
