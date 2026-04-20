import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  /** Optional custom fallback instead of the default error card. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors in the subtree and shows a friendly
 * recovery UI instead of crashing the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging; swap for a proper error tracker later.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error !== null) {
      if (fallback !== undefined) return fallback;

      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {error.message}
            </p>
          </div>
          <Button variant="outline" onClick={this.reset}>
            Try again
          </Button>
        </div>
      );
    }

    return children;
  }
}
