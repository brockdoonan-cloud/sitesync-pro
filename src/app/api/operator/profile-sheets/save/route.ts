import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { createClient } from '@/lib/supabase/server'
import { captureAppException } from '@/lib/monitoring/sentry'
import type { ProfileSheetExtraction } from '@/lib/billing/profileSheetTypes'

export const runtime = 'nodejs'

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstText(...values: unknown[]) {
  return values.map(value => String(value || '').trim()).find(Boolean) || ''
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

async function insertWithFallbacks(supabase: Awaited<ReturnType<typeof createClient>>, table: string, payloads: Record<string, unknown>[]) {
  let lastError: any = null
  for (const payload of payloads) {
    const { data, error } = await supabase.from(table).insert(cleanPayload(payload)).select('*').single()
    if (!error) return { data, error: null }
    lastError = error
  }
  return { data: null, error: lastError }
}

async function updateWithFallbacks(supabase: Awaited<ReturnType<typeof createClient>>, table: string, id: string, payloads: Record<string, unknown>[]) {
  let lastError: any = null
  for (const payload of payloads) {
    const { error } = await supabase.from(table).update(cleanPayload(payload)).eq('id', id)
    if (!error) return { error: null }
    lastError = error
  }
  return { error: lastError }
}

function chargeValue(term: { value: number | null; enabled?: boolean }, fallback = 0) {
  if (term.enabled === false) return 0
  return asNumber(term.value, fallback)
}

async function findOrCreateClient(supabase: Awaited<ReturnType<typeof createClient>>, extraction: ProfileSheetExtraction, organizationId: string | null) {
  const clientName = firstText(extraction.customer.legalBusinessName, extraction.fileName.replace(/\.[^.]+$/, ''))
  const { data: existingRows } = await supabase
    .from('clients')
    .select('id,company_name,name,email')
    .limit(2000)

  const existing = (existingRows || []).find((client: any) => {
    const current = firstText(client.company_name, client.name).toLowerCase()
    return current === clientName.toLowerCase()
  })
  if (existing?.id) return { clientId: existing.id, created: false, warning: '' }

  const fullPayload = {
    organization_id: organizationId,
    company_name: clientName,
    name: clientName,
    contact_name: extraction.customer.billingContactName || extraction.job.jobsiteContactName || null,
    email: extraction.customer.billingEmail || extraction.job.jobsiteContactEmail || null,
    phone: extraction.customer.mainPhone || extraction.job.jobsiteContactPhone || null,
    status: 'active',
  }
  const minimalWithOrg = {
    organization_id: organizationId,
    company_name: clientName,
    name: clientName,
    email: extraction.customer.billingEmail || null,
    phone: extraction.customer.mainPhone || null,
    status: 'active',
  }
  const minimal = {
    company_name: clientName,
    name: clientName,
    email: extraction.customer.billingEmail || null,
    phone: extraction.customer.mainPhone || null,
    status: 'active',
  }

  const { data, error } = await insertWithFallbacks(supabase, 'clients', organizationId ? [fullPayload, minimalWithOrg, minimal] : [minimal])
  if (error) throw error
  return { clientId: data.id as string, created: true, warning: '' }
}

async function findOrCreateJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  extraction: ProfileSheetExtraction,
  clientId: string,
  organizationId: string | null
) {
  const jobName = firstText(extraction.job.jobsiteName, extraction.job.jobsiteAddress, 'Profile sheet job')
  const jobsiteAddress = [extraction.job.jobsiteAddress, extraction.job.jobsiteCity, extraction.job.jobsiteState, extraction.job.jobsiteZip].filter(Boolean).join(', ')

  const { data: existingRows } = await supabase
    .from('jobs')
    .select('*')
    .limit(2000)

  const normalizedName = jobName.toLowerCase()
  const normalizedAddress = jobsiteAddress.toLowerCase()
  const existing = (existingRows || []).find((job: any) => {
    const currentName = firstText(job.job_name, job.project_name, job.name).toLowerCase()
    const currentAddress = firstText(job.jobsite_address, job.address).toLowerCase()
    return (currentName && currentName === normalizedName) || (currentAddress && currentAddress === normalizedAddress)
  })
  if (existing?.id) return { jobId: existing.id as string, created: false, warning: '' }

  const fullPayload = {
    organization_id: organizationId,
    client_id: clientId,
    customer_id: clientId,
    job_name: jobName,
    project_name: jobName,
    name: jobName,
    jobsite_address: jobsiteAddress || extraction.job.jobsiteAddress || null,
    address: jobsiteAddress || extraction.job.jobsiteAddress || null,
    jobsite_city: extraction.job.jobsiteCity || null,
    jobsite_state_code: extraction.job.jobsiteState || null,
    jobsite_zip: extraction.job.jobsiteZip || null,
    jobsite_contact_name: extraction.job.jobsiteContactName || null,
    jobsite_contact_phone: extraction.job.jobsiteContactPhone || null,
    jobsite_contact_email: extraction.job.jobsiteContactEmail || null,
    status: 'active',
    notes: `Imported from profile sheet: ${extraction.fileName}`,
  }
  const mediumPayload = {
    organization_id: organizationId,
    client_id: clientId,
    job_name: jobName,
    jobsite_address: jobsiteAddress || extraction.job.jobsiteAddress || null,
    status: 'active',
  }
  const schedulePayload = {
    organization_id: organizationId,
    status: 'active',
    scheduled_date: null,
  }

  const { data, error } = await insertWithFallbacks(
    supabase,
    'jobs',
    organizationId ? [fullPayload, mediumPayload, schedulePayload] : [{ ...fullPayload, organization_id: undefined }, { ...mediumPayload, organization_id: undefined }]
  )
  if (error) return { jobId: null, created: false, warning: `Job record was not created yet: ${error.message}` }
  return { jobId: data.id as string, created: true, warning: '' }
}

