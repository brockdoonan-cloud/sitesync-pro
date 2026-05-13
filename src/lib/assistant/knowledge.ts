export type AssistantAnswer = {
  answer: string
  links: { label: string; href: string }[]
}

type AssistantLanguage = 'en' | 'es'
type LocalizedString = Record<AssistantLanguage, string>

type HelpTopic = {
  keywords: string[]
  answer: LocalizedString
  links: { label: LocalizedString; href: string }[]
}

const topics: HelpTopic[] = [
  {
    keywords: ['quote', 'lead', 'price', 'estimate', 'cotizacion', 'cotización', 'precio'],
    answer: {
      en: 'Use the quote form to submit jobsite address, equipment type, dates, and notes. Operators see the lead in their inbox, can send a quote, and the customer can compare responses from their tracking link.',
      es: 'Usa el formulario de cotización para enviar la dirección del sitio, tipo de equipo, fechas y notas. Los operadores ven el lead en su bandeja, pueden enviar una cotización y el cliente puede comparar respuestas desde su enlace de seguimiento.',
    },
    links: [
      { label: { en: 'Get a quote', es: 'Pedir cotización' }, href: '/quotes' },
      { label: { en: 'Operator leads', es: 'Leads del operador' }, href: '/dashboard/operator/leads' },
    ],
  },
  {
    keywords: ['swap', 'request', 'service', 'customer', 'bin full', 'container', 'cambio', 'servicio'],
    answer: {
      en: 'Customers can open their portal, choose the exact bin on their jobsite, pick a date and time, and submit a swap request. Dispatch sees it in requests/routes and can assign it to a driver.',
      es: 'Los clientes pueden abrir su portal, elegir el contenedor exacto en su sitio, seleccionar fecha y hora, y enviar una solicitud de cambio. Despacho la ve en solicitudes/rutas y puede asignarla a un conductor.',
    },
    links: [
      { label: { en: 'Customer bins', es: 'Contenedores del cliente' }, href: '/dashboard/customer/bins' },
      { label: { en: 'Request service', es: 'Solicitar servicio' }, href: '/dashboard/customer/request' },
      { label: { en: 'Operator requests', es: 'Solicitudes del operador' }, href: '/dashboard/operator/requests' },
    ],
  },
  {
    keywords: ['driver', 'route', 'eta', 'tracking', 'truck', 'uber', 'gps', 'ruta', 'conductor'],
    answer: {
      en: 'Drivers open routes, mark stops en route, arrived, and complete. Customers can see ETA/tracking status while dispatch keeps billing and bin locations synchronized.',
      es: 'Los conductores abren sus rutas y marcan cada parada como en camino, llegada y completada. Los clientes pueden ver el ETA y el estado de rastreo mientras despacho mantiene sincronizadas la facturación y la ubicación de los contenedores.',
    },
    links: [
      { label: { en: 'Routes', es: 'Rutas' }, href: '/dashboard/operator/routes' },
      { label: { en: 'Trucks', es: 'Camiones' }, href: '/dashboard/operator/trucks' },
      { label: { en: 'Customer tracking', es: 'Rastreo del cliente' }, href: '/dashboard/customer/tracking' },
    ],
  },
  {
    keywords: ['billing', 'invoice', 'balance', 'audit', 'irs', 'charge', 'factura', 'saldo'],
    answer: {
      en: 'Billing uses completed route stops and imported daily reports to create traceable invoice lines. Customers can view active balances and invoice breakdowns from their portal.',
      es: 'La facturación usa paradas completadas e informes diarios importados para crear líneas de factura trazables. Los clientes pueden ver saldos activos y desgloses de facturas desde su portal.',
    },
    links: [
      { label: { en: 'Operator billing', es: 'Facturación del operador' }, href: '/dashboard/operator/billing' },
      { label: { en: 'Customer billing', es: 'Facturación del cliente' }, href: '/dashboard/customer/billing' },
      { label: { en: 'Pricing setup', es: 'Configurar precios' }, href: '/dashboard/operator/pricing' },
    ],
  },
  {
    keywords: ['access code', 'login', 'account', 'portal', 'customer access', 'codigo', 'código', 'cuenta'],
    answer: {
      en: 'Operators create a customer portal code from the Clients page. The customer enters that code at signup or in the portal, which links them only to their own bins, requests, tracking, and invoices.',
      es: 'Los operadores crean un código de portal desde la página de clientes. El cliente ingresa ese código al registrarse o dentro del portal, y queda vinculado solo a sus propios contenedores, solicitudes, rastreo y facturas.',
    },
    links: [
      { label: { en: 'Clients', es: 'Clientes' }, href: '/dashboard/operator/clients' },
      { label: { en: 'Sign up', es: 'Crear cuenta' }, href: '/auth/signup' },
      { label: { en: 'Customer portal', es: 'Portal del cliente' }, href: '/dashboard/customer' },
    ],
  },
  {
    keywords: ['zip', 'coverage', 'territory', 'division', 'nationwide', 'lead matching', 'area', 'cobertura', 'territorio'],
    answer: {
      en: 'Coverage controls which operators receive leads. Set divisions by state, county, ZIP, or radius so leads route only to serviceable areas.',
      es: 'La cobertura controla qué operadores reciben leads. Configura divisiones por estado, condado, código postal o radio para que los leads solo lleguen a zonas que sí pueden atender.',
    },
    links: [
      { label: { en: 'Coverage', es: 'Cobertura' }, href: '/dashboard/operator/coverage' },
      { label: { en: 'Operator onboarding', es: 'Carga del operador' }, href: '/dashboard/operator/onboarding' },
    ],
  },
  {
    keywords: ['import', 'onboard', 'spreadsheet', 'excel', 'orlando report', 'file', 'csv', 'importar', 'archivo'],
    answer: {
      en: 'Use the onboarding import page to upload operational spreadsheets. The system maps clients, jobsites, bins, and service activity, then reports warnings so bad rows can be corrected before live use.',
      es: 'Usa la página de importación para subir hojas operativas. El sistema mapea clientes, sitios, contenedores y actividad de servicio, y muestra advertencias para corregir filas antes de usarlas en vivo.',
    },
    links: [
      { label: { en: 'Import data', es: 'Importar datos' }, href: '/dashboard/operator/import' },
      { label: { en: 'Equipment', es: 'Equipo' }, href: '/dashboard/operator/equipment' },
    ],
  },
  {
    keywords: ['map', 'pin', 'location', 'jobsite', 'equipment map', 'mapa'],
    answer: {
      en: 'The live map shows jobsite pins and equipment status. Bins that need swaps are highlighted so dispatch can prioritize service.',
      es: 'El mapa en vivo muestra pines de sitios y el estado del equipo. Los contenedores que necesitan cambio se resaltan para que despacho pueda priorizar el servicio.',
    },
    links: [
      { label: { en: 'Live map', es: 'Mapa en vivo' }, href: '/dashboard/operator/map' },
      { label: { en: 'Routes', es: 'Rutas' }, href: '/dashboard/operator/routes' },
    ],
  },
]

