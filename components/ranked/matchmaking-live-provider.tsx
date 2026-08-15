"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useMatchmakingLiveController } from "./use-matchmaking-live";

type MatchmakingLiveContextValue = ReturnType<typeof useMatchmakingLiveController>;

const MatchmakingLiveContext = createContext<MatchmakingLiveContextValue | null>(null);

export function MatchmakingLiveProvider({ children }: { readonly children: ReactNode }) {
  const controller = useMatchmakingLiveController();

  return (
    <MatchmakingLiveContext.Provider value={controller}>
      {children}
    </MatchmakingLiveContext.Provider>
  );
}

export function useMatchmakingLive() {
  const context = useContext(MatchmakingLiveContext);
  if (!context) {
    throw new Error("useMatchmakingLive deve ser usado dentro de MatchmakingLiveProvider.");
  }
  return context;
}
