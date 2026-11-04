import Link from 'next/link'

/** Under the sign-in form: accounts are by invitation, so point newcomers to the form that asks for one. */
export function RequestAccessLink() {
  return (
    <p style={{ marginTop: '1.5rem', color: 'var(--theme-elevation-600)' }}>
      No account yet? <Link href="/join">Ask to join the project</Link>
    </p>
  )
}
