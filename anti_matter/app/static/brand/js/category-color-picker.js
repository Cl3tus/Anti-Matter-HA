/**
 * Category color field: visible swatch, hex label, preset swatches, close
 * native picker after selection.
 */
(function (global) {
  const PRESET_COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
    "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
  ];

  function sync() {
    const input = document.getElementById("category-color");
    if (!input) return;
    const swatch = document.getElementById("category-color-swatch");
    const hex = document.getElementById("category-color-hex");
    const value = input.value || "#6366f1";
    if (swatch) swatch.style.backgroundColor = value;
    if (hex) hex.textContent = value.toUpperCase();
    document.querySelectorAll(".category-color-preset").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.color === value.toLowerCase());
    });
  }

  function buildPresets(input) {
    const host = document.getElementById("category-color-presets");
    if (!host || host.childElementCount) return;
    host.innerHTML = PRESET_COLORS.map(
      (c) =>
        `<button type="button" class="category-color-preset" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
    ).join("");
    host.querySelectorAll(".category-color-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        input.value = btn.dataset.color;
        sync();
      });
    });
  }

  function bind() {
    const input = document.getElementById("category-color");
    if (!input || input.dataset.colorPickerBound === "1") return;
    input.dataset.colorPickerBound = "1";

    input.addEventListener("input", sync);
    input.addEventListener("change", () => {
      sync();
      input.blur();
    });

    buildPresets(input);
    sync();
  }

  global.AntiMatterCategoryColor = { bind, sync };
})(typeof window !== "undefined" ? window : globalThis);
