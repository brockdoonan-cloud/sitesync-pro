'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'es'

type Dictionary = Record<string, string>

const translations: Record<Language, Dictionary> = {
  en: {
    language: 'Language',
    english: 'English',
    spanish: 'Espa\u00f1ol',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signUp: 'Sign up',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    company: 'Company',
    optional: 'optional',
    submitAnother: 'Submit Another',
    backHome: 'Back to Home',
    welcomeBack: 'Welcome back',
    signInSubtitle: 'Sign in to your account',
    allFieldsRequired: 'Please fill in all fields',
    signingIn: 'Signing in...',
    noAccount: "Don't have an account?",
    createAccount: 'Create Account',
    createAccountTitle: 'Create your account',
    createAccountSubtitle: 'Manage jobsite equipment from one place',
    requiredFields: 'Please fill in all required fields',
    creating: 'Creating...',
    alreadyAccount: 'Already have an account?',
    checkEmail: 'Check your email',
    confirmEmail: 'Confirm your account, then sign in to continue.',
    backToSignIn: 'Back to Sign In',
    homeTitle: 'Equipment Service, Streamlined',
    homeSubtitle: 'Real-time scheduling, live bin tracking, and route optimization for jobsite equipment rentals.',
    getQuote: 'Get a Quote',
    liveBinTracking: 'Live Bin Tracking',
    swapPlanning: 'Swap Planning',
    leadCapture: 'Lead Capture',
    quotesTitle: 'Get Equipment Quotes from Local Providers',
    quotesSubtitle: 'Dumpsters, washout containers, portable toilets, tanks and more.',
    contactInfo: '1. Your Contact Info',
    phone: 'Phone',
    deliveryLocation: '2. Delivery Location',
    exactAddress: 'Exact Address',
    city: 'City',
    zip: 'ZIP',
    equipmentNeeded: '3. Equipment Needed',
    equipmentType: 'Equipment Type',
    dumpsterSize: 'Dumpster Size',
    jobType: 'Job Type',
    timeframe: '4. Timeframe',
    startDate: 'Start Date',
    endDate: 'End Date',
    notes: 'Notes',
    notesPlaceholder: 'Gate code, site access details, weight restrictions...',
    quoteRequired: 'Please fill in the exact address, location, equipment type, and job type.',
    contactRequired: 'Please provide your name and email.',
    requestSent: 'Request Sent!',
    requestSentToProviders: 'Your request was sent to local providers in',
    quotesSentTo: 'Quotes will be sent to',
    linkCopied: 'Link Copied',
    shareQuoteLink: 'Share Quote Link',
    sendingProviders: 'Sending to Providers...',
    getFreeQuotes: 'Get Free Quotes',
    noSpam: 'No spam - providers only contact you about your request. Free to use.',
    customerPortal: 'Customer Portal',
    liveTracking: 'Live Tracking',
    trackingSubtitle: 'Follow active service requests from pending to completion.',
    pending: 'Pending',
    scheduled: 'Scheduled',
    enRoute: 'En Route',
    completed: 'Completed',
    loadingRequests: 'Loading your active requests...',
    noActiveRequests: 'No active service requests',
    noActiveRequestsCopy: 'When a delivery, swap, pickup, or other request is scheduled, live status and location details will appear here.',
    jobsiteMap: 'Jobsite Map',
    selectAddress: 'Select a request with an address.',
    selectedRequest: 'Selected Request',
    status: 'Status',
    equipment: 'Equipment',
    date: 'Date',
    datePending: 'Date pending',
    addressPending: 'Jobsite address pending',
    signInTracking: 'Please sign in to view live tracking.',
    requestService: 'Request Service',
    requestServiceSubtitle: 'Tell us what you need, where, and when',
    serviceType: 'Service Type',
    jobsiteAddress: 'Jobsite Address',
    binNumber: 'Bin #',
    preferredDate: 'Preferred Date',
    preferredTime: 'Preferred Time',
    additionalNotes: 'Additional Notes',
    serviceRequired: 'Please select a service type and enter the jobsite address',
    requestSubmitted: 'Request Submitted!',
    confirmDriver: "We'll confirm shortly and assign a driver.",
    viewServices: 'View Services',
    submitting: 'Submitting...',
    submitServiceRequest: 'Submit Service Request',
    overview: 'Overview',
    track: 'Track',
    setup: 'Setup',
    import: 'Import',
    leads: 'Leads',
    requests: 'Requests',
    jobs: 'Jobs',
    routes: 'Routes',
    map: 'Map',
    trucks: 'Trucks',
    clients: 'Clients',
    billing: 'Billing',
    equipmentMap: 'Equipment Map',
    equipmentMapSubtitle: 'See every deployed bin by jobsite and identify the ones that need swaps.',
    allSites: 'All Sites',
    needsSwap: 'Needs Swap',
    noSwap: 'No Swap',
    refresh: 'Refresh',
    demoModeMap: 'Demo mode is showing sample Orlando jobsites because live jobsite rows were not returned. Real Supabase data will replace this automatically.',
    jobsites: 'Jobsites',
    equipmentOnSites: 'Equipment On Sites',
    okayForNow: 'Okay For Now',
    selectJobsite: 'Select a jobsite',
    noAddress: 'No address on file',
    onSite: 'On Site',
    equipmentAtSelectedSite: 'Equipment at selected site',
    noEquipmentLinked: 'No equipment linked to this site yet.',
    swapQueue: 'Swap queue',
    swapNeeded: 'Swap needed',
    needsSwapSentence: 'needs swap',
    noSwapsNeeded: 'No swaps needed in the current view.',
    refreshingMap: 'Refreshing map data...',
    unknown: 'unknown',
    unassigned: 'Unassigned',
    location: 'Location',
    lastServiced: 'Last serviced',
    serviceRequest: 'Service Request',
    scheduledLabel: 'Scheduled',
    notesLabel: 'Notes',
    mapDetailsPending: 'Map details will appear once a jobsite address is assigned.',
    swapOut: 'Swap Out',
    swapOutDesc: 'Exchange full container for empty',
    pickupRemoval: 'Pickup / Removal',
    pickupRemovalDesc: 'Remove equipment from jobsite',
    newDelivery: 'New Delivery',
    newDeliveryDesc: 'Bring new equipment to site',
    pumpOut: 'Pump Out',
    pumpOutDesc: 'Water removal service',
    emergency: 'Emergency',
    emergencyDesc: 'Urgent service needed ASAP',
    morning: 'Morning (7am-11am)',
    midday: 'Midday (11am-2pm)',
    afternoon: 'Afternoon (2pm-5pm)',
    anyTime: 'Any time',
    gateCodePlaceholder: 'Gate code, location on site, overloaded bin...',
  },
  es: {
    language: 'Idioma',
    english: 'English',
    spanish: 'Espa\u00f1ol',
    signIn: 'Iniciar sesi\u00f3n',
    signOut: 'Cerrar sesi\u00f3n',
    signUp: 'Crear cuenta',
    email: 'Correo electr\u00f3nico',
    password: 'Contrase\u00f1a',
    fullName: 'Nombre completo',
    company: 'Empresa',
    optional: 'opcional',
    submitAnother: 'Enviar otro',
    backHome: 'Volver al inicio',
    welcomeBack: 'Bienvenido de nuevo',
    signInSubtitle: 'Inicia sesi\u00f3n en tu cuenta',
    allFieldsRequired: 'Por favor completa todos los campos',
    signingIn: 'Iniciando sesi\u00f3n...',
    noAccount: '\u00bfNo tienes una cuenta?',
    createAccount: 'Crear cuenta',
    createAccountTitle: 'Crea tu cuenta',
    createAccountSubtitle: 'Administra equipo de obra desde un solo lugar',
    requiredFields: 'Por favor completa todos los campos requeridos',
    creating: 'Creando...',
    alreadyAccount: '\u00bfYa tienes una cuenta?',
    checkEmail: 'Revisa tu correo',
    confirmEmail: 'Confirma tu cuenta y luego inicia sesi\u00f3n para continuar.',
    backToSignIn: 'Volver a iniciar sesi\u00f3n',
    homeTitle: 'Servicio de equipo, simplificado',
    homeSubtitle: 'Programaci\u00f3n en tiempo real, rastreo de contenedores y optimizaci\u00f3n de rutas para equipo de obra.',
    getQuote: 'Pedir cotizaci\u00f3n',
    liveBinTracking: 'Rastreo de contenedores',
    swapPlanning: 'Plan de cambios',
    leadCapture: 'Captura de clientes',
    quotesTitle: 'Recibe cotizaciones de proveedores locales',
    quotesSubtitle: 'Dumpsters, contenedores de lavado, ba\u00f1os port\u00e1tiles, tanques y m\u00e1s.',
    contactInfo: '1. Tu informaci\u00f3n de contacto',
    phone: 'Tel\u00e9fono',
    deliveryLocation: '2. Ubicaci\u00f3n de entrega',
    exactAddress: 'Direcci\u00f3n exacta',
    city: 'Ciudad',
    zip: 'C\u00f3digo postal',
    equipmentNeeded: '3. Equipo necesario',
    equipmentType: 'Tipo de equipo',
    dumpsterSize: 'Tama\u00f1o del dumpster',
    jobType: 'Tipo de trabajo',
    timeframe: '4. Fechas',
    startDate: 'Fecha de inicio',
    endDate: 'Fecha final',
    notes: 'Notas',
    notesPlaceholder: 'C\u00f3digo de puerta, acceso al sitio, restricciones de peso...',
    quoteRequired: 'Por favor completa la direcci\u00f3n exacta, ubicaci\u00f3n, tipo de equipo y tipo de trabajo.',
    contactRequired: 'Por favor escribe tu nombre y correo electr\u00f3nico.',
    requestSent: '\u00a1Solicitud enviada!',
    requestSentToProviders: 'Tu solicitud fue enviada a proveedores locales en',
    quotesSentTo: 'Las cotizaciones se enviar\u00e1n a',
    linkCopied: 'Enlace copiado',
    shareQuoteLink: 'Compartir enlace',
    sendingProviders: 'Enviando a proveedores...',
    getFreeQuotes: 'Recibir cotizaciones gratis',
    noSpam: 'Sin spam - los proveedores solo te contactar\u00e1n sobre tu solicitud. Gratis.',
    customerPortal: 'Portal del cliente',
    liveTracking: 'Rastreo en vivo',
    trackingSubtitle: 'Sigue tus solicitudes activas desde pendiente hasta completada.',
    pending: 'Pendiente',
    scheduled: 'Programado',
    enRoute: 'En camino',
    completed: 'Completado',
    loadingRequests: 'Cargando tus solicitudes activas...',
    noActiveRequests: 'No hay solicitudes activas',
    noActiveRequestsCopy: 'Cuando se programe una entrega, cambio, recogida u otro servicio, ver\u00e1s el estado y la ubicaci\u00f3n aqu\u00ed.',
    jobsiteMap: 'Mapa del sitio',
    selectAddress: 'Selecciona una solicitud con direcci\u00f3n.',
    selectedRequest: 'Solicitud seleccionada',
    status: 'Estado',
    equipment: 'Equipo',
    date: 'Fecha',
    datePending: 'Fecha pendiente',
    addressPending: 'Direcci\u00f3n del sitio pendiente',
    signInTracking: 'Por favor inicia sesi\u00f3n para ver el rastreo.',
    requestService: 'Solicitar servicio',
    requestServiceSubtitle: 'Dinos qu\u00e9 necesitas, d\u00f3nde y cu\u00e1ndo',
    serviceType: 'Tipo de servicio',
    jobsiteAddress: 'Direcci\u00f3n del sitio',
    binNumber: 'Contenedor #',
    preferredDate: 'Fecha preferida',
    preferredTime: 'Hora preferida',
    additionalNotes: 'Notas adicionales',
    serviceRequired: 'Selecciona un tipo de servicio y escribe la direcci\u00f3n del sitio',
    requestSubmitted: '\u00a1Solicitud enviada!',
    confirmDriver: 'Confirmaremos pronto y asignaremos un conductor.',
    viewServices: 'Ver servicios',
    submitting: 'Enviando...',
    submitServiceRequest: 'Enviar solicitud de servicio',
    overview: 'Resumen',
    track: 'Rastrear',
    setup: 'Configuraci\u00f3n',
    import: 'Importar',
    leads: 'Clientes potenciales',
    requests: 'Solicitudes',
    jobs: 'Trabajos',
    routes: 'Rutas',
    map: 'Mapa',
    trucks: 'Camiones',
    clients: 'Clientes',
    billing: 'Facturaci\u00f3n',
    equipmentMap: 'Mapa de equipo',
    equipmentMapSubtitle: 'Ve cada contenedor desplegado por sitio e identifica los que necesitan cambio.',
    allSites: 'Todos los sitios',
    needsSwap: 'Necesita cambio',
    noSwap: 'Sin cambio',
    refresh: 'Actualizar',
    demoModeMap: 'El modo demo muestra sitios de Orlando porque no se devolvieron filas de sitios activos. Los datos reales de Supabase los reemplazar\u00e1n autom\u00e1ticamente.',
    jobsites: 'Sitios',
    equipmentOnSites: 'Equipo en sitios',
    okayForNow: 'Bien por ahora',
    selectJobsite: 'Selecciona un sitio',
    noAddress: 'Sin direcci\u00f3n registrada',
    onSite: 'En sitio',
    equipmentAtSelectedSite: 'Equipo en el sitio seleccionado',
    noEquipmentLinked: 'Todav\u00eda no hay equipo vinculado a este sitio.',
    swapQueue: 'Lista de cambios',
    swapNeeded: 'Cambio necesario',
    needsSwapSentence: 'necesita cambio',
    noSwapsNeeded: 'No se necesitan cambios en la vista actual.',
    refreshingMap: 'Actualizando datos del mapa...',
    unknown: 'desconocido',
    unassigned: 'Sin asignar',
    location: 'Ubicaci\u00f3n',
    lastServiced: '\u00daltimo servicio',
    serviceRequest: 'Solicitud de servicio',
    scheduledLabel: 'Programado',
    notesLabel: 'Notas',
    mapDetailsPending: 'Los detalles del mapa aparecer\u00e1n cuando se asigne una direcci\u00f3n al sitio.',
    swapOut: 'Cambiar contenedor',
    swapOutDesc: 'Cambiar contenedor lleno por uno vac\u00edo',
    pickupRemoval: 'Recogida / retiro',
    pickupRemovalDesc: 'Retirar equipo del sitio',
    newDelivery: 'Nueva entrega',
    newDeliveryDesc: 'Llevar equipo nuevo al sitio',
    pumpOut: 'Bombeo',
    pumpOutDesc: 'Servicio de retiro de agua',
    emergency: 'Emergencia',
    emergencyDesc: 'Servicio urgente lo antes posible',
    morning: 'Ma\u00f1ana (7am-11am)',
    midday: 'Mediod\u00eda (11am-2pm)',
    afternoon: 'Tarde (2pm-5pm)',
    anyTime: 'Cualquier hora',
    gateCodePlaceholder: 'C\u00f3digo de puerta, ubicaci\u00f3n en el sitio, contenedor sobrecargado...',
  },
}

