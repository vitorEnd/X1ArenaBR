import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { officialPlayers } from "@/data/arena";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  const routes = ["", "/eventos", "/rankings", "/categorias", "/jogadores", "/regulamento", "/sobre"];
  return [...routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: route === "" ? "weekly" as const : "monthly" as const, priority: route === "" ? 1 : 0.8 })), ...officialPlayers.map((player) => ({ url: `${base}/jogadores/${player.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 }))];
}
