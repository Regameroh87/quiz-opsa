---
target: home
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx"
target_fingerprint: "sha256:7bcf29dd4b38e4c364f656d1ac78772420fee5a86ddb1a25def6a7a396e54387"
target_path: /Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx
timestamp: 2026-09-30T20-11-39Z
slug: src-app-admin-page-tsx
---
Method: dual-agent (A: af868efe3f950fda1 · B: ae46ba3c216ba3766). A was source-only (admin login required); B detector ran, browser step skipped.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live strip strong; podium mode invisible; failed refresh keeps stale data silently. |
| 2 | Match System / Real World | 3 | Socios vs equipo, partida vs sala mixed. |
| 3 | User Control and Freedom | 3 | Inline confirm + Escape; no undo or duplicate. |
| 4 | Consistency and Standards | 2 | DESIGN.md drift: 17px buttons, alert red on live dot, Bowlby on secondary headings, Nuevo quiz ghost vs yellow. |
| 5 | Error Prevention | 3 | Borrar adjacent to Editar. |
| 6 | Recognition Rather Than Recall | 2 | No last-used info; podium mode remembered from paragraph. |
| 7 | Flexibility and Efficiency | 1 | No search/sort/duplicate; launch is last tab stop per row. |
| 8 | Aesthetic and Minimalist Design | 2 | Permanent explainer; three levels of sticker frames. |
| 9 | Error Recovery | 3 | In-context errors with fix link and retry. |
| 10 | Help and Documentation | 2 | Only help is an always-on paragraph. |
| **Total** | | **24/40** | **Acceptable** |

Score dropped from 27 to 24 but it is an independent stricter review, not a measured regression; heuristics 2, 4, 6 dropped on pre-existing items.

## Design Specificity Verdict
Mostly authored (sticker world, live strip, event copy). Generic in library rows, repeated ghost launch button, and metadata (count + created date instead of last played/players/duration).
Detector: 9 advisory design-system-drift findings (3 font-size, 5 color, 1 radius), none in page.tsx/layout.tsx; page-relevant ones are .sticker-panel radius/shadow, .field gradient, danger shadow. Down from 10 after polish fixed page.tsx:138.

## Priority Issues
- [P1] No way to manage a growing library (layout, distill)
- [P1] Podium-chain mode invisible at the decision point (clarify, shape)
- [P2] Design-system drift and ink-soft contrast on field glow (polish, colorize)
- [P2] Thin loading and refresh states (harden)
- [P3] Launch moment and first-run (onboard, delight)

## Persona Red Flags
Alex: no search/sort/shortcuts/duplicate; launch is third tab stop per row.
Sam: pulse ignores reduced-motion; ink-soft near 4.5:1 on glow; live strip changes not announced.
OPSA operator: cannot find today's quiz fast; must read paragraph to learn tab/projector model; no compact mode on phone.

## Minor Observations
Terminar vs Terminar partida; partida vs sala; empty quiz button disabled without reason; limit message has no next step; owner label text-sm; dividers may be faint; up to three levels of sticker frames; Logo has no sticker treatment (unverified).

## Questions to Consider
Quiz as pickable sticker? Event mode to pin today's quizzes? Live game as the home with library in a Preparar drawer?
