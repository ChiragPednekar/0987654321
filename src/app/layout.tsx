import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ProctorEndedHost } from "@/components/proctor/proctor-ended";
import "./globals.css";

/**
 * Type follows Apple's system: SF Pro for everything, New York for the case
 * brief, SF Mono for code. Those ship with Apple devices and cannot be served
 * to anyone else, so the stacks in globals.css name them first and fall back
 * to the two faces loaded here — Inter (the closest open cut of SF's
 * proportions) and Source Serif 4 — on Windows and Android.
 *
 * The variables are set on <html>, not <body>, so the stacks declared on
 * :root in globals.css can resolve them.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The case itself. A case is a document — a brief, a set of figures, a model
 * answer — so it is set like one, in a text serif, and the interface around it
 * stays sans. The switch in typeface is what tells a student which words are
 * the problem and which are the tool.
 */
const documentSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CaseCode — Practise business cases, get graded by AI",
    template: "%s · CaseCode",
  },
  description:
    "The LeetCode of business cases. Solve realistic finance, consulting and product cases, get rubric-based AI evaluation, track your progression and compete on the leaderboard.",
  keywords: [
    "business case practice",
    "case interview",
    "MBA",
    "consulting",
    "finance",
    "product management",
  ],
  openGraph: {
    title: "CaseCode",
    description:
      "Solve realistic business cases. Get AI evaluation against a rubric. Track your progress.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${documentSerif.variable}`}
    >
      <body
        className="min-h-screen font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ProctorEndedHost />
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-popover !text-popover-foreground !border-border-subtle !rounded-xl !shadow-lg !font-sans",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
