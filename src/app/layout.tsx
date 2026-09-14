import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
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
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} min-h-screen font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
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
