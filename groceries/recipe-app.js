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

function renderShoppingList(selectedMeals) {
  const { items } = buildShoppingList(selectedMeals);

  return items.map(item => `
    <li>
      <input type="checkbox">
      <strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(convertToShoppingUnit(item.name, item.quantity, item.unit))}
    </li>
  `).join("");
}

function renderShoppingPage(selectedMeals) {
  app.innerHTML = `
    <button onclick="renderList()">Back</button>
    <button onclick="window.print()">Print</button>

    <h1>Grocery List</h1>
    <ul class="shopping-list-page">
      ${renderShoppingList(selectedMeals)}
    </ul>
  `;
}

function renderList() {
  app.innerHTML = `
    <button id="chooseFiveBtn">Choose 5</button>
    <button id="makeListBtn">Make a List</button>
    <button id="resetBtn">Reset</button>

    ${recipes.map(r => `
      <div>
        <input type="checkbox" class="meal-checkbox" data-id="${r.id}">
        ${r.name}
      </div>
    `).join("")}
  `;

  document.querySelectorAll(".meal-checkbox").forEach(box => {
    box.addEventListener("change", e => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedMealIds.push(id);
      } else {
        selectedMealIds = selectedMealIds.filter(x => x !== id);
      }
    });
  });

  document.getElementById("makeListBtn").addEventListener("click", () => {
    const selectedMeals = recipes.filter(r => selectedMealIds.includes(r.id));
    renderShoppingPage(selectedMeals);
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    selectedMealIds = [];
    renderList();
  });

  document.getElementById("chooseFiveBtn").addEventListener("click", () => {
    const picked = [...recipes].sort(() => 0.5 - Math.random()).slice(0, 5);
    alert(picked.map(r => r.name).join("\n"));
  });
}

renderList();
