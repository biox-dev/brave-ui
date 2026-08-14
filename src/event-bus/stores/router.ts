import { create } from "zustand";
import type { NavigateFunction } from "react-router";

type RouterState = {
  navigate: NavigateFunction | null;
  setNavigate: (navigate: NavigateFunction) => void;
  go: (path: string, state?: any) => void;
};

export const useRouterStore = create<RouterState>((set, get) => ({
  navigate: null,
  setNavigate: (navigate) => set({ navigate }),
  go: (path: string, state: any = {}) => {
    const navigate = get().navigate;
    if (!navigate) {
      console.warn("[LLM] Router is not ready yet, skip navigation:", path);
      return;
    }
    // debugger
    navigate(path, { state });
  },
}));