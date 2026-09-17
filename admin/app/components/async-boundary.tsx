import { Component, type ReactNode, Suspense } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useSWRConfig } from "swr";
import { isRetryable } from "~/lib/swr-config";

type Props = {
  /** Shown while any child is suspended on its data. */
  fallback: ReactNode;
  /** What failed, in the reader's words: "Couldn't load the comments." */
  errorText?: string;
  /** Replaces the error message entirely — `null` for decorative bits. */
  errorFallback?: ReactNode;
  children: ReactNode;
};

/**
 * Suspense plus an error boundary, around one section of a page. A slow or
 * failing section shows its own placeholder or error without holding back,
 * or taking down, the rest of the page.
 */
export function AsyncBoundary({ fallback, errorText, errorFallback, children }: Props) {
  return (
    <SectionErrorBoundary errorText={errorText} errorFallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}

type BoundaryState = { error: Error | null };

class SectionErrorBoundary extends Component<
  { errorText?: string; errorFallback?: ReactNode; children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.errorFallback !== undefined) return this.props.errorFallback;
    return (
      <SectionError
        text={this.props.errorText ?? this.state.error.message}
        onRetry={
          isRetryable(this.state.error)
            ? () => this.setState({ error: null })
            : undefined
        }
      />
    );
  }
}

function SectionError({
  text,
  onRetry,
}: {
  text: string;
  /** Omitted when trying again can't help (a 404, a 403). */
  onRetry?: () => void;
}) {
  const { cache } = useSWRConfig();

  const retry = () => {
    if (!onRetry) return;
    // Suspense re-throws a cached error without refetching, so the failed
    // entries have to go before the section renders again.
    for (const key of cache.keys()) {
      if (cache.get(key)?.error) cache.delete(key);
    }
    onRetry();
  };

  return (
    <div className="err" role="alert">
      <AlertTriangle size={16} />
      <span style={{ flex: 1 }}>{text}</span>
      {onRetry && (
        <button type="button" className="btn btn-text" onClick={retry}>
          <RotateCcw size={14} />
          Try again
        </button>
      )}
    </div>
  );
}
