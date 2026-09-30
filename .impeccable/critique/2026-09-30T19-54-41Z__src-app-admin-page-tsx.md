---
target: home
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx"
target_fingerprint: "sha256:cb473faf292ee1d530da450d9f1b41776c86363b44a41c65400db7d105f3f9da"
target_path: /Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx
timestamp: 2026-09-30T19-54-41Z
slug: src-app-admin-page-tsx
closed: true
---
Method: dual-agent (A: a383049060696d339 · B: a6724636f03bc3a8c). A was source-only (no browser: admin login required); B detector ran, browser step skipped.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live strip strong; loading is bare text; no pending state on strip "Controlar". |
| 2 | Match System / Real World | 4 | Dealership vocabulary throughout. |
| 3 | User Control and Freedom | 3 | Inline confirm + Escape; no undo or duplicate quiz. |
| 4 | Consistency and Standards | 3 | Two "Controlar" for one game; Editar/Borrar identical; buttons 17px vs 22px in DESIGN.md. |
| 5 | Error Prevention | 3 | Launch disabled for empty quizzes, only discoverable via meta line. |
| 6 | Recognition Rather Than Recall | 3 | Podium-chaining mode changes "Lanzar" and is explained only in a paragraph. |
| 7 | Flexibility and Efficiency | 1 | No search, sort, duplicate, or relaunch-last. |
| 8 | Aesthetic and Minimalist Design | 2 | Three repeated actions per card, permanent instruction paragraph, yellow everywhere. |
| 9 | Error Recovery | 3 | In-context errors with fix links and retry. |
| 10 | Help and Documentation | 2 | One always-on paragraph that depends on hidden state. |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict
Authored for this product (~80%): sticker language from login, domain logic in UI (12h live window, duplicate-projector warning, sign-out guard, podium chaining). Generic in the list (plain 2-col grid of identical cards) and in repeated yellow.
Detector: 10 advisory design-system-drift findings (4 font-size, 5 color, 1 radius), no anti-patterns. Only page.tsx:138 is local to the page; rest in globals.css and OptionButton. None false positive; gradient and shadow colors likely intentional but undocumented.

## Priority Issues
- [P1] Yellow repeated on every card; no primary path (quieter, layout)
- [P1] No scaling path for many quizzes (layout, distill)
- [P2] Permanent instruction paragraph and hidden podium launch mode (clarify)
- [P2] Editar/Borrar identical and adjacent (harden)
- [P3] Loading text, pulse not reduced-motion gated, tilt shimmer (polish, harden)

## Persona Red Flags
Alex: no search/sort/shortcuts/duplicate; list reflows under cursor on refresh.
Sam: good alert/focus handling; ink-soft contrast margin, yellow title ~3.7:1, pulsing dot not motion-gated.
OPSA event operator: duplicate "Controlar", risk of launching into old projector, no total duration or tested signal on quizzes of other socios.

## Minor Observations
Null session marks all quizzes "De otro socio"; meta date less useful than last use/duration; limit message reads as error; empty state lists features; card height jumps; button size drifts from DESIGN.md.

## Questions to Consider
Home as "today's event"? Which single quiz deserves yellow? Should podium chaining be a named visible mode?
