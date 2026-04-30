'use client'

import { useEffect, useRef, useState } from 'react'

type GooglePlace = {
  formatted_address?: string
  [key: string]: unknown
}

type GoogleAutocomplete = {
  addListener: (eventName: string, cb: () => void) => void
  getPlace: () => GooglePlace
}

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      event: { clearInstanceListeners: (instance: GoogleAutocomplete) => void }
      places: { Autocomplete: new (input: HTMLInputElement, options: object) => GoogleAutocomplete }
    }
  }
  initGoogleMaps?: () => void
}

interface Props {
  value: string
  onChange: (value: string, placeDetails?: GooglePlace) => void
  placeholder?: string
  className?: string
  restrictToUS?: boolean
}

let scriptLoaded = false
let scriptLoading = false
const callbacks: (() => void)[] = []

function loadGoogleMaps(apiKey: string, cb: () => void) {
  const mapsWindow = window as unknown as GoogleMapsWindow
  if (scriptLoaded || mapsWindow.google) {
    cb()
    return
  }
  callbacks.push(cb)
  if (scriptLoading) return
  scriptLoading = true
  mapsWindow.initGoogleMaps = () => {
    scriptLoaded = true
    callbacks.forEach(fn => fn())
    callbacks.length = 0
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&loading=async`
  script.async = true
  script.defer = true
  document.head.appendChild(script)
}

export default function AddressAutocomplete({ value, onChange, placeholder = 'Enter address...', className = '', restrictToUS = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null)
  const [ready, setReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''

  useEffect(() => {
    if (!apiKey) {
      setReady(true)
      return
    }
    loadGoogleMaps(apiKey, () => {
      const mapsWindow = window as unknown as GoogleMapsWindow
      setReady(true)
      if (!inputRef.current || !mapsWindow.google) return
      autocompleteRef.current = new mapsWindow.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: restrictToUS ? { country: 'us' } : undefined,
        fields: ['formatted_address', 'geometry', 'address_components', 'name'],
      })
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place?.formatted_address) onChange(place.formatted_address, place)
      })
    })
    return () => {
      const mapsWindow = window as unknown as GoogleMapsWindow
      if (autocompleteRef.current && mapsWindow.google) mapsWindow.google.maps.event.clearInstanceListeners(autocompleteRef.current)
    }
  }, [apiKey, onChange, restrictToUS])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={ready ? placeholder : 'Loading address search...'}
      className={className || 'input'}
      autoComplete="off"
    />
  )
}
