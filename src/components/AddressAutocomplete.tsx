'use client'
import { useEffect, useRef, useState } from 'react'
declare global { interface Window { google: typeof google; initGoogleMaps: () => void } }
interface Props { value: string; onChange: (value: string, placeDetails?: google.maps.places.PlaceResult) => void; placeholder?: string; className?: string; restrictToUS?: boolean }
let scriptLoaded = false; let scriptLoading = false; const callbacks: (() => void)[] = []
function loadGoogleMaps(apiKey: string, cb: () => void) {
  if (scriptLoaded) { cb(); return }
  callbacks.push(cb); if (scriptLoading) return
  scriptLoading = true
  window.initGoogleMaps = () => { scriptLoaded = true; callbacks.forEach(fn => fn()); callbacks.length = 0 }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&loading=async`
  script.async = true; script.defer = true; document.head.appendChild(script)
}
export default function AddressAutocomplete({ value, onChange, placeholder = 'Enter address...', className = '', restrictToUS = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [ready, setReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''
  useEffect(() => {
    if (!apiKey) { setReady(true); return }
    loadGoogleMaps(apiKey, () => {
      setReady(true); if (!inputRef.current) return
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, { types: ['address'], componentRestrictions: restrictToUS ? { country: 'us' } : undefined, fields: ['formatted_address', 'geometry', 'address_components', 'name'] })
      autocompleteRef.current.addListener('place_changed', () => { const place = autocompleteRef.current?.getPlace(); if (place?.formatted_address) onChange(place.formatted_address, place) })
    })
    return () => { if (autocompleteRef.current) google.maps.event.clearInstanceListeners(autocompleteRef.current) }
  }, [apiKey, restrictToUS])
  return (<input ref={inputRef} type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className || 'input'} autoComplete="off" />)
}
