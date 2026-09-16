import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps one broken page from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('PocketPilot hit an error:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <h2>Something broke 😕</h2>
        <p className="muted">That is our fault, not yours. Your saved money and goals are safe.</p>
        <p className="tiny" style={{ wordBreak: 'break-word' }}>{error.message}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" className="btn secondary" onClick={() => window.location.assign('/')}>
            Go home
          </button>
        </div>
      </div>
    );
  }
}