const exactSpanishPhrases: Record<string, string> = {
  ...Object.fromEntries(Object.keys(translations.en).map(key => [translations.en[key], translations.es[key]])),
  'Operator Dashboard': 'Panel de operador',
  'Operations overview': 'Resumen de operaciones',
  'Setup Real Data': 'Configurar datos reales',
  'Onboard clients, jobsites, bins, and balances': 'Carga clientes, sitios, contenedores y saldos',
  'Bulk Import': 'Importaci\u00f3n masiva',
  'Drag in Excel reports for mass onboarding': 'Arrastra reportes de Excel para carga masiva',
  'Active service jobs': 'Trabajos de servicio activos',
  'Quote Leads': 'Clientes potenciales de cotizaci\u00f3n',
  'New quote requests': 'Nuevas solicitudes de cotizaci\u00f3n',
  'Bins and containers': 'Contenedores y equipo',
  'Swap status by jobsite': 'Estado de cambios por sitio',
  'Client accounts': 'Cuentas de clientes',
  'Service requests': 'Solicitudes de servicio',
  'Driver routes': 'Rutas de conductores',
  'Invoices and payments': 'Facturas y pagos',
  'Active Jobs': 'Trabajos activos',
  'New Leads': 'Nuevos clientes',
  'Bins Deployed': 'Contenedores desplegados',
  'Bins Available': 'Contenedores disponibles',
  'Welcome back': 'Bienvenido de nuevo',
  'Active Requests': 'Solicitudes activas',
  'Tracked Bins': 'Contenedores rastreados',
  'Schedule swap, pickup, or delivery': 'Programa cambio, recogida o entrega',
  'Track confirmed service': 'Rastrea servicio confirmado',
  'Recent Requests': 'Solicitudes recientes',
  'No service requests yet.': 'Todav\u00eda no hay solicitudes de servicio.',
  'Jobs': 'Trabajos',
  "Today's schedule and upcoming jobs": 'Programa de hoy y trabajos pr\u00f3ximos',
  'Today': 'Hoy',
  'Upcoming': 'Pr\u00f3ximos',
  'No jobs today.': 'No hay trabajos hoy.',
  'No upcoming jobs.': 'No hay trabajos pr\u00f3ximos.',
  'Address': 'Direcci\u00f3n',
  'Customer': 'Cliente',
  'Unassigned': 'Sin asignar',
  'Billing': 'Facturaci\u00f3n',
  'Billing & Audit Trace': 'Facturaci\u00f3n y trazabilidad de auditor\u00eda',
  'Daily invoice lookup, balance review, source-file traceability, and service reconciliation.': 'Consulta diaria de facturas, revisi\u00f3n de saldos, trazabilidad de archivos fuente y conciliaci\u00f3n de servicios.',
  'Audit note: SiteSync can preserve source files, line-level hashes, invoice totals, and service traces. Final tax treatment, retention policy, and IRS response should still be reviewed by your CPA.': 'Nota de auditor\u00eda: SiteSync puede conservar archivos fuente, hashes por l\u00ednea, totales de factura y rastros de servicio. El tratamiento fiscal final, la pol\u00edtica de retenci\u00f3n y la respuesta al IRS deben ser revisados por tu CPA.',
  'Day Revenue': 'Ingresos del d\u00eda',
  'Open Invoices': 'Facturas abiertas',
  'Service Events': 'Eventos de servicio',
  'Export Day': 'Exportar d\u00eda',
  'Drop billing export here': 'Suelta el reporte de facturaci\u00f3n aqu\u00ed',
  'Supports reports like Report_from_Atlantic_Concrete_Washout,_Inc.xlsx with Type, Date, Num, Memo, Item, Qty, Sales Price, Amount, and Balance columns.': 'Soporta reportes como Report_from_Atlantic_Concrete_Washout,_Inc.xlsx con columnas Type, Date, Num, Memo, Item, Qty, Sales Price, Amount y Balance.',
  'Source Trace Preview': 'Vista previa de trazabilidad',
  'Save Billing Trace': 'Guardar trazabilidad de facturaci\u00f3n',
  'Saving...': 'Guardando...',
  'Invoice': 'Factura',
  'Client / Project': 'Cliente / proyecto',
  'Memo / Item': 'Memo / art\u00edculo',
  'Amount': 'Importe',
  'Balance': 'Saldo',
  'Trace': 'Rastro',
  'Invoices for': 'Facturas para',
  'Service Trace for': 'Rastro de servicio para',
  'Loading billing records...': 'Cargando registros de facturaci\u00f3n...',
  'No invoices found for this day.': 'No se encontraron facturas para este d\u00eda.',
  'No service activity found for this day.': 'No se encontr\u00f3 actividad de servicio para este d\u00eda.',
  'Review invoices, active balances, and customer billing actions.': 'Revisa facturas, saldos activos y acciones de facturaci\u00f3n.',
  'Add Balance': 'Agregar saldo',
  'Invoices': 'Facturas',
  'Active Balance': 'Saldo activo',
  'Overdue': 'Vencido',
  'Paid': 'Pagado',
  'Client not linked': 'Cliente no vinculado',
  'Send': 'Enviar',
  'No email': 'Sin correo',
  'No invoices found.': 'No se encontraron facturas.',
  'Clients': 'Clientes',
  'Customer accounts linked to jobsites and equipment.': 'Cuentas de clientes vinculadas a sitios y equipo.',
  'Unnamed client': 'Cliente sin nombre',
  'Contact': 'Contacto',
  'Phone': 'Tel\u00e9fono',
  'No clients found.': 'No se encontraron clientes.',
  'Track bins, availability, and swap needs.': 'Rastrea contenedores, disponibilidad y cambios necesarios.',
  'Total Units': 'Unidades totales',
  'Deployed': 'Desplegados',
  'Available': 'Disponibles',
  'Unit': 'Unidad',
  'Last Service': '\u00daltimo servicio',
  'No equipment found.': 'No se encontr\u00f3 equipo.',
  'Trucks': 'Camiones',
  'Fleet availability and driver assignments.': 'Disponibilidad de flota y asignaci\u00f3n de conductores.',
  'Unassigned driver': 'Conductor sin asignar',
  'No trucks found.': 'No se encontraron camiones.',
  'Service Requests': 'Solicitudes de servicio',
  'Review and manage all incoming service requests': 'Revisa y administra todas las solicitudes entrantes',
  'Service request': 'Solicitud de servicio',
  'No address': 'Sin direcci\u00f3n',
  'Route Optimizer': 'Optimizador de rutas',
  'Prioritized driver route for active jobsites and bins that need swaps.': 'Ruta priorizada para sitios activos y contenedores que necesitan cambio.',
  'Swap Route': 'Ruta de cambios',
  'All Active': 'Todos activos',
  'Active Stops': 'Paradas activas',
  'Bins On Route': 'Contenedores en ruta',
  'Swap Bins': 'Contenedores para cambio',
  'Est. Miles': 'Millas estimadas',
  'No route stops found': 'No se encontraron paradas',
  'Import jobsites and equipment, or mark bins as full/needs service to build the swap route.': 'Importa sitios y equipo, o marca contenedores como llenos/necesitan servicio para crear la ruta.',
  'active': 'activo',
  'mi from previous': 'mi desde anterior',
  'bins on site': 'contenedores en sitio',
  'need swap': 'necesitan cambio',
  'Navigate': 'Navegar',
  'Driver route': 'Ruta del conductor',
  'Stops are ordered from the Orlando yard by a priority-plus-distance pass: urgent swap bins first, then nearby jobsites to reduce drive time.': 'Las paradas se ordenan desde el patio de Orlando por prioridad y distancia: primero cambios urgentes, luego sitios cercanos para reducir manejo.',
  'Open Optimized Route': 'Abrir ruta optimizada',
  'Google Maps supports a limited number of stops per route link, so this sends the first 9 highest-priority stops.': 'Google Maps permite un n\u00famero limitado de paradas por enlace, por eso env\u00eda las primeras 9 de mayor prioridad.',
  'No bins currently need swaps.': 'Actualmente ning\u00fan contenedor necesita cambio.',
  'Operations Onboarding': 'Carga inicial de operaciones',
  'Load real clients, jobsites, bins, active service work, and starting balances.': 'Carga clientes reales, sitios, contenedores, servicios activos y saldos iniciales.',
  'Client Account': 'Cuenta de cliente',
  'Active Jobsite': 'Sitio activo',
  'Bin / Equipment': 'Contenedor / equipo',
  'Active Service / Tracking': 'Servicio activo / rastreo',
  'Starting Balance / Invoice': 'Saldo inicial / factura',
  'Save Client': 'Guardar cliente',
  'Save Jobsite': 'Guardar sitio',
  'Save Equipment': 'Guardar equipo',
  'Save Service Request': 'Guardar solicitud de servicio',
  'Save Balance': 'Guardar saldo',
  'Bulk Office Import': 'Importaci\u00f3n masiva de oficina',
  'Drag in Orlando-style Excel reports to onboard hundreds of bins, jobsites, customers, and active services at once.': 'Arrastra reportes de Excel estilo Orlando para cargar cientos de contenedores, sitios, clientes y servicios activos a la vez.',
  'Drop an Excel report here': 'Suelta un reporte de Excel aqu\u00ed',
  'Preview': 'Vista previa',
  'Import All': 'Importar todo',
  'Importing...': 'Importando...',
  'Import warnings': 'Advertencias de importaci\u00f3n',
  'Rows': 'Filas',
  'Bins': 'Contenedores',
  'Service Records': 'Registros de servicio',
  'Project': 'Proyecto',
  'Operation': 'Operaci\u00f3n',
  'Equipment rental requests from potential customers': 'Solicitudes de renta de equipo de posibles clientes',
  'View Public Form': 'Ver formulario p\u00fablico',
  'All Leads': 'Todos los clientes',
  'No leads yet': 'Todav\u00eda no hay clientes potenciales',
  'Update Status': 'Actualizar estado',
  'Send SMS via Quo': 'Enviar SMS con Quo',
  'ETA / Schedule / Quote': 'ETA / Programa / Cotizaci\u00f3n',
  'Confirm Order': 'Confirmar orden',
  'Send Schedule': 'Enviar programa',
  'ETA Update': 'Actualizar ETA',
  'Mark Complete': 'Marcar completo',
  'Email Customer': 'Enviar correo',
  'Call': 'Llamar',
  'Loading address search...': 'Cargando b\u00fasqueda de direcciones...',
  'Enter address...': 'Ingresa direcci\u00f3n...',
}

