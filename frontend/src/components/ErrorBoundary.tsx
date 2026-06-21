import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render-time errors so a single failing component can't blank the app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-bold text-gray-100">Something went wrong</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 px-4 py-2 rounded-lg bg-fifa-gold text-fifa-navy text-sm font-semibold hover:brightness-95 transition-[filter]"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
