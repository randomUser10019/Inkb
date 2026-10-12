import { lazy, Suspense, type ComponentType } from "react";

/** Load a screen after the first paint. The import stays out of the home script. */
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return function LazyRoutePage() {
    return (
      <Suspense fallback={<p className="board-pad pt-8 text-sm text-muted">Loading</p>}>
        <Page />
      </Suspense>
    );
  };
}
