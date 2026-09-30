# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Live, Kahoot-style quiz app ("Quiz New Holland"): an admin builds quizzes, hosts a game on a projector screen, and players join from their phones via QR/6-char code. Next.js 16 App Router + React 19 + Tailwind v4, with Supabase (Postgres, Auth, Realtime) as the entire backend. Deployed on Vercel. UI copy and code comments are in Spanish (rioplatense: "elegí", "tenés") — keep that voice.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint (next core-web-vitals + typescript)
- `npm run typecheck` — `tsc --noEmit` (strict, `noUnusedLocals/Parameters` on)

There is no test suite. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

Database: schema lives in `supabase/migrations/` (apply as new numbered migrations, don't edit `0001_init.sql` once applied); `supabase/seed.sql` is a sample quiz to run manually in the SQL editor.

## Architecture

**All pages are client components talking directly to Supabase** — no server actions. The only API route is `src/app/api/upload/route.ts`: it checks the caller is an admin (Supabase token + `admins` RLS) and returns a presigned PUT URL for Cloudflare R2, where question images live (`questions.image_url`). Images are resized to WebP in the browser (`src/lib/image.ts`) before uploading.

**Security model lives in Postgres, not in the app.** Read `supabase/migrations/0001_init.sql` before changing any game logic:
- Players sign in anonymously (`ensureSession()` in `src/lib/supabase.ts`); admins use email/password and must have a row in `admins` (`is_admin()`).
- `quizzes`/`questions` are admin-only via RLS. Players never read `questions` directly — they get the current question through `get_current_question`, which omits `correct_index` until the `reveal` phase.
- `games`, `players`, `answers` have no insert/update/delete policies; every write goes through `security definer` RPCs (`create_game`, `join_game`, `submit_answer`, `host_advance`, …). Scoring (1000 → 500 pts linear on speed, 1 s grace) and answer validation happen server-side in `submit_answer`.
- RPCs signal errors with `raise exception '<code>'`; `errorMessage()` in `src/lib/game.ts` maps those codes to Spanish UI strings. When adding a new error code, add it to the `ERRORS` map.
- The "current question" is always resolved as `order by position, id offset current_position` — keep that ordering consistent across functions.

**Game state machine** (`games.phase`): `lobby → question → reveal → (leaderboard) → question … → finished`, driven only by `host_advance(game_id, action)` with actions `start | reveal | leaderboard | next | finish`. Invalid transitions raise `invalid_transition`.

**Realtime sync** (`src/lib/game.ts` hooks, shared by host and player screens):
- `useGame` loads the `games` row and subscribes to its `UPDATE`s; it reloads on (re)subscribe because events can be missed on reconnect.
- `useQuestion` refetches via RPC when phase/position changes and hides a stale question until the new index arrives (otherwise the old expired timer would trigger an auto-reveal).
- `useRemaining` corrects client clock skew using `server_now` from the RPC.
- `players`, `answers`, `games` are in the `supabase_realtime` publication; `useHostLive` subscribes to player joins and answer inserts and is shared by the projector screen (`src/app/host/[gameId]/page.tsx`, display-only, auto-reveals once per question when time runs out or everyone answered) and the control screen (`src/app/(admin)/control/[gameId]/page.tsx`, mobile-first, where the admin drives every `host_advance` step).

**Routes:** the admin lives in the `(admin)` route group so its auth gate (`(admin)/layout.tsx`) doesn't wrap `/play` or `/host`: `/` (quiz list + "start game") → `/quiz/[id]` (editor, `new` for create); launching opens `/host/[gameId]` (projector view, QR lobby, no controls) in a new tab and moves the admin tab to `/control/[gameId]` (game controls, usable from a phone); `/play?code=XXXXXX` (player join + game, reconnects via `get_my_standing`).

**Styling:** Tailwind v4 configured in CSS (`src/app/globals.css`): New Holland brand colors in `@theme`, and shared primitives (`.page`, `.card`, `.btn`, `.btn-secondary`, `.input`, `.badge`, `.timer`) in `@layer components`. The host screen scales everything in `em` from a viewport-based base font size so it fits any projector.

Player count per game is capped at 190 in `join_game` (Supabase Realtime connection limit of the plan).
