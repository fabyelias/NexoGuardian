import { useState } from 'react'
import {
  BookOpen, Plus, Sparkles, Loader2, Clock,
  MapPin, Search, Pencil, Check, X,
} from 'lucide-react'
import { useGuardLogs, useCreateGuardLog, useUpdateGuardLog } from '../hooks/useGuardLog'
import { useSites } from '@/features/sites/hooks/useSites'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useGPS } from '@/shared/hooks/useGPS'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Input } from '@/shared/components/ui/input'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { formatDate, getInitials } from '@/shared/lib/utils'
import { Card, CardContent } from '@/shared/components/ui/card'
import type { GuardLog } from '@/shared/types/models'

export function GuardLogPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'supervisor'

  const { data: logs = [], isLoading } = useGuardLogs()
  const { data: sites = [] } = useSites()
  const createLog = useCreateGuardLog()
  const updateLog = useUpdateGuardLog()
  const { position, requestPosition } = useGPS()

  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [aiEnhanced, setAiEnhanced] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [selectedSite, setSelectedSite] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [activeShiftId, setActiveShiftId] = useState('')

  // Load active shift on mount
  useState(() => {
    if (!profile?.id) return
    requestPosition()
    supabase
      .from('shifts')
      .select('id, site_id')
      .eq('guard_id', profile.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveShiftId(data.id)
          setSelectedSite(data.site_id)
        }
      })
  })

  const filtered = logs.filter(l => {
    const guard = l.guard as { first_name: string; last_name: string } | undefined
    const guardName = guard ? `${guard.first_name} ${guard.last_name}`.toLowerCase() : ''
    const site = l.site as { name: string } | undefined
    const q = search.toLowerCase()
    return (
      l.content.toLowerCase().includes(q) ||
      (l.ai_enhanced ?? '').toLowerCase().includes(q) ||
      guardName.includes(q) ||
      (site?.name ?? '').toLowerCase().includes(q)
    )
  })

  async function enhanceWithAI(text: string): Promise<string> {
    try {
      const { data } = await supabase.functions.invoke('ai-enhance', {
        body: { text, context: 'log' },
      })
      return data?.enhanced ?? text
    } catch { return text }
  }

  async function handleEnhance() {
    if (!content.trim()) return
    setIsEnhancing(true)
    const enhanced = await enhanceWithAI(content)
    setAiEnhanced(enhanced)
    setIsEnhancing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeShiftId || !selectedSite) return
    await createLog.mutateAsync({
      shiftId: activeShiftId,
      siteId: selectedSite,
      content,
      aiEnhanced: aiEnhanced || undefined,
      lat: position?.lat,
      lng: position?.lng,
    })
    setContent('')
    setAiEnhanced('')
    setShowForm(false)
  }

  function startEdit(log: GuardLog) {
    setEditingId(log.id)
    setEditContent(log.ai_enhanced || log.content)
  }

  async function saveEdit(log: GuardLog) {
    await updateLog.mutateAsync({ id: log.id, content: log.content, ai_enhanced: editContent })
    setEditingId(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Libro de Guardia</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{logs.length} novedad{logs.length !== 1 ? 'es' : ''} registrada{logs.length !== 1 ? 's' : ''}</p>
        </div>
        {(profile?.role === 'guard' || isAdmin) && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Nueva novedad
          </Button>
        )}
      </div>

      {/* Search (admin/supervisor) */}
      {isAdmin && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por vigilador, sitio o contenido..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <Card className="border-blue-500/20">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Objetivo *</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    value={selectedSite}
                    onChange={e => setSelectedSite(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2 h-9 w-full px-3 rounded-md border border-white/10 bg-zinc-900 text-xs">
                    <MapPin className={`h-3.5 w-3.5 ${position ? 'text-emerald-400' : 'text-zinc-600'}`} />
                    <span className="text-zinc-400 truncate">
                      {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Sin GPS'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Novedad *</label>
                <Textarea
                  placeholder="Describí la novedad observada durante el turno..."
                  rows={3}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  required
                />
                <Button type="button" variant="ghost" size="sm" onClick={handleEnhance}
                  disabled={isEnhancing || !content.trim()} className="text-blue-400 hover:text-blue-300">
                  {isEnhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Mejorar con IA
                </Button>
              </div>

              {aiEnhanced && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3">
                  <p className="text-xs text-blue-400 mb-1 font-medium">✨ Versión profesional (IA)</p>
                  <p className="text-sm text-zinc-300">{aiEnhanced}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => { setShowForm(false); setContent(''); setAiEnhanced('') }}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={createLog.isPending || !selectedSite || !activeShiftId}>
                  {createLog.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!activeShiftId ? 'Sin turno activo' : 'Registrar novedad'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Log entries */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-zinc-600">
          <BookOpen className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-zinc-400">
            {search ? 'Sin resultados' : 'Sin novedades registradas'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const guard = log.guard as { first_name: string; last_name: string; badge_number?: string } | undefined
            const site = log.site as { name: string } | undefined
            const isBeingEdited = editingId === log.id
            const displayText = log.ai_enhanced || log.content

            return (
              <div key={log.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 shrink-0 mt-1">
                  <AvatarFallback className="text-[10px]">
                    {guard ? getInitials(guard.first_name, guard.last_name) : 'GD'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-xl border border-white/8 bg-zinc-900/60 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-white">
                        {guard ? `${guard.first_name} ${guard.last_name}` : 'Vigilador'}
                      </span>
                      {guard?.badge_number && <span className="ml-1.5 text-xs text-zinc-600">#{guard.badge_number}</span>}
                      {site && <span className="ml-2 text-xs text-zinc-500">· {site.name}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.recorded_at)}
                      </div>
                      {/* Edit button — solo admin/supervisor */}
                      {isAdmin && !isBeingEdited && (
                        <button
                          onClick={() => startEdit(log)}
                          className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/8 transition-all"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isBeingEdited ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(log)} disabled={updateLog.isPending}>
                          {updateLog.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {log.ai_enhanced && log.ai_enhanced !== log.content ? (
                        <>
                          <p className="text-xs text-zinc-600 italic line-through">{log.content}</p>
                          <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5">
                            <p className="text-[10px] text-blue-400 mb-1 font-medium flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> Versión profesional
                            </p>
                            <p className="text-sm text-zinc-300 leading-relaxed">{log.ai_enhanced}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-300 leading-relaxed">{log.content}</p>
                      )}
                    </>
                  )}

                  {log.lat && (
                    <p className="flex items-center gap-1 text-xs text-zinc-600">
                      <MapPin className="h-3 w-3" /> {log.lat.toFixed(4)}, {log.lng?.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
