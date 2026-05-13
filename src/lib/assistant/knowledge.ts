export type AssistantAnswer = {
  answer: string
  links: { label: string; href: string }[]
}

type HelpTopic = {
  keywords: string[]
  answer: string
  links: { label: string; href: string }[]
}

const topics: HelpTopic[] = [
  {
    keywords: ['quote', 'lead', 'price', 'estimate', 'cotizacion', 'precio'],
    answer: 'Use the quote form to submit jobsite address, equipment type, dates, and notes. Operators see the lead in their inbox, can send a quote, and the customer can compare responses from their tracking link.',
    links: [
      { label: 'Get a quote', href: '/quotes' },
      { label: 'Operator leads', href: '/dashboard/operator/leads' },
    ],
  },
  {
    keywords: ['swap', 'request', 'service', 'customer', 'bin full', 'container', 'cambio', 'servicio'],
    answer: 'Customers can open their portal, choose the exact bin on their jobsite, pick a date and time, and submit a swap request. Dispatch sees it in requests/routes and can assign it to a driver.',
    links: [
      { label: 'Customer bins', href: '/dashboard/customer/bins' },
      { label: 'Request service', href: '/dashboard/customer/request' },
      { label: 'Operator requests', href: '/dashboard/operator/requests' },
    ],
  },
  {
    keywords: ['driver', 'route', 'eta', 'tracking', 'truck', 'uber', 'gps', 'ruta', 'conductor'],
    answer: 'Drivers open routes, mark stops en route, arrived, and complete. Customers can see ETA/tracking status while dispatch keeps billing and bin locations synchronized.',
    links: [
      { label: 'Routes', href: '/dashboard/operator/routes' },
      { label: 'Trucks', href: '/dashboard/operator/trucks' },
      { label: 'Customer tracking', href: '/dashboard/customer/tracking' },
    ],
  },
  {
    keywords: ['billing', 'invoice', 'balance', 'audit', 'irs', 'charge', 'factura', 'saldo'],
    answer: 'Billing uses completed route stops and imported daily reports to create traceable invoice lines. Customers can view active balances and invoice breakdowns from their portal.',
    links: [
      { label: 'Operator billing', href: '/dashboard/operator/billing' },
      { label: 'Customer billing', href: '/dashboard/customer/billing' },
      { label: 'Pricing setup', href: '/dashboard/operator/pricing' },
    ],
  },
  {
    keywords: ['access code', 'login', 'account', 'portal', 'customer access', 'codigo', 'cuenta'],
    answer: 'Operators create a customer portal code from the Clients page. The customer enters that code at signup or in the portal, which links them only to their own bins, requests, tracking, and invoices.',
    links: [
      { label: 'Clients', href: '/dashboard/operator/clients' },
      { label: 'Sign up', href: '/auth/signup' },
      { label: 'Customer portal', href: '/dashboard/customer' },
    ],
  },
  {
    keywords: ['zip', 'coverage', 'territory', 'division', 'nationwide', 'lead matching', 'area'],
    answer: 'Coverage controls which operators receive leads. Set divisions by state, county, ZIP, or radius so leads route only to serviceable areas.',
    links: [
      { label: 'Coverage', href: '/dashboard/operator/coverage' },
      { label: 'Operator onboarding', href: '/dashboard/operator/onboarding' },
    ],
  },
  {
    keywords: ['import', 'onboard', 'spreadsheet', 'excel', 'orlando report', 'file', 'csv'],
    answer: 'Use the onboarding import page to upload operational spreadsheets. The system maps clients, jobsites, bins, and service activity, then reports warnings so bad rows can be corrected before live use.',
    links: [
      { label: 'Import data', href: '/dashboard/operator/import' },
      { label: 'Equipment', href: '/dashboard/operator/equipment' },
    ],
  },
  {
    keywords: ['map', 'pin', 'location', 'jobsite', 'equipment map', 'mapa'],
    answer: 'The live map shows jobsite pins and equipment status. Bins that need swaps are highlighted so dispatch can prioritize service.',
    links: [
      { label: 'Live map', href: '/dashboard/operator/map' },
      { label: 'Routes', href: '/dashboard/operator/routes' },
    ],
  },
]

export function answerSiteQuestion(input: string): AssistantAnswer {
  const question = input.trim().toLowerCase()
  if (!question) {
    return {
      answer: 'Ask me about quotes, swaps, live tracking, billing, onboarding, coverage ZIPs, customer access, or driver routes.',
      links: [
        { label: 'Get a quote', href: '/quotes' },
        { label: 'Sign in', href: '/auth/login' },
      ],
    }
  }

  const scored = topics
    .map(topic => ({
      topic,
      score: topic.keywords.reduce((sum, keyword) => sum + (question.includes(keyword) ? keyword.length : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)

  if (scored[0]?.score > 0) return { answer: scored[0].topic.answer, links: scored[0].topic.links }

  return {
    answer: 'I can help route you to the right SiteSync tool. For customers, start with bins, requests, tracking, or billing. For operators, start with leads, dispatch/routes, map, equipment, clients, billing, or coverage.',
    links: [
      { label: 'Customer portal', href: '/dashboard/customer' },
      { label: 'Operator dashboard', href: '/dashboard/operator' },
      { label: 'Help with coverage', href: '/dashboard/operator/coverage' },
    ],
  }
}