const spanishPrefixPhrases: Array<[string, string]> = [
  ['Welcome back, ', 'Bienvenido de nuevo, '],
  ['Address: ', 'Direcci\u00f3n: '],
  ['Customer: ', 'Cliente: '],
  ['Scheduled: ', 'Programado: '],
  ['Contact: ', 'Contacto: '],
  ['Email: ', 'Correo: '],
  ['Phone: ', 'Tel\u00e9fono: '],
  ['Status: ', 'Estado: '],
  ['Last serviced ', '\u00daltimo servicio '],
  ['Invoices for ', 'Facturas para '],
  ['Service Trace for ', 'Rastro de servicio para '],
  ['Parsed ', 'Procesadas '],
  ['Saved ', 'Guardadas '],
]

const englishPhrases = Object.fromEntries(Object.entries(exactSpanishPhrases).map(([english, spanish]) => [spanish, english]))
const englishPrefixPhrases = spanishPrefixPhrases.map(([english, spanish]) => [spanish, english] as [string, string])

type TranslatableText = Text & { __sitesyncOriginal?: string }
type TranslatableElement = HTMLElement & { __sitesyncOriginalAttrs?: Record<string, string> }

function translatePhrase(value: string, language: Language) {
  if (language === 'en') {
    const trimmed = value.trim()
    const translated = englishPhrases[trimmed]
    if (translated) return value.replace(trimmed, translated)
    const prefix = englishPrefixPhrases.find(([source]) => trimmed.startsWith(source))
    return prefix ? value.replace(prefix[0], prefix[1]) : value
  }
  const trimmed = value.trim()
  const translated = exactSpanishPhrases[trimmed]
  if (translated) return value.replace(trimmed, translated)
  const prefix = spanishPrefixPhrases.find(([source]) => trimmed.startsWith(source))
  return prefix ? value.replace(prefix[0], prefix[1]) : value
}

