import Link from "next/link";
import { Logo } from "@/components/logo";
import { MarkedSheet } from "@/components/marked-sheet";

/**
 * Sign-in, sign-up and password pages.
 *
 * The right half used to carry an unattributed testimonial and a row of three
 * big stats — the stock furniture of a generated auth page. It now shows what
 * the account is for: an answer, marked.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8">
        <Link href="/" className="self-start" aria-label="CaseCode home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <aside className="hidden flex-col justify-center gap-8 border-l border-border bg-surface-sunken/70 px-12 py-12 lg:flex xl:px-20">
        <MarkedSheet compact className="max-w-lg -rotate-[0.6deg]" />
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Every answer comes back like this: marked against the case&apos;s own
          rubric, with the step you skipped written in the margin.
        </p>
      </aside>
    </div>
  );
}
