import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 404, including every `notFound()` thrown by an authorization guard.
 *
 * The teacher and admin guards answer 404 rather than 403 on purpose — see
 * requireBatchTeacher in lib/authz — so this page is what someone sees when
 * they probe a batch or assignment id that is not theirs. The wording says
 * nothing about whether the thing exists.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page does not exist, or it is not yours to open.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cases">Browse cases</Link>
        </Button>
      </div>
    </div>
  );
}
