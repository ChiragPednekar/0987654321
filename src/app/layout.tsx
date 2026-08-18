import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111112" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
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
                  "!bg-popover !text-popover-foreground !border-border !rounded-lg",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
