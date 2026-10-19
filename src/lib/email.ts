import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { resendAdapter } from '@payloadcms/email-resend'

/**
 * How the site sends email, chosen by environment variables so moving hosts is a settings change:
 *
 *   EMAIL_FROM (+ EMAIL_FROM_NAME)  the sender, e.g. daaho@lib.miamioh.edu; required to send at all
 *   RESEND_API_KEY                  send through Resend (while on Vercel)
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *                                   send through a mail server (the library server's relay)
 *
 * With neither, nothing is sent: Payload writes the message to the server log instead, and the
 * invitation panel shows the link for an admin to send by hand.
 */
export const emailConfigured = () =>
  Boolean(process.env.EMAIL_FROM && (process.env.RESEND_API_KEY || process.env.SMTP_HOST))

export function emailAdapter() {
  const defaultFromAddress = process.env.EMAIL_FROM
  const defaultFromName = process.env.EMAIL_FROM_NAME || 'DAAHO'
  if (!defaultFromAddress) return undefined
  if (process.env.RESEND_API_KEY) {
    return resendAdapter({ apiKey: process.env.RESEND_API_KEY, defaultFromAddress, defaultFromName })
  }
  if (process.env.SMTP_HOST) {
    return nodemailerAdapter({
      defaultFromAddress,
      defaultFromName,
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 25),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      },
    })
  }
  return undefined
}
