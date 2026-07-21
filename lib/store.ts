import { create } from "zustand";
import { getSetting, setSetting } from "./db";
import { setAppLocale, type AppLocale } from "./i18n";
import type { ShowStatus } from "./types";

export const TMDB_KEY_SETTING = "tmdb_api_key";
export const LIBRARY_VIEW_SETTING = "library_view";
export const SKIP_EPISODE_PROMPT_SETTING = "skip_episode_prompt";
export const LOCALE_SETTING = "locale";

export type LibraryFilter = "all" | ShowStatus;

/** How the Library screen lays out shows. */
export type LibraryView = "grid" | "list" | "compact";

/** "ask" = prompt when skipping; "never" = always mark previous without asking. */
export type SkipEpisodePrompt = "ask" | "never";

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
  /** Whether to prompt when the user skips earlier episodes. */
  skipEpisodePrompt: SkipEpisodePrompt;
  /** UI language. */
  locale: AppLocale;

  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setLibraryFilter: (filter: LibraryFilter) => void;
  setLibraryView: (view: LibraryView) => void;
  setSkipEpisodePrompt: (value: SkipEpisodePrompt) => Promise<void>;
  setLocale: (locale: AppLocale) => Promise<void>;
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
  skipEpisodePrompt: "ask",
  locale: "en",

  hydrate: async () => {
    const [key, view, skipPrompt, locale] = await Promise.all([
      getSetting(TMDB_KEY_SETTING),
      getSetting(LIBRARY_VIEW_SETTING),
      getSetting(SKIP_EPISODE_PROMPT_SETTING),
      getSetting(LOCALE_SETTING),
    ]);
    set({
      apiKey: key,
      libraryView: LIBRARY_VIEWS.includes(view as LibraryView)
        ? (view as LibraryView)
        : "grid",
      skipEpisodePrompt: skipPrompt === "never" ? "never" : "ask",
      locale: locale === "ar" || locale === "en" ? locale : "en",
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
    void setSetting(LIBRARY_VIEW_SETTING, view);
  },

  setSkipEpisodePrompt: async (value) => {
    await setSetting(SKIP_EPISODE_PROMPT_SETTING, value);
    set({ skipEpisodePrompt: value });
  },

  setLocale: async (locale) => {
    await setSetting(LOCALE_SETTING, locale);
    await setAppLocale(locale);
    set({ locale });
  },
}));

/** Read the current API key outside React (used by the TMDB client). */
export const getApiKey = (): string | null => useAppStore.getState().apiKey;
