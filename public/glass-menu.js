// Backed by a native select to keep option state and existing change handlers in sync.
export function createGlassMenu({ root, trigger, list, select, value, summary, onSelect }) {
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
  const place = () => {
    const { top, bottom } = trigger.getBoundingClientRect();
    const toolbarBottom = root.closest(".studio-experience")?.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const gutter = 12;
    const above = top - Math.max(toolbarBottom, 0) - gutter;
    const below = window.innerHeight - bottom - gutter;
    const preferred = Math.min(list.scrollHeight, 310, window.innerHeight * 0.42);
    const up = below < preferred && above > below;
    root.classList.toggle("opens-up", up);
    list.style.setProperty("--menu-available", `${Math.max(44, Math.floor(up ? above : below))}px`);
  };
  const focusRow = (row) => {
    if (!row) return;
    row.focus({ preventScroll: true });
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  };
  const show = (key) => {
    if (!rows.length) return;
    open = true;
    root.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    list.inert = false;
    place();
    const selected = rows[Math.max(0, select.selectedIndex)];
    focusRow(key === "ArrowUp" ? rows.at(-1) : selected);
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
      row.append(label, check);
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
      focusRow(rows[next]);
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
  window.addEventListener("resize", () => { if (open) place(); });
  select.addEventListener("change", sync);
  return { render, sync, close };
}
