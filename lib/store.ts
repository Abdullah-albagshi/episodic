import { create } from "zustand";
import { getSetting, setSetting } from "./db";
import type { ShowStatus } from "./types";

export const TMDB_KEY_SETTING = "tmdb_api_key";

export type LibraryFilter = "all" | ShowStatus;

interface AppState {
  /** TMDB API key (v3 key or v4 token). `null` until hydrated / if unset. */
  apiKey: string | null;
  /** True once we've read the key from persistent storage at least once. */
  hydrated: boolean;
  /** Currently selected filter on the Library screen. */
  libraryFilter: LibraryFilter;

  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setLibraryFilter: (filter: LibraryFilter) => void;
}

/**
 * Global client-side state. Server/DB state lives in React Query; this store is
 * only for values that are shared across screens and change independently of a
 * fetch: the TMDB key and the library filter.
 */
export const useAppStore = create<AppState>((set) => ({
  apiKey: null,
  hydrated: false,
  libraryFilter: "all",

  hydrate: async () => {
    const key = await getSetting(TMDB_KEY_SETTING);
    set({ apiKey: key, hydrated: true });
  },

  setApiKey: async (key: string) => {
    const trimmed = key.trim();
    await setSetting(TMDB_KEY_SETTING, trimmed);
    set({ apiKey: trimmed });
  },

  setLibraryFilter: (filter) => set({ libraryFilter: filter }),
}));

/** Read the current API key outside React (used by the TMDB client). */
export const getApiKey = (): string | null => useAppStore.getState().apiKey;
