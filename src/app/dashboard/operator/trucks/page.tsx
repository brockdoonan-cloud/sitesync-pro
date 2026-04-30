import { createClient } from '@/lib/supabase/server'

export default async function TrucksPage() {
  const supabase = createClient()
  const { data: trucks } = await supabase.from('trucks').select('*,profiles(full_name)').order('truck_number', { ascending: true })
  const rows = trucks || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trucks</h1>
        <p className="text-slate-400 mt-1">Fleet availability and driver assignments.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.length > 0 ? rows.map((truck: any) => (
          <div key={truck.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-lg font-bold text-white">Truck #{truck.truck_number || truck.id.slice(0, 8)}</div><div className="text-sm text-slate-400 mt-1">{truck.profiles?.full_name || 'Unassigned driver'}</div></div>
              <span className="rounded-full border border-slate-600/50 bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300 capitalize">{truck.status || 'unknown'}</span>
            </div>
          </div>
        )) : <div className="card text-center py-12 md:col-span-2 xl:col-span-3"><p className="text-slate-400">No trucks found.</p></div>}
      </div>
    </div>
  )
}
