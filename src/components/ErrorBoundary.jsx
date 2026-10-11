import React from 'react';

// Shows a readable message instead of a blank page if something throws while rendering.
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info && info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>The page could not be displayed. Reloading usually fixes it.</p>
          <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', marginBottom: 16 }}>{String(this.state.error && this.state.error.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 18px', borderRadius: 8, border: 0, background: '#111', color: '#fff', cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    );
  }
}
