import { createClient } from '@/lib/supabase/server'
import { isOperatorUser } from '@/lib/operator'

export type OrgRole = 'super_admin' | 'operator_admin' | 'operator_member' | 'client'

export type CurrentOrg = {
  user: any
  organizationId: string | null
  organizationName: string | null
  role: OrgRole | 'operator' | 'customer'
  isSuperAdmin: boolean
  isOperator: boolean
  isClient: boolean
}

const ROLE_PRIORITY: Record<OrgRole, number> = {
  super_admin: 4,
  operator_admin: 3,
  operator_member: 2,
  client: 1,
}

export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id,role,organizations(name,slug)')
    .eq('user_id', user.id)

  if (!error && memberships && memberships.length > 0) {
    const sorted = [...memberships].sort((a: any, b: any) => {
      return (ROLE_PRIORITY[b.role as OrgRole] || 0) - (ROLE_PRIORITY[a.role as OrgRole] || 0)
    })
    const chosen: any = sorted[0]
    const role = chosen.role as OrgRole
    const organization = Array.isArray(chosen.organizations) ? chosen.organizations[0] : chosen.organizations

    return {
      user,
      organizationId: chosen.organization_id,
      organizationName: organization?.name || null,
      role,
      isSuperAdmin: role === 'super_admin',
      isOperator: ['super_admin', 'operator_admin', 'operator_member'].includes(role),
      isClient: role === 'client',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,company_name')
    .eq('id', user.id)
    .single()

  const fallbackOperator = isOperatorUser(profile, user.email)

  return {
    user,
    organizationId: null,
    organizationName: profile?.company_name || null,
    role: fallbackOperator ? 'operator' : 'customer',
    isSuperAdmin: user.email?.toLowerCase() === 'brock.doonan@gmail.com',
    isOperator: fallbackOperator,
    isClient: !fallbackOperator,
  }
}
