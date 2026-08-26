"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The application's error boundary.
 *
 * Without one, an exception thrown while rendering any server component —
 * a missing RPC, a database hiccup, a null nobody expected — shows Next's
 * default error screen, which says nothing useful and offers no way back.
 *
 * `digest` is the server-side identifier Next attaches to the real error; the
 * message itself is deliberately withheld from the client in production, so the
 * digest is the only thing that ties what the user saw to what the log says.
 * Showing it is what makes a support conversation possible.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[boundary] unhandled render error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page failed to load. It is not something you did — trying again
        often works, because most causes are transient.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
