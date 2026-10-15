import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Si una pantalla falla al dibujarse, muestra un aviso con opción de recargar en lugar de dejar la página vacía
 * (en tema oscuro se ve todo negro y nada responde). `resetKey` (la ruta) vuelve a intentar al navegar.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error de interfaz", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto my-16 max-w-lg rounded-2xl border border-crimson-200 bg-white p-6 text-center shadow-soft dark:border-crimson-500/30 dark:bg-ink-800">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-crimson-500" />
        <h2 className="text-lg font-bold">Algo salió mal en esta pantalla</h2>
        <p className="mt-1 text-sm text-slate-500">Los cambios ya guardados no se pierden. Recargue para continuar.</p>
        <p className="mt-3 break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-white/5">{this.state.error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-outline" onClick={() => this.setState({ error: null })}>Reintentar</button>
          <button className="btn-primary" onClick={() => window.location.reload()}><RotateCcw className="h-4 w-4" /> Recargar</button>
        </div>
      </div>
    );
  }
}
