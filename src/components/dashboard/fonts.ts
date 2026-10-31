import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * The dashboard's display and figure faces. Exposed as CSS variables for
 * `.dash-display` and `.dash-mono` in globals.css; `dashFonts` goes on the page
 * and on anything it portals (the briefing dialog), which sits outside it.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const dashFonts = `${jakarta.variable} ${jetbrains.variable}`;
