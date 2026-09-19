import 'server-only'
import { logger } from '@/lib/observability/logger'
import { brand } from '@/config/brand'

/**
 * EMAIL
 *
 * Two drivers:
 *   "console" — prints the message (and any link) to your terminal. This is
 *               the default, and it means signup, verification and password
 *               reset all work locally with no email account at all.
 *   "resend"  — sends real email through Resend.
 *
 * FOUNDER NOTE: the Resend path is written and type-checked but has not been
 * exercised against the live API, because that needs an account only you can
 * create. See README § "Turning on real email".
 */

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailResult {
  sent: boolean
  driver: string
  /** In console mode we hand the link back so tests and the UI can use it. */
  previewUrl?: string
  error?: string
}

async function sendViaConsole(message: EmailMessage): Promise<EmailResult> {
  const link = message.text.match(/https?:\/\/\S+/)?.[0]
  console.log(
    [
      '',
      '  ┌───────────────────────────────────────────────────────────────',
      `  │  EMAIL (console driver — not actually sent)`,
      `  │  To:      ${message.to}`,
      `  │  Subject: ${message.subject}`,
      link ? `  │  Link:    ${link}` : null,
      '  └───────────────────────────────────────────────────────────────',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  return { sent: true, driver: 'console', previewUrl: link }
}

async function sendViaResend(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, driver: 'resend', error: 'RESEND_API_KEY is not set.' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${brand.name} <onboarding@resend.dev>`,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { sent: false, driver: 'resend', error: `Resend returned ${response.status}: ${body.slice(0, 200)}` }
    }
    return { sent: true, driver: 'resend' }
  } catch (error) {
    return { sent: false, driver: 'resend', error: String(error) }
  }
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const driver = (process.env.EMAIL_DRIVER ?? 'console').toLowerCase()
  const result = driver === 'resend' ? await sendViaResend(message) : await sendViaConsole(message)
  if (!result.sent) {
    // Never fail a signup because email is misconfigured — log it loudly instead.
    logger.error('email.send_failed', { driver: result.driver, error: result.error, subject: message.subject })
  }
  return result
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function wrap(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F6F1E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-family:Georgia,serif;font-size:24px;color:#14181F;margin:0 0 32px">${brand.name}</p>
    <div style="background:#fff;border-radius:14px;padding:32px">
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#14181F;margin:0 0 16px">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4C5662">${body}</div>
      ${cta ? `<p style="margin:28px 0 0"><a href="${cta.url}" style="display:inline-block;background:#C85A3C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:500">${cta.label}</a></p>` : ''}
    </div>
    <p style="font-size:12px;color:#9099A5;margin-top:24px">If you did not expect this email you can safely ignore it.</p>
  </div></body></html>`
}

export function verificationEmail(to: string, firstName: string, token: string): EmailMessage {
  const url = `${appUrl()}/verify?token=${token}`
  return {
    to,
    subject: `Confirm your email address`,
    text: `Hi ${firstName},\n\nConfirm your email address to finish setting up your ${brand.name} account:\n\n${url}\n\nThis link expires in 24 hours.`,
    html: wrap(
      `Confirm your email address`,
      `<p>Hi ${firstName},</p><p>Confirm your email address to finish setting up your ${brand.name} account. This link expires in 24 hours.</p>`,
      { label: 'Confirm email address', url },
    ),
  }
}

export function passwordResetEmail(to: string, firstName: string, token: string): EmailMessage {
  const url = `${appUrl()}/reset?token=${token}`
  return {
    to,
    subject: `Reset your password`,
    text: `Hi ${firstName},\n\nUse this link to set a new password:\n\n${url}\n\nThis link expires in one hour. If you did not ask for it, nothing has changed.`,
    html: wrap(
      `Reset your password`,
      `<p>Hi ${firstName},</p><p>Use the button below to set a new password. This link expires in one hour. If you did not ask for it, nothing has changed on your account.</p>`,
      { label: 'Set a new password', url },
    ),
  }
}
