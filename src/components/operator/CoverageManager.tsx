'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Division = {
  id: string
  name: string
  address_line1?: string | null
  city?: string | null
  state_code?: string | null
  zip?: string | null
  phone?: string | null
  email?: string | null
  is_active: boolean
}

type ZipCoverage = { id: string; division_id: string; zip: string }
type StateCoverage = { id: string; division_id: string; state_code: string }

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC', 'PR', 'VI', 'GU', 'MP', 'AS',
]

const VALID_STATES = new Set(US_STATES)

const STATE_PRESETS = [
  { label: 'Florida', states: ['FL'] },
  { label: 'Southeast', states: ['FL', 'GA', 'AL', 'SC', 'NC', 'TN'] },
  { label: 'Texas', states: ['TX'] },
  { label: 'Nationwide', states: US_STATES },
]

function parseZips(input: string) {
  return [...new Set(
    input
      .split(/[\s,;]+/)
      .map(value => value.replace(/\D/g, '').slice(0, 5))
      .filter(value => value.length === 5)
  )]
}

function parseStates(input: string) {
  return [...new Set(
    input
      .split(/[\s,;]+/)
      .map(value => value.trim().toUpperCase().slice(0, 2))
      .filter(value => VALID_STATES.has(value))
  )]
}

function findInvalidStates(input: string) {
  return [...new Set(
    input
      .split(/[\s,;]+/)
      .map(value => value.trim().toUpperCase().slice(0, 2))
      .filter(value => value && /^[A-Z]{2}$/.test(value) && !VALID_STATES.has(value))
  )]
}

function mergeStateText(current: string, additions: string[]) {
  return [...new Set([...parseStates(current), ...additions])].join(', ')
}

