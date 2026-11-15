"use strict";

const items = document.querySelector("#items");
const itemTemplate = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#total");
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
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
  return `${moneyFormatter.format(finiteAmount(value)).replace(/[\u00a0\u202f]/g, " ")} ₸`;
}

function recalculate() {
  let total = 0;
  for (const row of items.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    // Round each payable line to hundredths before adding it to the total.
    const product = finiteAmount(quantity * price);
    const amount = product <= Number.MAX_SAFE_INTEGER / 100
      ? Math.round((product + Number.EPSILON) * 100) / 100
      : product;
    row.querySelector(".item-total").textContent = formatMoney(amount);
    total = finiteAmount(total + amount);
  }
  totalOutput.textContent = formatMoney(total);
}

function addItem(focus = true) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

addButton.addEventListener("click", () => addItem());
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

const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

addItem(false);
