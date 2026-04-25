const app = document.getElementById("app");
let selectedRecipeId = null;
let searchQuery = "";
let selectedCategory = "All";
let survivorTribe = [];
let immuneRecipeId = null;
let selectedMealIds = [];
let selectedTheme = localStorage.getItem("recipeTheme") || "normal";
document.body.dataset.theme = selectedTheme;

function getHeadshot() {
  if (selectedTheme === "lost") return "lost-headshot.png";
  if (selectedTheme === "psych") return "psych-headshot.png";
  if (selectedTheme === "survivor") return "survivor-headshot.png";
  return "headshot.png";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function isStructuredIngredient(ingredient) {
  return ingredient && typeof ingredient === "object" && "name" in ingredient;
}

function ingredientSearchText(ingredient) {
  if (isStructuredIngredient(ingredient)) {
    return [ingredient.name, ingredient.unit, ingredient.section].join(" ");
  }
  return String(ingredient);
}

function formatIngredientDisplay(ingredient) {
  if (!isStructuredIngredient(ingredient)) return String(ingredient);
  const qty = ingredient.quantity === "to taste" ? "to taste" : ingredient.quantity;
  const unit = ingredient.unit ? ` ${ingredient.unit}` : "";
  return `${qty}${unit} ${ingredient.name}`.trim();
}

function normalizeUnit(unit) {
  if (!unit) return "";
  const clean = unit.toLowerCase();
  if (["cup", "cups"].includes(clean)) return "cups";
  if (["tbsp", "tablespoon", "tablespoons"].includes(clean)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(clean)) return "tsp";
  if (["lb", "lbs", "pound", "pounds"].includes(clean)) return "lb";
  if (["oz", "ounce", "ounces"].includes(clean)) return "oz";
  return clean;
}

function formatNumber(value) {
  if (typeof value !== "number") return value;
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function convertToShoppingUnit(name, quantity, unit) {
  const normalizedName = name.toLowerCase();
  const normalizedUnit = normalizeUnit(unit);

  if (quantity === "to taste") return "to taste";
  if (typeof quantity !== "number") return `${quantity}${normalizedUnit ? ` ${normalizedUnit}` : ""}`;

  if (normalizedName === "garlic") {
    const bulbs = Math.max(1, Math.ceil(quantity / 10));
    return `${bulbs} bulb${bulbs > 1 ? "s" : ""} (${formatNumber(quantity)} cloves needed)`;
  }

  if (normalizedName.includes("broth") && normalizedUnit === "cups") {
    const cartons = Math.max(1, Math.ceil(quantity / 4));
    return `${cartons} carton${cartons > 1 ? "s" : ""} (${formatNumber(quantity)} cups needed)`;
  }

  if (normalizedName === "yellow onion") {
    return `${formatNumber(quantity)} onion${quantity === 1 ? "" : "s"}`;
  }

  if (normalizedName === "green onions") {
    const bunches = Math.max(1, Math.ceil(quantity / 6));
    return `${bunches} bunch${bunches > 1 ? "es" : ""} (${formatNumber(quantity)} stalks needed)`;
  }

  return `${formatNumber(quantity)}${normalizedUnit ? ` ${normalizedUnit}` : ""}`.trim();
}

function buildShoppingList(selectedMeals) {
  const grouped = {};
  const fallbackItems = [];

  selectedMeals.forEach(meal => {
    meal.ingredients.forEach(ingredient => {

      if (!isStructuredIngredient(ingredient)) {
        fallbackItems.push({ meal: meal.name, text: String(ingredient) });
        return;
      }

      const name = ingredient.name;
      const unit = normalizeUnit(ingredient.unit || "");
      const section = ingredient.section || "Other";
      const key = `${section}|${name}|${unit}`;

      if (!grouped[key]) {
        grouped[key] = {
          name,
          unit,
          section,
          quantity: 0,
          toTaste: false,
          recipes: []
        };
      }

      if (ingredient.quantity === "to taste") {
        grouped[key].toTaste = true;
      } else if (typeof ingredient.quantity === "number") {
        grouped[key].quantity += ingredient.quantity;
      } else {
        grouped[key].quantity = ingredient.quantity;
      }

      grouped[key].recipes.push(meal.name);
    });
  });

  return { items: Object.values(grouped), fallbackItems };
}
