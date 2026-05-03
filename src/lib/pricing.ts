export type ServiceCode =
  | 'delivery'
  | 'swap'
  | 'pickup'
  | 'water_removal'
  | 'slurry_pumpout'
  | 'relocate'
  | 'onsite_relocate'
  | 'dead_run'

export type PriceInput = {
  serviceCode: ServiceCode
  quantity?: number
  miles?: number
  sameDay?: boolean
  trashFee?: boolean
  overloadFee?: boolean
  weightTicket?: boolean
  standbyMinutes?: number
}

export type PriceLine = {
  label: string
  quantity: number
  rate: number
  amount: number
  taxable?: boolean
}

export const DEFAULT_PRICING = {
  yardAddress: '255 S Orange Ave, Orlando, FL 32801',
  includedMiles: 30,
  extraMileRate: 4.5,
  oneBinService: 395,
  twoBinService: 350,
  waterPumpout: 395,
  slurryPumpout: 0,
  relocate: 395,
  onsiteRelocate: 150,
  deadRun: 395,
  monthlyUsage: 150,
  fuelSurchargePercent: 14,
  environmentalFee: 25,
  trashFee: 350,
  overloadFee: 350,
  sameDayFee: 150,
  weightTicketFee: 50,
  standbyTierOne: 50,
  standbyTierTwo: 100,
}

export function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function serviceBaseRate(input: PriceInput) {
  const quantity = Math.max(1, input.quantity || 1)
  if (['delivery', 'swap', 'pickup'].includes(input.serviceCode)) {
    return quantity >= 2 ? DEFAULT_PRICING.twoBinService : DEFAULT_PRICING.oneBinService
  }
  if (input.serviceCode === 'water_removal') return DEFAULT_PRICING.waterPumpout
  if (input.serviceCode === 'slurry_pumpout') return DEFAULT_PRICING.slurryPumpout
  if (input.serviceCode === 'relocate') return DEFAULT_PRICING.relocate
  if (input.serviceCode === 'onsite_relocate') return DEFAULT_PRICING.onsiteRelocate
  return DEFAULT_PRICING.deadRun
}

export function serviceLabel(code: ServiceCode) {
  if (code === 'delivery') return 'Bin drop'
  if (code === 'swap') return 'Bin swap'
  if (code === 'pickup') return 'Bin pickup'
  if (code === 'water_removal') return 'Water pumpout'
  if (code === 'slurry_pumpout') return 'Slurry/paint pumpout'
  if (code === 'relocate') return 'Bin relocate'
  if (code === 'onsite_relocate') return 'Onsite relocation'
  return 'Dead run'
}

export function calculatePrice(input: PriceInput) {
  const quantity = Math.max(1, input.quantity || 1)
  const miles = Math.max(0, input.miles || 0)
  const lines: PriceLine[] = []
  const baseRate = serviceBaseRate(input)

  lines.push({
    label: `${serviceLabel(input.serviceCode)}${miles <= DEFAULT_PRICING.includedMiles ? ' within 30 miles' : ''}`,
    quantity,
    rate: baseRate,
    amount: baseRate * quantity,
  })

  if (miles > DEFAULT_PRICING.includedMiles) {
    const extraMiles = Number((miles - DEFAULT_PRICING.includedMiles).toFixed(1))
    lines.push({
      label: `Mileage over ${DEFAULT_PRICING.includedMiles} miles`,
      quantity: extraMiles,
      rate: DEFAULT_PRICING.extraMileRate,
      amount: extraMiles * DEFAULT_PRICING.extraMileRate,
    })
  }

  if (input.sameDay) lines.push({ label: 'Same day/night/weekend service', quantity, rate: DEFAULT_PRICING.sameDayFee, amount: DEFAULT_PRICING.sameDayFee * quantity })
  if (input.trashFee) lines.push({ label: 'Trash or unauthorized material fee', quantity, rate: DEFAULT_PRICING.trashFee, amount: DEFAULT_PRICING.trashFee * quantity })
  if (input.overloadFee) lines.push({ label: 'Overloaded/oversized/solid fee', quantity, rate: DEFAULT_PRICING.overloadFee, amount: DEFAULT_PRICING.overloadFee * quantity })
  if (input.weightTicket) lines.push({ label: 'Weight ticket', quantity, rate: DEFAULT_PRICING.weightTicketFee, amount: DEFAULT_PRICING.weightTicketFee * quantity })

  const standby = input.standbyMinutes || 0
  if (standby > 30 && standby <= 45) lines.push({ label: 'Stand-by time 31-45 minutes', quantity: 1, rate: DEFAULT_PRICING.standbyTierOne, amount: DEFAULT_PRICING.standbyTierOne })
  if (standby > 45 && standby <= 60) lines.push({ label: 'Stand-by time 46-60 minutes', quantity: 1, rate: DEFAULT_PRICING.standbyTierTwo, amount: DEFAULT_PRICING.standbyTierTwo })
  if (standby > 60) lines.push({ label: 'Stand-by over 60 minutes becomes dead run', quantity: 1, rate: DEFAULT_PRICING.deadRun, amount: DEFAULT_PRICING.deadRun })

  lines.push({ label: 'Environmental service fee', quantity, rate: DEFAULT_PRICING.environmentalFee, amount: DEFAULT_PRICING.environmentalFee * quantity })

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const fuelSurcharge = Number((subtotal * (DEFAULT_PRICING.fuelSurchargePercent / 100)).toFixed(2))
  lines.push({ label: `${DEFAULT_PRICING.fuelSurchargePercent}% fuel surcharge`, quantity: 1, rate: fuelSurcharge, amount: fuelSurcharge })

  return {
    lines,
    subtotal,
    fuelSurcharge,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  }
}
