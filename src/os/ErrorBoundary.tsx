import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Name of the app, shown in the fallback. */
  appName?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a single app window so one crashing app
 * shows a readable message instead of blanking the entire OS.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[KobeOS] App crashed:', this.props.appName, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col h-full w-full items-center justify-center gap-3 p-6 text-center bg-[#0d0d1a] text-white/80 overflow-auto">
        <AlertTriangle className="w-10 h-10 text-amber-400 shrink-0" />
        <h2 className="text-base font-semibold text-white">
          {this.props.appName ?? 'This app'} ran into a problem
        </h2>
        <p className="text-xs text-red-300 font-mono max-w-md break-words">
          {error.message || String(error)}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-1 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-white/70 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
