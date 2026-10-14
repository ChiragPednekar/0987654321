import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, IBM_Plex_Mono, IBM_Plex_Sans, Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ProctorEndedHost } from "@/components/proctor/proctor-ended";
import "./globals.css";

/**
 * IBM Plex: a working typeface drawn for software and documentation, with the
 * slightly engineered character that suits scores, rubrics and spreadsheets.
 *
 * Only 400, 500 and 600 are loaded, on purpose. The type hierarchy is regular
 * for reading, medium for labels and controls, semibold for headings — and
 * with no 700 file present, a stray `font-bold` renders at 600 instead of
 * shouting.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Headings. A newspaper grotesk with a little bite in the R, G and a — enough
 * character that a page title reads as a title, without competing with the
 * interface text set in Plex underneath it.
 */
const display = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * The editorial face: the landing hero, the sign-in panel, and page and
 * section titles on the dashboards. A Didone with an optical-size axis, so at
 * headline size it gets its display cut — fine hairlines, a confident italic.
 * Preloaded, because a dashboard title flashing from the fallback serif on
 * every visit would undo the point of it.
 */
const editorial = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
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
    { media: "(prefers-color-scheme: light)", color: "#f1f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#121714" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} ${display.variable} ${documentSerif.variable} ${editorial.variable} min-h-screen font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
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
                  "!bg-popover !text-popover-foreground !border-border !rounded-md !shadow-md !font-sans",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
