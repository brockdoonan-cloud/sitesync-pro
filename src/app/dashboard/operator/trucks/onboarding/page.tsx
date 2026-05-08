'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_TRUCK_TRACKING_MAPPING,
  TRACKING_FIELD_LABELS,
  TRACKING_PROVIDER_PRESETS,
  extractTrackingRecords,
  parseDelimitedRecords,
  type TruckTrackingMapping,
} from '@/lib/truckTracking'

type Integration = {
  id: string
  provider_key: string
  provider_name: string
  connection_type: 'api' | 'webhook' | 'csv' | 'manual'
  status: string
  api_base_url?: string | null
  auth_type?: string | null
  credential_reference?: string | null
  external_account_id?: string | null
  webhook_token: string
  field_mapping: TruckTrackingMapping
  last_sync_at?: string | null
  created_at: string
}

const sampleCsv = `truck_number,external_vehicle_id,driver_name,lat,lng,recorded_at,speed_mph,heading_degrees,ignition,status,license_plate
12,SAM-12,Mike R.,28.5384,-81.3689,2026-05-08T09:15:00-04:00,34,188,true,en_route,ACW12
18,SAM-18,Carlos M.,28.4332,-81.2983,2026-05-08T09:16:00-04:00,0,90,true,servicing,ACW18`

function mappingEntries(mapping: TruckTrackingMapping) {
  return Object.keys(TRACKING_FIELD_LABELS).map(key => key as keyof TruckTrackingMapping).map(key => ({
    key,
    label: TRACKING_FIELD_LABELS[key],
    value: mapping[key],
  }))
}

function statusClass(status: string) {
  if (status === 'connected') return 'border-green-500/30 bg-green-500/10 text-green-300'
  if (status === 'testing') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  if (status === 'error') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-slate-700/60 bg-slate-800/60 text-slate-300'
}

