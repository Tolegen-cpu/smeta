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

function addItem(focus = true) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  updateCurrency();
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
});

function preparePrint() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  document.querySelector("#print-title").textContent = `Смета № ${number} от ${formattedDate}`;

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

const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

addItem(false);
