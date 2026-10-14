import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Sign-in, sign-up and password pages.
 *
 * The right half carries the same line as the landing hero, set in the same
 * Didone, and nothing else — so the two front pages read as one piece. The
 * forms on the left are styled by `.auth-form` (globals.css): underlined
 * fields, small-capital labels, titles in the Didone.
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
          <div className="auth-form w-full max-w-sm">{children}</div>
        </div>
      </div>

      <aside className="hidden flex-col justify-between border-l border-border bg-surface-sunken/70 px-14 py-12 lg:flex xl:px-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Case practice for MBA placements
        </p>
        <p className="font-editorial text-[5.5rem] leading-[0.92] tracking-[-0.025em]">
          Every case,
          <br />
          <em className="italic">rehearsed.</em>
        </p>
        <p className="max-w-sm border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
          Finance, consulting and product cases, solved under interview
          conditions and marked against a rubric — criterion by criterion.
        </p>
      </aside>
    </div>
  );
}
