import { create } from "zustand";
import { getSetting, setSetting } from "./db";
import type { ShowStatus } from "./types";

export const TMDB_KEY_SETTING = "tmdb_api_key";
export const LIBRARY_VIEW_SETTING = "library_view";

export type LibraryFilter = "all" | ShowStatus;

/** How the Library screen lays out shows. */
export type LibraryView = "grid" | "list" | "compact";

const LIBRARY_VIEWS: LibraryView[] = ["grid", "list", "compact"];

interface AppState {
  /** TMDB API key (v3 key or v4 token). `null` until hydrated / if unset. */
  apiKey: string | null;
  /** True once we've read the key from persistent storage at least once. */
  hydrated: boolean;
  /** Currently selected filter on the Library screen. */
  libraryFilter: LibraryFilter;
  /** Currently selected layout on the Library screen. */
  libraryView: LibraryView;

  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setLibraryFilter: (filter: LibraryFilter) => void;
  setLibraryView: (view: LibraryView) => void;
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
  libraryView: "grid",

  hydrate: async () => {
    const [key, view] = await Promise.all([
      getSetting(TMDB_KEY_SETTING),
      getSetting(LIBRARY_VIEW_SETTING),
    ]);
    set({
      apiKey: key,
      libraryView: LIBRARY_VIEWS.includes(view as LibraryView)
        ? (view as LibraryView)
        : "grid",
      hydrated: true,
    });
  },

  setApiKey: async (key: string) => {
    const trimmed = key.trim();
    await setSetting(TMDB_KEY_SETTING, trimmed);
    set({ apiKey: trimmed });
  },

  setLibraryFilter: (filter) => set({ libraryFilter: filter }),

  setLibraryView: (view) => {
    set({ libraryView: view });
    // Persist the preference; fire-and-forget so the toggle stays snappy.
    void setSetting(LIBRARY_VIEW_SETTING, view);
  },
}));

/** Read the current API key outside React (used by the TMDB client). */
export const getApiKey = (): string | null => useAppStore.getState().apiKey;
