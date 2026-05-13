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

async function insertWithFallbacks(supabase: Awaited<ReturnType<typeof createClient>>, table: string, payloads: Record<string, unknown>[]) {
  let lastError: any = null
  for (const payload of payloads) {
    const { data, error } = await supabase.from(table).insert(payload).select('*').single()
    if (!error) return { data, error: null }
    lastError = error
  }
  return { data: null, error: lastError }
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
    const profilePayload = {
      organization_id: organizationId,
      client_id: clientId,
      file_name: extraction.fileName,
      file_path: extraction.sourceFilePath || null,
      customer_name: customerName,
      job_name: jobName,
      jobsite_address: jobsiteAddress || null,
      extracted_terms: extraction,
      billing_rules: extraction.billingRules,
      billing_preview: extraction.preview,
      source_text_excerpt: extraction.sourceTextExcerpt || null,
      active: true,
      created_by_user_id: org.user.id,
    }

    let profileSheetId: string | null = null
    const profileResult = await insertWithFallbacks(supabase, 'customer_profile_sheets', [profilePayload, { ...profilePayload, organization_id: undefined }])
    if (profileResult.error) {
      warnings.push(`Profile sheet archive was not saved yet: ${profileResult.error.message}`)
    } else {
      profileSheetId = profileResult.data.id as string
    }

    const pricingPayload = {
      organization_id: organizationId,
      client_id: clientId,
      profile_sheet_id: profileSheetId,
      name: `${customerName} - ${jobName}`,
      yard_address: '16877 E Colonial Dr, Orlando, FL 32820',
      included_miles: 30,
      extra_mile_rate: 0,
      mileage_bands: [
        { label: '0-30 miles included', minMiles: 0, maxMiles: 30, rate: 0 },
        { label: '31-50 miles', minMiles: 31, maxMiles: 50, rate: 0 },
        { label: '51+ miles', minMiles: 51, maxMiles: null, rate: 0 },
      ],
      one_bin_service: asNumber(extraction.pricing.oneBinService.value, 395),
      two_bin_service: asNumber(extraction.pricing.twoBinService.value, 0),
      water_pumpout: asNumber(extraction.pricing.waterPumpout.value, asNumber(extraction.pricing.oneBinService.value, 395)),
      relocate: asNumber(extraction.pricing.relocate.value, 0),
      onsite_relocate: asNumber(extraction.pricing.onsiteRelocate.value, 0),
      monthly_usage: asNumber(extraction.pricing.monthlyUsage.value, 150),
      fuel_surcharge_percent: asNumber(extraction.pricing.fuelSurchargePercent.value, 0),
      environmental_fee: asNumber(extraction.pricing.environmentalFee.value, 0),
      trash_fee: asNumber(extraction.pricing.trashFee.value, 0),
      dead_run: asNumber(extraction.pricing.deadRun.value, 0),
      active: true,
    }
    const pricingFallback = { ...pricingPayload }
    delete (pricingFallback as any).organization_id
    delete (pricingFallback as any).profile_sheet_id
    const pricingOrgFallback = { ...pricingPayload }
    delete (pricingOrgFallback as any).profile_sheet_id

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
      const runResult = await insertWithFallbacks(supabase, 'profile_sheet_billing_runs', [runPayload, { ...runPayload, organization_id: undefined }])
      if (runResult.error) warnings.push(`Billing preview run was not archived yet: ${runResult.error.message}`)
      else billingRunId = runResult.data.id as string
    }

    return NextResponse.json({
      saved: !warnings.some(warning => warning.includes('Pricing profile was not saved')),
      clientId,
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
