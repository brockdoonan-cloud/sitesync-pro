import 'server-only'

type SmsInput = {
  phone?: string | null
  message: string
  type: string
  requestId?: string | null
  sentBy?: string | null
  supabase?: any
}

type EmailInput = {
  to?: string | null
  subject: string
  text: string
  html?: string
}

export function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://sitesync-pro.vercel.app'
}

export async function sendQuoSms({ phone, message, type, requestId, sentBy, supabase }: SmsInput) {
  if (!phone) return { success: false, skipped: true, reason: 'missing_phone' }

  const apiKey = process.env.QUO_API_KEY
  const from = process.env.QUO_FROM_NUMBER
  if (!apiKey || !from) return { success: false, skipped: true, reason: 'not_configured' }

  try {
    const response = await fetch('https://api.quoapp.io/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: phone, body: message }),
    })

    const payload = await response.json().catch(() => ({}))
    const success = response.ok

    if (supabase) {
      await supabase.from('sms_logs').insert({
        request_id: requestId || null,
        phone,
        message,
        type,
        success,
        sms_id: payload.id || payload.message_id || null,
        sent_by: sentBy || null,
      })
    }

    return { success, payload, error: success ? null : payload.error || payload.message || 'SMS failed' }
  } catch (error: any) {
    if (supabase) {
      await supabase.from('sms_logs').insert({
        request_id: requestId || null,
        phone,
        message,
        type,
        success: false,
        sent_by: sentBy || null,
      })
    }
    return { success: false, error: error?.message || 'SMS failed' }
  }
}

export async function sendEmail({ to, subject, text, html }: EmailInput) {
  if (!to) return { success: false, skipped: true, reason: 'missing_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, skipped: true, reason: 'not_configured' }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'SiteSync Pro <notifications@sitesync-pro.vercel.app>',
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br />'),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  return { success: response.ok, payload, error: response.ok ? null : payload.error || payload.message || 'Email failed' }
}

export async function notifyQuoteReceived(request: any) {
  const token = request.access_token
  if (!token) return
  const link = `${appBaseUrl()}/quote/${token}`
  const text = `SiteSync Pro: Your request was received. Track responses here: ${link}`

  await Promise.all([
    sendEmail({
      to: request.email,
      subject: 'Your SiteSync Pro quote request was received',
      text: `Your request was received.\n\nTrack responses here: ${link}`,
    }),
    sendQuoSms({
      phone: request.phone,
      message: text,
      type: 'quote_received',
      requestId: request.id,
    }),
  ])
}

export async function notifyQuoteResponse(request: any, response: any, supabase?: any) {
  const link = `${appBaseUrl()}/quote/${request.access_token}`
  const amount = Number(response.price_quote || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
  const sms = `New quote from ${response.operator_company}: ${amount}. Compare: ${link}`

  await Promise.all([
    sendEmail({
      to: request.email,
      subject: `${response.operator_company} sent you a quote`,
      text: `${response.operator_company} sent you a quote for ${amount}.\n\nCompare quotes here: ${link}`,
    }),
    sendQuoSms({
      phone: request.phone,
      message: sms,
      type: 'quote_response',
      requestId: request.id,
      sentBy: response.operator_user_id,
      supabase,
    }),
  ])
}

export async function notifySelectedOperator(request: any, response: any, supabase?: any) {
  const contact = [request.phone, request.email].filter(Boolean).join(' / ')
  const message = `SiteSync Pro: You won ${request.name || 'a contractor'}'s quote. Contact: ${contact || 'Open SiteSync for details'}`

  await Promise.all([
    sendEmail({
      to: response.operator_email,
      subject: 'You won a SiteSync Pro quote',
      text: `You won the quote for ${request.name || 'a contractor'}.\n\nContact: ${contact || 'No contact info provided.'}`,
    }),
    sendQuoSms({
      phone: response.operator_phone,
      message,
      type: 'quote_selected',
      requestId: request.id,
      sentBy: response.operator_user_id,
      supabase,
    }),
  ])
}
