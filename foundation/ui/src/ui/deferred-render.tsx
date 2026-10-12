import { type ReactNode, Suspense, use } from "react";

// Server-safe: streams a slow part of a page. The page starts the query without awaiting it and passes the promise;
// the fallback is sent at once and the content follows in the same response when the promise settles. A rejection
// goes to the nearest error boundary (`error.tsx`). In a client component the promise must be stable (created
// outside render, or by the server), or every render starts a new one.

export interface DeferredRenderProps<Value> {
  /** The pending data, started by the caller. */
  readonly data: Promise<Value>;
  /** Shown until the data arrives (a skeleton). */
  readonly fallback: ReactNode;
  /** Renders the data. */
  readonly children: (value: Value) => ReactNode;
}

/** A Suspense boundary that renders `children(value)` once `data` resolves. */
export function DeferredRender<Value>({ data, fallback, children }: DeferredRenderProps<Value>) {
  return (
    <Suspense fallback={fallback}>
      <Resolved data={data} render={children} />
    </Suspense>
  );
}

function Resolved<Value>({ data, render }: { readonly data: Promise<Value>; readonly render: (value: Value) => ReactNode }) {
  return render(use(data));
}
