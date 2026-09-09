import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Shown in place of the answer editor when the account may browse but not
 * practise.
 *
 * Deliberately not a wall. The case, its data and the rubric are all still on
 * the page above this — someone evaluating CaseCode for a placement cell should
 * be able to read a real case and see exactly how it would be marked, because
 * that is the argument for buying. What is withheld is being graded.
 *
 * The copy avoids "upgrade": this is not a consumer paywall, and the reader
 * usually cannot buy their own way past it. The action that actually unblocks
 * them is their college taking a licence, so that is what it asks for.
 */
export function LicenceGate() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
          <Lock className="size-4 text-muted-foreground" />
        </span>

        <h3 className="mt-4 text-base font-medium">
          Solving is for licensed accounts
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          You can read every case, follow the learning paths and see how each one
          is marked. Submitting an answer for AI grading needs an account covered
          by a campus licence.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/pricing">Licence your campus</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/cases">Keep browsing</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Already at a licensed college? Sign in with your college email address.
        </p>
      </CardContent>
    </Card>
  );
}
