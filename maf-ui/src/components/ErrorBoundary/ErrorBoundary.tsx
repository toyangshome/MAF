import React from 'react';
import { useAppStore } from '../../stores/useAppStore';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback renderer for fine-grained control */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to store
    const { addLog } = useAppStore.getState();
    addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'error',
      source: 'error-boundary',
      message: `${error.message}\n${errorInfo.componentStack}`,
    });
    // Set global error
    useAppStore.getState().setGlobalError({
      message: error.message,
      stack: error.stack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Error icon */}
            <div style={styles.iconCircle}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red-9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={styles.title}>发生错误</h2>
            <p style={styles.message}>{this.state.error.message}</p>

            {/* Actions */}
            <div style={styles.actions}>
              <button style={styles.retryBtn} onClick={this.handleRetry}>
                重试
              </button>
              <button style={styles.detailsBtn} onClick={this.toggleDetails}>
                {this.state.showDetails ? '隐藏详情' : '查看详情'}
              </button>
            </div>

            {/* Stack trace */}
            {this.state.showDetails && this.state.error.stack && (
              <pre style={styles.stack}>{this.state.error.stack}</pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 24,
    boxSizing: 'border-box',
  },
  card: {
    background: 'var(--gray-2)',
    border: '1px solid var(--gray-6)',
    borderRadius: 8,
    padding: '32px 28px',
    maxWidth: 480,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--red-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--gray-12)',
  },
  message: {
    margin: 0,
    fontSize: 14,
    color: 'var(--gray-11)',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  retryBtn: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--accent-9)',
    color: 'var(--gray-1)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  detailsBtn: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--gray-4)',
    color: 'var(--gray-11)',
    border: '1px solid var(--gray-7)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  stack: {
    marginTop: 8,
    padding: '12px 14px',
    background: 'var(--gray-1)',
    border: '1px solid var(--gray-6)',
    borderRadius: 6,
    fontSize: 11,
    lineHeight: 1.5,
    color: 'var(--gray-10)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 240,
    overflow: 'auto',
    width: '100%',
    boxSizing: 'border-box',
  },
};

export default ErrorBoundary;
