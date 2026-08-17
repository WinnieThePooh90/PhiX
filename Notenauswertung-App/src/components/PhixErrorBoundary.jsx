import React from 'react';

/**
 * ErrorBoundary für Ansichten, um weiße Bildschirme bei unerwarteten Komponenten-Fehlern zu verhindern.
 */
export class PhixErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PhixErrorBoundary] Fehler abgefangen:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="program-view glass-panel" style={{ padding: '2rem', margin: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Fehler beim Laden dieser Ansicht</h3>
          <p className="text-muted" style={{ margin: '1rem 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            type="button"
            className="tab primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
