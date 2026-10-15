"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";

/** The signed-in admin-area account, for showing or hiding UI. The API enforces the same rules. */
export type Viewer = { role: UserRole; company: string | null; displayName: string };

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside ViewerProvider");
  return viewer;
}
