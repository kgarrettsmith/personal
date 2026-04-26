const app = document.getElementById("app");
let selectedRecipeId = null;
let searchQuery = "";
let selectedCategory = "All";
let survivorTribe = [];
let immuneRecipeId = null;
let selectedMealIds = [];
let selectedTheme = localStorage.getItem("recipeTheme") || "normal";
let hidePantry = false;
let checkedItems = JSON.parse(localStorage.getItem("checkedItems") || "{}");
document.body.dataset.theme = selectedTheme;

function getHeadshot() {
  if (selectedTheme === "lost") return "images/lost-headshot.png";
  if (selectedTheme === "psych") return "images/psych-headshot.png";
  if (selectedTheme === "survivor") return "images/survivor-headshot.png";
  return "images/headshot.png";
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

  if (normalizedName === "chicken broth" && normalizedUnit === "cups") {
    const cartons = Math.max(1, Math.ceil(quantity / 4));
    return `${cartons} carton${cartons > 1 ? "s" : ""} (${formatNumber(quantity)} cups needed)`;
  }

  if (normalizedName === "beef broth" && normalizedUnit === "cups") {
    const cartons = Math.max(1, Math.ceil(quantity / 4));
    return `${cartons} carton${cartons > 1 ? "s" : ""} (${formatNumber(quantity)} cups needed)`;
  }

  if (normalizedName === "yellow onion" && normalizedUnit === "") {
    return `${formatNumber(quantity)} onion${quantity === 1 ? "" : "s"}`;
  }

  if (normalizedName === "bell peppers" && normalizedUnit === "") {
    return `${formatNumber(quantity)} pepper${quantity === 1 ? "" : "s"}`;
  }

  if (normalizedName === "green onions" && normalizedUnit === "") {
    const bunches = Math.max(1, Math.ceil(quantity / 6));
    return `${bunches} bunch${bunches > 1 ? "es" : ""} (${formatNumber(quantity)} stalks needed)`;
  }

  if (normalizedName === "cream cheese" && normalizedUnit === "oz") {
    const blocks = Math.max(1, Math.ceil(quantity / 8));
    return `${blocks} block${blocks > 1 ? "s" : ""} (${formatNumber(quantity)} oz needed)`;
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
  const { items, fallbackItems } = buildShoppingList(selectedMeals);
  const sectionOrder = ["Produce", "Meat", "Dairy", "Frozen", "Refrigerated", "Pantry", "Other"];
  const itemsBySection = {};

  const pantryStaples = [
    "salt",
    "black pepper",
    "olive oil",
    "butter",
    "garlic powder",
    "onion powder",
    "paprika",
    "italian seasoning",
    "red pepper flakes",
    "crushed red pepper flakes"
  ];

  const filteredItems = hidePantry
    ? items.filter(item => !pantryStaples.includes(item.name.toLowerCase()))
    : items;

  filteredItems.forEach(item => {
    if (!itemsBySection[item.section]) itemsBySection[item.section] = [];
    itemsBySection[item.section].push(item);
  });

  const structuredHtml = sectionOrder
    .filter(section => itemsBySection[section] && itemsBySection[section].length)
    .map(section => `
      <h3 style="margin-top:24px;border-bottom:1px solid var(--border);padding-bottom:6px;">${escapeHtml(section)}</h3>
      <ul style="list-style:none;padding:0;margin:0;display:grid;gap:10px;">
        ${itemsBySection[section]
          .sort((a, b) => {
            if (a.toTaste && !b.toTaste) return 1;
            if (!a.toTaste && b.toTaste) return -1;
            return a.name.localeCompare(b.name);
          })
          .map(item => {
            const amount = item.toTaste
              ? "to taste"
              : convertToShoppingUnit(item.name, item.quantity, item.unit);

            return `
              <li style="display:flex;gap:14px;align-items:flex-start;padding:12px;border:1px solid var(--border);background:var(--soft);border-radius:8px;break-inside:avoid;">
                <input type="checkbox" data-key="${escapeHtml(item.name)}" ${checkedItems[item.name] ? "checked" : ""} />
                <span><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(amount)}<br><small style="color:var(--muted);">For: ${escapeHtml([...new Set(item.recipes)].join(", "))}</small></span>
              </li>
            `;
          }).join("")}
      </ul>
    `).join("");

  const fallbackHtml = fallbackItems.length ? `
    <h3 style="margin-top:24px;">Needs cleanup</h3>
    <p style="color:var(--muted);">These older recipe ingredients are still plain text and will not merge until converted to the new format.</p>
    <ul>
      ${fallbackItems.map(item => `<li>${escapeHtml(item.text)} <small style="color:var(--muted);">(${escapeHtml(item.meal)})</small></li>`).join("")}
    </ul>
  ` : "";

  return structuredHtml + fallbackHtml;
}