export default function TruckTrackingOnboardingPage() {
  const [origin, setOrigin] = useState('')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [providerKey, setProviderKey] = useState('custom')
  const [providerName, setProviderName] = useState('Other / Custom Provider')
  const [connectionType, setConnectionType] = useState<'api' | 'webhook' | 'csv' | 'manual'>('csv')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [authType, setAuthType] = useState('API key / bearer token')
  const [credentialReference, setCredentialReference] = useState('')
  const [externalAccountId, setExternalAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [mapping, setMapping] = useState<TruckTrackingMapping>(DEFAULT_TRUCK_TRACKING_MAPPING)
  const [sampleInput, setSampleInput] = useState(sampleCsv)
  const [sourceFileName, setSourceFileName] = useState('truck-gps-sample.csv')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedPreset = useMemo(() => TRACKING_PROVIDER_PRESETS.find(provider => provider.key === providerKey) || TRACKING_PROVIDER_PRESETS.at(-1)!, [providerKey])
  const records = useMemo(() => {
    const trimmed = sampleInput.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return extractTrackingRecords(JSON.parse(trimmed))
      } catch {
        return []
      }
    }
    return parseDelimitedRecords(trimmed)
  }, [sampleInput])
  const webhookUrl = selectedIntegration ? `${origin}/api/truck-tracking/webhook/${selectedIntegration.webhook_token}` : ''

  const loadIntegrations = useCallback(async () => {
    const response = await fetch('/api/truck-tracking/integrations')
    const payload = await response.json().catch(() => ({}))
    if (response.ok) setIntegrations(payload.integrations || [])
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
    loadIntegrations()
  }, [loadIntegrations])

  const applyPreset = (key: string) => {
    const preset = TRACKING_PROVIDER_PRESETS.find(provider => provider.key === key) || TRACKING_PROVIDER_PRESETS.at(-1)!
    setProviderKey(preset.key)
    setProviderName(preset.name)
    setConnectionType(preset.connectionTypes[0])
    setMapping(preset.mapping)
  }

  const saveIntegration = async () => {
    setSaving(true)
    setMessage('')
    setError('')

    const response = await fetch('/api/truck-tracking/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_key: providerKey,
        provider_name: providerName,
        connection_type: connectionType,
        api_base_url: apiBaseUrl || null,
        auth_type: authType || null,
        credential_reference: credentialReference || null,
        external_account_id: externalAccountId || null,
        field_mapping: mapping,
        notes: notes || null,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      setError(payload.error || 'Could not save tracking provider.')
      return
    }

    setSelectedIntegration(payload.integration)
    setMessage('Tracking provider saved. You can now test a file import or copy the webhook URL to your GPS vendor.')
    await loadIntegrations()
  }

  const testImport = async () => {
    const integration = selectedIntegration || integrations[0]
    if (!integration) {
      setError('Save a tracking provider before importing sample GPS rows.')
      return
    }
    if (!records.length) {
      setError('Paste JSON or CSV rows with truck number, latitude, and longitude.')
      return
    }

    setImporting(true)
    setMessage('')
    setError('')
    const response = await fetch('/api/truck-tracking/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integration_id: integration.id,
        field_mapping: mapping,
        records,
        source_file_name: sourceFileName || 'truck-gps-import',
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setImporting(false)

    if (!response.ok) {
      setError(payload.error || 'Truck GPS import failed.')
      return
    }

    setMessage(`Imported ${payload.imported} truck GPS row(s). ${payload.skipped ? `${payload.skipped} skipped.` : 'No skipped rows.'}`)
    await loadIntegrations()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/operator/trucks" className="text-sm text-sky-400 hover:underline">Back to trucks</Link>
          <h1 className="mt-2 text-2xl font-bold text-white">Truck GPS Provider Onboarding</h1>
          <p className="mt-1 text-slate-400">Connect any fleet tracking company by mapping its vehicle feed into SiteSync truck locations.</p>
        </div>
        <Link href="/dashboard/operator/routes" className="btn-secondary px-4 py-2 text-sm">Route Board</Link>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card space-y-4 xl:col-span-2">
          <div>
            <h2 className="font-semibold text-white">1. Pick the tracking company</h2>
            <p className="mt-1 text-xs text-slate-500">Use a preset for common vendors, or choose custom for any other GPS/ELD provider.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TRACKING_PROVIDER_PRESETS.map(provider => (
              <button
                key={provider.key}
                type="button"
                onClick={() => applyPreset(provider.key)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${providerKey === provider.key ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}`}
              >
                <div className="text-sm font-semibold text-white">{provider.name}</div>
                <div className="mt-1 text-xs text-slate-500">{provider.category}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" value={providerName} onChange={event => setProviderName(event.target.value)} placeholder="Provider company name" />
            <select className="input" value={connectionType} onChange={event => setConnectionType(event.target.value as typeof connectionType)}>
              {selectedPreset.connectionTypes.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}
            </select>
            <input className="input" value={apiBaseUrl} onChange={event => setApiBaseUrl(event.target.value)} placeholder="API base URL, optional" />
            <input className="input" value={externalAccountId} onChange={event => setExternalAccountId(event.target.value)} placeholder="External account / fleet ID, optional" />
            <input className="input" value={authType} onChange={event => setAuthType(event.target.value)} placeholder="Auth type" />
            <input className="input" value={credentialReference} onChange={event => setCredentialReference(event.target.value)} placeholder="Credential reference, not the secret itself" />
          </div>
          <textarea className="input min-h-[80px]" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Provider notes, sync schedule, contact, or setup instructions" />
          <button onClick={saveIntegration} disabled={saving || !providerName} className="btn-primary px-4 py-2 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Tracking Provider'}
          </button>
        </section>

        <aside className="card space-y-4">
          <div>
            <h2 className="font-semibold text-white">Saved providers</h2>
            <p className="mt-1 text-xs text-slate-500">Each provider can feed live GPS by webhook, API job, or CSV upload.</p>
          </div>
          <div className="space-y-2">
            {integrations.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">No providers saved yet.</div>
            ) : integrations.map(integration => (
              <button
                key={integration.id}
                type="button"
                onClick={() => {
                  setSelectedIntegration(integration)
                  setProviderKey(integration.provider_key || 'custom')
                  setProviderName(integration.provider_name)
                  setConnectionType(integration.connection_type)
                  setApiBaseUrl(integration.api_base_url || '')
                  setAuthType(integration.auth_type || '')
                  setCredentialReference(integration.credential_reference || '')
                  setExternalAccountId(integration.external_account_id || '')
                  setMapping(integration.field_mapping || DEFAULT_TRUCK_TRACKING_MAPPING)
                }}
                className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-3 text-left hover:border-slate-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{integration.provider_name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(integration.status)}`}>{integration.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{integration.connection_type.toUpperCase()} {integration.last_sync_at ? `| synced ${new Date(integration.last_sync_at).toLocaleString()}` : '| not synced yet'}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold text-white">2. Map provider fields to SiteSync</h2>
          <p className="mt-1 text-xs text-slate-500">Each field accepts one or more possible paths separated by commas. SiteSync tries them in order.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mappingEntries(mapping).map(field => (
            <label key={field.key} className="space-y-1">
              <span className="block text-xs font-medium text-slate-400">{field.label}</span>
              <input
                className="input text-xs"
                value={field.value}
                onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-white">3. Test import GPS rows</h2>
            <p className="mt-1 text-xs text-slate-500">Paste CSV, TSV, JSON object, or JSON array from any provider. Imported rows update trucks and write location history.</p>
          </div>
          <input className="input" value={sourceFileName} onChange={event => setSourceFileName(event.target.value)} placeholder="Source file name" />
          <textarea className="input min-h-[220px] font-mono text-xs" value={sampleInput} onChange={event => setSampleInput(event.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={testImport} disabled={importing || !records.length} className="btn-primary px-4 py-2 disabled:opacity-50">
              {importing ? 'Importing...' : 'Import GPS Rows'}
            </button>
            <span className="text-xs text-slate-500">{records.length} parsed row(s)</span>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-white">4. Webhook for live GPS</h2>
            <p className="mt-1 text-xs text-slate-500">For providers that can post JSON, copy this URL into their webhook destination. It normalizes payloads using the field map above.</p>
          </div>
          {selectedIntegration ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
              <div className="text-xs text-slate-500">Webhook URL</div>
              <div className="mt-2 break-all rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-sky-300">{webhookUrl}</div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="btn-secondary mt-3 px-4 py-2 text-sm"
              >
                Copy Webhook URL
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">Save or select a provider to generate its webhook URL.</div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">Preview rows</h3>
            <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto">
              {records.slice(0, 6).map((record, index) => (
                <pre key={index} className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-950 p-3 text-[11px] text-slate-400">
                  {JSON.stringify(record, null, 2)}
                </pre>
              ))}
              {!records.length && <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">No preview rows yet.</div>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