export async function POST(request: NextRequest) {
  const org = await getCurrentOrg()
  if (!org?.isOperator) {
    return NextResponse.json({ error: 'Operator access is required.' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const extraction = body?.extraction as ProfileSheetExtraction | undefined
    if (!extraction?.pricing) {
      return NextResponse.json({ error: 'Missing extracted profile sheet terms.' }, { status: 400 })
    }

    const supabase = await createClient()
    const warnings: string[] = []
    const organizationId = org.organizationId
    const { clientId, created } = await findOrCreateClient(supabase, extraction, organizationId)
    if (created) warnings.push('Created a new client account from the profile sheet.')

    const customerName = firstText(extraction.customer.legalBusinessName, extraction.fileName.replace(/\.[^.]+$/, ''))
    const jobName = firstText(extraction.job.jobsiteName, extraction.job.jobsiteAddress, 'Profile sheet job')
    const jobsiteAddress = [extraction.job.jobsiteAddress, extraction.job.jobsiteCity, extraction.job.jobsiteState, extraction.job.jobsiteZip].filter(Boolean).join(', ')
    const jobResult = await findOrCreateJob(supabase, extraction, clientId, organizationId)
    if (jobResult.created) warnings.push('Created a project job record and linked the profile sheet to it.')
    if (jobResult.warning) warnings.push(jobResult.warning)
    extraction.jobId = jobResult.jobId

    const profilePayload = {
      organization_id: organizationId,
      client_id: clientId,
      job_id: jobResult.jobId,
      file_name: extraction.fileName,
      file_path: extraction.sourceFilePath || null,
      customer_name: customerName,
      job_name: jobName,
      jobsite_address: jobsiteAddress || null,
      extracted_terms: extraction,
      billing_rules: extraction.billingRules,
      fee_settings: extraction.feeSettings,
      billing_preview: extraction.preview,
      source_text_excerpt: extraction.sourceTextExcerpt || null,
      active: true,
      created_by_user_id: org.user.id,
    }

    let profileSheetId: string | null = null
    const profileWithoutJob = { ...profilePayload }
    delete (profileWithoutJob as any).job_id
    const profileWithoutOrg = { ...profileWithoutJob }
    delete (profileWithoutOrg as any).organization_id
    const profileResult = await insertWithFallbacks(supabase, 'customer_profile_sheets', [profilePayload, profileWithoutJob, profileWithoutOrg])
    if (profileResult.error) {
      warnings.push(`Profile sheet archive was not saved yet: ${profileResult.error.message}`)
    } else {
      profileSheetId = profileResult.data.id as string
    }

    if (jobResult.jobId && profileSheetId) {
      const linkResult = await updateWithFallbacks(supabase, 'jobs', jobResult.jobId, [
        { signed_profile_sheet_id: profileSheetId, profile_sheet_id: profileSheetId },
        { signed_profile_sheet_id: profileSheetId },
        { profile_sheet_id: profileSheetId },
      ])
      if (linkResult.error) warnings.push(`Job was created, but the profile-sheet pointer was not written yet: ${linkResult.error.message}`)
    }

    const pricingPayload = {
      organization_id: organizationId,
      client_id: clientId,
      job_id: jobResult.jobId,
      profile_sheet_id: profileSheetId,
      billing_rules: extraction.billingRules,
      name: `${customerName} - ${jobName}`,
      yard_address: '16877 E Colonial Dr, Orlando, FL 32820',
      included_miles: 30,
      extra_mile_rate: 0,
      mileage_bands: [
        { label: '0-30 miles included', minMiles: 0, maxMiles: 30, rate: 0 },
        { label: '31-50 miles', minMiles: 31, maxMiles: 50, rate: 0 },
        { label: '51+ miles', minMiles: 51, maxMiles: null, rate: 0 },
      ],
      one_bin_service: chargeValue(extraction.pricing.oneBinService, 395),
      two_bin_service: chargeValue(extraction.pricing.twoBinService, 0),
      water_pumpout: chargeValue(extraction.pricing.waterPumpout, chargeValue(extraction.pricing.oneBinService, 395)),
      relocate: chargeValue(extraction.pricing.relocate, 0),
      onsite_relocate: chargeValue(extraction.pricing.onsiteRelocate, 0),
      monthly_usage: chargeValue(extraction.pricing.monthlyUsage, 150),
      fuel_surcharge_percent: chargeValue(extraction.pricing.fuelSurchargePercent, 0),
      environmental_fee: chargeValue(extraction.pricing.environmentalFee, 0),
      trash_fee: chargeValue(extraction.pricing.trashFee, 0),
      dead_run: chargeValue(extraction.pricing.deadRun, 0),
      active: true,
    }
    const pricingFallback = { ...pricingPayload }
    delete (pricingFallback as any).organization_id
    delete (pricingFallback as any).profile_sheet_id
    delete (pricingFallback as any).job_id
    delete (pricingFallback as any).billing_rules
    const pricingOrgFallback = { ...pricingPayload }
    delete (pricingOrgFallback as any).profile_sheet_id
    delete (pricingOrgFallback as any).job_id
    delete (pricingOrgFallback as any).billing_rules

    const pricingResult = await insertWithFallbacks(supabase, 'pricing_profiles', [pricingPayload, pricingOrgFallback, pricingFallback])
    if (pricingResult.error) {
      warnings.push(`Pricing profile was not saved: ${pricingResult.error.message}`)
    }

    let billingRunId: string | null = null
    if (profileSheetId) {
      const runPayload = {
        organization_id: organizationId,
        profile_sheet_id: profileSheetId,
        client_id: clientId,
        job_id: jobResult.jobId,
        period_start: new Date().toISOString().slice(0, 8) + '01',
        period_end: new Date().toISOString().slice(0, 10),
        source_activity: extraction.preview.activity,
        line_items: extraction.preview.lines,
        subtotal: extraction.preview.serviceSubtotal + extraction.preview.recurringSubtotal,
        fuel_surcharge: extraction.preview.surchargeTotal,
        total: extraction.preview.total,
        status: 'draft',
        created_by_user_id: org.user.id,
      }
      const runWithoutJob = { ...runPayload }
      delete (runWithoutJob as any).job_id
      const runWithoutOrg = { ...runWithoutJob }
      delete (runWithoutOrg as any).organization_id
      const runResult = await insertWithFallbacks(supabase, 'profile_sheet_billing_runs', [runPayload, runWithoutJob, runWithoutOrg])
      if (runResult.error) warnings.push(`Billing preview run was not archived yet: ${runResult.error.message}`)
      else billingRunId = runResult.data.id as string
    }

    return NextResponse.json({
      saved: !warnings.some(warning => warning.includes('Pricing profile was not saved')),
      clientId,
      jobId: jobResult.jobId,
      profileSheetId,
      pricingProfileId: pricingResult.data?.id || null,
      billingRunId,
      warnings,
    })
  } catch (error) {
    captureAppException(error, { route: '/api/operator/profile-sheets/save', organizationId: org.organizationId, userId: org.user.id })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save the profile sheet.' }, { status: 500 })
  }
}
