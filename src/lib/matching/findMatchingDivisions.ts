type SupabaseLike = {
  from: (table: string) => any
}

export type LeadDivisionMatch = {
  division_id: string
  organization_id: string
  matched_via: 'zip' | 'state' | 'manual'
}

const MATCH_PRIORITY: Record<LeadDivisionMatch['matched_via'], number> = {
  zip: 3,
  state: 2,
  manual: 1,
}

export function normalizeZip(input?: string | null) {
  const clean = String(input || '').replace(/\D/g, '').slice(0, 5)
  return clean.length === 5 ? clean : null
}

export async function findMatchingDivisions(
  supabase: SupabaseLike,
  location: { zip?: string | null; stateCode?: string | null }
): Promise<LeadDivisionMatch[]> {
  const zip = normalizeZip(location.zip)
  let stateCode = String(location.stateCode || '').trim().toUpperCase().slice(0, 2) || null

  if (zip && !stateCode) {
    const { data } = await supabase
      .from('zip_lookup')
      .select('state_code')
      .eq('zip', zip)
      .maybeSingle()
    stateCode = data?.state_code || null
  }

  const [zipCoverage, stateCoverage] = await Promise.all([
    zip
      ? supabase
          .from('division_coverage_zips')
          .select('division_id')
          .eq('zip', zip)
      : Promise.resolve({ data: [], error: null }),
    stateCode
      ? supabase
          .from('division_coverage_states')
          .select('division_id')
          .eq('state_code', stateCode)
      : Promise.resolve({ data: [], error: null }),
  ])

  const candidateByDivision = new Map<string, LeadDivisionMatch['matched_via']>()
  if (!zipCoverage.error) {
    for (const row of zipCoverage.data || []) candidateByDivision.set(row.division_id, 'zip')
  }
  if (!stateCoverage.error) {
    for (const row of stateCoverage.data || []) {
      const existing = candidateByDivision.get(row.division_id)
      if (!existing || MATCH_PRIORITY.state > MATCH_PRIORITY[existing]) {
        candidateByDivision.set(row.division_id, 'state')
      }
    }
  }

  const ids = [...candidateByDivision.keys()]
  if (!ids.length) return []

  const { data: divisions, error } = await supabase
    .from('operator_divisions')
    .select('id,organization_id,is_active')
    .in('id', ids)
    .eq('is_active', true)

  if (error || !divisions) return []

  return divisions.map((division: any) => ({
    division_id: division.id,
    organization_id: division.organization_id,
    matched_via: candidateByDivision.get(division.id) || 'manual',
  }))
}

export async function insertLeadDivisionMatches(
  supabase: SupabaseLike,
  quoteRequestId: string | null | undefined,
  matches: LeadDivisionMatch[]
) {
  if (!quoteRequestId || matches.length === 0) return

  await supabase
    .from('lead_division_matches')
    .upsert(
      matches.map(match => ({
        quote_request_id: quoteRequestId,
        division_id: match.division_id,
        organization_id: match.organization_id,
        matched_via: match.matched_via,
      })),
      { onConflict: 'quote_request_id,division_id' }
    )
}
