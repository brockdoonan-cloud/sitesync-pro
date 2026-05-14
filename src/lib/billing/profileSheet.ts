import JSZip from 'jszip'
import type { BillingChargeMode, BillingPreview, BillingPreviewLine, BillingRule, ExtractedBillingTerm, ProfileSheetExtraction } from './profileSheetTypes'

const LABELS_THAT_END_VALUES = [
  'DIVISION',
  'JOBSITE INFORMATION',
  'JOBSITE NAME',
  'JOB #:',
  'PO #:',
  'TODAY',
  'JOBSITE STREET ADDRESS',
  'CITY',
  'STATE',
  'ZIP',
  'JOBSITE CONTACT',
  'CUSTOMER INFORMATION',
  'LEGAL COMPANY NAME',
  'STREET ADDRESS',
  'BILLING ADDRESS',
  'MAIN PHONE',
  'FED TAX ID',
  'NAME OF PRIMARY BILLING CONTACT',
  'BILLING EMAIL',
  'BILLING CONTACT',
  'ADDITIONAL BILLING EMAILS',
  'PRICING INFORMATION',
  'BIN DROP',
  'BIN PUMPOUT',
  'TRASH',
  'DEAD RUN',
  'BIN RELOCATE',
  'SAME DAY',
  'BIN USAGE',
  'ENVIRONMENTAL',
  'FUEL SURCHARGE',
  'GREEN BUILDING',
  'AUTHORIZED SIGNATURES',
]

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function cleanLine(value: string) {
  return decodeXml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function looksLikeLabel(value: string) {
  const upper = value.toUpperCase()
  return LABELS_THAT_END_VALUES.some(label => upper.includes(label))
}

function linesFromText(text: string) {
  return normalizeText(text)
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean)
}

function findIndex(lines: string[], candidates: string[], startAt = 0) {
  return lines.findIndex((line, index) => index >= startAt && candidates.some(candidate => line.toUpperCase().includes(candidate.toUpperCase())))
}

function section(lines: string[], startCandidates: string[], endCandidates: string[]) {
  const start = findIndex(lines, startCandidates)
  if (start < 0) return []
  const end = findIndex(lines, endCandidates, start + 1)
  return lines.slice(start, end > start ? end : undefined)
}

