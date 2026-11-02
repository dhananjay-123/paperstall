import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Caveat, Schibsted_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Paperstall — Draw it. Snap it. Get paid.", template: "%s · Paperstall" },
  description:
    "Turn a photo of a chalkboard menu, a handwritten bill or a lessons notice into a real way to get paid with PayPal.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1530" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading headers makes every page dynamic, which the per-request CSP nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${schibsted.variable} ${caveat.variable} h-full`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col paper-grain dark:blueprint-grid">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
