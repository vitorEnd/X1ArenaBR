import type { Metadata } from "next";

export function createPageMetadata(
  title: string,
  description: string,
  absoluteTitle = false,
): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/og.png", width: 1736, height: 906, alt: "WOF Arena X1 BR — Onde cada X1 vira história" }],
    },
    twitter: { title, description, images: ["/og.png"] },
  };
}
