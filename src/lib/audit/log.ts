import 'server-only'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, getUserAgent } from '@/lib/request'

type AuditInput = {
  userId?: string | null
  orgId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  beforeState?: unknown
  afterState?: unknown
  request?: NextRequest
}

export async function logAuditEvent(input: AuditInput) {
  const admin = createAdminClient()
  if (!admin) return

  await admin.from('audit_logs').insert({
    user_id: input.userId || null,
    organization_id: input.orgId || null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    ip_address: input.request ? getClientIp(input.request) : null,
    user_agent: input.request ? getUserAgent(input.request) : null,
  })
}
