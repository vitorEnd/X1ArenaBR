export interface PublicQueueStatusResponse {
  readonly configured: boolean;
  readonly available: boolean;
  readonly active: boolean;
  readonly playersSearching: number;
  readonly checkedAt: string;
}

export function normalizePublicQueueCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

