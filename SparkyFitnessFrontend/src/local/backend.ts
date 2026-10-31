/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser-only replacement for the BEAST NUTRITION server, so the frontend can
 * run from static hosting (GitHub Pages). It intercepts fetch calls to /api/*
 * and serves them from localStorage. Must be imported before anything else.
 *
 * GET on a route not implemented here answers an empty list; a write answers
 * 501, so the UI reports the feature as unavailable rather than losing data.
 */
const STORE_KEY = 'beast-nutrition:v1';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_EMAIL = 'local@sparky.app';
const USER_NAME = 'Eu';
const OFF_ID = '00000000-0000-4000-8000-0000000000ff';

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDay = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayRange = (start: string, end: string) => {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 3700; d = addDay(d, 1)) out.push(d);
  return out;
};
const day = (s: unknown) => String(s ?? '').slice(0, 10);
const num = (v: unknown) => Number(v) || 0;

const NUTRIENTS = [
  'calories', 'protein', 'carbs', 'fat', 'saturated_fat', 'polyunsaturated_fat',
  'monounsaturated_fat', 'trans_fat', 'cholesterol', 'sodium', 'potassium',
  'dietary_fiber', 'sugars', 'vitamin_a', 'vitamin_c', 'calcium', 'iron',
  'caffeine_mg', 'water_ml', 'alcohol_g',
];

const DEFAULT_GOALS = {
  calories: 2000, protein: 150, carbs: 200, fat: 65, water_goal_ml: 2500,
  saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25,
  trans_fat: 0, cholesterol: 300, sodium: 2300, potassium: 3500,
  dietary_fiber: 25, sugars: 50, vitamin_a: 900, vitamin_c: 90, calcium: 1000,
  iron: 18, caffeine_mg: 400, alcohol_g: 0,
  target_exercise_calories_burned: 0, target_exercise_duration_minutes: 0,
  target_steps: 10000, protein_percentage: null, carbs_percentage: null,
  fat_percentage: null, breakfast_percentage: 25, lunch_percentage: 25,
  dinner_percentage: 25, snacks_percentage: 25, custom_nutrients: {},
  custom_meal_percentages: {},
};

const DEFAULT_PREFS = {
  user_id: USER_ID, date_format: 'dd/MM/yyyy', time_format: 'HH:mm',
  default_weight_unit: 'kg', default_measurement_unit: 'cm',
  default_distance_unit: 'km', auto_clear_history: 'never',
  logging_level: 'ERROR', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  item_display_limit: 10, water_display_unit: 'ml',
  add_exercise_water_to_goal: false, add_food_water_to_intake: true,
  language: 'ro', calorie_goal_adjustment_mode: 'dynamic', energy_unit: 'kcal',
  auto_scale_open_food_facts_imports: true, auto_scale_online_imports: true,
  selected_diet: 'balanced', default_food_data_provider_id: OFF_ID,
  default_barcode_provider_id: OFF_ID, barcode_fallback_open_food_facts: true,
  food_search_all_providers_default: false, exercise_calorie_percentage: 100,
  activity_level: 'not_much', tdee_allow_negative_adjustment: false,
  bmr_algorithm: 'Mifflin-St Jeor', body_fat_algorithm: 'U.S. Navy',
  include_bmr_in_net_calories: false, use_external_bmr: false,
  show_net_carbs: false, ai_assisted_conversions: false,
  fat_breakdown_algorithm: 'AHA Guidelines',
  mineral_calculation_algorithm: 'RDA Standard',
  vitamin_calculation_algorithm: 'RDA Standard',
  sugar_calculation_algorithm: 'WHO Guidelines',
  added_sugar_algorithm: 'WHO Guidelines', first_day_of_week: 1,
  measurement_decimal_places: 2, chart_scale_mode: 'auto', goal_mode: 'custom',
  goal_mode_calculation_method: 'percentage', adaptive_activity_separate: false,
  goal_mode_custom_percentage: 0, goal_mode_weekly_change_kg: 0,
  calorie_safety_floor_mode: 'standard', calorie_safety_floor_value: 1200,
  voice_input_enabled: false, use_move_ring_active_calories: false,
};

const seedMealTypes = () =>
  ['Mic dejun', 'Prânz', 'Cină', 'Gustări'].map((name, i) => ({
    id: uuid(), name, sort_order: i + 1, user_id: null, is_visible: true,
    show_in_quick_log: true, default_time: null,
  }));

type Db = Record<string, any>;
const emptyDb = (): Db => ({
  foods: [], foodEntries: [], foodEntryMeals: [], meals: [], favorites: [],
  mealTypes: seedMealTypes(), exercises: [], exerciseEntries: [], presetEntries: [],
  workoutPresets: [], checkIn: [], customCategories: [], customEntries: [],
  water: [], goals: [], goalPresets: [], weeklyPlans: [], fasting: [], sleep: [],
  mood: [], customMoods: [], medications: [], medicationEntries: [],
  symptomEntries: [], waterContainers: [{ id: 1, user_id: USER_ID, name: 'Pahar', volume: 250, unit: 'ml', is_primary: true, servings_per_container: 1 }], prefs: {}, onboarding: {}, seq: 1,
  kv: {},
});

let db: Db;
const load = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    db = { ...emptyDb(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    db = emptyDb();
  }
};
const save = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {
    throw new HttpError(507, `Spațiul local este plin: ${String(e)}`);
  }
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const find = (table: string, id: string) => {
  const row = db[table].find((r: any) => String(r.id) === String(id));
  if (!row) throw new HttpError(404, 'Nu a fost găsit.');
  return row;
};
const remove = (table: string, id: string) => {
  db[table] = db[table].filter((r: any) => String(r.id) !== String(id));
  return { message: 'Șters.' };
};
const upsert = (table: string, id: string, patch: any) =>
  Object.assign(find(table, id), patch, { updated_at: now() });