function formatTopic(topic: HelpTopic, language: AssistantLanguage): AssistantAnswer {
  return {
    answer: topic.answer[language],
    links: topic.links.map(link => ({ label: link.label[language], href: link.href })),
  }
}

export function answerSiteQuestion(input: string, language: AssistantLanguage = 'en'): AssistantAnswer {
  const question = input.trim().toLowerCase()
  if (!question) {
    return {
      answer: language === 'es'
        ? 'Pregúntame sobre cotizaciones, cambios de contenedores, rastreo en vivo, facturación, carga de datos, cobertura por códigos postales, acceso del cliente o rutas de conductores.'
        : 'Ask me about quotes, swaps, live tracking, billing, onboarding, coverage ZIPs, customer access, or driver routes.',
      links: [
        { label: language === 'es' ? 'Pedir cotización' : 'Get a quote', href: '/quotes' },
        { label: language === 'es' ? 'Iniciar sesión' : 'Sign in', href: '/auth/login' },
      ],
    }
  }

  const scored = topics
    .map(topic => ({
      topic,
      score: topic.keywords.reduce((sum, keyword) => sum + (question.includes(keyword) ? keyword.length : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)

  if (scored[0]?.score > 0) return formatTopic(scored[0].topic, language)

  return {
    answer: language === 'es'
      ? 'Puedo ayudarte a llegar a la herramienta correcta de SiteSync. Para clientes, empieza con contenedores, solicitudes, rastreo o facturación. Para operadores, empieza con leads, despacho/rutas, mapa, equipo, clientes, facturación o cobertura.'
      : 'I can help route you to the right SiteSync tool. For customers, start with bins, requests, tracking, or billing. For operators, start with leads, dispatch/routes, map, equipment, clients, billing, or coverage.',
    links: [
      { label: language === 'es' ? 'Portal del cliente' : 'Customer portal', href: '/dashboard/customer' },
      { label: language === 'es' ? 'Panel del operador' : 'Operator dashboard', href: '/dashboard/operator' },
      { label: language === 'es' ? 'Ayuda con cobertura' : 'Help with coverage', href: '/dashboard/operator/coverage' },
    ],
  }
}
