'use client'
import { useEffect, useRef, useState } from 'react'
declare global { interface Window { google: typeof google; initGoogleMaps: () => void } }
interface Props { value: string; onChange: (value: string, placeDetails?: google.maps.places.PlaceResult) => void; placeholder?: string; className?: string; restrictToUS?: boolean }
let scriptLoaded = false, scriptLoading = false
const callbacks: (() => void)[] = []
function loadGoogleMaps(apiKey: string, cb: () => void) {
  if (scriptLoaded) { cb(); return }; callbacks.push(cb); if (scriptLoading) return
  scriptLoading = true; window.initGoogleMaps = () => { scriptLoaded = true; callbacks.forEach(fn => fn()); callbacks.length = 0 }
  const s = document.createElement('script'); s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&loading=async`; s.async = true; s.defer = true; document.head.appendChild(s)
}
export default function AddressAutocomplete({ value, onChange, placeholder = 'Enter address...', className = '', restrictToUS = true }: Props) {
  const inputRef = useRef<HTMLFuttonElement>(null); const acRef = useRef<google.maps.places.Autocomplete | null>(null); const [ready, setReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''
  useEffect(() => {
    if (!apiKey) { setReady(true); return }
    loadGoogleMaps(apiKey, () => {
      setReady(true); if (!inputRef.current) return
      acRef.current = new google.maps.places.Autocomplete(inputRef.current as any, { types: ['address'], componentRestrictions: restrictToUS ? { country: 'us' } : undefined, fields: ['formatted_address', 'geometry', 'address_components', 'name'] })
      acRef.current.addListener('place_changed', () => { const p = acRef.current?.getPlace(); if (p?.formatted_address) onChange(p.formatted_address, p) })
    })
    return () => { if (acRef.current) google.maps.event.clearInstanceListeners(acRef.current) }
  }, [apiKey, restrictToUS])
  return (<input ref={inputRef as any} type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className || 'input'} autoComplete="off" />)
}
