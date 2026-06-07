import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useGPS } from '@/shared/hooks/useGPS'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import type { IncidentCategory, IncidentSeverity } from '@/shared/types/enums'
import { INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'

const CATEGORIES = Object.entries(INCIDENT_CATEGORY_LABELS) as [IncidentCategory, string][]
const SEVERITIES = Object.entries(INCIDENT_SEVERITY_LABELS) as [IncidentSeverity, string][]

interface IncidentFormProps {
  shiftId?: string
  siteId?: string
}

export function IncidentForm({ shiftId, siteId: defaultSiteId }: IncidentFormProps) {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const { position } = useGPS()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [aiDescription, setAiDescription] = useState('')
  const [category, setCategory] = useState<IncidentCategory>('operational')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [siteId, setSiteId] = useState(defaultSiteId ?? '')

  async function enhanceWithAI() {
    if (!description.trim()) return
    setIsEnhancing(true)

    try {
      const { data, error } = await supabase.functions.invoke('ai-enhance', {
        body: { text: description, context: 'incident', category },
      })
      if (!error && data?.enhanced) {
        setAiDescription(data.enhanced)
      }
    } catch {
      // IA no disponible, continúa sin ella
    }

    setIsEnhancing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setIsSubmitting(true)

    await supabase.from('incidents').insert({
      organization_id: profile.organization_id,
      site_id: siteId,
      reported_by: profile.id,
      category,
      severity,
      title,
      description,
      ai_description: aiDescription || null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      shift_id: shiftId ?? null,
    })

    navigate('/incidents')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Incidente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              placeholder="Descripción breve del incidente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <select
                className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Severidad</Label>
              <select
                className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              >
                {SEVERITIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <textarea
              className="flex min-h-24 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              placeholder="Describí brevemente lo que ocurrió..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={enhanceWithAI}
              disabled={isEnhancing || !description.trim()}
              className="text-blue-400 hover:text-blue-300"
            >
              {isEnhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Mejorar con IA
            </Button>
          </div>

          {aiDescription && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Descripción mejorada por IA
              </Label>
              <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3 text-sm text-zinc-300">
                {aiDescription}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Incidente'}
        </Button>
      </div>
    </form>
  )
}
