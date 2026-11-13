# Handoff: Beast Nutrition "Carduri luminoase" format, then the Inner Beast Azi cleanup

## Goal
The user (writes in Romanian) is polishing their Beast PWA family on bladejhs.github.io.

- **Beast Nutrition.** After "nu-mi place formatul aplicatiei per total" the user picked three problems: too many screens, too much text, and awkward food logging. For the look they picked "Carduri luminoase": rounded cards, warmer, friendlier.
- **Inner Beast (newest request).** "Iar la Inner Beast vreau tab ul de azi sa fie mai aerist chestionarul sa fie optional si elimina de invatat": a more airy Azi tab, an optional questionnaire, and the "de învățat" section removed.

## Status
- **Done and deployed** (Pages run success):
  - Beast Nutrition `296aa5f`: the Azi rearrangement (kcal ring, count-up numbers, quick plates, entrance animations).
  - Beast Nutrition `0affc66`:
    - four tabs: Azi, Mese, Corp, Mai mult;
    - the rounded-card override layer;
    - a green + (`.fab`);
    - "+ N g" one-tap add on recent foods.
- **Not started:** the Inner Beast Azi cleanup. It is done in the same session right after this handoff; check the inner-beast git log.
- **Optional:** the Plan screen in Beast Nutrition is still long and wordy. It was offered to the user, who has not answered.

## Decisions
- **Mese** is the meal plan shown as a tab through `mealsTab()` in `src/screens/fuel.ts`, with no back link.
- **Mai mult** is the old Fuel home without a hero. It also lists Planul meu (`data-tab="plan"`, which renders with a back link to Mai mult), Alimentele mele, Micronutrienți and Mentalitate.
- **The new look is an override layer appended at the end of `src/styles.css`**, under the comment "Carduri luminoase". Older rules stay underneath it.
  - Icon chip colours come from `data-k` attributes.
  - `banner()` in `parts.ts` now renders an icon `head()`, with no photo.

## Dead ends
- **Python heredocs and `python -` in Bash hang.** They open the Windows pyrepl and fail with WinError 123. Write a .py file to the scratchpad and run `python -I -X utf8 file.py`.
- **`git add` / `git commit` may fail with "Permission denied" on `.git/objects`.** Retry in a loop.

## Files
- `src/screens/today.ts`: Azi (`numbers`, `quick`, `weekRow`, `todayHtml`, `slide`).
- `src/app.ts`: `ctx.fresh`, `countUp`, `data-ring` handling in `afterRender`.
- `src/main.ts`: router, `ICONS`, `TAB_NAME`, `home()`, the `views` map.
- `src/screens/fuel.ts`: `home()` (Mai mult), `mealsTab()`, `meals()`.
- `src/screens/log.ts`: `recentRow`, `lastGrams`, the `data-qadd` action.
- `src/screens/parts.ts`: `ICON`, `head`, `banner`, `back` (default label "Mai mult").
- Screenshot tooling lives in the scratchpad:
  - `C:\Users\Andrei PC\AppData\Local\Temp\claude\4cbdb4d8649f704d\6265b167-b07b-4bd9-8b9d-e24bc5e785fa\scratchpad\shot.mjs`
  - `C:\Users\Andrei PC\AppData\Local\Temp\claude\4cbdb4d8649f704d\6265b167-b07b-4bd9-8b9d-e24bc5e785fa\scratchpad\sheet.cjs`
  - `C:\Users\Andrei PC\AppData\Local\Temp\claude\4cbdb4d8649f704d\6265b167-b07b-4bd9-8b9d-e24bc5e785fa\scratchpad\light.json`, which needs the dev server: `npx.cmd vite --port 5320 --strictPort --host 127.0.0.1`.

## Verification
- In `beast-nutrition`, run `npx.cmd tsc --noEmit`, `npm.cmd test` (last result: 144 pass) and `npm.cmd run build`.
- After a push, run `gh run list --limit 1`. The last run was a success.

## Next steps
1. Inner Beast Azi: make it airier, make the questionnaire optional, remove "de învățat". Then test, build, push and wait for Pages.
2. Optionally trim the Beast Nutrition Plan screen.

## Standing instructions
- Reply in Romanian and name the app that changed.
- Push to main after each batch, wait for the Pages run, and tell the user to open the app twice.
- Stage files by path. Never commit `docs/handoffs`.
- End commit messages with "Claude-Session: https://claude.ai/code/session_018EKgfVZ5Smwt8yKyxrHyV9".
- Never edit `calc.ts` or `review.ts`.
- Inner Beast gets no nutrition.
- Use `npm.cmd` / `npx.cmd`.
