import type { ErrorComponentProps } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/kit";
import { COPY } from "@inkboard/shared/copy";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function errorStack(error: unknown): string {
  if (error instanceof Error && error.stack) return error.stack;
  return "";
}

function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function ErrorSheet({
  title,
  message,
  stack,
  blob,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  message: string;
  stack: string;
  blob: string;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  return (
    <div className="board-pad max-w-[65ch] py-12" data-error-boundary="true">
      <p className="text-seal text-faint">Error</p>
      <h1 className="mt-2 text-display">{title}</h1>
      <p className="mt-3 text-sm text-muted">{message}</p>
      {stack ? (
        <pre className="mt-4 max-h-48 overflow-auto border-y border-line py-3 text-xs text-muted whitespace-pre-wrap">
          {stack}
        </pre>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={onPrimary}>
          {primaryLabel}
        </Button>
        <a href="/" className="h-11 inline-flex items-center text-sm text-muted hover:text-fg">
          {COPY.backToTheWall}
        </a>
        <button type="button" className="h-11 text-sm text-muted hover:text-fg" onClick={() => copyText(blob)}>
          Copy error
        </button>
      </div>
    </div>
  );
}

export function AppErrorComponent({ error, info }: ErrorComponentProps) {
  const msg = errorMessage(error);
  const stack = import.meta.env.DEV
    ? [errorStack(error), info?.componentStack].filter(Boolean).join("\n\n")
    : "";
  const blob = [msg, errorStack(error), info?.componentStack].filter(Boolean).join("\n\n");
  return (
    <ErrorSheet
      title={COPY.boardDidNotHold}
      message={msg}
      stack={stack}
      blob={blob}
      primaryLabel={COPY.tryAgain}
      onPrimary={() => window.location.reload()}
    />
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null; componentStack: string };

export class PlayerErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Pick<BoundaryState, "error"> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ error, componentStack: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      const msg = errorMessage(this.state.error);
      const stack = import.meta.env.DEV
        ? [errorStack(this.state.error), this.state.componentStack].filter(Boolean).join("\n\n")
        : "";
      const blob = [msg, errorStack(this.state.error), this.state.componentStack].filter(Boolean).join("\n\n");
      return (
        <ErrorSheet
          title={COPY.slateSlipped}
          message={msg}
          stack={stack}
          blob={blob}
          primaryLabel={COPY.tryAgain}
          onPrimary={() => this.setState({ error: null, componentStack: "" })}
        />
      );
    }
    return this.props.children;
  }
}
