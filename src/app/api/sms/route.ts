import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SmsType = 'confirmation' | 'eta_update' | 'completed' | 'scheduled'

async function sendSMS(to: string, body: string) {
  const apiKey = process.env.QUO_API_KEY
  const fromNumber = process.env.QUO_FROM_NUMBER

  if (!apiKey || !fromNumber) {
    console.warn('[SMS] Quo not configured - add QUO_API_KEY and QUO_FROM_NUMBER to Vercel env')
    return { success: false, reason: 'not_configured' }
  }

  const cleaned = to.replace(/\D/g, '')
  const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`

  const res = await fetch('https://api.quoapp.io/v1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: e164, from: fromNumber, text: body }),
  })
  const data = await res.json()
  if (!res.ok) return { success: false, error: data.message || 'Send failed' }
  return { success: true, id: data.id }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type, phone, customerName, serviceType, address, eta, requestId } = body
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })
    if (!['confirmation', 'eta_update', 'completed', 'scheduled'].includes(type)) {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    const firstName = customerName?.split(' ')[0] || 'there'
    const svc = serviceType || 'service'
    const addr = address || 'your location'
    const messages: Record<SmsType, string> = {
      confirmation: `Hi ${firstName}! Your ${svc} request has been confirmed for ${addr}. Reply STOP to opt out. - SiteSync Pro`,
      eta_update: `Hi ${firstName}! Your driver is ${eta || 'on the way'} for your ${svc} at ${addr}. - SiteSync Pro`,
      completed: `Hi ${firstName}! Your ${svc} at ${addr} has been completed. Thanks! - SiteSync Pro`,
      scheduled: `Hi ${firstName}! Your ${svc} is scheduled for ${eta || 'soon'} at ${addr}. Reply STOP to opt out. - SiteSync Pro`,
    }
    const message = messages[type as SmsType]
    const result = await sendSMS(phone, message)

    if (requestId) {
      await supabase.from('sms_logs').insert({
        request_id: requestId,
        phone,
        message,
        type,
        success: result.success,
        sms_id: 'id' in result ? result.id || null : null,
        sent_by: user.id,
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMS error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestId = req.nextUrl.searchParams.get('requestId')
  const { data } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('request_id', requestId || '')
    .order('created_at', { ascending: false })

  return NextResponse.json({ logs: data || [] })
}
