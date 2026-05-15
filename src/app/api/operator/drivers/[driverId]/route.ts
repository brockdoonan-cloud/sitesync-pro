import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ driverId: string }> }

const patchDriverSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  truck_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const org = await getCurrentOrg()
  if (!org?.organizationId || (!org.isOperator && !org.isSuperAdmin)) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  const { driverId } = await params
  const body = await request.json().catch(() => null)
  const parsed = patchDriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid driver update.' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required.' }, { status: 500 })

  const { data, error } = await admin
    .from('drivers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', driverId)
    .eq('organization_id', org.organizationId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ driver: data })
}
