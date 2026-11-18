import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { proxy } from '@/proxy'

const visit = (path: string) => proxy(new NextRequest(new URL(path, 'http://localhost:3000')))

describe('after signing in', () => {
  it('a sign-in with nowhere particular to go leads to the choice of website or admin', () => {
    for (const path of ['/admin/login', '/admin/login?redirect=%2Fadmin', '/admin/login?redirect=/admin/']) {
      expect(visit(path).headers.get('location')).toBe('http://localhost:3000/admin/login?redirect=%2Fsigned-in')
    }
  })

  it('a sign-in on its way to a particular page still goes there', () => {
    for (const path of ['/admin/login?redirect=%2Fadmin%2Fcollections%2Fitems%2F12', '/admin/login?redirect=%2Fsigned-in']) {
      const res = visit(path)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('x-middleware-next')).toBe('1')
    }
  })
})
