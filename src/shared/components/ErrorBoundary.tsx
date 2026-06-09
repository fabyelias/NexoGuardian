import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] rounded-xl border border-red-800/30 bg-red-950/20 p-6 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-300">Error al cargar este componente</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-1.5 rounded-lg bg-white/8 hover:bg-white/12 px-3 py-1.5 text-xs text-zinc-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