function applyDomLanguage(language: Language) {
  if (typeof document === 'undefined') return

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest('[data-no-translate="true"]')) return NodeFilter.FILTER_REJECT
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  let node = walker.nextNode() as TranslatableText | null
  while (node) {
    if (!node.__sitesyncOriginal) node.__sitesyncOriginal = node.textContent || ''
    const nextValue = translatePhrase(node.__sitesyncOriginal, language)
    if (node.textContent !== nextValue) node.textContent = nextValue
    node = walker.nextNode() as TranslatableText | null
  }

  document.querySelectorAll<TranslatableElement>('input, textarea, [title], [aria-label]').forEach(element => {
    const attrs = ['placeholder', 'title', 'aria-label']
    element.__sitesyncOriginalAttrs ||= {}
    attrs.forEach(attr => {
      const value = element.getAttribute(attr)
      if (!value) return
      element.__sitesyncOriginalAttrs![attr] ||= value
      const nextValue = translatePhrase(element.__sitesyncOriginalAttrs![attr], language)
      if (value !== nextValue) element.setAttribute(attr, nextValue)
    })
  })
}

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const stored = window.localStorage.getItem('sitesync-language')
    if (stored === 'en' || stored === 'es') {
      setLanguageState(stored)
      return
    }
    const browserLanguage = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
    setLanguageState(browserLanguage)
  }, [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      setLanguageState(nextLanguage)
      window.localStorage.setItem('sitesync-language', nextLanguage)
      document.documentElement.lang = nextLanguage
    },
    t(key) {
      return translations[language][key] || translations.en[key] || key
    },
  }), [language])

  useEffect(() => {
    document.documentElement.lang = language
    applyDomLanguage(language)
    const observer = new MutationObserver(() => applyDomLanguage(language))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] })
    return () => observer.disconnect()
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