/** Generic list + create + read + update + delete for a simple table. */
const crud = (base: string, table: string, extra: (b: any) => any = () => ({})) => [
  route('GET', base, () => db[table]),
  route('POST', base, (c) => {
    const row = { id: uuid(), user_id: USER_ID, created_at: now(), updated_at: now(), ...c.body, ...extra(c.body) };
    db[table].push(row);
    return row;
  }),
  route('GET', `${base}/:id`, (c) => find(table, c.p.id)),
  route('PUT', `${base}/:id`, (c) => upsert(table, c.p.id, c.body)),
  route('PATCH', `${base}/:id`, (c) => upsert(table, c.p.id, c.body)),
  route('DELETE', `${base}/:id`, (c) => remove(table, c.p.id)),
];

// ---- Foods ---------------------------------------------------------------
const variantOf = (b: any, old?: any) => {
  const v: any = { id: old?.id ?? uuid(), serving_size: num(b.serving_size) || 100,
    serving_unit: b.serving_unit || 'g', is_default: true };
  for (const n of NUTRIENTS) v[n] = b[n] != null ? Number(b[n]) : (old?.[n] ?? 0);
  v.custom_nutrients = b.custom_nutrients ?? old?.custom_nutrients ?? {};
  return v;
};
const createFood = (b: any) => {
  const dv = b.default_variant ? { ...b.default_variant, id: b.default_variant.id ?? uuid(), is_default: true } : variantOf(b);
  const extra = (b.variants ?? []).filter((v: any) => !v.is_default).map((v: any) => ({ ...v, id: uuid() }));
  const food = {
    id: uuid(), name: b.name, brand: b.brand ?? null, notes: b.notes ?? null,
    barcode: b.barcode ?? null, is_custom: true, user_id: USER_ID,
    shared_with_public: false, provider_external_id: b.provider_external_id ?? null,
    provider_type: b.provider_type ?? null, provider_verified: !!b.provider_verified,
    images: [], default_variant: dv, variants: [dv, ...extra],
    created_at: now(), updated_at: now(),
  };
  db.foods.push(food);
  return food;
};
const lastLogged = () => {
  const map = new Map<string, number>();
  for (const e of db.foodEntries) map.set(e.food_id, (map.get(e.food_id) ?? 0) + 1);
  return map;
};
const matches = (food: any, q: string) =>
  `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(q.toLowerCase());
const findVariant = (food: any, id?: string | null) =>
  food?.variants?.find((v: any) => v.id === id) ?? food?.default_variant;

const mealTypeName = (b: any) => {
  const t = db.mealTypes.find((m: any) => m.id === b.meal_type_id || m.name === b.meal_type);
  return t ?? db.mealTypes[0];
};
const makeEntry = (b: any) => {
  const food = db.foods.find((f: any) => f.id === b.food_id);
  if (!food) throw new HttpError(404, 'Alimentul nu există.');
  const v = findVariant(food, b.variant_id);
  const type = mealTypeName(b);
  const e: any = {
    id: uuid(), user_id: USER_ID, food_id: food.id, meal_id: null,
    meal_type: type.name, meal_type_id: type.id, quantity: num(b.quantity),
    unit: b.unit ?? v.serving_unit, variant_id: v.id, entry_date: day(b.entry_date),
    entry_time: b.entry_time ?? null, meal_plan_template_id: null,
    food_entry_meal_id: b.food_entry_meal_id ?? null, food_name: food.name,
    brand_name: food.brand ?? null, serving_size: v.serving_size,
    serving_unit: v.serving_unit, glycemic_index: null,
    custom_nutrients: v.custom_nutrients ?? {}, notes: b.notes ?? null, source: null,
    created_at: now(),
  };
  for (const n of NUTRIENTS) e[n] = num(v[n]);
  return e;
};
const factor = (e: any) => num(e.quantity) / (num(e.serving_size) || 1);
const eaten = (e: any, n: string) => num(e[n]) * factor(e);
const entriesOn = (date: string) => db.foodEntries.filter((e: any) => e.entry_date === date);
const copyEntries = (rows: any[], date: string, type?: any) => {
  const copies = rows.map((e) => ({
    ...e, id: uuid(), entry_date: date, created_at: now(),
    ...(type ? { meal_type: type.name, meal_type_id: type.id } : {}),
  }));
  db.foodEntries.push(...copies);
  return copies;
};

// ---- Goals ---------------------------------------------------------------
const goalsFor = (date: string) => {
  const rows = [...db.goals].sort((a: any, b: any) => a.date.localeCompare(b.date));
  let g: any = null;
  for (const r of rows) if (r.date <= date) g = r;
  return { ...DEFAULT_GOALS, ...(g?.values ?? {}) };
};

// ---- Measurements --------------------------------------------------------
const MEASURES = ['weight', 'neck', 'waist', 'hips', 'steps', 'height', 'body_fat_percentage',
  'muscle_mass_kg', 'bone_mass_kg', 'body_water_percentage', 'bmr', 'resting_heart_rate'];
const checkInUpsert = (date: string, patch: any) => {
  let row = db.checkIn.find((r: any) => r.entry_date === date);
  if (!row) {
    row = { id: uuid(), user_id: USER_ID, entry_date: date, updated_at: now(), created_by_user_id: null, updated_by_user_id: null, ...Object.fromEntries(MEASURES.map((k) => [k, null])) };
    db.checkIn.push(row);
  }
  for (const k of MEASURES) if (k in patch) row[k] = patch[k] === '' ? null : patch[k];
  row.updated_at = now();
  return row;
};
const latestMeasures = (date: string) => {
  const out: any = {};
  const rows = db.checkIn.filter((r: any) => r.entry_date <= date)
    .sort((a: any, b: any) => a.entry_date.localeCompare(b.entry_date));
  for (const r of rows) {
    for (const k of MEASURES) {
      if (r[k] != null && (k !== 'steps' || r.entry_date === date)) out[k] = r[k];
    }
    Object.assign(out, { id: r.id, user_id: USER_ID, entry_date: r.entry_date, updated_at: r.updated_at, created_by_user_id: null, updated_by_user_id: null });
  }
  if (out.id) for (const k of MEASURES) out[k] ??= null;
  return out;
};

// ---- Exercise ------------------------------------------------------------
const snapshotOf = (ex: any) => ({
  id: ex.id, name: ex.name, category: ex.category ?? null, modality: ex.modality ?? null,
  images: ex.images ?? [], primary_muscles: ex.primary_muscles ?? [],
  secondary_muscles: ex.secondary_muscles ?? [], equipment: ex.equipment ?? [],
  instructions: ex.instructions ?? [], force: ex.force ?? null, level: ex.level ?? null,
  mechanic: ex.mechanic ?? null, source: 'custom', source_id: null, is_custom: true,
  user_id: USER_ID, calories_per_hour: ex.calories_per_hour ?? null,
  description: ex.description ?? null, shared_with_public: false,
  created_at: ex.created_at ?? null, updated_at: ex.updated_at ?? null,
  tags: [], duration_min: null,
});
const parseFields = (b: any) => {
  const o = { ...b };
  for (const k of ['sets', 'activity_details']) if (typeof o[k] === 'string') o[k] = JSON.parse(o[k] || '[]');
  for (const k of ['duration_minutes', 'calories_burned', 'distance', 'avg_heart_rate']) {
    if (typeof o[k] === 'string') o[k] = o[k] === '' ? null : Number(o[k]);
  }
  return o;
};
const setsOf = (sets: any[] = []) =>
  sets.map((s, i) => ({
    id: db.seq++, set_number: s.set_number ?? i + 1, set_type: s.set_type ?? 'Working Set',
    reps: s.reps ?? null, weight: s.weight ?? null, duration: s.duration ?? null,
    rest_time: s.rest_time ?? null, notes: s.notes ?? null, rpe: s.rpe ?? null,
    completed_at: s.completed_at ?? null, is_pr: false, rir: s.rir ?? null, distance: s.distance ?? null,
  }));
const makeExerciseEntry = (b0: any, presetId: string | null = null) => {
  const b = parseFields(b0);
  const ex = db.exercises.find((x: any) => x.id === b.exercise_id);
  const minutes = num(b.duration_minutes);
  const calories = b.calories_burned ?? Math.round((num(ex?.calories_per_hour) * minutes) / 60);
  return {
    id: uuid(), exercise_id: b.exercise_id ?? null, duration_minutes: minutes,
    calories_burned: num(calories), entry_date: day(b.entry_date), entry_time: b.entry_time ?? null,
    notes: b.notes ?? null, distance: b.distance ?? null, avg_heart_rate: b.avg_heart_rate ?? null,
    source: 'manual', image_url: null, exercise_preset_entry_id: presetId, created_at: now(),
    sets: setsOf(b.sets), exercise_snapshot: ex ? snapshotOf(ex) : null, activity_details: [],
    steps: b.steps ?? null, category: ex?.category ?? null, superset_group: b.superset_group ?? null,
    name: ex?.name ?? null,
  };
};
const sessionsOn = (date: string) => {
  const single = db.exerciseEntries
    .filter((e: any) => e.entry_date === date && !e.exercise_preset_entry_id)
    .map((e: any) => ({ ...e, type: 'individual' }));
  const grouped = db.presetEntries.filter((p: any) => p.entry_date === date).map(presetView);
  return [...single, ...grouped];
};
function presetView(p: any) {
  const exercises = db.exerciseEntries.filter((e: any) => e.exercise_preset_entry_id === p.id);
  return { ...p, type: 'preset', exercises,
    total_duration_minutes: exercises.reduce((s: number, e: any) => s + num(e.duration_minutes), 0),
    activity_details: [] };
}
const burnedOn = (date: string) =>
  db.exerciseEntries.filter((e: any) => e.entry_date === date)
    .reduce((s: number, e: any) => s + num(e.calories_burned), 0);

// ---- Summaries -----------------------------------------------------------
const waterOn = (date: string) =>
  db.water.filter((w: any) => day(w.entry_date) === date)
    .reduce((s: number, w: any) => s + num(w.water_ml), 0);
const prefs = () => ({ ...DEFAULT_PREFS, ...db.prefs });
const balance = (date: string) => {
  const goal = num(goalsFor(date).calories);
  const ate = Math.round(entriesOn(date).reduce((s: number, e: any) => s + eaten(e, 'calories'), 0));
  const burned = Math.round(burnedOn(date));
  const remaining = goal - ate + burned;
  return { eaten: ate, burned, remaining, goal, net: ate - burned,
    progress: goal ? Math.min(100, Math.round(((ate - burned) / goal) * 100)) : 0,
    bmr: 0, exerciseSource: burned ? 'logged' : 'none', tdeeProjection: null };
};
const dailySummary = (date: string) => {
  const m = latestMeasures(date);
  const water = waterOn(date);
  const p: any = prefs();
  return {
    goals: goalsFor(date), foodEntries: entriesOn(date), exerciseSessions: sessionsOn(date),
    waterIntake: water,
    waterIntakeBreakdown: { water_ml: water, manual_ml: water, ledger_ml: 0, food_ml: 0 },
    stepCalories: 0, calorieBalance: balance(date),
    calorieInputs: {
      rules: Object.fromEntries(['goal_mode', 'goal_mode_calculation_method', 'goal_mode_custom_percentage',
        'goal_mode_weekly_change_kg', 'calorie_goal_adjustment_mode', 'exercise_calorie_percentage',
        'tdee_allow_negative_adjustment', 'calorie_safety_floor_mode', 'calorie_safety_floor_value',
        'adaptive_activity_separate', 'bmr_algorithm', 'activity_level', 'use_external_bmr',
        'include_bmr_in_net_calories'].map((k) => [k, p[k]])),
      age: 30, gender: 'male', weightKg: m.weight ?? 0, heightCm: m.height ?? 0,
      bodyFatPercentage: m.body_fat_percentage ?? null, waistCm: m.waist ?? null,
      neckCm: m.neck ?? null, hipsCm: m.hips ?? null,
    },
    adjustedGoals: null, supplementTotals: { custom_nutrients: {} },
  };
};
const nutritionDay = (date: string) => {
  const row: any = { date };
  for (const n of NUTRIENTS) {
    row[n] = entriesOn(date).reduce((s: number, e: any) => s + eaten(e, n), 0);
  }
  return row;
};
const reports = (start: string, end: string) => {
  const inRange = (d: string) => d >= start && d <= end;
  return {
    nutritionData: dayRange(start, end).map(nutritionDay),
    tabularData: db.foodEntries.filter((e: any) => inRange(e.entry_date)).map((e: any) => {
      const row: any = { ...e, foods: { name: e.food_name, brand: e.brand_name } };
      return row;
    }),
    exerciseEntries: db.exerciseEntries.filter((e: any) => inRange(e.entry_date)),
    measurementData: db.checkIn.filter((r: any) => inRange(r.entry_date))
      .sort((a: any, b: any) => a.entry_date.localeCompare(b.entry_date)),
    customCategories: db.customCategories,
    customMeasurementsData: db.customEntries.filter((e: any) => inRange(day(e.entry_date))),
    sleepAnalyticsData: [], medications: [], medicationEntries: [], symptomEntries: [],
    injections: [], titrationSteps: [],
  };
};

// ---- Open Food Facts (public API, called straight from the browser) --------
const offToFood = (p: any) => {
  const n = p.nutriments ?? {};
  const v: any = {
    serving_size: 100, serving_unit: 'g', is_default: true,
    calories: Math.round(num(n['energy-kcal_100g'])), protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g), saturated_fat: num(n['saturated-fat_100g']),
    trans_fat: num(n['trans-fat_100g']), sodium: Math.round(num(n.sodium_100g) * 1000),
    dietary_fiber: num(n.fiber_100g), sugars: num(n.sugars_100g),
  };
  return {
    id: String(p.code), name: p.product_name || p.generic_name || String(p.code),
    brand: p.brands?.split(',')[0] ?? null, barcode: p.code ?? null, is_custom: false,
    provider_external_id: String(p.code), provider_type: 'openfoodfacts',
    image_url: p.image_small_url ?? null, default_variant: v, variants: [v],
  };
};
const OFF_FIELDS = 'code,product_name,generic_name,brands,nutriments,image_small_url';
const offSearch = async (query: string, page: number, pageSize: number) => {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}&fields=${OFF_FIELDS}`;
  const r = await realFetch(url);
  if (!r.ok) throw new HttpError(502, 'Open Food Facts nu răspunde.');
  const j = await r.json();
  const foods = (j.products ?? []).filter((p: any) => p.product_name && p.code).map(offToFood);
  return { foods, pagination: { page, pageSize, totalCount: j.count ?? foods.length, hasMore: page * pageSize < (j.count ?? 0) } };
};
const offProduct = async (code: string) => {
  const r = await realFetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
  if (!r.ok) return null;
  const j = await r.json();
  return j.status === 1 && j.product ? offToFood({ code, ...j.product }) : null;
};

