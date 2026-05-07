import { redirect } from 'next/navigation'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import CoverageManager from '@/components/operator/CoverageManager'

export default async function CoveragePage() {
  const org = await getCurrentOrg()
  if (!org) redirect('/auth/login')
  if (!org.isOperator) redirect('/dashboard/customer')
  if (!org.organizationId) redirect('/dashboard/operator')

  const supabase = await createClient()
  const { data: divisions } = await supabase
    .from('operator_divisions')
    .select('id,name,address_line1,city,state_code,zip,phone,email,is_active,created_at')
    .eq('organization_id', org.organizationId)
    .order('created_at', { ascending: true })

  const divisionIds = (divisions || []).map((division: any) => division.id)
  const [zipCoverage, stateCoverage] = divisionIds.length
    ? await Promise.all([
        supabase
          .from('division_coverage_zips')
          .select('id,division_id,zip')
          .in('division_id', divisionIds)
          .order('zip', { ascending: true }),
        supabase
          .from('division_coverage_states')
          .select('id,division_id,state_code')
          .in('division_id', divisionIds)
          .order('state_code', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <CoverageManager
      organizationId={org.organizationId}
      organizationName={org.organizationName || 'Your organization'}
      initialDivisions={divisions || []}
      initialZipCoverage={zipCoverage.data || []}
      initialStateCoverage={stateCoverage.data || []}
    />
  )
}
