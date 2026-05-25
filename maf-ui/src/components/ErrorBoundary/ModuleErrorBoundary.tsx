import React from 'react';
import { useAppStore } from '../../stores/useAppStore';

interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  /** Display name of the module (shown in fallback UI) */
  moduleName: string;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Incrementing key used to force re-mount on retry */
  retryCount: number;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ModuleErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { addLog } = useAppStore.getState();
    addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'error',
      source: `module:${this.props.moduleName}`,
      message: `[${this.props.moduleName}] ${error.message}`,
    });
  }

  private handleRetry = () => {
    this.setState((s) => ({
      hasError: false,
      error: null,
      retryCount: s.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.icon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red-9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span style={styles.text}>
            模块 "{this.props.moduleName}" 加载失败
          </span>
          <button style={styles.retryBtn} onClick={this.handleRetry}>
            重试
          </button>
        </div>
      );
    }

    // Use key to force children re-mount on retry
    return (
      <React.Fragment key={this.state.retryCount}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 200,
    gap: 10,
    padding: 24,
    background: 'var(--gray-2)',
    borderRadius: 8,
    border: '1px solid var(--gray-6)',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--red-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    color: 'var(--gray-11)',
  },
  retryBtn: {
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 500,
    background: 'var(--accent-9)',
    color: 'var(--gray-1)',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
  },
};

export default ModuleErrorBoundary;
