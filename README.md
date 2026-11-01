# BEAST NUTRITION

Nutrition tracker built on the method of *Fat Loss Forever* (Layne Norton, Peter Baker). Runs in the browser, data in localStorage.

`src/logic/calc.ts` and `review.ts` hold the book method. Carb cycling, meal planning, fasting and the rest sit on top and never change those numbers.

Foods: USDA FoodData Central (public domain), October 2026 CSV zip. `python -I scripts/usda-extract.py <zip> <dir>` pulls the tracker fields, `node scripts/build-foods.mjs <dir>/generic.json` writes `public/foods.json` (SR Legacy, Foundation, FNDDS) and `python -I scripts/usda-branded.py <dir> public/branded/<date>` writes the branded shards; a new date also needs `BRANDED` in `src/logic/foods.ts`. Menu: `public/splendid.json`, from the nutrition declaration of Splendid Chicken. Branded products: USDA shards read on demand, plus Open Food Facts (ODbL).
