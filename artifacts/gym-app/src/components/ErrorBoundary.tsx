import { Component, type ReactNode, type ErrorInfo } from "react";
import { Dumbbell, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorId: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: "" };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, errorId: `ERR-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack?.slice(0, 200));
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Dumbbell className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            An unexpected error occurred. Please refresh the page to try again.
          </p>
          <p className="text-xs text-slate-600 font-mono mb-6">Ref: {this.state.errorId}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}
