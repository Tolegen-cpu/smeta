"use strict";

const items = document.querySelector("#items");
const itemTemplate = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const subtotalOutput = document.querySelector("#subtotal");
const discountOutput = document.querySelector("#discount-amount");
const discountedOutput = document.querySelector("#discounted-amount");
const vatOutput = document.querySelector("#vat-amount");
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});
const draftKey = "estimate-draft-v1";
const draftFieldIds = ["sender", "recipient", "estimate-number", "estimate-date", "discount-rate", "vat-rate", "currency", "comment"];
const draftSelector = ".details input, #items input, #items select, #discount-rate, #vat-rate, #currency, #comment";
const rowFields = { name: ".item-name", quantity: ".item-quantity", unit: "select", price: ".item-price" };
let savingEnabled = false;
let copyTimer;

function parseNumber(value) {
  const normalized = value.trim().replace(/[ \u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function finiteAmount(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatMoney(value) {
  return `${moneyFormatter.format(finiteAmount(value)).replace(/[\u00a0\u202f]/g, " ")} ${currency.value}`;
}

function recalculate() {
  let total = 0;
  for (const row of items.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    // Round each stage so the displayed amounts add up to the payable total.
    const amount = Math.round(finiteAmount(quantity * price));
    row.querySelector(".item-total").textContent = formatMoney(amount);
    total = finiteAmount(total + amount);
  }
  const discount = Math.round(total * (Math.min(100, parseNumber(discountRate.value)) / 100));
  const discounted = total - discount;
  const vat = Math.round(finiteAmount(discounted * (parseNumber(vatRate.value) / 100)));
  subtotalOutput.textContent = formatMoney(total);
  discountOutput.textContent = formatMoney(discount);
  discountedOutput.textContent = formatMoney(discounted);
  vatOutput.textContent = formatMoney(vat);
  document.querySelector("#discount-row").hidden = discount === 0;
  document.querySelector("#discounted-row").hidden = discounted === 0;
  document.querySelector("#vat-row").hidden = vat === 0;
  totalOutput.textContent = formatMoney(finiteAmount(discounted + vat));
}

function updateCurrency() {
  const label = `Цена, ${currency.value}`;
  document.querySelector("#price-heading").textContent = label;
  for (const row of items.rows) {
    const price = row.querySelector(".item-price");
    price.setAttribute("aria-label", label);
    price.closest("td").dataset.label = label;
  }
  recalculate();
}

function addItem(focus = true, values = null) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  if (values) {
    ensureUnitOption(row.querySelector("select"), values.unit);
    for (const [key, selector] of Object.entries(rowFields)) row.querySelector(selector).value = values[key];
    if (typeof values.catalogId === "string") row.dataset.catalogId = values.catalogId;
  }
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  updateCurrency();
  saveDraft();
  return row;
}

function ensureUnitOption(select, unit) {
  if (Array.from(select.options).some(option => option.value === unit)) return;
  const option = document.createElement("option");
  option.value = unit;
  option.textContent = unit;
  select.append(option);
}

addButton.addEventListener("click", () => addItem());
discountRate.addEventListener("input", recalculate);
vatRate.addEventListener("input", recalculate);
currency.addEventListener("change", updateCurrency);
items.addEventListener("input", recalculate);
items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  // Leave native select and button keyboard behaviour intact.
  if (!event.target.matches("input")) return;
  if (event.target.closest("tr") === items.lastElementChild) {
    event.preventDefault();
    addItem();
  }
});

items.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addButton.focus();
  recalculate();
  saveDraft();
});

function clearCopyFeedback() {
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#share-text").value = "";
}

function saveDraft() {
  if (!savingEnabled) return;
  clearCopyFeedback();
  const fields = Object.fromEntries(draftFieldIds.map(id => [id, document.getElementById(id).value]));
  const rows = Array.from(items.rows, row => ({
    ...Object.fromEntries(Object.entries(rowFields).map(([key, selector]) => [key, row.querySelector(selector).value])),
    catalogId: row.dataset.catalogId || "",
  }));
  try {
    localStorage.setItem(draftKey, JSON.stringify({ version: 1, fields, rows }));
    document.querySelector("#draft-status").textContent = "";
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик в браузере. Перед закрытием сохраните PDF или скопируйте текст.";
  }
}

