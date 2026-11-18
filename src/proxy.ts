import { NextResponse, type NextRequest } from 'next/server'

/**
 * After signing in, staff choose where to go: the website (with drafts and staff tools) or the admin.
 * A sign-in with nowhere particular to go, or only the admin's front page, is sent to that choice
 * (/signed-in). A sign-in on its way to a particular admin page still goes straight there.
 */
export function proxy(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('redirect')
  if (to && !/^\/admin\/?$/.test(to)) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.searchParams.set('redirect', '/signed-in')
  return NextResponse.redirect(url)
}

export const config = { matcher: '/admin/login' }
