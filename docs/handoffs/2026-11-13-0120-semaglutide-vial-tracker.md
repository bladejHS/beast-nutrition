# Handoff: Beast Nutrition, semaglutide tracker with vial math (plus the recent Inner Beast Azi changes)

## Goal

The user writes in Romanian. They keep improving their Beast PWA family on bladejhs.github.io: Beast Nutrition, Inner Beast, Operator, Beast Fighter and Beast Psihologic.

Their latest requests:
- Put semaglutide in Beast Nutrition "cu cel mai bun protocol". Then: show how many UI on an insulin syringe each injection is, and how many ml of water to reconstitute a 10 mg vial with.
- Earlier: tidy up Inner Beast's Azi tab.

## Status

All of the following is done and deployed. Each push was followed by a successful Pages run, and the working tree is clean apart from the untracked `docs/`.

**Beast Nutrition**
- `0affc66`: "Carduri luminoase" look, and four tabs (Azi, Mese, Corp, Mai mult).
- `9e616ff`: semaglutide tracker. It has a screen under Mai mult → Semaglutidă and a card on Azi.
- `966300f`: vial reconstitution. Defaults are 10 mg and 2 ml, giving 5 mg/ml. On the U-100 syringe that is:

  | Dose | Units (UI) |
  |---|---|
  | 0.25 mg | 5 UI |
  | 0.5 mg | 10 UI |
  | 1 mg | 20 UI |
  | 1.7 mg | 34 UI |
  | 2.4 mg | 48 UI |

  It also shows mg left in the vial, warns when the mix is more than 28 days old, and lists the mixing steps.

**Inner Beast**
- `f63ecb5`: the readiness questionnaire is now optional and folds into one line; the "De învățat" section is removed.
- `ca110ee`: the daily mobility card is removed from Azi, and "Cum ești azi?" moved to the very bottom.

**Not started:** optional items the user was offered but has not answered.
- Trim the Beast Nutrition Plan screen.
- Add the supplement stack (creatine, caffeine, beta-alanine, bicarbonate, nitrate) to Suplimente, with times.
- Add to Inner Beast a 2nd lower-body strength session (no squats, no jumps), plus farmer carry and dead hang.

## Decisions

**Semaglutide**
- The app never changes the dose. The doctor's dose is set by hand with the "Doza prescrisă" chips. `titration()` only suggests:
  - at least 4 weeks per step;
  - suggest the next step only if weight loss is under 0.5 %/week and nausea is below 2;
  - hold at 0.5–1 %/week;
  - warn above 1.5 %/week.
- The default injection day is Wednesday, the Inner Beast recovery day.
- Missed dose follows the Wegovy label:
  - take it if the next dose is more than 2 days away, otherwise skip it;
  - more than 2 weeks missed: the doctor decides the restart;
  - keep at least 3 days between doses.
- With no shot logged yet, the first dose shows as due today.

**Advice already given in chat**
- 10 mg powder vials are not Wegovy (Wegovy is a pen) and are likely grey-market. The user was told to have the vial independently tested and to tell their doctor.
- Peptide research verdict: only GLP-1 drugs (with a doctor) have strong human evidence for this user's goal. BPC-157, TB-500, CJC/ipamorelin, GHK-Cu and kisspeptin were advised against for performance; MK-677 and IGF-1 LR3 should be avoided.
- The user said WADA does not matter to them (they don't compete) and that peptides are legal in their country.

## Dead ends

- **Python run from inline Bash hangs.** Both `python -` with a heredoc and inline Python inside Bash heredocs open the Windows pyrepl and hang (WinError 123). Write a `.py` file to the scratchpad and run `python -I -X utf8 file.py`.
- **Screenshot script fails from the wrong folder.** `sheet.cjs` needs `sharp`, so run it from `C:\Users\Andrei PC\beast-nutrition`. From the inner-beast folder it fails with "Cannot find module 'sharp'".
- **Git can fail with "Permission denied".** `git add` / `git commit` may fail on `.git/objects`; retry in a loop.

## Files

- `src/logic/glp1.ts`: the logic and the U-100 math. Exports `due`, `nextSite`, `weeksAtDose`, `weeklyRate`, `titration`, `units`, `doseMl`, `vialLeft`, `vialAge`, `LADDER`, `SITES`. Tests are in `src/logic/glp1.test.ts`.
- `src/screens/glp1.ts`: the screen, `glp1Card` (Azi), `vialCard` and the `glp1Action` (`data-g` actions).
- `src/logic/store.ts`: `State.glp1`, defaulting to `freshGlp1()`.
- Wiring:
  - `src/main.ts`: tab `glp1`, mapped to the Mai mult tab;
  - `src/screens/fuel.ts`: the list row under Mai mult;
  - `src/screens/today.ts`: the card under the hero.
- `src/styles.css`: the "Carduri luminoase" override layer, then the ladder, `.card.glp`, `.chips.seven/.five`, `table.units` and `ol.steps`.
- Inner Beast: `C:\Users\Andrei PC\inner-beast\src\ui\screens\today.ts`.
- Scratchpad tools in `C:\Users\Andrei PC\AppData\Local\Temp\claude\4cbdb4d8649f704d\6265b167-b07b-4bd9-8b9d-e24bc5e785fa\scratchpad\`:
  - `shot.mjs`: headless Edge screenshots;
  - `sheet.cjs`: contact sheet;
  - `ed.py`: JSON exact-string editor;
  - `glp.json` and `vial.json`: screenshot plans, which need the dev server `npx.cmd vite --port 5320 --strictPort --host 127.0.0.1`.

## Verification

- Beast Nutrition:
  - `npx.cmd tsc --noEmit` passes.
  - `npm.cmd test`: 149 pass.
  - `npm.cmd run build`: sw.js version 7259437a0682.
- Inner Beast: `npm.cmd test`, 78 pass.
- Deploy check: `gh run list --limit 1` shows success for every push above.

## Next steps

1. Wait for the user's next request. If they accept one of the offers under Status, start with that.
2. If semaglutide gets more changes, keep the app in a "suggest, never prescribe" role. Keep the grey-market vial quality warning.

## Standing instructions

- Reply in Romanian, name the app changed, and say what was verified.
- Push to main after each batch, wait for the Pages run, and tell the user to open the app twice.
- Stage files by path. Never commit `docs/handoffs`.
- End commit messages with "Claude-Session: https://claude.ai/code/session_018EKgfVZ5Smwt8yKyxrHyV9".
- Never edit `calc.ts` or `review.ts` in Beast Nutrition; importing from them is fine.
- Inner Beast has no nutrition. Inner Beast and Beast Nutrition are separate apps.
- Keep deep research small: no swarms of subagents, because they burned the user's limits.
- Use `npm.cmd` / `npx.cmd`, and Python with `-I -X utf8`.
- The host is flagged as phishing: never suggest disguising password fields. Tell the user to back up before removing or re-adding a home-screen app.

## Open questions

- Does the user want any of the three offers: Plan trim, the supplement stack in the app, or the Inner Beast lower-body strength and carries?
- Is the user's 10 mg vial pharmacy-sourced or grey-market, and is a doctor involved?
