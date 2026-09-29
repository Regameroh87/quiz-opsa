# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players:** customers of an official New Holland dealership (OPSA) attending customer events. They join from their own phones by scanning a QR code or typing a 6-character code, choose a nickname, and answer timed multiple-choice questions. They don't have accounts; the session is anonymous and survives a reload.
- **Admins/hosts:** several people on the dealership's team. Each one creates quizzes, starts games, and runs them from a computer connected to the event's shared screen.

## Product Purpose

A live quiz game in the style of Kahoot for dealership customer events: a host runs the game on a shared screen, and the audience plays in real time from their phones. Success means joining is effortless (scan, nickname, play), the game runs smoothly for a full room, and the event ends with a clear ranking and podium.

## Operating Context

- The event flow is: an admin signs in (`/`), builds or edits a quiz, and starts a game. The host screen (`/host/[gameId]`) shows a lobby with a QR code and join code, then each question with a countdown, the reveal with the answer distribution, an optional ranking, and finally a podium.
- Players use `/play` on their phones. They answer, then see whether they got it right, their points, and their position.
- Two very different screens are in play: the shared/projected screen, read from across the room, and each player's phone, held in the hand.

## Capabilities and Constraints

- Questions have 2 to 4 options, a time limit of 5 to 120 s, and speed-based scoring: 1000 points for an instant correct answer, down to 500 at the time limit.
- Up to 190 players per game, which is the Realtime connection limit of the Supabase plan.
- Access rules, scoring, and phase transitions are enforced in Postgres (RLS plus `security definer` RPCs); the correct answer never reaches players before the reveal.
- The stack is Next.js App Router, Supabase (Auth, Postgres, Realtime), deployed on Vercel.

## Brand Commitments

- The visible brand is **New Holland**, presented by the OPSA dealership. The logo is in `public/logo-new-holland.png`, and the current palette comes from New Holland's "Guía FieldOps" guide (see `src/app/globals.css`).
- The interface is in Spanish, using rioplatense *voseo* ("elegí", "tenés", "sumate").

## Evidence on Hand

- New Holland logo and favicon in `public/`.
- `supabase/seed.sql` holds only a placeholder sample quiz; it is not real event content.
- There are no testimonials, photos of past events, or real quiz content in the repo. Don't invent any.

## Product Principles

1. Joining takes seconds: QR, nickname, play, with no accounts or installs for players.
2. The shared screen runs the room: it has to read from far away and move the event forward with minimal host effort.
3. Fairness is guaranteed by the server: timing, scoring, and answers are validated server-side, never trusted to the client.
4. It's a New Holland dealership experience: the brand stays recognizable without getting in the way of the game.

## Accessibility & Inclusion

- The white text on the answer-option colors keeps at least WCAG AA contrast (an existing commitment in `globals.css`).
