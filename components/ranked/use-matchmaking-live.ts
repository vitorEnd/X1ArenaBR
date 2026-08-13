"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  rankedUiAdapter,
  type MatchmakingSnapshotResponse,
  type RankedMatchIntent,
  type RankedMutationResponse,
  type RankedUiAdapter,
} from "./adapter";

interface UseMatchmakingLiveOptions {
  readonly adapter?: RankedUiAdapter;
}

export function useMatchmakingLive({
  adapter = rankedUiAdapter,
}: UseMatchmakingLiveOptions = {}) {
  const [snapshot, setSnapshot] = useState<MatchmakingSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const refreshControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;

    try {
      const nextSnapshot = await adapter.getSnapshot(controller.signal);
      if (!mountedRef.current) return;
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (refreshError) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível atualizar o estado da Arena.",
      );
    } finally {
      if (refreshControllerRef.current === controller) {
        refreshControllerRef.current = null;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, [adapter]);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefresh = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(initialRefresh);
      mountedRef.current = false;
      refreshControllerRef.current?.abort();
      refreshControllerRef.current = null;
    };
  }, [refresh]);

  const profileId = snapshot?.profile?.id ?? null;
  const needsLiveUpdates = Boolean(
    snapshot?.queue?.state === "searching" ||
      snapshot?.foundMatch ||
      snapshot?.activeMatch,
  );
  const currentMatchId =
    snapshot?.foundMatch?.matchId ?? snapshot?.activeMatch?.matchId ?? null;

  useEffect(() => {
    if (!snapshot?.configured || !profileId) return;

    let supabase;
    try {
      supabase = createClient();
    } catch {
      // Snapshot polling remains available if Realtime is temporarily unavailable.
      return;
    }
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 120);
    };

    let channel = supabase
      .channel(`ranked-profile:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ranked_notifications",
          filter: `recipient_profile_id=eq.${profileId}`,
          select: ["id", "recipient_profile_id", "kind", "created_at", "read_at"],
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ranked_profiles",
          filter: `id=eq.${profileId}`,
          select: [
            "id",
            "username",
            "avatar_path",
            "wins",
            "losses",
            "placement_matches",
            "updated_at",
          ],
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ranked_queue_entries",
          filter: `profile_id=eq.${profileId}`,
          select: ["id", "profile_id", "status", "match_id", "updated_at"],
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ranked_post_match_choices",
          filter: `profile_id=eq.${profileId}`,
          select: ["id", "match_id", "profile_id", "requeue", "acknowledged_at"],
        },
        scheduleRefresh,
      );

    if (currentMatchId) {
      channel = channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ranked_matches",
            filter: `id=eq.${currentMatchId}`,
            select: [
              "id",
              "status",
              "accept_deadline",
              "room_name",
              "room_password",
              "score_deadline",
              "confirmation_deadline",
              "player_one_score",
              "player_two_score",
              "updated_at",
            ],
          },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ranked_match_acceptances",
            filter: `match_id=eq.${currentMatchId}`,
            select: ["id", "match_id", "profile_id", "state", "responded_at"],
          },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ranked_result_confirmations",
            filter: `match_id=eq.${currentMatchId}`,
            select: ["id", "match_id", "profile_id", "state", "responded_at"],
          },
          scheduleRefresh,
        );
    }

    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [currentMatchId, profileId, refresh, snapshot?.configured]);

  useEffect(() => {
    if (!needsLiveUpdates) return;
    const refreshDelay = snapshot?.activeMatch ? 5_000 : 3_000;
    const fallbackInterval = setInterval(() => void refresh(), refreshDelay);
    return () => clearInterval(fallbackInterval);
  }, [needsLiveUpdates, refresh, snapshot?.activeMatch]);

  useEffect(() => {
    if (!profileId || snapshot?.queue?.state !== "idle") return;
    const queueCountInterval = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(queueCountInterval);
  }, [profileId, refresh, snapshot?.queue?.state]);

  useEffect(() => {
    if (snapshot?.queue?.state !== "searching") return;

    const heartbeat = async () => {
      try {
        await adapter.updateQueue("heartbeat");
      } catch {
        // The short polling fallback will surface a persistent failure.
      }
    };

    const heartbeatInterval = setInterval(() => void heartbeat(), 8_000);
    return () => clearInterval(heartbeatInterval);
  }, [adapter, snapshot?.queue?.state]);

  const mutate = useCallback(
    async (operation: () => Promise<RankedMutationResponse>) => {
      setBusy(true);
      setError(null);
      try {
        const response = await operation();
        if (!response.ok) throw new Error(response.message);
        await refresh();
        return response;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Não foi possível concluir a ação.";
        setError(message);
        throw mutationError;
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [refresh],
  );

  const updateQueue = useCallback(
    (intent: "join" | "leave") => mutate(() => adapter.updateQueue(intent)),
    [adapter, mutate],
  );

  const updateMatch = useCallback(
    (matchId: string, payload: RankedMatchIntent) =>
      mutate(() => adapter.updateMatch(matchId, payload)),
    [adapter, mutate],
  );

  return {
    snapshot,
    loading,
    busy,
    error,
    refresh,
    updateQueue,
    updateMatch,
  };
}

export function useMatchFoundAlert(
  matchId: string | null,
  shouldSound: boolean,
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const notifiedMatchRef = useRef<string | null>(null);

  const prepareAlerts = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextConstructor && !audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume().catch(() => undefined);
    }

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => "denied");
    }
  }, []);

  useEffect(() => {
    if (!matchId || !shouldSound) return;

    const playSignal = () => {
      const context = audioContextRef.current;
      if (!context || context.state !== "running") return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(720, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.27);
    };

    playSignal();
    const signalInterval = setInterval(playSignal, 1_250);

    if (
      notifiedMatchRef.current !== matchId &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      notifiedMatchRef.current = matchId;
      new Notification("Partida encontrada — AXB", {
        body: "Seu adversário está pronto. Você tem 15 segundos para aceitar.",
        icon: "/icon.png",
        tag: `axb-match-${matchId}`,
      });
    }

    return () => clearInterval(signalInterval);
  }, [matchId, shouldSound]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    [],
  );

  return { prepareAlerts };
}
