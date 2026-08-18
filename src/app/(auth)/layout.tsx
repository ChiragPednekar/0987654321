import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8">
        <Link href="/" className="flex items-center gap-2 self-start">
          <div className="grid size-7 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            C
          </div>
          <span className="font-semibold tracking-tight">CaseCode</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <aside className="hidden flex-col justify-between border-l border-border bg-muted/40 p-12 lg:flex">
        <div />
        <blockquote className="space-y-4">
          <p className="text-2xl font-medium leading-snug tracking-tight">
            &ldquo;Reading casebooks taught me the frameworks. Solving 80 cases
            here taught me to actually pick a number and defend it.&rdquo;
          </p>
          <footer className="text-sm text-muted-foreground">
            The gap CaseCode is built to close.
          </footer>
        </blockquote>
        <dl className="grid grid-cols-3 gap-6 border-t border-border pt-8">
          {[
            ["300+", "cases"],
            ["5", "domains"],
            ["Weekly", "contests"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="text-2xl font-semibold tracking-tight tabular">
                {value}
              </dt>
              <dd className="text-sm text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