function restoreDraft() {
  try {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return false;
    const draft = JSON.parse(saved);
    const valid = draft && draft.version === 1 && draft.fields && Array.isArray(draft.rows)
      && draftFieldIds.every(id => typeof draft.fields[id] === "string")
      && ["₸", "₽", "$", "€"].includes(draft.fields.currency)
      && draft.rows.every(row => row && Object.keys(rowFields).every(key => typeof row[key] === "string")
        && row.unit.trim().length > 0 && row.unit.length <= 100
        && (row.catalogId === undefined || typeof row.catalogId === "string"));
    if (!valid) throw new Error("Invalid draft");
    for (const id of draftFieldIds) document.getElementById(id).value = draft.fields[id];
    for (const row of draft.rows) addItem(false, row);
    updateCurrency();
    return true;
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось восстановить черновик. Проверьте доступность хранилища браузера.";
    return false;
  }
}

for (const type of ["input", "change"]) {
  document.addEventListener(type, event => {
    if (event.target.matches(draftSelector)) saveDraft();
  });
}

function todayDate() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const currentNumber = document.querySelector("#estimate-number").value.trim();
  const nextNumber = /\d+$/.test(currentNumber)
    ? currentNumber.replace(/\d+$/, digits => (BigInt(digits) + 1n).toString().padStart(digits.length, "0"))
    : "1";
  savingEnabled = false;
  for (const id of draftFieldIds) document.getElementById(id).value = "";
  discountRate.value = vatRate.value = "0";
  currency.value = "₸";
  document.querySelector("#estimate-number").value = nextNumber;
  document.querySelector("#estimate-date").value = todayDate();
  items.replaceChildren();
  for (const value of document.querySelectorAll(".print-value")) value.remove();
  document.querySelector("#print-title").textContent = "";
  addItem(false);
  savingEnabled = true;
  saveDraft();
  document.querySelector("#sender").focus();
});

function estimateHeading() {
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  return `Смета № ${number} от ${date ? date.split("-").reverse().join(".") : "—"}`;
}

function shareText() {
  recalculate();
  const lines = [estimateHeading()];
  for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  const quantityFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 20 });
  for (const row of items.rows) {
    const name = row.querySelector(".item-name").value.trim() || "Без наименования";
    const quantity = quantityFormatter.format(parseNumber(row.querySelector(".item-quantity").value)).replace(/[\u00a0\u202f]/g, " ");
    const price = formatMoney(parseNumber(row.querySelector(".item-price").value));
    lines.push(`• ${name} — ${quantity} ${row.querySelector("select").value} × ${price} = ${row.querySelector(".item-total").textContent}`);
  }
  lines.push("", `Сумма: ${subtotalOutput.textContent}`);
  if (!document.querySelector("#discount-row").hidden) {
    lines.push(`Скидка (${Math.min(100, parseNumber(discountRate.value))} %): ${discountOutput.textContent}`);
    lines.push(`Сумма со скидкой: ${discountedOutput.textContent}`);
  }
  if (!document.querySelector("#vat-row").hidden) lines.push(`НДС (${parseNumber(vatRate.value)} %): ${vatOutput.textContent}`);
  lines.push(`Итого к оплате: ${totalOutput.textContent}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", `Комментарий: ${comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  clearCopyFeedback();
  const text = shareText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.querySelector("#copy-status").textContent = ""; }, 2000);
  } catch {
    document.querySelector("#manual-copy").hidden = false;
    const field = document.querySelector("#share-text");
    field.value = text;
    field.focus();
    field.select();
  }
});

function preparePrint() {
  recalculate();
  document.querySelector("#print-title").textContent = estimateHeading();

  // Plain text copies let long values wrap fully in print without changing the inputs.
  for (const value of document.querySelectorAll(".print-value")) value.remove();
  for (const field of document.querySelectorAll(".details input, #items input, #items select, #comment")) {
    const value = document.createElement("span");
    value.className = "print-value";
    value.textContent = field.value;
    value.setAttribute("aria-hidden", "true");
    field.insertAdjacentElement("afterend", value);
  }
}

document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
window.addEventListener("beforeprint", preparePrint);

document.querySelector("#estimate-date").value = todayDate();
if (!restoreDraft()) addItem(false);
savingEnabled = true;
