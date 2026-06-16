import { Router } from "express";
import { db, aiDietPlansTable, membersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface FoodItem { food: string; amount: string; calories: number; protein: number; carbs: number; fats: number; }
interface Meal { name: string; time: string; calories: number; protein: number; items: FoodItem[]; }
interface GeneratedDietPlan {
  dailyCalories: number; protein: number; carbs: number; fats: number;
  hydration: string; bmi?: number; dietaryPreference?: string; activityLevel?: string;
  breakfast: Meal; lunch: Meal; dinner: Meal; snacks: Meal;
  notes: string; tips: string[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function parseWeight(w: string): number {
  const n = parseFloat(w);
  if (w.toLowerCase().includes("lb")) return n * 0.453592;
  return isNaN(n) ? 70 : n;
}
function parseHeight(h: string): number {
  const ft = h.match(/(\d+)'(\d+)/);
  if (ft) return parseInt(ft[1]) * 30.48 + parseInt(ft[2]) * 2.54;
  const n = parseFloat(h);
  if (isNaN(n)) return 170;
  if (n < 10) return n * 100;
  return n;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary:        1.2,
  lightly_active:   1.375,
  moderately_active:1.55,
  very_active:      1.725,
  extra_active:     1.9,
};

function calcMacros(kcal: number, goal: string): { protein: number; carbs: number; fats: number } {
  const ratios: Record<string, [number, number, number]> = {
    weight_loss:    [0.40, 0.35, 0.25],
    muscle_gain:    [0.30, 0.50, 0.20],
    strength:       [0.35, 0.45, 0.20],
    general_fitness:[0.30, 0.40, 0.30],
  };
  const [pr, ch, fa] = ratios[goal] ?? ratios.general_fitness;
  return {
    protein: Math.round((kcal * pr) / 4),
    carbs:   Math.round((kcal * ch) / 4),
    fats:    Math.round((kcal * fa) / 9),
  };
}

// ─── MEAL TEMPLATES ──────────────────────────────────────────────────────────

type MealTemplateSet = { breakfast: FoodItem[][]; lunch: FoodItem[][]; dinner: FoodItem[][]; snacks: FoodItem[][]; };

const STANDARD_TEMPLATES: Record<string, MealTemplateSet> = {
  weight_loss: {
    breakfast: [
      [
        { food: "Egg whites (6)", amount: "180g", calories: 94, protein: 20, carbs: 2, fats: 0 },
        { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
        { food: "Blueberries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
        { food: "Black coffee", amount: "240ml", calories: 5, protein: 0, carbs: 1, fats: 0 },
      ],
      [
        { food: "Greek yogurt (0%)", amount: "200g", calories: 104, protein: 18, carbs: 7, fats: 1 },
        { food: "Banana", amount: "1 medium", calories: 89, protein: 1, carbs: 23, fats: 0 },
        { food: "Almonds", amount: "20g", calories: 116, protein: 4, carbs: 3, fats: 10 },
      ],
    ],
    lunch: [[
      { food: "Grilled chicken breast", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Mixed green salad", amount: "150g", calories: 35, protein: 3, carbs: 6, fats: 0 },
      { food: "Cherry tomatoes", amount: "80g", calories: 14, protein: 1, carbs: 3, fats: 0 },
      { food: "Olive oil dressing", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 },
    ]],
    dinner: [
      [
        { food: "Salmon fillet", amount: "160g", calories: 331, protein: 36, carbs: 0, fats: 20 },
        { food: "Steamed broccoli", amount: "200g", calories: 68, protein: 6, carbs: 13, fats: 1 },
        { food: "Cauliflower rice", amount: "150g", calories: 38, protein: 3, carbs: 8, fats: 0 },
      ],
      [
        { food: "Lean ground turkey (93%)", amount: "180g", calories: 234, protein: 36, carbs: 0, fats: 9 },
        { food: "Stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 },
        { food: "Brown rice (cooked)", amount: "100g", calories: 111, protein: 3, carbs: 23, fats: 1 },
      ],
    ],
    snacks: [[
      { food: "Whey protein shake", amount: "1 scoop / 300ml water", calories: 130, protein: 25, carbs: 5, fats: 2 },
      { food: "Celery sticks", amount: "100g", calories: 14, protein: 1, carbs: 3, fats: 0 },
    ]],
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "3 large", calories: 213, protein: 18, carbs: 2, fats: 15 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 },
    ]],
    lunch: [[
      { food: "Chicken breast", amount: "220g", calories: 363, protein: 68, carbs: 0, fats: 8 },
      { food: "White rice (cooked)", amount: "200g", calories: 260, protein: 5, carbs: 57, fats: 0 },
      { food: "Avocado", amount: "½ fruit", calories: 120, protein: 2, carbs: 6, fats: 11 },
      { food: "Broccoli", amount: "150g", calories: 51, protein: 4, carbs: 10, fats: 1 },
    ]],
    dinner: [[
      { food: "Sirloin steak (lean)", amount: "200g", calories: 342, protein: 52, carbs: 0, fats: 14 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Asparagus", amount: "150g", calories: 34, protein: 4, carbs: 6, fats: 0 },
      { food: "Olive oil", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 },
    ]],
    snacks: [[
      { food: "Mass gainer / Protein shake", amount: "1 serving", calories: 280, protein: 30, carbs: 30, fats: 5 },
      { food: "Peanut butter", amount: "30g", calories: 188, protein: 8, carbs: 6, fats: 16 },
      { food: "Rice cakes", amount: "2 cakes", calories: 70, protein: 1, carbs: 16, fats: 0 },
    ]],
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Sourdough toast", amount: "2 slices", calories: 200, protein: 8, carbs: 38, fats: 2 },
      { food: "Smoked salmon", amount: "80g", calories: 130, protein: 18, carbs: 0, fats: 6 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 },
    ]],
    lunch: [[
      { food: "Lean beef mince (10% fat)", amount: "200g", calories: 320, protein: 44, carbs: 0, fats: 14 },
      { food: "Pasta (cooked)", amount: "200g", calories: 260, protein: 9, carbs: 52, fats: 2 },
      { food: "Tomato sauce", amount: "100g", calories: 35, protein: 2, carbs: 8, fats: 0 },
      { food: "Parmesan", amount: "20g", calories: 79, protein: 7, carbs: 1, fats: 5 },
    ]],
    dinner: [[
      { food: "Salmon fillet", amount: "200g", calories: 414, protein: 45, carbs: 0, fats: 25 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Roasted mixed vegetables", amount: "200g", calories: 100, protein: 4, carbs: 20, fats: 2 },
    ]],
    snacks: [[
      { food: "Protein shake + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "40g", calories: 240, protein: 8, carbs: 8, fats: 20 },
    ]],
  },
  general_fitness: {
    breakfast: [[
      { food: "Greek yogurt (full-fat)", amount: "200g", calories: 130, protein: 17, carbs: 9, fats: 3 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
      { food: "Granola", amount: "40g", calories: 179, protein: 4, carbs: 28, fats: 6 },
      { food: "Orange", amount: "1 medium", calories: 62, protein: 1, carbs: 15, fats: 0 },
    ]],
    lunch: [[
      { food: "Grilled chicken", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Mixed salad", amount: "150g", calories: 35, protein: 3, carbs: 6, fats: 0 },
      { food: "Brown rice (cooked)", amount: "150g", calories: 167, protein: 4, carbs: 35, fats: 1 },
      { food: "Hummus", amount: "50g", calories: 118, protein: 4, carbs: 10, fats: 7 },
    ]],
    dinner: [[
      { food: "Baked cod fillet", amount: "180g", calories: 189, protein: 41, carbs: 0, fats: 2 },
      { food: "Sweet potato mash", amount: "200g", calories: 172, protein: 3, carbs: 40, fats: 0 },
      { food: "Green beans", amount: "150g", calories: 53, protein: 3, carbs: 12, fats: 0 },
      { food: "Olive oil drizzle", amount: "5ml", calories: 44, protein: 0, carbs: 0, fats: 5 },
    ]],
    snacks: [[
      { food: "Apple", amount: "1 medium", calories: 95, protein: 0, carbs: 25, fats: 0 },
      { food: "String cheese", amount: "28g", calories: 80, protein: 7, carbs: 1, fats: 5 },
    ]],
  },
};

const VEGETARIAN_TEMPLATES: Record<string, MealTemplateSet> = {
  weight_loss: {
    breakfast: [[
      { food: "Scrambled eggs (3)", amount: "150g", calories: 195, protein: 18, carbs: 2, fats: 14 },
      { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
    ]],
    lunch: [[
      { food: "Paneer (low-fat)", amount: "150g", calories: 246, protein: 18, carbs: 4, fats: 18 },
      { food: "Mixed salad", amount: "200g", calories: 40, protein: 3, carbs: 7, fats: 0 },
      { food: "Chickpeas (cooked)", amount: "100g", calories: 164, protein: 9, carbs: 27, fats: 3 },
      { food: "Lemon-tahini dressing", amount: "15g", calories: 90, protein: 3, carbs: 3, fats: 8 },
    ]],
    dinner: [[
      { food: "Lentil soup", amount: "300g", calories: 230, protein: 18, carbs: 38, fats: 2 },
      { food: "Steamed broccoli", amount: "200g", calories: 68, protein: 6, carbs: 13, fats: 1 },
      { food: "Brown rice (cooked)", amount: "80g", calories: 89, protein: 2, carbs: 19, fats: 1 },
    ]],
    snacks: [[
      { food: "Whey protein shake", amount: "1 scoop / 300ml milk", calories: 200, protein: 30, carbs: 12, fats: 3 },
      { food: "Cucumber sticks", amount: "100g", calories: 15, protein: 1, carbs: 3, fats: 0 },
    ]],
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
    ]],
    lunch: [[
      { food: "Cottage cheese (full-fat)", amount: "200g", calories: 206, protein: 25, carbs: 8, fats: 9 },
      { food: "Brown rice (cooked)", amount: "200g", calories: 222, protein: 5, carbs: 46, fats: 2 },
      { food: "Black beans (cooked)", amount: "150g", calories: 227, protein: 15, carbs: 41, fats: 1 },
      { food: "Avocado", amount: "½ fruit", calories: 120, protein: 2, carbs: 6, fats: 11 },
    ]],
    dinner: [[
      { food: "Paneer tikka", amount: "200g", calories: 340, protein: 24, carbs: 6, fats: 25 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Spinach sauté", amount: "150g", calories: 55, protein: 5, carbs: 8, fats: 1 },
    ]],
    snacks: [[
      { food: "Whey protein + whole milk", amount: "1 scoop + 300ml", calories: 280, protein: 34, carbs: 18, fats: 8 },
      { food: "Peanut butter on rice cakes", amount: "30g pb + 2 cakes", calories: 258, protein: 9, carbs: 22, fats: 16 },
    ]],
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Cheese (cheddar)", amount: "40g", calories: 164, protein: 10, carbs: 0, fats: 14 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 },
    ]],
    lunch: [[
      { food: "Greek yogurt (full-fat)", amount: "200g", calories: 160, protein: 14, carbs: 10, fats: 7 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Chickpeas (roasted)", amount: "100g", calories: 164, protein: 9, carbs: 27, fats: 3 },
      { food: "Feta cheese", amount: "30g", calories: 80, protein: 5, carbs: 1, fats: 6 },
    ]],
    dinner: [[
      { food: "Tempeh", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 },
      { food: "Brown rice (cooked)", amount: "180g", calories: 200, protein: 4, carbs: 42, fats: 1 },
    ]],
    snacks: [[
      { food: "Protein shake (whey) + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "40g", calories: 240, protein: 8, carbs: 8, fats: 20 },
    ]],
  },
  general_fitness: {
    breakfast: [[
      { food: "Poached eggs (2)", amount: "100g", calories: 130, protein: 12, carbs: 1, fats: 9 },
      { food: "Wholegrain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Avocado", amount: "½ fruit", calories: 120, protein: 2, carbs: 6, fats: 11 },
      { food: "Orange", amount: "1 medium", calories: 62, protein: 1, carbs: 15, fats: 0 },
    ]],
    lunch: [[
      { food: "Caprese salad (mozzarella + tomato)", amount: "200g", calories: 220, protein: 14, carbs: 10, fats: 14 },
      { food: "Lentil soup", amount: "250g", calories: 192, protein: 15, carbs: 32, fats: 2 },
      { food: "Crusty bread", amount: "1 slice", calories: 80, protein: 3, carbs: 16, fats: 1 },
    ]],
    dinner: [[
      { food: "Vegetable curry", amount: "300g", calories: 210, protein: 8, carbs: 34, fats: 6 },
      { food: "Basmati rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Greek yogurt raita", amount: "80g", calories: 52, protein: 4, carbs: 5, fats: 2 },
    ]],
    snacks: [[
      { food: "Apple", amount: "1 medium", calories: 95, protein: 0, carbs: 25, fats: 0 },
      { food: "Cottage cheese", amount: "100g", calories: 103, protein: 13, carbs: 4, fats: 5 },
    ]],
  },
};

const VEGAN_TEMPLATES: Record<string, MealTemplateSet> = {
  weight_loss: {
    breakfast: [[
      { food: "Tofu scramble", amount: "200g", calories: 160, protein: 18, carbs: 4, fats: 9 },
      { food: "Oatmeal (dry) + almond milk", amount: "50g + 200ml", calories: 250, protein: 8, carbs: 40, fats: 5 },
      { food: "Blueberries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
    ]],
    lunch: [[
      { food: "Lentil & spinach salad", amount: "300g", calories: 260, protein: 18, carbs: 40, fats: 4 },
      { food: "Cucumber & cherry tomatoes", amount: "150g", calories: 25, protein: 1, carbs: 5, fats: 0 },
      { food: "Tahini dressing", amount: "15g", calories: 90, protein: 3, carbs: 3, fats: 8 },
    ]],
    dinner: [[
      { food: "Chickpea & vegetable stew", amount: "350g", calories: 280, protein: 15, carbs: 48, fats: 5 },
      { food: "Brown rice (cooked)", amount: "120g", calories: 134, protein: 3, carbs: 28, fats: 1 },
      { food: "Kale chips", amount: "50g", calories: 50, protein: 4, carbs: 8, fats: 1 },
    ]],
    snacks: [[
      { food: "Pea protein shake (water)", amount: "1 scoop", calories: 120, protein: 24, carbs: 3, fats: 2 },
      { food: "Celery + almond butter", amount: "100g + 15g", calories: 108, protein: 3, carbs: 7, fats: 8 },
    ]],
  },
  muscle_gain: {
    breakfast: [[
      { food: "Pea protein smoothie (oat milk)", amount: "1 scoop + 400ml", calories: 280, protein: 28, carbs: 28, fats: 6 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Chia seeds", amount: "20g", calories: 97, protein: 3, carbs: 8, fats: 6 },
    ]],
    lunch: [[
      { food: "Tempeh (marinated)", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Brown rice (cooked)", amount: "200g", calories: 222, protein: 5, carbs: 46, fats: 2 },
      { food: "Edamame", amount: "100g", calories: 121, protein: 11, carbs: 9, fats: 5 },
      { food: "Sesame oil drizzle", amount: "5ml", calories: 40, protein: 0, carbs: 0, fats: 4 },
    ]],
    dinner: [[
      { food: "Black bean burgers", amount: "2 patties", calories: 360, protein: 24, carbs: 52, fats: 8 },
      { food: "Sweet potato fries (baked)", amount: "200g", calories: 172, protein: 3, carbs: 40, fats: 1 },
      { food: "Avocado", amount: "1 whole", calories: 240, protein: 3, carbs: 13, fats: 22 },
    ]],
    snacks: [[
      { food: "Pea protein shake (oat milk)", amount: "1 scoop + 300ml", calories: 230, protein: 26, carbs: 20, fats: 5 },
      { food: "Mixed nuts & dried fruit", amount: "50g", calories: 265, protein: 7, carbs: 22, fats: 17 },
    ]],
  },
  strength: {
    breakfast: [[
      { food: "Tofu scramble with nutritional yeast", amount: "250g", calories: 220, protein: 26, carbs: 8, fats: 10 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Almond butter", amount: "20g", calories: 122, protein: 4, carbs: 4, fats: 11 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 },
    ]],
    lunch: [[
      { food: "Lentil bolognese", amount: "300g", calories: 320, protein: 24, carbs: 50, fats: 5 },
      { food: "Pasta (wholewheat, cooked)", amount: "200g", calories: 280, protein: 12, carbs: 54, fats: 3 },
      { food: "Nutritional yeast", amount: "10g", calories: 45, protein: 8, carbs: 5, fats: 1 },
    ]],
    dinner: [[
      { food: "Tempeh stir-fry", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Mixed stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 },
    ]],
    snacks: [[
      { food: "Pea protein shake (water) + creatine", amount: "1 scoop + 5g", calories: 125, protein: 25, carbs: 4, fats: 2 },
      { food: "Walnuts & dark chocolate", amount: "30g + 20g", calories: 280, protein: 5, carbs: 14, fats: 22 },
    ]],
  },
  general_fitness: {
    breakfast: [[
      { food: "Overnight oats (oat milk)", amount: "80g + 200ml", calories: 310, protein: 10, carbs: 54, fats: 7 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
      { food: "Flaxseeds", amount: "15g", calories: 81, protein: 3, carbs: 4, fats: 6 },
    ]],
    lunch: [[
      { food: "Buddha bowl (chickpeas + quinoa)", amount: "350g", calories: 420, protein: 20, carbs: 60, fats: 12 },
      { food: "Tahini & lemon dressing", amount: "20g", calories: 120, protein: 4, carbs: 4, fats: 10 },
      { food: "Cucumber & radish", amount: "100g", calories: 15, protein: 1, carbs: 3, fats: 0 },
    ]],
    dinner: [[
      { food: "Thai green lentil curry", amount: "300g", calories: 290, protein: 18, carbs: 46, fats: 5 },
      { food: "Jasmine rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Coconut cream (2 tbsp)", amount: "30g", calories: 66, protein: 1, carbs: 2, fats: 7 },
    ]],
    snacks: [[
      { food: "Apple with almond butter", amount: "1 medium + 20g", calories: 217, protein: 4, carbs: 33, fats: 11 },
      { food: "Edamame (shelled)", amount: "80g", calories: 97, protein: 9, carbs: 7, fats: 4 },
    ]],
  },
};

const HALAL_TEMPLATES: Record<string, MealTemplateSet> = {
  weight_loss: {
    breakfast: [[
      { food: "Egg whites (6)", amount: "180g", calories: 94, protein: 20, carbs: 2, fats: 0 },
      { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
      { food: "Dates", amount: "2 pieces", calories: 66, protein: 1, carbs: 18, fats: 0 },
      { food: "Black coffee", amount: "240ml", calories: 5, protein: 0, carbs: 1, fats: 0 },
    ]],
    lunch: [[
      { food: "Grilled halal chicken breast", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Tabbouleh salad", amount: "150g", calories: 120, protein: 4, carbs: 18, fats: 4 },
      { food: "Cherry tomatoes", amount: "80g", calories: 14, protein: 1, carbs: 3, fats: 0 },
      { food: "Olive oil & lemon dressing", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 },
    ]],
    dinner: [[
      { food: "Halal lamb (lean)", amount: "160g", calories: 290, protein: 38, carbs: 0, fats: 15 },
      { food: "Roasted cauliflower", amount: "200g", calories: 66, protein: 5, carbs: 13, fats: 1 },
      { food: "Bulgur wheat (cooked)", amount: "100g", calories: 83, protein: 3, carbs: 19, fats: 0 },
    ]],
    snacks: [[
      { food: "Whey protein shake (halal-certified)", amount: "1 scoop / 300ml water", calories: 130, protein: 25, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "25g", calories: 150, protein: 4, carbs: 6, fats: 12 },
    ]],
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "3 large", calories: 213, protein: 18, carbs: 2, fats: 15 },
      { food: "Oatmeal with honey", amount: "80g + 10g", calories: 344, protein: 11, carbs: 65, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 },
    ]],
    lunch: [[
      { food: "Halal chicken breast", amount: "220g", calories: 363, protein: 68, carbs: 0, fats: 8 },
      { food: "White rice (cooked)", amount: "200g", calories: 260, protein: 5, carbs: 57, fats: 0 },
      { food: "Lentil dal", amount: "150g", calories: 173, protein: 12, carbs: 30, fats: 1 },
      { food: "Broccoli", amount: "150g", calories: 51, protein: 4, carbs: 10, fats: 1 },
    ]],
    dinner: [[
      { food: "Halal beef steak (lean)", amount: "200g", calories: 342, protein: 52, carbs: 0, fats: 14 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Spinach with olive oil", amount: "150g + 5ml", calories: 78, protein: 5, carbs: 7, fats: 5 },
    ]],
    snacks: [[
      { food: "Halal whey protein + milk", amount: "1 scoop + 300ml", calories: 280, protein: 33, carbs: 18, fats: 8 },
      { food: "Date & nut energy balls", amount: "2 pieces", calories: 180, protein: 4, carbs: 26, fats: 8 },
    ]],
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Halal turkey slices", amount: "80g", calories: 108, protein: 20, carbs: 2, fats: 2 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 },
    ]],
    lunch: [[
      { food: "Halal beef mince (10%)", amount: "200g", calories: 320, protein: 44, carbs: 0, fats: 14 },
      { food: "Pasta (cooked)", amount: "200g", calories: 260, protein: 9, carbs: 52, fats: 2 },
      { food: "Tomato-based sauce", amount: "100g", calories: 35, protein: 2, carbs: 8, fats: 0 },
      { food: "Parmesan", amount: "20g", calories: 79, protein: 7, carbs: 1, fats: 5 },
    ]],
    dinner: [[
      { food: "Halal salmon fillet", amount: "200g", calories: 414, protein: 45, carbs: 0, fats: 25 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Roasted root vegetables", amount: "200g", calories: 100, protein: 4, carbs: 20, fats: 2 },
    ]],
    snacks: [[
      { food: "Halal protein shake + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts & raisins", amount: "40g", calories: 210, protein: 5, carbs: 18, fats: 13 },
    ]],
  },
  general_fitness: {
    breakfast: [[
      { food: "Foul medames (fava beans)", amount: "200g", calories: 186, protein: 14, carbs: 32, fats: 1 },
      { food: "Poached egg (2)", amount: "100g", calories: 130, protein: 12, carbs: 1, fats: 9 },
      { food: "Wholegrain pitta", amount: "1 piece", calories: 150, protein: 5, carbs: 29, fats: 2 },
      { food: "Olive oil drizzle", amount: "5ml", calories: 44, protein: 0, carbs: 0, fats: 5 },
    ]],
    lunch: [[
      { food: "Halal chicken shawarma wrap", amount: "1 wrap", calories: 380, protein: 34, carbs: 38, fats: 10 },
      { food: "Hummus", amount: "50g", calories: 118, protein: 4, carbs: 10, fats: 7 },
      { food: "Tabouli salad", amount: "100g", calories: 80, protein: 3, carbs: 12, fats: 3 },
    ]],
    dinner: [[
      { food: "Halal lamb kofta", amount: "180g", calories: 310, protein: 30, carbs: 6, fats: 18 },
      { food: "Basmati rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Cucumber-yogurt dip (labneh)", amount: "80g", calories: 70, protein: 4, carbs: 4, fats: 4 },
    ]],
    snacks: [[
      { food: "Dates & almonds", amount: "3 dates + 20g almonds", calories: 215, protein: 4, carbs: 38, fats: 11 },
      { food: "Greek yogurt", amount: "150g", calories: 97, protein: 13, carbs: 7, fats: 2 },
    ]],
  },
};

function getTemplates(dietaryPreference: string): Record<string, MealTemplateSet> {
  if (dietaryPreference === "vegetarian") return VEGETARIAN_TEMPLATES;
  if (dietaryPreference === "vegan") return VEGAN_TEMPLATES;
  if (dietaryPreference === "halal") return HALAL_TEMPLATES;
  return STANDARD_TEMPLATES;
}

// ─── MEAL SCALER ─────────────────────────────────────────────────────────────

function scaleMeal(items: FoodItem[], targetKcal: number): { items: FoodItem[]; calories: number; protein: number } {
  const baseKcal = items.reduce((s, i) => s + i.calories, 0);
  const factor = baseKcal > 0 ? targetKcal / baseKcal : 1;
  const scaled = items.map(i => ({
    ...i,
    calories: Math.round(i.calories * factor),
    protein:  Math.round(i.protein * factor),
    carbs:    Math.round(i.carbs * factor),
    fats:     Math.round(i.fats * factor),
  }));
  return {
    items: scaled,
    calories: Math.round(targetKcal),
    protein: scaled.reduce((s, i) => s + i.protein, 0),
  };
}

// ─── MAIN GENERATOR ───────────────────────────────────────────────────────────

function generateDietPlan(params: {
  age: number; gender: string; weight: string; height: string; goal: string;
  activityLevel?: string; dietaryPreference?: string;
}): GeneratedDietPlan {
  const { age, gender, goal } = params;
  const activityLevel = params.activityLevel ?? "moderately_active";
  const dietaryPreference = params.dietaryPreference ?? "standard";

  const wKg = parseWeight(params.weight);
  const hCm = parseHeight(params.height);

  let bmr = 10 * wKg + 6.25 * hCm - 5 * age;
  bmr += gender === "male" ? 5 : -161;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  const tdee = bmr * multiplier;

  let kcal = tdee;
  if (goal === "weight_loss") kcal = tdee - 500;
  if (goal === "muscle_gain") kcal = tdee + 300;
  kcal = Math.round(Math.max(1400, kcal));

  const bmi = hCm > 0 ? Math.round((wKg / ((hCm / 100) ** 2)) * 10) / 10 : undefined;

  const { protein, carbs, fats } = calcMacros(kcal, goal);
  const templates = getTemplates(dietaryPreference);
  const tpl = templates[goal] ?? templates.general_fitness;
  const v = Math.round(Math.random());

  const bfRaw = tpl.breakfast[v] ?? tpl.breakfast[0];
  const luRaw = tpl.lunch[0];
  const diRaw = tpl.dinner[v] ?? tpl.dinner[0];
  const snRaw = tpl.snacks[0];

  const bfKcal = Math.round(kcal * 0.25);
  const luKcal = Math.round(kcal * 0.35);
  const diKcal = Math.round(kcal * 0.30);
  const snKcal = kcal - bfKcal - luKcal - diKcal;

  const bf = scaleMeal(bfRaw, bfKcal);
  const lu = scaleMeal(luRaw, luKcal);
  const di = scaleMeal(diRaw, diKcal);
  const sn = scaleMeal(snRaw, snKcal);

  const hydration = wKg > 0
    ? `${Math.round(wKg * 0.035 * 10) / 10}–${Math.round(wKg * 0.04 * 10) / 10} litres per day. Add ~500ml for every hour of training. Start your morning with a large glass before anything else.`
    : "2.5–3.5 litres per day. Adjust upward based on training intensity and climate.";

  const prefLabel: Record<string, string> = {
    standard: "Standard", vegetarian: "Vegetarian", vegan: "Vegan", halal: "Halal",
  };
  const actLabel: Record<string, string> = {
    sedentary: "Sedentary", lightly_active: "Lightly Active",
    moderately_active: "Moderately Active", very_active: "Very Active", extra_active: "Extra Active",
  };

  const notes: Record<string, string> = {
    weight_loss:    "Aim for a consistent 400–500 kcal daily deficit. High protein intake preserves lean muscle while losing fat. Sustainable loss is 0.5–1 kg/week — avoid crash dieting.",
    muscle_gain:    "Eat in a controlled surplus and time carbohydrates around workouts (1–2 hrs pre/post). Don't neglect vegetables and micronutrients.",
    strength:       "Pre-workout meals should be carb-rich for fuel. Post-workout protein within 30–60 min of finishing your session is critical.",
    general_fitness:"Balance is key. Enjoy a wide variety of whole foods, minimise ultra-processed products, and don't obsess over exact numbers.",
  };

  const tips: Record<string, string[]> = {
    weight_loss:    ["Track calories for at least 2 weeks to build awareness", "Eat slowly — wait 20 min before going for seconds", "Replace sugary drinks with water, black coffee, or herbal tea", "Prioritise sleep — poor sleep dramatically increases hunger hormones"],
    muscle_gain:    ["Don't skip carbs — they're your muscles' primary fuel source", "Eat within 60 min post-workout for optimal muscle protein synthesis", "Creatine monohydrate (5g/day) is proven to enhance strength and muscle mass", "Progressive overload drives muscle growth — nutrition supports and amplifies it"],
    strength:       ["Carbohydrates are critical for maximal strength output — don't cut them", "Time your largest carb-rich meal 2–3 hours before training", "Consider creatine (5g/day) and beta-alanine for performance support", "Adequate rest between sessions is a non-negotiable part of the programme"],
    general_fitness:["Cook more meals at home — healthier, cheaper, and more satisfying", "The 80/20 rule: eat well 80% of the time and don't stress the rest", "Variety in your diet ensures you get the full spectrum of micronutrients", "Stay consistent rather than perfect — habits beat willpower long-term"],
  };

  return {
    dailyCalories: kcal, protein, carbs, fats,
    hydration, bmi, dietaryPreference: prefLabel[dietaryPreference] ?? dietaryPreference,
    activityLevel: actLabel[activityLevel] ?? activityLevel,
    breakfast: { name: "Breakfast", time: "7:00 – 8:00 AM",       calories: bf.calories, protein: bf.protein, items: bf.items },
    lunch:     { name: "Lunch",     time: "12:00 – 1:00 PM",       calories: lu.calories, protein: lu.protein, items: lu.items },
    dinner:    { name: "Dinner",    time: "6:30 – 7:30 PM",        calories: di.calories, protein: di.protein, items: di.items },
    snacks:    { name: "Snacks",    time: "10:00 AM & 3:30 PM",    calories: sn.calories, protein: sn.protein, items: sn.items },
    notes: notes[goal] ?? notes.general_fitness,
    tips:  tips[goal] ?? tips.general_fitness,
  };
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

router.post("/generate", async (req, res) => {
  try {
    const { age, gender, weight, height, goal, activityLevel, dietaryPreference } = req.body;
    if (!age || !gender || !goal) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const plan = generateDietPlan({
      age: Number(age), gender, weight: String(weight || "70kg"), height: String(height || "170cm"),
      goal, activityLevel: activityLevel ?? "moderately_active", dietaryPreference: dietaryPreference ?? "standard",
    });
    res.json({ plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const plans = await db.select().from(aiDietPlansTable).where(eq(aiDietPlansTable.gymId, req.gymId!));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, memberName, age, gender, weight, height, goal, plan } = req.body;
    if (!memberId || !plan) { res.status(400).json({ error: "memberId and plan are required" }); return; }
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, Number(memberId)), eq(membersTable.gymId, gymId))).limit(1);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    const [saved] = await db.insert(aiDietPlansTable).values({
      gymId, memberId: Number(memberId), memberName: memberName ?? member.name,
      age: age ? Number(age) : null, gender: gender ?? null,
      weightVal: weight ? String(weight) : null, heightVal: height ? String(height) : null,
      goal: goal ?? null, plan,
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.gymId, gymId), eq(membersTable.email, req.userEmail!))).limit(1);
    if (!member) { res.json([]); return; }
    const plans = await db.select().from(aiDietPlansTable)
      .where(and(eq(aiDietPlansTable.gymId, gymId), eq(aiDietPlansTable.memberId, member.id)));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.gymId, gymId), eq(membersTable.email, req.userEmail!))).limit(1);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    const { age, gender, weight, height, goal, plan } = req.body;
    if (!plan) { res.status(400).json({ error: "plan is required" }); return; }
    const [saved] = await db.insert(aiDietPlansTable).values({
      gymId, memberId: member.id, memberName: member.name,
      age: age ? Number(age) : null, gender: gender ?? null,
      weightVal: weight ? String(weight) : null, heightVal: height ? String(height) : null,
      goal: goal ?? null, plan,
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [plan] = await db.select().from(aiDietPlansTable)
      .where(and(eq(aiDietPlansTable.id, Number(req.params.id)), eq(aiDietPlansTable.gymId, req.gymId!))).limit(1);
    if (!plan) { res.status(404).json({ error: "Not found" }); return; }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(aiDietPlansTable)
      .where(and(eq(aiDietPlansTable.id, Number(req.params.id)), eq(aiDietPlansTable.gymId, req.gymId!)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
