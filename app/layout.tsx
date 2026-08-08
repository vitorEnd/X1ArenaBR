import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { headers } from "next/headers";
import { IntroSplash } from "@/components/intro-splash";
import { MotionProvider } from "@/components/motion-provider";
import { MobileDiscordCta } from "@/components/mobile-discord-cta";
import { PageTransition } from "@/components/page-transition";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

const siteMetadata: Metadata = {
  title: {
    default: "WOF Arena X1 BR | Rankings, Eventos e Cinturões",
    template: "%s | WOF Arena X1 BR",
  },
  description:
    "A comunidade competitiva de x1 do World of Football. Participe de eventos semanais, suba no ranking e dispute os cinturões da Arena X1 Brasil.",
  applicationName: "WOF Arena X1 BR",
  keywords: [
    "World of Football",
    "Arena X1 Brasil",
    "WOF Arena X1 BR",
    "ranking x1",
    "futebol x1",
    "AXB",
  ],
  authors: [
    { name: "Itz" },
    { name: "Vtzinn021" },
    { name: "Apenas João00325" },
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "WOF Arena X1 BR",
    title: "WOF Arena X1 BR | Rankings, Eventos e Cinturões",
    description:
      "Eventos semanais, ranking contínuo, rivalidades e cinturões no World of Football.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WOF Arena X1 BR",
    description:
      "Entre na Arena, suba no ranking e construa o seu legado.",
  },
  robots: { index: true, follow: true },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    ...siteMetadata,
    metadataBase,
    openGraph: {
      ...siteMetadata.openGraph,
      images: [
        {
          url: "/og.png",
          width: 1736,
          height: 906,
          alt: "WOF Arena X1 BR — Onde cada X1 vira história",
        },
      ],
    },
    twitter: {
      ...siteMetadata.twitter,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${barlow.variable}`}>
        <MotionProvider>
          <IntroSplash />
          <a className="skip-link" href="#conteudo-principal">
            Pular para o conteúdo
          </a>
          <SiteHeader />
          <main id="conteudo-principal"><PageTransition>{children}</PageTransition></main>
          <SiteFooter />
          <MobileDiscordCta />
        </MotionProvider>
      </body>
    </html>
  );
}
