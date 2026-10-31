# BEAST NUTRITION

Nutrition tracker built on the method of *Fat Loss Forever* (Layne Norton, Peter Baker). Runs in the browser, data in localStorage.

`src/logic/calc.ts` and `review.ts` hold the book method. Carb cycling, meal planning, fasting and the rest sit on top and never change those numbers.

Foods: USDA FoodData Central SR Legacy (public domain), rebuilt with `node scripts/build-foods.mjs <json>`. Menu: `public/splendid.json`, from the nutrition declaration of Splendid Chicken. Branded products: Open Food Facts (ODbL).
