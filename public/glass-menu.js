// Backed by a native select to keep option state and existing change handlers in sync.
export function createGlassMenu({ root, trigger, list, select, value, decorate, summary, onSelect }) {
  let rows = [];
  let open = false;

  const close = (returnFocus = false) => {
    if (!open) return;
    open = false;
    root.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    list.inert = true;
    if (returnFocus) trigger.focus({ preventScroll: true });
  };
  const show = (key) => {
    if (!rows.length) return;
    open = true;
    root.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    list.inert = false;
    const selected = rows[Math.max(0, select.selectedIndex)];
    (key === "ArrowUp" ? rows.at(-1) : selected)?.focus();
  };
  const sync = () => {
    const option = select.selectedOptions[0];
    value.textContent = summary?.(option) || option?.textContent || "—";
    rows.forEach((row, index) => {
      const selected = index === select.selectedIndex;
      row.classList.toggle("selected", selected);
      row.setAttribute("aria-selected", String(selected));
    });
  };
  const render = () => {
    close();
    rows = Array.from(select.options, (option) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "glass-select-option";
      row.tabIndex = -1;
      row.setAttribute("role", "option");
      const label = document.createElement("strong");
      label.textContent = option.textContent;
      const check = document.createElement("span");
      check.className = "option-check";
      check.setAttribute("aria-hidden", "true");
      row.append(decorate(option), label, check);
      row.addEventListener("click", () => {
        select.value = option.value;
        close(true);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        onSelect?.(option.value);
      });
      return row;
    });
    list.replaceChildren(...rows);
    trigger.disabled = rows.length < 2;
    sync();
  };

  list.inert = true;
  trigger.setAttribute("aria-controls", list.id);
  trigger.addEventListener("click", () => open ? close(true) : show());
  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      show(event.key);
    }
  });
  list.addEventListener("keydown", (event) => {
    const index = rows.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 :
        (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      rows[next]?.focus();
    } else if (event.key === "Tab") {
      // The options are not in the tab order; move from the trigger, not a removed option.
      close(true);
    }
  });
  root.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !root.contains(event.relatedTarget)) close();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target)) close();
  });
  select.addEventListener("change", sync);
  return { render, sync, close };
}
