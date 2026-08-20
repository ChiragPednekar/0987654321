import Link from "next/link";

/**
 * Chrome for the policy pages. Deliberately plain: these are read rarely and
 * skimmed when they are, so the priority is legibility over design.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">
            CaseCode
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/how-grading-works" className="hover:text-foreground">
              How grading works
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article
          className="prose-legal space-y-6 text-sm leading-relaxed text-muted-foreground
            [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground
            [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground
            [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5"
        >
          {children}
        </article>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-3xl px-4 text-xs text-muted-foreground sm:px-6">
          CaseCode — practise business cases, get graded, improve.
        </p>
      </footer>
    </div>
  );
}
