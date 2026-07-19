import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

// Gate /admin/* (except /admin/login) and /lecturer/dashboard, /lecturer/team/*.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!session || session.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  if ((pathname.startsWith('/lecturer/dashboard') || pathname.startsWith('/lecturer/team')) ) {
    if (!session || session.role !== 'lecturer') {
      return NextResponse.redirect(new URL('/lecturer', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/lecturer/dashboard/:path*', '/lecturer/team/:path*'],
};
