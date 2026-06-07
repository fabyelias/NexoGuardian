import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import jsQR from 'jsqr'
import {
  QrCode, CheckCircle2, XCircle, AlertCircle, Loader2,
  Camera, CameraOff, Route, ArrowLeft, Check,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { usePatrolDetail, useCheckpoints, useScanCheckpoint, useCompletePatrol } from '../hooks/usePatrols'
import { useGPS } from '@/shared/hooks/useGPS'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import type { PatrolPoint, Checkpoint } from '@/shared/types/models'

type ScanFeedback = { type: 'success' | 'error' | 'duplicate'; message: string } | null

export function PatrolScanPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { position } = useGPS()

  const { data: patrol, refetch: refetchPatrol } = usePatrolDetail(sessionId ?? '')
  const scanCheckpoint = useScanCheckpoint()
  const completePatrol = useCompletePatrol()

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<ScanFeedback>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const [manualCheckpoint, setManualCheckpoint] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const lastScannedRef = useRef<string>('')

  // Load checkpoints and already-scanned points
  useEffect(() => {
    if (!patrol?.site_id) return

    Promise.all([
      supabase.from('checkpoints').select('*').eq('site_id', patrol.site_id).eq('is_active', true).order('order_index'),
      supabase.from('patrol_points').select('checkpoint_id').eq('patrol_session_id', sessionId!),
    ]).then(([cpRes, ppRes]) => {
      setCheckpoints((cpRes.data ?? []) as Checkpoint[])
      setScannedIds(new Set((ppRes.data ?? []).map((p: { checkpoint_id: string }) => p.checkpoint_id)))
    })

    if (patrol.status === 'completed') setIsComplete(true)
  }, [patrol?.site_id, sessionId, patrol?.status])

  // Camera setup
  useEffect(() => {
    if (!cameraActive || isComplete) return

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        scanningRef.current = true
        scanLoop()
      } catch {
        setCameraError('No se puede acceder a la cámara. Usá el modo manual.')
        setCameraActive(false)
      }
    }

    startCamera()

    return () => {
      scanningRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [cameraActive, isComplete])

  function scanLoop() {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanLoop)
      return
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { requestAnimationFrame(scanLoop); return }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })

    if (code?.data && code.data !== lastScannedRef.current) {
      lastScannedRef.current = code.data
      handleQRScan(code.data)
      setTimeout(() => { lastScannedRef.current = '' }, 3000)
    } else {
      requestAnimationFrame(scanLoop)
    }
  }

  const handleQRScan = useCallback(async (qrValue: string) => {
    const checkpoint = checkpoints.find(cp => cp.qr_code === qrValue)

    if (!checkpoint) {
      showFeedback({ type: 'error', message: 'Código QR no reconocido' })
      requestAnimationFrame(scanLoop)
      return
    }
    if (scannedIds.has(checkpoint.id)) {
      showFeedback({ type: 'duplicate', message: `${checkpoint.name} ya fue registrado` })
      requestAnimationFrame(scanLoop)
      return
    }

    await registerCheckpoint(checkpoint.id)
  }, [checkpoints, scannedIds, sessionId])

  async function registerCheckpoint(checkpointId: string) {
    try {
      await scanCheckpoint.mutateAsync({
        patrolSessionId: sessionId!,
        checkpointId,
        lat: position?.lat,
        lng: position?.lng,
      })

      const newScanned = new Set([...scannedIds, checkpointId])
      setScannedIds(newScanned)

      const cp = checkpoints.find(c => c.id === checkpointId)
      showFeedback({ type: 'success', message: `✓ ${cp?.name ?? 'Checkpoint'} registrado` })

      if (newScanned.size >= checkpoints.length && checkpoints.length > 0) {
        setTimeout(() => setIsComplete(true), 1500)
      } else {
        requestAnimationFrame(scanLoop)
      }
    } catch {
      showFeedback({ type: 'error', message: 'Error al registrar el punto' })
      requestAnimationFrame(scanLoop)
    }
  }

  function showFeedback(f: ScanFeedback) {
    setFeedback(f)
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleManualRegister(checkpointId: string) {
    if (scannedIds.has(checkpointId)) return
    setManualCheckpoint(checkpointId)
    await registerCheckpoint(checkpointId)
    setManualCheckpoint(null)
  }

  async function handleForceComplete() {
    if (!sessionId) return
    await completePatrol.mutateAsync(sessionId)
    setIsComplete(true)
  }

  const progress = checkpoints.length > 0 ? Math.round((scannedIds.size / checkpoints.length) * 100) : 100

  // ── Completion screen ────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto space-y-5 text-center">
        <div className="flex flex-col items-center py-10 gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600/10 border border-emerald-500/20">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">¡Rondín completado!</h2>
            <p className="text-zinc-500 mt-1">
              {scannedIds.size} de {checkpoints.length} puntos registrados
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-5 text-left space-y-2">
          {checkpoints.map(cp => (
            <div key={cp.id} className="flex items-center gap-3">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                scannedIds.has(cp.id) ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-red-600/20 border border-red-500/30'
              }`}>
                {scannedIds.has(cp.id)
                  ? <Check className="h-3 w-3 text-emerald-400" />
                  : <XCircle className="h-3 w-3 text-red-400" />
                }
              </div>
              <span className={`text-sm ${scannedIds.has(cp.id) ? 'text-zinc-300' : 'text-zinc-500 line-through'}`}>
                {cp.name}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/patrols/new')}>
            <Route className="h-4 w-4" /> Nuevo rondín
          </Button>
          <Button className="flex-1" onClick={() => navigate('/dashboard')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    )
  }

  // ── Scanner screen ───────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/patrols')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Rondines
        </button>
        <span className="text-sm font-medium text-white">
          {scannedIds.size}/{checkpoints.length} puntos
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 text-center">{progress}% completado</p>
      </div>

      {/* Camera / QR scanner */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 relative">
          {cameraActive && !cameraError ? (
            <div className="relative bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-48">
                  <div className="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                  <div className="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-blue-400 rounded-br" />
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-400/50 animate-[scan_2s_linear_infinite]" />
                </div>
              </div>

              {/* Feedback overlay */}
              {feedback && (
                <div className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity`}>
                  <div className={`flex flex-col items-center gap-2 rounded-xl px-6 py-4 border ${
                    feedback.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30' :
                    feedback.type === 'duplicate' ? 'bg-amber-950/80 border-amber-500/30' :
                    'bg-red-950/80 border-red-500/30'
                  }`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> :
                     feedback.type === 'duplicate' ? <AlertCircle className="h-8 w-8 text-amber-400" /> :
                     <XCircle className="h-8 w-8 text-red-400" />}
                    <p className={`text-sm font-medium ${
                      feedback.type === 'success' ? 'text-emerald-300' :
                      feedback.type === 'duplicate' ? 'text-amber-300' : 'text-red-300'
                    }`}>{feedback.message}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-zinc-900/60">
              <CameraOff className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-500 text-center px-4">{cameraError ?? 'Cámara desactivada'}</p>
              {!cameraActive && !cameraError && (
                <Button variant="outline" size="sm" onClick={() => setCameraActive(true)}>
                  <Camera className="h-4 w-4" /> Activar cámara
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-600 text-center">
        Apuntá la cámara al código QR de cada checkpoint
      </p>

      {/* Checkpoint list — manual fallback */}
      {checkpoints.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">Checkpoints — toca para marcar manualmente</p>
          <div className="space-y-1.5">
            {checkpoints.map((cp, i) => {
              const done = scannedIds.has(cp.id)
              const loading = manualCheckpoint === cp.id
              return (
                <button
                  key={cp.id}
                  onClick={() => !done && handleManualRegister(cp.id)}
                  disabled={done || loading}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    done
                      ? 'border-emerald-500/20 bg-emerald-600/10'
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-emerald-600/20' : 'bg-white/5'
                  }`}>
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin" />
                    ) : done ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-xs text-zinc-500">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? 'text-emerald-400' : 'text-zinc-300'}`}>{cp.name}</p>
                    {cp.description && <p className="text-xs text-zinc-600 truncate">{cp.description}</p>}
                  </div>
                  {!done && <QrCode className="h-3.5 w-3.5 text-zinc-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Force complete */}
      <Button
        variant="outline"
        className="w-full text-zinc-500"
        onClick={handleForceComplete}
        disabled={completePatrol.isPending}
      >
        {completePatrol.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Finalizar rondín incompleto
      </Button>
    </div>
  )
}