function renderShoppingPage(selectedMeals) {
  app.innerHTML = `
    <section class="theme-bar print-actions">
      <button id="backToRecipesBtn" style="padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">← Back to Recipes</button>
      <button id="printListBtn" style="padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Print</button>
      <button id="resetBtn" style="padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Reset</button>
    </section>

    <section class="detail-card shopping-list-page">
      <p class="eyebrow">Shopping List</p>
      <div style="display:flex;gap:10px;align-items:center;">
        <h1 class="detail-title" style="margin:0;">Grocery List</h1>
        <button id="togglePantryBtn">
          ${hidePantry ? "Show Pantry Items" : "Hide Pantry Items"}
        </button>
      </div>
      <p class="description">Selected meals: ${selectedMeals.length}</p>
      <ul style="margin-top:8px;">
        ${selectedMeals.map(meal => `<li>${escapeHtml(meal.name)}</li>`).join("")}
      </ul>
      ${renderShoppingList(selectedMeals)}
    </section>
  `;

  document.getElementById("togglePantryBtn").addEventListener("click", () => {
    hidePantry = !hidePantry;
    renderShoppingPage(selectedMeals);
  });

  document.getElementById("backToRecipesBtn").addEventListener("click", () => {
    selectedRecipeId = null;
    renderList();
  });

  document.getElementById("printListBtn").addEventListener("click", () => {
    window.print();
  });

document.getElementById("resetBtn").addEventListener("click", () => {
  selectedMealIds = [];
  renderList();
});

document.querySelectorAll("input[type='checkbox'][data-key]").forEach(box => {
  box.addEventListener("change", (e) => {
    const key = e.target.dataset.key;

    if (e.target.checked) {
      checkedItems[key] = true;
    } else {
      delete checkedItems[key];
    }

    localStorage.setItem("checkedItems", JSON.stringify(checkedItems));
  });
});

}

function getCategories() {
  return ["All", ...new Set(recipes.map(recipe => recipe.category))];
}

function getFilteredRecipes() {
  const q = searchQuery.trim().toLowerCase();
  return recipes.filter(recipe => {
    const matchesCategory = selectedCategory === "All" || recipe.category === selectedCategory;
    const text = [recipe.name, recipe.category, recipe.description, ...recipe.tags, ...recipe.ingredients.map(ingredientSearchText)].join(" ").toLowerCase();
    return matchesCategory && text.includes(q);
  });
}