export default function CoverageManager({
  organizationId,
  organizationName,
  initialDivisions,
  initialZipCoverage,
  initialStateCoverage,
}: {
  organizationId: string
  organizationName: string
  initialDivisions: Division[]
  initialZipCoverage: ZipCoverage[]
  initialStateCoverage: StateCoverage[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [divisions, setDivisions] = useState(initialDivisions)
  const [zipCoverage, setZipCoverage] = useState(initialZipCoverage)
  const [stateCoverage, setStateCoverage] = useState(initialStateCoverage)
  const [selectedId, setSelectedId] = useState(initialDivisions[0]?.id || '')
  const [newDivisionName, setNewDivisionName] = useState(`${organizationName} Main`)
  const [zipText, setZipText] = useState('')
  const [stateText, setStateText] = useState('FL')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selectedDivision = divisions.find(division => division.id === selectedId) || divisions[0]
  const selectedZips = selectedDivision
    ? zipCoverage.filter(row => row.division_id === selectedDivision.id).map(row => row.zip)
    : []
  const selectedStates = selectedDivision
    ? stateCoverage.filter(row => row.division_id === selectedDivision.id).map(row => row.state_code)
    : []

  const refreshCoverage = async (divisionList = divisions) => {
    const ids = divisionList.map(division => division.id)
    if (!ids.length) {
      setZipCoverage([])
      setStateCoverage([])
      return
    }

    const [zips, states] = await Promise.all([
      supabase.from('division_coverage_zips').select('id,division_id,zip').in('division_id', ids).order('zip'),
      supabase.from('division_coverage_states').select('id,division_id,state_code').in('division_id', ids).order('state_code'),
    ])
    if (!zips.error) setZipCoverage(zips.data || [])
    if (!states.error) setStateCoverage(states.data || [])
  }

  const findInvalidZips = async (zips: string[]) => {
    if (!zips.length) return []
    const valid = new Set<string>()

    for (let index = 0; index < zips.length; index += 500) {
      const chunk = zips.slice(index, index + 500)
      const { data, error } = await supabase
        .from('zip_lookup')
        .select('zip')
        .in('zip', chunk)

      if (error) throw error
      for (const row of data || []) valid.add(row.zip)
    }

    return zips.filter(zip => !valid.has(zip))
  }

  const createDivision = async () => {
    const name = newDivisionName.trim()
    if (!name) return
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase
      .from('operator_divisions')
      .insert({
        organization_id: organizationId,
        name,
        is_active: true,
      })
      .select('id,name,address_line1,city,state_code,zip,phone,email,is_active')
      .single()
    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    const next = [...divisions, data]
    setDivisions(next)
    setSelectedId(data.id)
    setNewDivisionName('')
    setMessage('Division added.')
  }

  const saveCoverage = async () => {
    if (!selectedDivision) return
    const zips = parseZips(zipText)
    const states = parseStates(stateText)
    const invalidStates = findInvalidStates(stateText)
    if (!zips.length && !states.length) {
      setMessage('Add at least one ZIP code or state code.')
      return
    }
    if (invalidStates.length) {
      setMessage(`Invalid state code${invalidStates.length === 1 ? '' : 's'}: ${invalidStates.join(', ')}`)
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const invalidZips = await findInvalidZips(zips)
      if (invalidZips.length) {
        setBusy(false)
        setMessage(`Invalid ZIP code${invalidZips.length === 1 ? '' : 's'}: ${invalidZips.slice(0, 10).join(', ')}${invalidZips.length > 10 ? ` + ${invalidZips.length - 10} more` : ''}`)
        return
      }
    } catch (error: any) {
      setBusy(false)
      setMessage(error.message || 'Could not validate ZIP codes.')
      return
    }

    for (let index = 0; index < zips.length; index += 500) {
      const chunk = zips.slice(index, index + 500).map(zip => ({
        division_id: selectedDivision.id,
        zip,
      }))
      const { error } = await supabase
        .from('division_coverage_zips')
        .upsert(chunk, { onConflict: 'division_id,zip' })
      if (error) {
        setBusy(false)
        setMessage(error.message)
        return
      }
    }

    if (states.length) {
      const { error } = await supabase
        .from('division_coverage_states')
        .upsert(
          states.map(state_code => ({
            division_id: selectedDivision.id,
            state_code,
          })),
          { onConflict: 'division_id,state_code' }
        )
      if (error) {
        setBusy(false)
        setMessage(error.message)
        return
      }
    }

    await refreshCoverage()
    setZipText('')
    setStateText('')
    setBusy(false)
    setMessage(`Coverage saved: ${zips.length} ZIPs and ${states.length} states added.`)
  }

  const deactivateDivision = async (division: Division) => {
    setBusy(true)
    setMessage('')
    const { error } = await supabase
      .from('operator_divisions')
      .update({ is_active: !division.is_active })
      .eq('id', division.id)
    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setDivisions(current =>
      current.map(row => row.id === division.id ? { ...row, is_active: !row.is_active } : row)
    )
    setMessage(division.is_active ? 'Division paused.' : 'Division reactivated.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coverage</h1>
          <p className="mt-1 text-sm text-slate-400">
            Assign service ZIPs and states so quote leads route to the operators who cover them.
          </p>
        </div>
        <a href="/quotes" target="_blank" rel="noopener noreferrer" className="btn-secondary px-4 py-2 text-sm">
          Test Public Quote
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-white">Divisions</h2>
            <div className="space-y-2">
              {divisions.map(division => (
                <button
                  key={division.id}
                  onClick={() => setSelectedId(division.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedDivision?.id === division.id
                      ? 'border-sky-500/40 bg-sky-500/10'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{division.name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      division.is_active ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {division.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {zipCoverage.filter(row => row.division_id === division.id).length} ZIPs | {stateCoverage.filter(row => row.division_id === division.id).length} states
                  </div>
                </button>
              ))}
              {!divisions.length && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">
                  No divisions yet.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-white">Add Division</h2>
            <div className="space-y-3">
              <input
                className="input"
                value={newDivisionName}
                onChange={event => setNewDivisionName(event.target.value)}
                placeholder="Orlando Office"
              />
              <button onClick={createDivision} disabled={busy} className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-50">
                Add Division
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedDivision?.name || 'Select a division'}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Paste all service ZIPs for this office, or use state coverage for broad areas.
                </p>
              </div>
              {selectedDivision && (
                <button
                  onClick={() => deactivateDivision(selectedDivision)}
                  disabled={busy}
                  className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
                >
                  {selectedDivision.is_active ? 'Pause Division' : 'Reactivate Division'}
                </button>
              )}
            </div>

            {selectedDivision ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    ZIP Codes
                  </label>
                  <textarea
                    className="input min-h-44 resize-y"
                    value={zipText}
                    onChange={event => setZipText(event.target.value)}
                    placeholder="32801, 32827, 32830&#10;34746"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Current: {selectedZips.length ? selectedZips.slice(0, 12).join(', ') : 'none'}
                    {selectedZips.length > 12 ? ` + ${selectedZips.length - 12} more` : ''}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      State Coverage
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATE_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setStateText(current => mergeStateText(current, preset.states))}
                          className="rounded-md border border-slate-700/60 px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="input min-h-44 resize-y"
                    value={stateText}
                    onChange={event => setStateText(event.target.value)}
                    placeholder="FL, GA, TX"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Current: {selectedStates.length ? selectedStates.join(', ') : 'none'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
                Add a division before assigning coverage.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={saveCoverage}
                disabled={busy || !selectedDivision}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                Save Coverage
              </button>
              {message && (
                <div className={`text-sm ${message.includes('saved') || message.includes('added') || message.includes('paused') || message.includes('reactivated') ? 'text-green-400' : 'text-yellow-400'}`}>
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <div className="text-2xl font-bold text-white">{divisions.length}</div>
              <div className="mt-1 text-xs text-slate-500">Divisions</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <div className="text-2xl font-bold text-white">{zipCoverage.length}</div>
              <div className="mt-1 text-xs text-slate-500">Covered ZIPs</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <div className="text-2xl font-bold text-white">{stateCoverage.length}</div>
              <div className="mt-1 text-xs text-slate-500">Covered States</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
