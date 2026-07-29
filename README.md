# Episodic

A personal, local-first **TV tracker** built to replace [TV Time](https://www.tvtime.com), which shuts down on **July 15, 2026**. Track the shows you watch, mark episodes, see what's up next and what's airing soon, and **import your TV Time history** before it's deleted.

Runs on **iOS, Android, and the web** from one codebase.

## Highlights

- **Local-first** — your watch data lives on your device (SQLite on mobile, `localStorage` on web). No account, no server.
- **Up next** — the next unwatched episode for every show you're watching.
- **Library** — everything you track, filterable by Watching / Plan to watch / Completed / Dropped.
- **Show detail** — seasons and episodes; tap to mark watched, or mark a whole season at once.
- **Search** — find shows via [TMDB](https://www.themoviedb.org) and add them to your library.
- **Upcoming** — episodes with future air dates for the shows you follow.
- **Import from TV Time** — dry-run preview, parallel import with cancel, and manual TMDB rematch for unmatched titles.
- **Backup & restore** — export your whole library to JSON so you're never locked in again.
- **Installable builds** — EAS profiles for Android APK / App Bundle and iOS builds (`eas.json`).

## Tech stack

- [Expo](https://expo.dev) (React Native) + [Expo Router](https://docs.expo.dev/router/introduction/) + TypeScript
- [NativeWind v4](https://www.nativewind.dev) (Tailwind CSS) for styling — dark media-tracker theme in `tailwind.config.js`
- [TanStack Query](https://tanstack.com/query) for all async DB/TMDB state — caching, background refetch, and automatic invalidation after mutations (`lib/queries.ts`)
- [Zustand](https://zustand.docs.pmnd.rs) for global client state — TMDB key and library filter (`lib/store.ts`)
- `expo-sqlite` on native, `localStorage` on web (unified behind `lib/db.ts`)
- [TMDB API](https://developer.themoviedb.org/docs) for show/episode metadata

### State management

- **Server/DB state → React Query.** Every read (`useShows`, `useEpisodes`, `useContinueWatching`, `useUpcoming`, TMDB search/detail) is a query; every write (`useAddShow`, `useToggleEpisode`, `useSetShowStatus`, `useImportTvTime`, …) is a mutation that invalidates the affected queries, so screens update automatically without manual refetch-on-focus.
- **Client state → Zustand.** The `useAppStore` holds the TMDB API key (hydrated from storage at launch, read by the TMDB client via `getApiKey()`) and the current library filter.

## Prerequisites

- Node.js 18+ and npm
- A free **TMDB API key** — create one at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api). Either a v3 API key or a v4 read access token works. You paste it into the app's Settings (stored only on your device).

## Getting started

```bash
npm install
npm run web      # open in the browser
# or
npm start        # Expo dev server: press a (Android), i (iOS), or scan with Expo Go
```

On first launch, go to **Settings → TMDB API key**, paste your key, and save. Then use **Search** to add shows.

## Importing from TV Time

TV Time deletes all personal data after **July 15, 2026** — export yours now, even before you finish setting this up.

1. In TV Time, request your data export via their GDPR self-service download.
2. In Episodic: **Profile / Settings → Import from TV Time → Select GDPR ZIP or CSVs** (the ZIP is preferred; no need to unzip).
3. Review the **dry-run preview** (nothing is written yet).
4. Tap **Import for real**. Matching runs in parallel; you can **Cancel** mid-import (already-imported items are kept).
5. For any **Shows/Movies not found**, tap **Rematch**, search TMDB, and pick the correct title — watched history from the export is applied automatically.

## Installable builds (EAS)

Episodic can be packaged as a real Android APK / iOS build with [EAS Build](https://docs.expo.dev/build/introduction/). Config lives in `eas.json`.

```bash
# one-time: Expo account + link this project
npm i -g eas-cli
eas login
eas init          # creates an Expo project and writes the projectId into app.json

# internal/test APK (Android) or ad-hoc build (iOS)
npm run build:android
npm run build:ios

# store-ready
npm run build:android:prod
npm run build:ios:prod
```

- **preview** profile → Android APK you can sideload; iOS internal distribution.
- **production** profile → Android App Bundle / iOS App Store build.
- Bump `expo.version`, `android.versionCode`, and `ios.buildNumber` in `app.json` before each store release.

You need an Expo account. iOS device builds also need an Apple Developer account when you distribute outside Expo Go.

## Project structure

```
app/
  _layout.tsx          # Root stack, DB init, global.css
  (tabs)/
    index.tsx          # Home / Up next
    library.tsx        # My shows (filterable grid)
    search.tsx         # TMDB search + add
    upcoming.tsx       # Future episodes
    settings.tsx       # TMDB key, backup/restore, import
  show/[id].tsx        # Show detail + episode tracking
  import.tsx           # TV Time CSV import flow
components/
  ui.tsx               # Poster, Button, ProgressBar, EmptyState, etc.
lib/
  db.ts                # Storage layer (SQLite / web) + high-level queries
  queries.ts           # React Query client + query/mutation hooks
  store.ts             # Zustand store (API key, library filter)
  tmdb.ts              # TMDB client
  export.ts            # JSON backup / restore
  import/tvtime.ts     # TV Time CSV parser + import
  types.ts             # Shared types
global.css             # Tailwind entry (NativeWind)
tailwind.config.js     # Theme
```

## Data & privacy

Everything stays on your device. The only network calls are to TMDB (for search, posters, and episode lists) using the API key you provide. Use **Settings → Export backup** to keep a portable copy of your data.

## Roadmap (not in v1)

Cloud sync across devices, movies, ratings/notes, home-screen widgets, new-episode notifications, and Trakt/TVmaze import.
