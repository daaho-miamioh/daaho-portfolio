// Runs before every Vercel build. Payload reports a missing setting only when it reaches it, one per
// failed deploy; and a missing storage bucket fails nothing at all — uploads would land on Vercel's
// temporary disk and vanish on the next deploy. So list everything missing at once, and refuse to
// build a deployed site without its bucket.
const deployed = ['production', 'preview'].includes(process.env.VERCEL_ENV ?? '')
const required = {
  PAYLOAD_SECRET: 'long random string: openssl rand -hex 32',
  DATABASE_URL: 'set by the Neon integration (Vercel -> Storage -> Neon -> Connect)',
  ...(deployed && {
    S3_BUCKET: 'the private S3 bucket name',
    S3_REGION: 'the bucket region, e.g. us-east-2',
    S3_ACCESS_KEY_ID: "the IAM user's access key ID",
    S3_SECRET_ACCESS_KEY: "the IAM user's secret access key",
  }),
}
const missing = Object.entries(required).filter(([name]) => !process.env[name]?.trim())
if (missing.length) {
  const where = process.env.VERCEL_ENV ? ` for the "${process.env.VERCEL_ENV}" environment` : ''
  console.error(`\nMissing environment variables${where}:\n`)
  for (const [name, hint] of missing) console.error(`  ${name.padEnd(22)} ${hint}`)
  console.error('\nAdd them in Vercel -> Project -> Settings -> Environment Variables, then redeploy:')
  console.error('variables apply only to deployments started after they are saved.\n')
  process.exit(1)
}
console.log(`Environment check passed${deployed ? ` (${process.env.VERCEL_ENV})` : ''}.`)
