export type ExtractedBillingTerm = {
  value: number | null
  label: string
  source?: string
  confidence: 'high' | 'medium' | 'low'
  enabled: boolean
  chargeMode: BillingChargeMode
}

export type BillingChargeMode =
  | 'per_service'
  | 'per_pumpout'
  | 'per_bin_month'
  | 'percent_of_service'
  | 'conditional'
  | 'manual'

export type ProfileSheetExtraction = {
  fileName: string
  sourceFilePath?: string | null
  jobId?: string | null
  extractedAt: string
  customer: {
    legalBusinessName: string
    billingAddress: string
    billingCity: string
    billingState: string
    billingZip: string
    mainPhone: string
    taxId: string
    billingContactName: string
    billingEmail: string
    additionalBillingEmails: string[]
  }
  job: {
    equipmentTypeId?: string
    serviceTypeId?: string
    jobsiteName: string
    jobNumber: string
    poNumber: string
    agreementDate: string
    jobsiteAddress: string
    jobsiteCity: string
    jobsiteState: string
    jobsiteZip: string
    jobsiteContactName: string
    jobsiteContactPhone: string
    jobsiteContactEmail: string
  }
  pricing: {
    oneBinService: ExtractedBillingTerm
    twoBinService: ExtractedBillingTerm
    waterPumpout: ExtractedBillingTerm
    slurryPumpout: ExtractedBillingTerm
    trashFee: ExtractedBillingTerm
    deadRun: ExtractedBillingTerm
    relocate: ExtractedBillingTerm
    onsiteRelocate: ExtractedBillingTerm
    sameDayWeekendFee: ExtractedBillingTerm
    monthlyUsage: ExtractedBillingTerm
    environmentalFee: ExtractedBillingTerm
    fuelSurchargePercent: ExtractedBillingTerm
    overloadedFee: ExtractedBillingTerm
    standbyThirtyToFortyFive: ExtractedBillingTerm
    standbyFortySixToSixty: ExtractedBillingTerm
    weightTicketFee: ExtractedBillingTerm
  }
  compliance: {
    greenBuildingRequired: boolean | null
    weightTicketRequired: boolean | null
  }
  signers: {
    salespersonName: string
    customerSignerName: string
    customerSignedDate: string
  }
  billingRules: BillingRule[]
  feeSettings: Record<string, { enabled: boolean; chargeMode: BillingChargeMode }>
  preview: BillingPreview
  warnings: string[]
  sourceTextExcerpt: string
  ocrRawResponse?: unknown
  ocrModelVersion?: string
  ocrConfidenceNotes?: string
}

export type BillingRule = {
  eventType: string
  chargeLabel: string
  rate: number
  unit: 'event' | 'bin_month' | 'percent' | 'flag'
  enabled: boolean
  chargeMode: BillingChargeMode
  description: string
}

export type BillingPreviewLine = {
  id: string
  label: string
  source: string
  quantity: number
  rate: number
  amount: number
}

export type BillingPreview = {
  periodLabel: string
  activity: {
    swaps: number
    drops: number
    pickups: number
    pumpouts: number
    activeBins: number
  }
  lines: BillingPreviewLine[]
  serviceSubtotal: number
  recurringSubtotal: number
  surchargeTotal: number
  total: number
}
