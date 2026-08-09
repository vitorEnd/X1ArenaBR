import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/metadata";

export function createPrivatePageMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    ...createPageMetadata(title, description),
    robots: { index: false, follow: false, noarchive: true },
  };
}