function valueAfter(lines: string[], candidates: string[]) {
  const index = findIndex(lines, candidates)
  if (index < 0) return ''

  const line = lines[index]
  for (const candidate of candidates) {
    const position = line.toUpperCase().indexOf(candidate.toUpperCase())
    if (position >= 0) {
      const sameLine = cleanLine(line.slice(position + candidate.length).replace(/^[:#-]+/, ''))
      if (sameLine && !looksLikeLabel(sameLine)) return sameLine
    }
  }

  for (let next = index + 1; next < Math.min(lines.length, index + 6); next++) {
    if (!lines[next]) continue
    if (looksLikeLabel(lines[next])) break
    return lines[next]
  }
  return ''
}

function collectEmails(text: string) {
  return Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []))
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return value.trim()
}

function splitNamePhone(value: string) {
  const phone = value.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || ''
  const name = phone ? value.replace(phone, '').replace(/[,-]+$/, '').trim() : value.trim()
  return { name, phone: phone ? normalizePhone(phone) : '' }
}

function parseMoney(value: string | undefined) {
  if (!value) return null
  const normalized = value.replace(/[$,\s]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function snippet(text: string, index: number) {
  if (index < 0) return undefined
  const start = Math.max(0, index - 80)
  return cleanLine(text.slice(start, index + 180))
}

function defaultEnabled(value: number | null, fallback: number | null, chargeMode: BillingChargeMode) {
  if (chargeMode === 'manual') return false
  return value !== null || fallback !== null
}

function moneyTerm(text: string, label: string, patterns: RegExp[], fallback: number | null = null, chargeMode: BillingChargeMode = 'conditional'): ExtractedBillingTerm {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (!match) continue
    const value = parseMoney(match[1])
    if (value !== null) {
      return { value, label, source: snippet(text, match.index), confidence: 'high', enabled: defaultEnabled(value, fallback, chargeMode), chargeMode }
    }
  }
  return {
    value: fallback,
    label,
    confidence: fallback === null ? 'low' : 'medium',
    source: fallback === null ? undefined : 'Defaulted from SiteSync standard pricing because the document did not include a clear value.',
    enabled: defaultEnabled(null, fallback, chargeMode),
    chargeMode,
  }
}

function percentTerm(text: string, label: string, patterns: RegExp[], fallback: number | null = null, chargeMode: BillingChargeMode = 'percent_of_service'): ExtractedBillingTerm {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (!match) continue
    const value = Number(String(match[1]).replace(/[^\d.]/g, ''))
    if (Number.isFinite(value)) {
      return { value, label, source: snippet(text, match.index), confidence: 'high', enabled: defaultEnabled(value, fallback, chargeMode), chargeMode }
    }
  }
  return { value: fallback, label, confidence: fallback === null ? 'low' : 'medium', enabled: defaultEnabled(null, fallback, chargeMode), chargeMode }
}

function line(id: string, label: string, source: string, quantity: number, rate: number): BillingPreviewLine {
  return {
    id,
    label,
    source,
    quantity,
    rate,
    amount: Number((quantity * rate).toFixed(2)),
  }
}

function termValue(term: ExtractedBillingTerm, fallback = 0) {
  return Number(term.value ?? fallback)
}

function termEnabled(term: ExtractedBillingTerm) {
  return term.enabled !== false && Number(term.value ?? 0) > 0
}

function feeSettingsFromPricing(pricing: ProfileSheetExtraction['pricing']) {
  return Object.fromEntries(
    Object.entries(pricing).map(([key, term]) => [key, { enabled: term.enabled, chargeMode: term.chargeMode }])
  )
}

export function buildBillingRules(extraction: Pick<ProfileSheetExtraction, 'pricing'>): BillingRule[] {
  const pricing = extraction.pricing
  const trashOrOverloadRate = termEnabled(pricing.trashFee) ? termValue(pricing.trashFee) : termValue(pricing.overloadedFee)
  const rules: BillingRule[] = [
    {
      eventType: 'delivery_completed',
      chargeLabel: 'Bin drop',
      rate: termValue(pricing.oneBinService),
      unit: 'event',
      enabled: pricing.oneBinService.enabled,
      chargeMode: pricing.oneBinService.chargeMode,
      description: 'Applied whenever a driver completes a bin delivery.',
    },
    {
      eventType: 'swap_completed',
      chargeLabel: 'Bin swap',
      rate: termValue(pricing.oneBinService),
      unit: 'event',
      enabled: pricing.oneBinService.enabled,
      chargeMode: pricing.oneBinService.chargeMode,
      description: 'Applied whenever a driver completes a swap and closes the stop.',
    },
    {
      eventType: 'pickup_completed',
      chargeLabel: 'Bin pickup',
      rate: termValue(pricing.oneBinService),
      unit: 'event',
      enabled: pricing.oneBinService.enabled,
      chargeMode: pricing.oneBinService.chargeMode,
      description: 'Applied when a final pickup is completed.',
    },
    {
      eventType: 'monthly_usage',
      chargeLabel: 'Monthly bin usage',
      rate: termValue(pricing.monthlyUsage),
      unit: 'bin_month',
      enabled: pricing.monthlyUsage.enabled,
      chargeMode: pricing.monthlyUsage.chargeMode,
      description: 'Applied once per active bin on site for the billing month.',
    },
    {
      eventType: 'water_pumpout_completed',
      chargeLabel: 'Water pumpout',
      rate: termValue(pricing.waterPumpout),
      unit: 'event',
      enabled: pricing.waterPumpout.enabled,
      chargeMode: pricing.waterPumpout.chargeMode,
      description: 'Applied when a pumpout is completed.',
    },
    {
      eventType: 'environmental_service_fee',
      chargeLabel: 'Environmental service fee',
      rate: termValue(pricing.environmentalFee),
      unit: 'event',
      enabled: pricing.environmentalFee.enabled,
      chargeMode: pricing.environmentalFee.chargeMode,
      description: 'Applied to each billable service event.',
    },
    {
      eventType: 'fuel_surcharge',
      chargeLabel: 'Fuel surcharge',
      rate: termValue(pricing.fuelSurchargePercent),
      unit: 'percent',
      enabled: pricing.fuelSurchargePercent.enabled,
      chargeMode: pricing.fuelSurchargePercent.chargeMode,
      description: 'Calculated as a percent of service and environmental charges.',
    },
    {
      eventType: 'dead_run',
      chargeLabel: 'Dead run',
      rate: termValue(pricing.deadRun),
      unit: 'flag',
      enabled: pricing.deadRun.enabled,
      chargeMode: pricing.deadRun.chargeMode,
      description: 'Applied when the driver cannot complete the service due to site conditions.',
    },
    {
      eventType: 'trash_or_overload',
      chargeLabel: 'Trash or overload fee',
      rate: trashOrOverloadRate,
      unit: 'flag',
      enabled: pricing.trashFee.enabled || pricing.overloadedFee.enabled,
      chargeMode: 'conditional',
      description: 'Applied when unauthorized material or overloaded concrete is documented.',
    },
  ]

  return rules.filter(rule => Number.isFinite(rule.rate) && rule.rate >= 0)
}

export function buildBillingPreview(extraction: Pick<ProfileSheetExtraction, 'pricing'>): BillingPreview {
  const serviceCount = 6
  const pumpouts = 1
  const activeBins = 4
  const pricing = extraction.pricing
  const serviceRate = termValue(pricing.oneBinService, 395)
  const pumpoutRate = termValue(pricing.waterPumpout, serviceRate)
  const monthlyRate = termValue(pricing.monthlyUsage, 150)
  const environmentalRate = termValue(pricing.environmentalFee, 25)
  const surchargePct = termValue(pricing.fuelSurchargePercent, 0)

  const lines = [
    termEnabled(pricing.oneBinService) ? line('services', 'Drops / swaps / pickups', 'Driver closeouts and completed swap requests', serviceCount, serviceRate) : null,
    termEnabled(pricing.waterPumpout) ? line('pumpouts', 'Water pumpouts', 'Completed pumpout stops', pumpouts, pumpoutRate) : null,
    termEnabled(pricing.monthlyUsage) ? line('monthly', 'Monthly bin usage', 'Active bins on site during the month', activeBins, monthlyRate) : null,
    termEnabled(pricing.environmentalFee) ? line('environmental', 'Environmental service fees', 'Per bin/service from profile sheet', serviceCount + pumpouts, environmentalRate) : null,
  ].filter(Boolean) as BillingPreviewLine[]
  const serviceSubtotal = lines.filter(item => item.id !== 'monthly').reduce((sum, item) => sum + item.amount, 0)
  const recurringSubtotal = lines.find(item => item.id === 'monthly')?.amount || 0
  const surchargeTotal = termEnabled(pricing.fuelSurchargePercent) ? Number((serviceSubtotal * (surchargePct / 100)).toFixed(2)) : 0

  if (surchargeTotal > 0) {
    lines.push({
      id: 'fuel',
      label: `${surchargePct}% fuel surcharge`,
      source: 'Profile sheet fuel surcharge',
      quantity: 1,
      rate: surchargeTotal,
      amount: surchargeTotal,
    })
  }

  return {
    periodLabel: 'Demo month preview',
    activity: { swaps: 3, drops: 2, pickups: 1, pumpouts, activeBins },
    lines,
    serviceSubtotal,
    recurringSubtotal,
    surchargeTotal,
    total: Number(lines.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
  }
}

export async function extractDocxText(buffer: ArrayBuffer | Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const documentFiles = Object.keys(zip.files)
    .filter(name => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name))
    .sort((a, b) => (a.includes('document') ? -1 : b.includes('document') ? 1 : a.localeCompare(b)))

  const parts = await Promise.all(documentFiles.map(async name => {
    const xml = await zip.files[name].async('text')
    return xml
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
  }))

  return normalizeText(decodeXml(parts.join('\n')))
}

export function extractProfileSheetTerms(text: string, fileName: string): ProfileSheetExtraction {
  const normalized = normalizeText(text)
  const lines = linesFromText(normalized)
  const customerLines = section(lines, ['CUSTOMER INFORMATION'], ['Payment Info', 'PRICING INFORMATION'])
  const pricingLines = section(lines, ['PRICING INFORMATION'], ['GREEN BUILDING', 'AUTHORIZED SIGNATURES'])
  const allEmails = collectEmails(normalized)
  const jobsiteContact = splitNamePhone(valueAfter(lines, ['JOBSITE CONTACT NAME/PHONE']))
  const billingContactPhone = valueAfter(customerLines, ["BILLING CONTACT'S PHONE NUMBER", 'BILLING CONTACTS PHONE NUMBER'])

  const pricing = {
    oneBinService: moneyTerm(normalized, 'Using 1 bin at a time', [/USING\s+1\s+BIN\s+AT\s+A\s+TIME[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], 395, 'per_service'),
    twoBinService: moneyTerm(normalized, 'Using 2 bins at a time', [/USING\s+2\s+BINS[\s\S]{0,160}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'per_service'),
    waterPumpout: moneyTerm(normalized, 'Bin pumpout - water', [/BIN\s+PUMPOUT\s*-\s*WATER[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'per_pumpout'),
    slurryPumpout: moneyTerm(normalized, 'Bin pumpout - slurry / paint', [/BIN\s+PUMPOUT\s*-\s*SLURRY[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'per_pumpout'),
    trashFee: moneyTerm(normalized, 'Trash or unauthorized materials', [/TRASH\s+OR\s+OTHER\s+UNAUTHORIZED\s+MATERIALS[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    deadRun: moneyTerm(normalized, 'Dead run', [/DEAD\s+RUN[\s\S]{0,40}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    relocate: moneyTerm(normalized, 'Bin relocate', [/BIN\s+RELOCATE[\s\S]{0,50}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    onsiteRelocate: moneyTerm(normalized, 'Onsite relocation', [/RELOCATION\s+if\s+onsite[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    sameDayWeekendFee: moneyTerm(normalized, 'Same day / nights / weekends', [/SAME\s+DAY[\s\S]{0,100}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    monthlyUsage: moneyTerm(normalized, 'Monthly bin usage fee', [/BIN\s+USAGE\s+FEE[\s\S]{0,50}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], 150, 'per_bin_month'),
    environmentalFee: moneyTerm(normalized, 'Environmental service fee', [/ENVIRONMENTAL\s+SERVICE\s+FEE[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], 25, 'per_service'),
    fuelSurchargePercent: percentTerm(normalized, 'Fuel surcharge percent', [/FUEL\s+SURCHARGE[\s\S]{0,40}?(\d+(?:\.\d+)?)\s*%/i], 0),
    overloadedFee: moneyTerm(normalized, 'Container overloaded fee', [/CONTAINER\s+OVERLOADED[\s\S]{0,120}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    standbyThirtyToFortyFive: moneyTerm(normalized, 'Stand-by 31-45 minutes', [/31\s*-\s*45\s+min\w*[\s\S]{0,60}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    standbyFortySixToSixty: moneyTerm(normalized, 'Stand-by 46-60 minutes', [/46\s*-\s*60\s+min\w*[\s\S]{0,80}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
    weightTicketFee: moneyTerm(normalized, 'Weight ticket fee', [/WEIGHT\s+TICKET[\s\S]{0,160}?\$\s*([\d,\s]+(?:\.\d{1,2})?)/i], null, 'conditional'),
  }

  const extraction: ProfileSheetExtraction = {
    fileName,
    jobId: null,
    extractedAt: new Date().toISOString(),
    customer: {
      legalBusinessName: valueAfter(customerLines, ['LEGAL COMPANY NAME']),
      billingAddress: valueAfter(customerLines, ['BILLING ADDRESS (IF DIFFERENT)', 'STREET ADDRESS']),
      billingCity: valueAfter(customerLines, ['CITY']),
      billingState: valueAfter(customerLines, ['STATE']),
      billingZip: valueAfter(customerLines, ['ZIP']),
      mainPhone: normalizePhone(valueAfter(customerLines, ['MAIN PHONE NUMBER'])),
      taxId: valueAfter(customerLines, ['FED TAX ID#', 'FED TAX ID']),
      billingContactName: valueAfter(customerLines, ['NAME OF PRIMARY BILLING CONTACT']),
      billingEmail: valueAfter(customerLines, ['BILLING EMAIL']) || allEmails[0] || '',
      additionalBillingEmails: allEmails.filter(email => email !== (valueAfter(customerLines, ['BILLING EMAIL']) || allEmails[0])),
    },
    job: {
      jobsiteName: valueAfter(lines, ['JOBSITE NAME']),
      jobNumber: valueAfter(lines, ['JOB #:']),
      poNumber: valueAfter(lines, ['PO #:']),
      agreementDate: valueAfter(lines, ["TODAY'S DATE", 'TODAYS DATE']),
      jobsiteAddress: valueAfter(lines, ['JOBSITE STREET ADDRESS']),
      jobsiteCity: valueAfter(lines, ['CITY']),
      jobsiteState: valueAfter(lines, ['STATE']),
      jobsiteZip: valueAfter(lines, ['ZIP']),
      jobsiteContactName: jobsiteContact.name,
      jobsiteContactPhone: jobsiteContact.phone,
      jobsiteContactEmail: valueAfter(lines, ['JOBSITE CONTACT EMAIL']) || allEmails.find(email => !email.includes('acwncw.com')) || '',
    },
    pricing,
    compliance: {
      greenBuildingRequired: /GREEN\s+BUILDING[\s\S]{0,120}?YES\s+FORMCHECKBOX/i.test(normalized) ? false : null,
      weightTicketRequired: /WEIGHT\s+TICKET\s+REQUIRED[\s\S]{0,120}?YES\s+FORMCHECKBOX/i.test(normalized) ? false : null,
    },
    signers: {
      salespersonName: valueAfter(lines, ['SALESPERSON (PLEASE PRINT)', 'SALESPERSON']),
      customerSignerName: valueAfter(lines, ['AUTHORIZED CUSTOMER']),
      customerSignedDate: valueAfter(lines.slice(Math.max(0, findIndex(lines, ['AUTHORIZED CUSTOMER']) + 1)), ['DATE']),
    },
    billingRules: [],
    feeSettings: {},
    preview: {
      periodLabel: '',
      activity: { swaps: 0, drops: 0, pickups: 0, pumpouts: 0, activeBins: 0 },
      lines: [],
      serviceSubtotal: 0,
      recurringSubtotal: 0,
      surchargeTotal: 0,
      total: 0,
    },
    warnings: [],
    sourceTextExcerpt: lines.slice(0, 120).join('\n').slice(0, 7000),
  }

  if (billingContactPhone && !extraction.customer.mainPhone) extraction.customer.mainPhone = normalizePhone(billingContactPhone)
  if (!extraction.customer.legalBusinessName) extraction.warnings.push('Legal company name was not found. Review the customer before saving.')
  if (!extraction.job.jobsiteAddress) extraction.warnings.push('Jobsite address was not found. Add it before billing live work.')
  if (pricing.oneBinService.value === null) extraction.warnings.push('One-bin drop/swap/pickup rate was not found. The preview used the default rate.')
  if (pricing.monthlyUsage.value === null) extraction.warnings.push('Monthly usage fee was not found. The preview used the default monthly rate.')
  if (pricing.twoBinService.value === null) extraction.warnings.push('Two-bin same-trip pricing was not found. The system will bill single-bin rates unless an operator sets this manually.')

  extraction.billingRules = buildBillingRules(extraction)
  extraction.feeSettings = feeSettingsFromPricing(extraction.pricing)
  extraction.preview = buildBillingPreview(extraction)

  if (pricing.standbyFortySixToSixty.value !== null && pricing.standbyThirtyToFortyFive.value !== null) {
    pricing.standbyFortySixToSixty.value = pricing.standbyThirtyToFortyFive.value + pricing.standbyFortySixToSixty.value
    pricing.standbyFortySixToSixty.source = `${pricing.standbyFortySixToSixty.source || ''} Calculated as cumulative standby charges through 60 minutes.`.trim()
  }

  return extraction
}
