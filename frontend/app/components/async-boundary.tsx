import { Component, type ReactNode, Suspense } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useSWRConfig } from "swr";

type Props = {
  /** Shown while any child is suspended on its data. */
  fallback: ReactNode;
  /** What failed, in the reader's words: "Couldn't load the comments." */
  errorText?: string;
  children: ReactNode;
};

/**
 * Suspense plus an error boundary, around one section of a page. A slow or
 * failing section shows its own placeholder or error without holding back,
 * or taking down, the rest of the page.
 */
export function AsyncBoundary({ fallback, errorText, children }: Props) {
  return (
    <SectionErrorBoundary errorText={errorText}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}

type BoundaryState = { error: Error | null };

class SectionErrorBoundary extends Component<
  { errorText?: string; children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <SectionError
        text={this.props.errorText ?? this.state.error.message}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

function SectionError({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  const { cache } = useSWRConfig();

  const retry = () => {
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
      <button type="button" className="btn btn-text" onClick={retry}>
        <RotateCcw size={14} />
        Try again
      </button>
    </div>
  );
}
