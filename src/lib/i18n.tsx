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
  },
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
    if (stored === 'en' || stored === 'es') setLanguageState(stored)
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
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
