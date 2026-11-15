"use strict";

const catalogKey = "estimate-catalog-v1";
const catalogList = document.querySelector("#catalog-list");
const catalogFilter = document.querySelector("#catalog-filter");
const catalogSearch = document.querySelector("#catalog-search");
const catalogForm = document.querySelector("#catalog-form");
const catalogStatus = document.querySelector("#catalog-status");
const catalogInputs = Object.fromEntries(["name", "unit", "price", "category"].map(key => [key, document.getElementById(`catalog-${key}`)]));
const catalogQuantities = new Map();
let catalogEntries = [];
let editingCatalogId = null;
let reviewedPrices = [];

function catalogElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function loadCatalog() {
  try {
    const saved = localStorage.getItem(catalogKey);
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!data || data.version !== 1 || !Array.isArray(data.entries)
      || !data.entries.every(entry => entry && typeof entry.id === "string" && entry.id
        && ["name", "unit", "category"].every(key => typeof entry[key] === "string" && entry[key].trim())
        && entry.unit.length <= 100 && typeof entry.price === "number" && Number.isFinite(entry.price) && entry.price >= 0)
      || new Set(data.entries.map(entry => entry.id)).size !== data.entries.length) throw new Error("Invalid catalog");
    catalogEntries = data.entries;
  } catch {
    document.querySelector("#catalog-storage-status").textContent = "Не удалось загрузить каталог из браузера.";
  }
}

function saveCatalog() {
  try {
    localStorage.setItem(catalogKey, JSON.stringify({ version: 1, entries: catalogEntries }));
    document.querySelector("#catalog-storage-status").textContent = "";
  } catch {
    document.querySelector("#catalog-storage-status").textContent = "Каталог доступен сейчас, но не сохранён: хранилище браузера недоступно. Не закрывайте страницу.";
  }
}

function renderCatalogCategories() {
  const selected = catalogFilter.value;
  const categories = [...new Set(catalogEntries.map(entry => entry.category))].sort((a, b) => a.localeCompare(b, "ru"));
  catalogFilter.replaceChildren();
  const all = catalogElement("option", "Все категории");
  all.value = "";
  catalogFilter.append(all);
  const suggestions = document.querySelector("#catalog-categories");
  suggestions.replaceChildren();
  for (const category of categories) {
    const option = catalogElement("option", category);
    option.value = category;
    catalogFilter.append(option);
    const suggestion = catalogElement("option");
    suggestion.value = category;
    suggestions.append(suggestion);
  }
  catalogFilter.value = categories.includes(selected) ? selected : "";
}

function renderCatalog() {
  catalogList.replaceChildren();
  const query = catalogSearch.value.trim().toLocaleLowerCase("ru");
  const entries = catalogEntries.filter(entry => (!catalogFilter.value || entry.category === catalogFilter.value)
    && entry.name.toLocaleLowerCase("ru").includes(query));
  if (!entries.length) {
    catalogList.append(catalogElement("p", catalogEntries.length ? "Ничего не найдено. Измените поиск или категорию." : "Каталог пока пуст. Создайте первую работу или материал ниже."));
  }
  for (const entry of entries) {
    const card = catalogElement("article", undefined, "catalog-entry");
    card.append(catalogElement("h3", entry.name));
    card.append(catalogElement("p", `${entry.category} · ${formatMoney(entry.price)} / ${entry.unit}`));
    const controls = catalogElement("div", undefined, "catalog-add");
    const label = catalogElement("label", `Количество, ${entry.unit}`);
    const quantity = catalogElement("input");
    quantity.type = "text";
    quantity.inputMode = "decimal";
    quantity.value = catalogQuantities.get(entry.id) ?? "1";
    quantity.setAttribute("aria-label", `Количество: ${entry.name}, ${entry.unit}`);
    label.append(quantity);
    const amount = catalogElement("output");
    amount.setAttribute("aria-live", "polite");
    const showAmount = () => { amount.textContent = `Стоимость: ${formatMoney(Math.round(finiteAmount(parseNumber(quantity.value) * entry.price)))}`; };
    quantity.addEventListener("input", () => {
      catalogQuantities.set(entry.id, quantity.value);
      showAmount();
    });
    showAmount();
    const add = catalogElement("button", "Добавить в смету", "add-button");
    add.type = "button";
    add.setAttribute("aria-label", `Добавить в смету: ${entry.name}`);
    add.addEventListener("click", () => addCatalogToEstimate(entry.id, quantity.value));
    const edit = catalogElement("button", "Редактировать", "secondary-button");
    edit.type = "button";
    edit.setAttribute("aria-label", `Редактировать: ${entry.name}`);
    edit.addEventListener("click", () => editCatalogEntry(entry.id));
    controls.append(label, amount, add, edit);
    card.append(controls);
    catalogList.append(card);
  }
}

function resetCatalogEditor() {
  editingCatalogId = null;
  catalogForm.reset();
  document.querySelector("#catalog-editor-title").textContent = "Новая работа или материал";
  document.querySelector("#catalog-save").textContent = "Создать позицию";
  document.querySelector("#catalog-cancel").hidden = true;
}

function editCatalogEntry(id) {
  const entry = catalogEntries.find(item => item.id === id);
  if (!entry) return;
  editingCatalogId = id;
  for (const key of Object.keys(catalogInputs)) catalogInputs[key].value = String(entry[key]);
  document.querySelector("#catalog-editor-title").textContent = "Редактирование позиции";
  document.querySelector("#catalog-save").textContent = "Сохранить изменения";
  document.querySelector("#catalog-cancel").hidden = false;
  catalogInputs.name.focus();
}

catalogForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = catalogInputs.name.value.trim();
  const unit = catalogInputs.unit.value.trim();
  const category = catalogInputs.category.value.trim();
  if (!name || !unit || !category) {
    catalogStatus.textContent = "Заполните название, единицу измерения и категорию.";
    (!name ? catalogInputs.name : !unit ? catalogInputs.unit : catalogInputs.category).focus();
    return;
  }
  let id = editingCatalogId;
  if (!id) {
    do { id = `catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
    while (catalogEntries.some(entry => entry.id === id));
  }
  const entry = { id, name, unit, category, price: parseNumber(catalogInputs.price.value) };
  const index = catalogEntries.findIndex(item => item.id === id);
  if (index === -1) catalogEntries.push(entry);
  else catalogEntries[index] = entry;
  saveCatalog();
  catalogStatus.textContent = index === -1 ? "Позиция создана." : "Каталог изменён. Цены в смете сохранены. Для их изменения нажмите «Обновить цены».";
  resetCatalogEditor();
  renderCatalogCategories();
  renderCatalog();
  catalogInputs.name.focus();
});

function addCatalogToEstimate(id, quantity) {
  const entry = catalogEntries.find(item => item.id === id);
  if (!entry) return;
  const values = { catalogId: id, name: entry.name, unit: entry.unit, price: String(entry.price), quantity };
  // Reuse only a completely empty, unlinked row; existing work is never replaced.
  let row = Array.from(items.rows).find(item => !item.dataset.catalogId
    && [".item-name", ".item-quantity", ".item-price"].every(selector => item.querySelector(selector).value === ""));
  if (row) {
    ensureUnitOption(row.querySelector("select"), entry.unit);
    for (const [key, selector] of Object.entries(rowFields)) row.querySelector(selector).value = values[key];
    row.dataset.catalogId = id;
    recalculate();
    saveDraft();
  } else row = addItem(false, values);
  row.querySelector(".item-quantity").focus();
  catalogStatus.textContent = `Добавлено в смету: ${entry.name}. Стоимость: ${row.querySelector(".item-total").textContent}`;
}

function collectPriceChanges() {
  const changes = [];
  const skipped = [];
  Array.from(items.rows).forEach((row, index) => {
    const entry = catalogEntries.find(item => item.id === row.dataset.catalogId);
    if (!entry) return;
    const name = row.querySelector(".item-name").value || entry.name;
    if (row.querySelector("select").value !== entry.unit) {
      skipped.push(`Строка ${index + 1}, ${name}: единица в каталоге изменена. Добавьте позицию заново для новой единицы.`);
      return;
    }
    const oldPrice = row.querySelector(".item-price").value;
    if (parseNumber(oldPrice) !== entry.price) changes.push({ row, index, name, unit: entry.unit, oldPrice, newPrice: entry.price });
  });
  return { changes, skipped };
}

function showPriceReview(note = "") {
  const { changes, skipped } = collectPriceChanges();
  reviewedPrices = changes;
  const list = document.querySelector("#price-changes");
  list.replaceChildren();
  for (const change of changes) {
    list.append(catalogElement("li", `Строка ${change.index + 1}, ${change.name} (${change.unit}): ${formatMoney(parseNumber(change.oldPrice))} → ${formatMoney(change.newPrice)}`));
  }
  for (const message of skipped) list.append(catalogElement("li", message));
  document.querySelector("#price-review-note").textContent = note || (changes.length
    ? "Изменятся только цены перечисленных позиций. Названия и количество сохранятся."
    : "Нет цен для обновления. Обновляются только позиции, добавленные из каталога.");
  document.querySelector("#confirm-prices").hidden = changes.length === 0;
  document.querySelector("#price-review").hidden = false;
  document.querySelector("#price-review-title").focus();
}

document.querySelector("#confirm-prices").addEventListener("click", () => {
  const current = collectPriceChanges().changes;
  // A stale preview must never approve a new price or a replaced estimate row.
  if (current.length !== reviewedPrices.length || current.some((change, index) => {
    const previous = reviewedPrices[index];
    return change.row !== previous.row || change.oldPrice !== previous.oldPrice || change.newPrice !== previous.newPrice
      || change.name !== previous.name || change.unit !== previous.unit || change.index !== previous.index;
  })) {
    showPriceReview("Данные изменились. Проверьте новый список и подтвердите ещё раз.");
    return;
  }
  for (const change of current) change.row.querySelector(".item-price").value = String(change.newPrice);
  recalculate();
  saveDraft();
  document.querySelector("#price-review-note").textContent = `Цены обновлены: ${current.length}. Итого: ${totalOutput.textContent}`;
  document.querySelector("#confirm-prices").hidden = true;
  reviewedPrices = [];
  document.querySelector("#price-review-title").focus();
});

document.querySelector("#cancel-prices").addEventListener("click", () => {
  document.querySelector("#price-review").hidden = true;
  reviewedPrices = [];
  document.querySelector("#update-prices").focus();
});
document.querySelector("#update-prices").addEventListener("click", () => showPriceReview());
document.querySelector("#catalog-cancel").addEventListener("click", () => { resetCatalogEditor(); catalogInputs.name.focus(); });
catalogSearch.addEventListener("input", renderCatalog);
catalogFilter.addEventListener("change", renderCatalog);
currency.addEventListener("change", () => {
  renderCatalog();
  if (!document.querySelector("#price-review").hidden) showPriceReview();
});

loadCatalog();
renderCatalogCategories();
renderCatalog();