// ---- Router --------------------------------------------------------------
type Ctx = { p: Record<string, string>; q: URLSearchParams; body: any };
type Route = { m: string; re: RegExp; keys: string[]; h: (c: Ctx) => any };
function route(m: string, path: string, h: Route['h']): Route {
  const keys: string[] = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  return { m, re, keys, h };
}
const sessionPayload = () => ({
  session: { id: 'local', userId: USER_ID, token: 'local', expiresAt: '2999-01-01T00:00:00.000Z', createdAt: now(), updatedAt: now() },
  user: { id: USER_ID, email: USER_EMAIL, name: USER_NAME, emailVerified: true, role: 'admin',
    activeUserId: USER_ID, twoFactorEnabled: false, mfaEmailEnabled: false, createdAt: now(), updatedAt: now() },
});

const kv = (path: string, key: string, fallback: any) => [
  route('GET', path, () => db.kv[key] ?? fallback),
  route('PUT', path, (c) => (db.kv[key] = c.body)),
  route('POST', path, (c) => (db.kv[key] = c.body)),
];

const routes: Route[] = [
  // Session: there is one implicit local user, so nobody ever sees a login.
  route('GET', '/auth/get-session', sessionPayload),
  route('POST', '/auth/sign-out', () => ({ success: true })),
  route('GET', '/auth/settings', () => ({ email: { enabled: true }, oidc: { enabled: false, providers: [] }, signup_disabled: true })),
  route('GET', '/ping', () => ({ status: 'ok' })),
  route('GET', '/version/current', () => ({ version: 'local' })),
  route('GET', '/version/latest-github', () => ({ version: 'local', isNewVersionAvailable: false })),
  route('GET', '/announcement/current', () => ({ active: false })),
  route('GET', '/global-settings/mock-data-enabled', () => ({ enabled: false })),
  route('GET', '/identity/user', () => ({ activeUserId: USER_ID, fullName: USER_NAME, activeUserFullName: USER_NAME, activeUserEmail: USER_EMAIL, isDemo: false })),
  route('POST', '/identity/switch-context', () => ({ activeUserId: USER_ID })),
  route('GET', '/identity/users/accessible-users', () => []),
  route('GET', '/identity/profiles', () => ({ id: USER_ID, full_name: USER_NAME, ...db.kv.profile })),
  route('PUT', '/identity/profiles', (c) => (db.kv.profile = { ...db.kv.profile, ...c.body })),

  route('GET', '/onboarding/status', () => ({ onboardingComplete: !!db.onboarding.done, onboardingSkipped: !!db.onboarding.skipped })),
  route('POST', '/onboarding/skip', () => { db.onboarding.skipped = true; return { ok: true }; }),
  route('POST', '/onboarding/reset', () => { db.onboarding = {}; return { ok: true }; }),
  route('POST', '/onboarding', (c) => {
    const b = typeof c.body === 'string' ? JSON.parse(c.body) : c.body;
    db.onboarding.done = true;
    if (b.currentWeight) checkInUpsert(today(), { weight: num(b.currentWeight), height: b.height ? num(b.height) : null });
    return { ok: true };
  }),

  route('GET', '/user-preferences', prefs),
  route('POST', '/user-preferences', (c) => { Object.assign(db.prefs, c.body); return prefs(); }),
  route('PUT', '/user-preferences', (c) => { Object.assign(db.prefs, c.body); return prefs(); }),
  route('GET', '/external-providers', () => [{ id: OFF_ID, name: 'Open Food Facts', provider_name: 'Open Food Facts', provider_type: 'openfoodfacts', is_active: true, app_key: '', categories: ['food'], supports_barcode: true, is_strictly_private: false }]),
  route('GET', '/v2/run-program', () => ({ program: null })),
  route('GET', '/chat/ai-service-settings/active', () => null),
  route('GET', '/external-providers/types', () => []),

  // Foods. Specific paths must stay above /foods/:id.
  route('GET', '/foods/foods-paginated', (c) => {
    const term = c.q.get('searchTerm') ?? '';
    const page = Number(c.q.get('currentPage') ?? 1);
    const size = Number(c.q.get('itemsPerPage') ?? 10);
    const [field, dir] = (c.q.get('sortBy') ?? 'name:asc').split(':');
    const list = db.foods.filter((f: any) => !f.hidden && matches(f, term)).sort((a: any, b: any) =>
      String(a[field!] ?? '').localeCompare(String(b[field!] ?? '')) * (dir === 'desc' ? -1 : 1));
    return { foods: list.slice((page - 1) * size, page * size), totalCount: list.length };
  }),
  route('GET', '/foods/food-variants', (c) => {
    const f = db.foods.find((x: any) => x.id === c.q.get('food_id'));
    return f?.variants ?? [];
  }),
  route('POST', '/foods/food-variants', (c) => {
    const f = find('foods', c.body.food_id);
    const v = { id: uuid(), ...c.body };
    f.variants.push(v);
    return v;
  }),
  route('POST', '/foods/food-variants/bulk', (c) => {
    const list = Array.isArray(c.body) ? c.body : (c.body.variants ?? []);
    const out = list.map((v: any) => ({ id: uuid(), ...v }));
    const f = db.foods.find((x: any) => x.id === list[0]?.food_id);
    f?.variants.push(...out);
    return out;
  }),
  route('PUT', '/foods/food-variants/:id', (c) => {
    for (const f of db.foods) {
      const v = f.variants.find((x: any) => x.id === c.p.id);
      if (v) { Object.assign(v, c.body); if (v.is_default) f.default_variant = v; return v; }
    }
    throw new HttpError(404, 'Varianta nu există.');
  }),
  route('DELETE', '/foods/food-variants/:id', (c) => {
    for (const f of db.foods) f.variants = f.variants.filter((v: any) => v.id !== c.p.id);
    return { message: 'Șters.' };
  }),
  route('POST', '/foods/update-snapshot', () => ({ message: 'ok' })),
  route('GET', '/foods', (c) => {
    const name = c.q.get('name');
    if (name) return { searchResults: db.foods.filter((f: any) => matches(f, name)) };
    const limit = Number(c.q.get('limit') ?? 5);
    const count = lastLogged();
    const recentIds = [...db.foodEntries].reverse().map((e: any) => e.food_id);
    const pick = (ids: string[]) => [...new Set(ids)].slice(0, limit)
      .map((id) => db.foods.find((f: any) => f.id === id)).filter(Boolean);
    return { recentFoods: pick(recentIds), topFoods: pick([...count.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])) };
  }),
  route('POST', '/foods', (c) => createFood(c.body)),
  route('POST', '/foods/import-from-csv', (c) => {
    const b = typeof c.body === 'string' ? JSON.parse(c.body) : c.body;
    b.foods.forEach(createFood);
    return { message: 'ok' };
  }),
  route('GET', '/foods/:id/deletion-impact', (c) => {
    const n = db.foodEntries.filter((e: any) => e.food_id === c.p.id).length;
    return { foodEntries: [], foodEntriesCount: n, mealFoodsCount: 0, mealPlansCount: 0, mealPlanTemplateAssignmentsCount: 0, totalReferences: n, currentUserReferences: n, otherUserReferences: 0, isPubliclyShared: false, familySharedUsers: [] };
  }),
  route('GET', '/foods/:id', (c) => find('foods', c.p.id)),
  route('PUT', '/foods/:id', (c) => {
    const f = find('foods', c.p.id);
    const { default_variant, variants, ...rest } = c.body;
    Object.assign(f, rest);
    if (default_variant) { Object.assign(f.default_variant, default_variant); }
    else if (NUTRIENTS.some((n) => n in c.body)) Object.assign(f.default_variant, variantOf(c.body, f.default_variant));
    if (variants) f.variants = variants.map((v: any) => ({ id: uuid(), ...v }));
    return f;
  }),
  route('DELETE', '/foods/:id', (c) => {
    if (c.q.get('mode') === 'hide') { find('foods', c.p.id).hidden = true; return { message: 'Ascuns.', status: 'hidden' }; }
    if (c.q.get('mode') === 'delete_with_history') db.foodEntries = db.foodEntries.filter((e: any) => e.food_id !== c.p.id);
    remove('foods', c.p.id);
    return { message: 'Șters.', status: 'deleted' };
  }),
  route('GET', '/v2/foods/search/:type', (c) => {
    const q = c.q.get('query') ?? '';
    if (c.p.type !== 'openfoodfacts') return { foods: [], pagination: { page: 1, pageSize: 20, totalCount: 0, hasMore: false } };
    return offSearch(q, Number(c.q.get('page') ?? 1), Number(c.q.get('pageSize') ?? 20));
  }),
  route('GET', '/v2/foods/details/openfoodfacts/:id', async (c) => {
    const f = await offProduct(c.p.id!);
    if (!f) throw new HttpError(404, 'Produs negăsit.');
    return f;
  }),
  route('GET', '/v2/foods/barcode/:code', async (c) => {
    const food: any = await offProduct(c.p.code!);
    return { source: food ? 'openfoodfacts' : 'not_found', food, providerId: OFF_ID, providerName: 'Open Food Facts' };
  }),
  route('GET', '/v2/foods/barcode/:code/alternatives', () => ({ results: [] })),
  route('GET', '/favorites', () => ({
    favoriteFoods: db.foods.filter((f: any) => db.favorites.includes(`food:${f.id}`)),
    favoriteMeals: db.meals.filter((m: any) => db.favorites.includes(`meal:${m.id}`)),
  })),
  route('POST', '/favorites/:type/:id', (c) => {
    db.favorites.push(`${c.p.type}:${c.p.id}`);
    return { type: c.p.type, id: c.p.id, is_favorite: true };
  }),
  route('DELETE', '/favorites/:type/:id', (c) => {
    db.favorites = db.favorites.filter((k: string) => k !== `${c.p.type}:${c.p.id}`);
    return { type: c.p.type, id: c.p.id, is_favorite: false };
  }),

  // Diary
  ...crud('/meal-types', 'mealTypes'),
  route('GET', '/meal-types/:id/deletion-impact', () => ({ foodEntries: 0, foodEntryMeals: 0, mealPlans: 0, templateAssignments: 0, totalReferences: 0 })),
  route('POST', '/food-entries', (c) => { const e = makeEntry(c.body); db.foodEntries.push(e); return e; }),
  route('GET', '/food-entries/by-date/:date', (c) => entriesOn(c.p.date!)),
  route('PUT', '/food-entries/:id', (c) => {
    const patch = { ...c.body };
    if (patch.variant_id) {
      const e = find('foodEntries', c.p.id);
      const v = findVariant(db.foods.find((f: any) => f.id === e.food_id), patch.variant_id);
      if (v) { for (const n of NUTRIENTS) patch[n] = num(v[n]); patch.serving_size = v.serving_size; patch.serving_unit = v.serving_unit; }
    }
    if (patch.meal_type_id || patch.meal_type) patch.meal_type = mealTypeName(patch).name;
    return upsert('foodEntries', c.p.id, patch);
  }),
  route('DELETE', '/food-entries/:id', (c) => remove('foodEntries', c.p.id)),
  route('POST', '/food-entries/copy', (c) => copyEntries(
    db.foodEntries.filter((e: any) => e.entry_date === c.body.sourceDate && e.meal_type === c.body.sourceMealType),
    c.body.targetDate, mealTypeName({ meal_type: c.body.targetMealType }))),
  route('POST', '/food-entries/copy-yesterday', (c) => copyEntries(
    db.foodEntries.filter((e: any) => e.entry_date === addDay(c.body.targetDate, -1) && e.meal_type === c.body.mealType),
    c.body.targetDate)),
  route('POST', '/food-entries/copy-all', (c) => copyEntries(entriesOn(c.body.sourceDate), c.body.targetDate)),
  route('POST', '/food-entries/copy-all-yesterday', (c) => copyEntries(entriesOn(addDay(c.body.targetDate, -1)), c.body.targetDate)),
  route('GET', '/food-entry-meals/by-date/:date', () => []),
  route('GET', '/daily-summary', (c) => dailySummary(c.q.get('date') ?? today())),
  route('GET', '/daily-summary/range', (c) => ({
    days: dayRange(c.q.get('startDate')!, c.q.get('endDate')!).map((d) => ({ date: d, stepCalories: 0, ...balance(d) })),
  })),

  // Goals
  route('GET', '/goals/for-date', (c) => {
    const start = c.q.get('date') ?? today();
    const end = c.q.get('end_date');
    return end ? Object.fromEntries(dayRange(start, end).map((d) => [d, goalsFor(d)])) : goalsFor(start);
  }),
  route('GET', '/goals/by-date/:date', (c) => goalsFor(c.p.date!)),
  route('POST', '/goals/manage-timeline', (c) => {
    const { p_start_date: date, p_cascade: cascade, custom_meal_percentages, custom_nutrients, ...rest } = c.body;
    const values: any = { custom_meal_percentages, custom_nutrients };
    for (const [k, v] of Object.entries(rest)) values[k.replace(/^p_/, '')] = v;
    db.goals = db.goals.filter((g: any) => (cascade ? g.date < date : g.date !== date));
    db.goals.push({ date, values });
    return { message: 'ok' };
  }),
  ...crud('/goal-presets', 'goalPresets'),
  ...crud('/weekly-goal-plans', 'weeklyPlans'),

  // Measurements
  route('POST', '/measurements/check-in', (c) => checkInUpsert(day(c.body.entry_date), c.body)),
  route('GET', '/measurements/check-in/:date', (c) => latestMeasures(c.p.date!)),
  route('PUT', '/measurements/check-in/:id', (c) => upsert('checkIn', c.p.id, c.body)),
  route('DELETE', '/measurements/check-in/:id', (c) => remove('checkIn', c.p.id)),
  route('GET', '/measurements/check-in-measurements-range/:s/:e', (c) =>
    db.checkIn.filter((r: any) => r.entry_date >= c.p.s! && r.entry_date <= c.p.e!)),
  route('GET', '/measurements/most-recent/:type', (c) => {
    const v = latestMeasures(c.q.get('date') ?? today())[c.p.type!];
    return v == null ? {} : { [c.p.type!]: v };
  }),
  ...crud('/measurements/custom-categories', 'customCategories', (b) => ({ frequency: b.frequency ?? 'Daily', data_type: b.data_type ?? 'numeric', display_name: b.display_name ?? b.name })),
  route('GET', '/measurements/custom-entries/latest-manual-on-or-before-date', () => []),
  route('GET', '/measurements/custom-entries', (c) => {
    const id = c.q.get('category_id');
    return db.customEntries.filter((e: any) => !id || e.category_id === id);
  }),
  route('POST', '/measurements/custom-entries', (c) => {
    const row = { id: uuid(), user_id: USER_ID, entry_hour: null, notes: null, source: 'manual', created_by_user_id: null, updated_by_user_id: null, entry_timestamp: now(), created_at: now(), updated_at: now(), ...c.body, value: String(c.body.value) };
    db.customEntries.push(row);
    return row;
  }),
  route('GET', '/measurements/custom-entries/:date', (c) =>
    db.customEntries.filter((e: any) => day(e.entry_date) === c.p.date)),
  route('DELETE', '/measurements/custom-entries/:id', (c) => remove('customEntries', c.p.id)),

  // Water
  route('GET', '/measurements/water-intake/:date', (c) => ({ water_ml: waterOn(c.p.date!) })),
  route('POST', '/measurements/water-intake', (c) => {
    const b = c.body;
    const date = day(b.entry_date ?? today());
    const glass = db.waterContainers.find((w: any) => w.id === b.container_id) ?? db.waterContainers[0];
    const ml = num(b.change_drinks) * num(glass?.volume ?? 250);
    // A minus press can never take the day below zero.
    db.water.push({ id: uuid(), user_id: USER_ID, entry_date: date, water_ml: Math.max(ml, -waterOn(date)), container_id: glass?.id ?? null, container_name: glass?.name ?? null, source: 'manual', created_at: now(), logged_at: now() });
    return { water_ml: waterOn(date) };
  }),
  route('GET', '/v2/measurements/water-intake/:date/log', (c) =>
    db.water.filter((w: any) => w.entry_date === c.p.date && w.water_ml > 0)),
  route('DELETE', '/v2/measurements/water-intake/log/:id', (c) => remove('water', c.p.id)),
  route('GET', '/water-containers', () => db.waterContainers),
  route('POST', '/water-containers', (c) => {
    const row = { id: db.seq++ + 1, user_id: USER_ID, ...c.body };
    db.waterContainers.push(row);
    return row;
  }),
  route('PUT', '/water-containers/:id/set-primary', (c) => {
    for (const w of db.waterContainers) w.is_primary = String(w.id) === c.p.id;
    return find('waterContainers', c.p.id);
  }),
  route('PUT', '/water-containers/:id', (c) => upsert('waterContainers', c.p.id, c.body)),
  route('DELETE', '/water-containers/:id', (c) => remove('waterContainers', c.p.id)),
  route('GET', '/water-containers/catalog', () => []),
  route('GET', '/water-containers/presets', () => []),

  // Exercise
  route('GET', '/exercises/equipment', () => [...new Set(db.exercises.flatMap((e: any) => e.equipment ?? []))]),
  route('GET', '/exercises/muscle-groups', () => [...new Set(db.exercises.flatMap((e: any) => e.primary_muscles ?? []))]),
  route('GET', '/exercises/names', () => db.exercises.map((e: any) => ({ id: e.id, name: e.name }))),
  route('GET', '/exercises/search', (c) => db.exercises.filter((e: any) => e.name.toLowerCase().includes((c.q.get('searchTerm') ?? '').toLowerCase()))),
  route('GET', '/exercises/recent', () => recentExercises()),
  route('GET', '/exercises/top', () => recentExercises()),
  route('GET', '/exercises/:id/deletion-impact', (c) => {
    const n = db.exerciseEntries.filter((e: any) => e.exercise_id === c.p.id).length;
    return { exerciseEntriesCount: n, workoutPlansCount: 0, workoutPresetsCount: 0, totalReferences: n, currentUserReferences: n, otherUserReferences: 0, isPubliclyShared: false, familySharedUsers: [] };
  }),
  route('GET', '/exercises', (c) => {
    const term = (c.q.get('searchTerm') ?? '').toLowerCase();
    const cat = c.q.get('categoryFilter') ?? 'all';
    const page = Number(c.q.get('currentPage') ?? 1);
    const size = Number(c.q.get('itemsPerPage') ?? 10);
    const list = db.exercises.filter((e: any) => e.name.toLowerCase().includes(term) && (cat === 'all' || e.category === cat));
    return { exercises: list.slice((page - 1) * size, page * size), totalCount: list.length };
  }),
  route('POST', '/exercises', (c) => {
    const b = c.body.exerciseData ? JSON.parse(c.body.exerciseData) : c.body;
    const row = { id: uuid(), user_id: USER_ID, is_custom: true, source: 'custom', images: [], equipment: [], primary_muscles: [], secondary_muscles: [], instructions: [], created_at: now(), updated_at: now(), ...b };
    db.exercises.push(row);
    return row;
  }),
  route('GET', '/exercises/:id', (c) => find('exercises', c.p.id)),
  route('PUT', '/exercises/:id', (c) => upsert('exercises', c.p.id, c.body.exerciseData ? JSON.parse(c.body.exerciseData) : c.body)),
  route('DELETE', '/exercises/:id', (c) => remove('exercises', c.p.id)),
  route('GET', '/v2/exercise-entries/by-date', (c) => sessionsOn(c.q.get('selectedDate') ?? today())),
  route('POST', '/exercise-entries', (c) => { const e = makeExerciseEntry(c.body); db.exerciseEntries.push(e); return e; }),
  route('GET', '/exercise-entries/history/:id', (c) => db.exerciseEntries.filter((e: any) => e.exercise_id === c.p.id).slice(-Number(c.q.get('limit') ?? 5)).reverse()),
  route('GET', '/exercise-entries/progress/:id', () => []),
  route('GET', '/exercise-entries/:id', (c) => find('exerciseEntries', c.p.id)),
  route('PUT', '/exercise-entries/:id', (c) => {
    const b = parseFields(c.body);
    if (b.sets) b.sets = setsOf(b.sets);
    return upsert('exerciseEntries', c.p.id, b);
  }),
  route('DELETE', '/exercise-entries/:id', (c) => remove('exerciseEntries', c.p.id)),
  route('GET', '/workout-presets', () => ({ presets: db.workoutPresets, total: db.workoutPresets.length, page: 1, limit: 100 })),

  // Fasting
  route('GET', '/fasting/current', () => db.fasting.find((f: any) => f.status === 'ACTIVE') ?? null),
  route('POST', '/fasting/start', (c) => {
    const row = { id: uuid(), user_id: USER_ID, end_time: null, duration_minutes: null, status: 'ACTIVE', created_at: now(), ...c.body };
    db.fasting.push(row);
    return row;
  }),
  route('POST', '/fasting/end', (c) => {
    if (c.body.weight) checkInUpsert(today(), { weight: c.body.weight });
    return upsert('fasting', c.body.id, {
      start_time: c.body.start_time, end_time: c.body.end_time, status: 'COMPLETED',
      duration_minutes: Math.round((+new Date(c.body.end_time) - +new Date(c.body.start_time)) / 60000),
    });
  }),
  route('GET', '/fasting/history', () => fastsDone()),
  route('GET', '/fasting/history/range/:s/:e', (c) => fastsDone().filter((f: any) => day(f.start_time) >= c.p.s! && day(f.start_time) <= c.p.e!)),
  route('GET', '/fasting/stats', () => {
    const d = fastsDone();
    const total = d.reduce((s: number, f: any) => s + num(f.duration_minutes), 0);
    return { total_completed_fasts: String(d.length), total_minutes_fasted: String(total), average_duration_minutes: String(d.length ? total / d.length : 0) };
  }),

  // Sleep & mood
  route('GET', '/sleep/details', (c) => db.sleep.filter((s: any) => day(s.entry_date) >= c.q.get('startDate')! && day(s.entry_date) <= c.q.get('endDate')!)),
  route('POST', '/sleep/manual_entry', (c) => { const r = { id: uuid(), user_id: USER_ID, created_at: now(), stage_events: [], ...c.body }; db.sleep.push(r); return r; }),
  route('PUT', '/sleep/:id', (c) => upsert('sleep', c.p.id, c.body)),
  route('DELETE', '/sleep/:id', (c) => remove('sleep', c.p.id)),
  ...kv('/mood/display-preferences', 'moodDisplay', { hidden_moods: [] }),
  route('GET', '/mood/custom', () => db.customMoods),
  route('POST', '/mood/custom', (c) => { const r = { id: uuid(), ...c.body }; db.customMoods.push(r); return r; }),
  route('DELETE', '/mood/custom/:id', (c) => remove('customMoods', c.p.id)),
  route('GET', '/mood/date/:date', (c) => db.mood.filter((m: any) => m.entry_date === c.p.date)),
  route('GET', '/mood', (c) => db.mood.filter((m: any) => m.entry_date >= c.q.get('startDate')! && m.entry_date <= c.q.get('endDate')!)),
  route('POST', '/mood', (c) => { const r = { id: uuid(), user_id: USER_ID, created_at: now(), ...c.body }; db.mood.push(r); return r; }),
  route('PUT', '/mood/:id', (c) => upsert('mood', c.p.id, c.body)),
  route('DELETE', '/mood/:id', (c) => remove('mood', c.p.id)),

  route('GET', '/v2/heart-rate-zones', () => {
    const max = 190;
    const floors = [0.5, 0.6, 0.7, 0.8, 0.9].map((p) => Math.round(max * p));
    return {
      settings: { max_heart_rate: null, resting_heart_rate: null, method: 'percent_max', custom_floors: null, display_zones: 5 },
      resolved: { max_hr: max, max_hr_source: 'fallback', resting_hr: null, method: 'percent_max', effective_method: 'percent_max',
        zones: floors.map((f, i) => ({ zone: i + 1, lower_bpm: f, upper_bpm: floors[i + 1] ? floors[i + 1]! - 1 : null })) },
    };
  }),

  // Reports
  route('GET', '/reports', (c) => reports(c.q.get('startDate')!, c.q.get('endDate')!)),
  route('GET', '/reports/mini-nutrition-trends', (c) => dayRange(c.q.get('startDate')!, c.q.get('endDate')!).map(nutritionDay)),
];

