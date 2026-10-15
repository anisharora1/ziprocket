# ZipRocket Mobile App — Engineering Guidelines & Rules

This document outlines the strict guidelines for developing the React Native / Expo mobile app for ZipRocket.

## Core Rules & Isolation
1. **Never edit `client/` or `server/`:** All mobile work strictly takes place inside `mobile/`. Never run npm commands or modify any file outside `mobile/`.
2. **Never work on `main` branch:** All work happens on dedicated feature branches (e.g. `mobile-app`).
3. **No secrets in git:** Store secrets in `mobile/.env` (git-ignored) and document placeholder values in `mobile/.env.example`.
4. **Zero Backend Changes:** Reuse existing backend API endpoints as-is. No backend changes unless explicitly requested.

## UI Porting & Translation
1. **Source of Truth:** `client/src` is the single source of truth for all UI. Port screens exactly: layout, copy, colors, icons, and interactive behavior. Never redesign or improvise aesthetics.
2. **Web-to-Native Component Mapping:**
   - `<div>` / `<section>` / `<header>` / `<main>` $\rightarrow$ `<View>`
   - `<p>` / `<span>` / `<h1>`-`<h6>` $\rightarrow$ `<Text>` (All raw text MUST be wrapped inside `<Text>`)
   - `<img>` / Next.js `<Image>` $\rightarrow$ `<Image>` from `expo-image`
   - `<button>` / clickable items $\rightarrow$ `<Pressable>`
   - `<input>` $\rightarrow$ `<TextInput>`
   - Long item lists / `.map(...)` $\rightarrow$ `<FlatList>`
3. **Icons:** Use `@expo/vector-icons` (`MaterialIcons`). Web app uses `react-icons/md`, which maps 1-to-1 to MaterialIcons.
4. **Design Tokens:** Only import and use colors, spacing, radii, font sizes, and shadows from `@/constants/theme` (`src/constants/theme.ts`). Do not hardcode arbitrary hex codes or random paddings.
5. **Styling Engine:** Use plain React Native `StyleSheet.create({ ... })`. Do not use NativeWind until explicitly instructed.

## Development Workflow
1. **One Screen at a Time:** Work on exactly one screen per iteration, verify it, and commit after each screen.
2. **Translation Discrepancies Report:** After each screen, list anything that could not be translated directly from the web app (e.g. web-only DOM APIs, specific CSS pseudo-classes, or browser-specific behaviors).
3. **Running the App:**
   - Run `npx expo start` inside `mobile/` and scan the QR code with the Expo Go app on iOS or Android.
