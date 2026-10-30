import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Sign-in, sign-up and password pages: the form centred on the grouped grey
 * background in a white rounded card, the way Apple's account pages are, with
 * the product's line beside it on wide screens. The forms are styled by
 * `.auth-form` (globals.css): a large title and 44px fields.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <main id="main-content" tabIndex={-1} className="flex flex-col px-4 py-6 sm:px-6">
        <Link href="/" className="self-start" aria-label="CaseCode home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="auth-form w-full max-w-[26rem] rounded-2xl bg-card p-7 shadow-sm dark:shadow-none sm:p-9">
            {children}
          </div>
        </div>
      </main>

      <aside className="hidden flex-col justify-center bg-card px-14 py-12 lg:flex xl:px-20">
        <p className="text-[15px] font-semibold text-muted-foreground">
          Case practice for MBA placements
        </p>
        <p className="mt-4 text-[4.25rem] font-bold leading-[1.02] tracking-[-0.035em]">
          Every case,
          <br />
          <span className="text-muted-foreground">rehearsed.</span>
        </p>
        <p className="mt-6 max-w-md text-[1.2rem] leading-snug text-muted-foreground">
          Finance, consulting and product cases, solved under interview
          conditions and marked against a rubric — criterion by criterion.
        </p>
      </aside>
    </div>
  );
}