function recentExercises() {
  const ids = [...new Set([...db.exerciseEntries].reverse().map((e: any) => e.exercise_id))].slice(0, 10);
  return ids.map((id) => db.exercises.find((e: any) => e.id === id)).filter(Boolean);
}
function fastsDone() {
  return db.fasting.filter((f: any) => f.status === 'COMPLETED').reverse();
}

// Unimplemented routes that return a single object: null means "no data".
const OBJECT_ROUTES = /^\/(v2\/)?reports\/|caffeine|run-program|adaptive|sleep-science|coaching|overview|settings|preferences|pregnancy/;

const LIST_ROUTES = /nutrient|allergen|ai-service-settings/;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data ?? null), { status, headers: { 'content-type': 'application/json' } });

const parseBody = (body: any) => {
  if (body == null) return {};
  if (body instanceof FormData) return Object.fromEntries([...body.entries()].filter(([, v]) => typeof v === 'string'));
  if (typeof body !== 'string') return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

async function handle(method: string, url: URL, body: any): Promise<Response> {
  const path = url.pathname.slice(url.pathname.indexOf('/api') + 4).replace(/\/$/, '') || '/';
  load();
  for (const r of routes) {
    if (r.m !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const p = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
    try {
      const result = await r.h({ p, q: url.searchParams, body: parseBody(body) });
      if (method !== 'GET') save();
      return json(result);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[local backend]', path, e);
      return json({ error: String(e) }, 500);
    }
  }
  if (method === 'GET') return json(OBJECT_ROUTES.test(path) && !LIST_ROUTES.test(path) ? null : []);
  return json({ error: 'Funcție indisponibilă în versiunea locală.' }, 501);
}

const realFetch = window.fetch.bind(window);

function installLocalBackend() {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !/(^|\/)api(\/|$)/.test(url.pathname)) {
      return realFetch(input, init);
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const body = init?.body ?? (input instanceof Request && method !== 'GET' ? await input.clone().text() : undefined);
    return handle(method, url, body);
  };
}

installLocalBackend();