function renderList() {
  const filtered = getFilteredRecipes();
  const categories = getCategories();

  app.innerHTML = `
    <section class="theme-bar">
      <label for="themeSelect">Theme:</label>
      <select id="themeSelect">
        <option value="normal" ${selectedTheme === "normal" ? "selected" : ""}>Normal</option>
        <option value="retro" ${selectedTheme === "retro" ? "selected" : ""}>80's Retro</option>
        <option value="lost" ${selectedTheme === "lost" ? "selected" : ""}>LOST</option>
        <option value="psych" ${selectedTheme === "psych" ? "selected" : ""}>PSYCH</option>
        <option value="survivor" ${selectedTheme === "survivor" ? "selected" : ""}>SURVIVOR</option>
      </select>
      <button id="chooseFiveBtn" style="margin-left:10px;padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Choose 5</button>
      <button id="makeListBtn" style="margin-left:10px;padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Make a List</button>
      <button id="resetBtn" style="margin-left:10px;padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Reset</button>
    </section>
    <section id="chooseFivePanel" style="display:none;margin-bottom:16px;padding:14px;border:1px solid var(--border);background:var(--card);border-radius:6px;"></section>
    <section id="shoppingListPanel" style="display:none;margin-bottom:16px;padding:14px;border:1px solid var(--border);background:var(--card);border-radius:6px;"></section>

    <section class="hero">
      <div>
        <div style="display:flex;align-items:center;gap:16px;">
          <img src="${getHeadshot()}" alt="Family" style="width:110px;height:110px;border-radius:50%;object-fit:cover;" />
          <div>
            <p class="eyebrow">Family Recipe Hub</p>
            <h1>What Is For Dinner?</h1>
          </div>
        </div>
        <p>A curated family recipe list with quick filters, searchable ingredients, and full recipe pages.</p>
      </div>
      <div class="count-box">
        <strong>${recipes.length}</strong>
        <span>saved recipes</span>
      </div>
    </section>

    <section class="mystery-panel">
      <p><strong>Previously on dinner...</strong><br>Let the island choose tonight’s meal.</p>
      <button class="mystery-button" id="mysteryButton">Mystery Dinner</button>
    </section>

    <section class="survivor-panel" id="survivorPanel">
      <div>
        <strong>Survivor Dinner Council</strong><br>
        <span style="color:var(--muted);">Pick a tribe of 5 meals, grant immunity, then vote meals off until one dinner remains.</span>
      </div>
      <div class="survivor-controls">
        <button class="survivor-button" id="startTribeBtn">Start Tribe of 5</button>
        <button class="survivor-button" id="immunityBtn">Grant Immunity</button>
        <button class="survivor-button" id="tribalCouncilBtn">Tribal Council</button>
      </div>
      <div id="survivorGame"></div>
    </section>

    <section class="toolbar">
      <input id="searchInput" type="search" placeholder="Search by recipe, ingredient, or tag..." value="${escapeHtml(searchQuery)}" />
      <select id="categorySelect">
        ${categories.map(category => `<option value="${escapeHtml(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
      </select>
    </section>

    ${filtered.length ? `
      <section class="grid">
        ${filtered.map(recipe => `
          <article class="card" data-recipe-id="${escapeHtml(recipe.id)}">
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;" onclick="event.stopPropagation()">
              <input type="checkbox" class="meal-checkbox" data-meal-id="${escapeHtml(recipe.id)}" ${selectedMealIds.includes(recipe.id) ? "checked" : ""} />
              <span>Select for shopping list</span>
            </label>
            <div class="card-header">
              <div>
                <h2>${escapeHtml(recipe.name)}</h2>
                <div class="category">${escapeHtml(recipe.category)}</div>
              </div>
              <span class="pill servings-pill">${recipe.servings} servings</span>
            </div>
            <p class="description">${escapeHtml(recipe.description)}</p>
            <div class="tags">
              ${recipe.tags.slice(0, 4).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </article>
        `).join("")}
      </section>
    ` : `<div class="empty">No recipes found. Try a different search or category.</div>`}
  `;

  document.getElementById("themeSelect").addEventListener("change", event => {
    selectedTheme = event.target.value;
    document.body.dataset.theme = selectedTheme;
    localStorage.setItem("recipeTheme", selectedTheme);
    renderList();
    triggerStatic();
  });

  const mysteryButton = document.getElementById("mysteryButton");
  if (mysteryButton) {
    mysteryButton.addEventListener("click", () => {
      const randomRecipe = recipes[Math.floor(Math.random() * recipes.length)];
      selectedRecipeId = randomRecipe.id;
      triggerStatic();
      setTimeout(() => {
        renderDetail();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 180);
    });
  }

  const chooseBtn = document.getElementById("chooseFiveBtn");
  const panel = document.getElementById("chooseFivePanel");
  if (chooseBtn && panel) {
    chooseBtn.addEventListener("click", () => {
      const shuffled = [...recipes].sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, 5);
      panel.style.display = "block";
      panel.innerHTML = `<strong>5 Dinner Picks:</strong><ul style="margin-top:8px;">${picked.map(r => `<li style="margin:6px 0;cursor:pointer;text-decoration:underline;" data-id="${r.id}">${escapeHtml(r.name)}</li>`).join("")}</ul>`;
      panel.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
          selectedRecipeId = li.dataset.id;
          renderDetail();
        });
      });
    });
  }

  setupSurvivorButtons();

  document.getElementById("searchInput").addEventListener("input", event => {
    searchQuery = event.target.value;
    renderList();
  });

  document.getElementById("categorySelect").addEventListener("change", event => {
    selectedCategory = event.target.value;
    renderList();
  });

  document.querySelectorAll(".meal-checkbox").forEach(box => {
    box.addEventListener("change", event => {
      const id = event.target.dataset.mealId;
      if (event.target.checked) {
        if (!selectedMealIds.includes(id) && selectedMealIds.length < 7) {
          selectedMealIds.push(id);
        } else if (selectedMealIds.length >= 7) {
          event.target.checked = false;
          alert("You can select up to 7 meals.");
        }
      } else {
        selectedMealIds = selectedMealIds.filter(mealId => mealId !== id);
      }
    });
  });

  const makeListBtn = document.getElementById("makeListBtn");
  const shoppingListPanel = document.getElementById("shoppingListPanel");
  if (makeListBtn && shoppingListPanel) {
    makeListBtn.addEventListener("click", () => {
      const selectedMeals = recipes.filter(recipe => selectedMealIds.includes(recipe.id));
      if (!selectedMeals.length) {
        shoppingListPanel.style.display = "block";
        shoppingListPanel.innerHTML = `<strong>Shopping List</strong><p style="margin-bottom:0;">Select 1 to 7 meals first.</p>`;
        return;
      }
      renderShoppingPage(selectedMeals);
    });
  }

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      selectedMealIds = [];
      document.querySelectorAll(".meal-checkbox").forEach(box => box.checked = false);
      if (shoppingListPanel) {
        shoppingListPanel.style.display = "none";
        shoppingListPanel.innerHTML = "";
      }
    });
  }

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest("label") || event.target.classList.contains("meal-checkbox")) return;
      selectedRecipeId = card.dataset.recipeId;
      renderDetail();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function shuffleRecipes() {
  return [...recipes].sort(() => Math.random() - 0.5);
}

function renderSurvivorGame() {
  const box = document.getElementById("survivorGame");
  if (!box) return;

  if (!survivorTribe.length) {
    box.innerHTML = `<p style="margin:0;color:var(--muted);">No tribe selected yet. Start with 5 meals.</p>`;
    return;
  }

  if (survivorTribe.length === 1) {
    const winner = survivorTribe[0];
    box.innerHTML = `
      <div style="padding:12px;border:1px solid var(--border);background:var(--soft);border-radius:8px;">
        <strong>The tribe has spoken.</strong><br>
        Tonight’s dinner is: <span style="color:var(--accent);font-weight:700;">${escapeHtml(winner.name)}</span><br>
        <button class="survivor-button" style="margin-top:10px;" data-open-winner="${escapeHtml(winner.id)}">View Recipe</button>
      </div>
    `;
    box.querySelector("[data-open-winner]").addEventListener("click", event => {
      selectedRecipeId = event.target.dataset.openWinner;
      renderDetail();
    });
    return;
  }

  box.innerHTML = `
    <ul class="tribe-list">
      ${survivorTribe.map(recipe => `
        <li>
          <span>${escapeHtml(recipe.name)} ${recipe.id === immuneRecipeId ? `<span class="immune-badge">IMMUNITY</span>` : ""}</span>
          <button data-vote-off="${escapeHtml(recipe.id)}" ${recipe.id === immuneRecipeId ? "disabled" : ""}>Vote Off</button>
        </li>
      `).join("")}
    </ul>
  `;

  box.querySelectorAll("[data-vote-off]").forEach(button => {
    button.addEventListener("click", event => {
      const id = event.target.dataset.voteOff;
      survivorTribe = survivorTribe.filter(recipe => recipe.id !== id);
      renderSurvivorGame();
    });
  });
}

function setupSurvivorButtons() {
  const start = document.getElementById("startTribeBtn");
  const immunity = document.getElementById("immunityBtn");
  const tribal = document.getElementById("tribalCouncilBtn");
  if (!start || !immunity || !tribal) return;

  start.addEventListener("click", () => {
    survivorTribe = shuffleRecipes().slice(0, 5);
    immuneRecipeId = null;
    renderSurvivorGame();
  });

  immunity.addEventListener("click", () => {
    if (!survivorTribe.length) survivorTribe = shuffleRecipes().slice(0, 5);
    immuneRecipeId = survivorTribe[Math.floor(Math.random() * survivorTribe.length)].id;
    renderSurvivorGame();
  });

  tribal.addEventListener("click", () => {
    if (!survivorTribe.length) survivorTribe = shuffleRecipes().slice(0, 5);
    const vulnerable = survivorTribe.filter(recipe => recipe.id !== immuneRecipeId);
    if (vulnerable.length > 0 && survivorTribe.length > 1) {
      const votedOff = vulnerable[Math.floor(Math.random() * vulnerable.length)];
      survivorTribe = survivorTribe.filter(recipe => recipe.id !== votedOff.id);
    }
    renderSurvivorGame();
  });

  renderSurvivorGame();
}

function triggerStatic() {
  if (selectedTheme !== "lost") return;
  document.body.classList.remove("static-flash");
  void document.body.offsetWidth;
  document.body.classList.add("static-flash");
  setTimeout(() => document.body.classList.remove("static-flash"), 650);
}

function renderDetail() {
  const recipe = recipes.find(item => item.id === selectedRecipeId);
  if (!recipe) {
    selectedRecipeId = null;
    renderList();
    return;
  }

  app.innerHTML = `
    <section class="theme-bar">
      <label for="themeSelect">Theme:</label>
      <select id="themeSelect">
        <option value="normal" ${selectedTheme === "normal" ? "selected" : ""}>Normal</option>
        <option value="retro" ${selectedTheme === "retro" ? "selected" : ""}>80's Retro</option>
        <option value="lost" ${selectedTheme === "lost" ? "selected" : ""}>LOST</option>
        <option value="psych" ${selectedTheme === "psych" ? "selected" : ""}>PSYCH</option>
        <option value="survivor" ${selectedTheme === "survivor" ? "selected" : ""}>SURVIVOR</option>
      </select>
      <button id="chooseFiveBtn" style="margin-left:10px;padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Choose 5</button>
      <button id="makeListBtn" style="margin-left:10px;padding:10px 14px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;border-radius:6px;">Make a List</button>
    </section>
    <section id="chooseFivePanel" style="display:none;margin-bottom:16px;padding:14px;border:1px solid var(--border);background:var(--card);border-radius:6px;"></section>
    <section id="shoppingListPanel" style="display:none;margin-bottom:16px;padding:14px;border:1px solid var(--border);background:var(--card);border-radius:6px;"></section>

    <div class="detail-wrap">
      <button class="back-button" id="backButton">← Back to recipes</button>
      <article class="detail-card">
        <p class="eyebrow">${escapeHtml(recipe.category)}</p>
        <h1 class="detail-title">${escapeHtml(recipe.name)}</h1>
        <p class="description">${escapeHtml(recipe.description)}</p>

        <div class="stats">
          <div class="stat"><div class="stat-label">Servings</div><strong>${recipe.servings}</strong></div>
          <div class="stat"><div class="stat-label">Prep</div><strong>${escapeHtml(recipe.prepTime)}</strong></div>
          <div class="stat"><div class="stat-label">Cook</div><strong>${escapeHtml(recipe.cookTime)}</strong></div>
        </div>

        <div class="tags">
          ${recipe.tags.map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
        </div>

        <div class="columns">
          <section>
            <h3>Ingredients</h3>
            <ul class="ingredients">
              ${recipe.ingredients.map(item => `<li>${escapeHtml(formatIngredientDisplay(item))}</li>`).join("")}
            </ul>
          </section>
        
          ${recipe.sourceUrl ? `
            <section>
              <h3>Instructions</h3>
              <a 
                class="source-link" 
                href="${escapeHtml(recipe.sourceUrl)}" 
                target="_blank" 
                rel="noreferrer"
              >
                View full recipe ↗
              </a>
            </section>
          ` : ""}
        </div>  
        
        ${recipe.notes ? `
          <section class="notes">
            <h3>Family Notes</h3>
            <p>${escapeHtml(recipe.notes)}</p>
          </section>
        ` : ""}

      </article>
    </div>
  `;

  document.getElementById("themeSelect").addEventListener("change", event => {
    selectedTheme = event.target.value;
    document.body.dataset.theme = selectedTheme;
    localStorage.setItem("recipeTheme", selectedTheme);
    renderList();
    triggerStatic();
  });

  const chooseBtn2 = document.getElementById("chooseFiveBtn");
  const panel2 = document.getElementById("chooseFivePanel");
  if (chooseBtn2) {
    chooseBtn2.addEventListener("click", () => {
      const shuffled = [...recipes].sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, 5);
      panel2.style.display = "block";
      panel2.innerHTML = `<strong>5 Dinner Picks:</strong><ul style="margin-top:8px;">${picked.map(r => `<li style="margin:6px 0;cursor:pointer;text-decoration:underline;" data-id="${r.id}">${escapeHtml(r.name)}</li>`).join("")}</ul>`;
      panel2.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
          selectedRecipeId = li.dataset.id;
          renderDetail();
        });
      });
    });
  }

  setupSurvivorButtons();

  document.getElementById("backButton").addEventListener("click", () => {
    selectedRecipeId = null;
    renderList();
  });
}

renderList();
