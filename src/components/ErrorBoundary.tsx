import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected application error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error">
          <h1>Something went wrong</h1>
          <p>
            The interface hit an unexpected error. Your files never left this device. Reload the page to
            continue.
          </p>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
