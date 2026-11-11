/**
 * Presentation and keyboard accessibility for the SDK-owned LoadoutManager.
 *
 * Keep the SDK in charge of changing gear, equipment constraints, saved
 * loadouts and reset-on-close. This only annotates its rendered item picker.
 */
export function enhanceLoadout(root: HTMLElement): () => void {
  const triggerSelector = "section button[aria-expanded]";
  const tooltip = document.createElement("div");
  tooltip.className = "trainer-item-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  root.appendChild(tooltip);

  let currentTrigger: HTMLButtonElement | null = null;
  let menuSequence = 0;
  const frames = new Set<number>();
  const requestFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0);
  const cancelFrame = window.cancelAnimationFrame
    ? window.cancelAnimationFrame.bind(window)
    : window.clearTimeout.bind(window);
  const schedule = (callback: () => void) => {
    const id = requestFrame(() => {
      frames.delete(id);
      callback();
    });
    frames.add(id);
  };

  const getTrigger = (target: Element | null): HTMLButtonElement | null => {
    const button = target?.closest(triggerSelector);
    return button instanceof HTMLButtonElement ? button : null;
  };

  const getMenu = (trigger: HTMLButtonElement): HTMLElement | null => {
    if (trigger.getAttribute("aria-expanded") !== "true") return null;
    const menu = trigger.nextElementSibling;
    return menu instanceof HTMLElement ? menu : null;
  };

  const optionsFor = (menu: HTMLElement): HTMLElement[] =>
    Array.from(menu.children).filter((child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute("role") === "option");

  const decorate = () => {
    for (const trigger of Array.from(root.querySelectorAll<HTMLButtonElement>(triggerSelector))) {
      const image = trigger.querySelector<HTMLImageElement>("img[alt]");
      const label = image?.alt.trim() || "Empty item slot";
      const name = image ? "Change " + label : "Choose an item for an empty slot";
      if (trigger.getAttribute("aria-label") !== name) trigger.setAttribute("aria-label", name);
      trigger.setAttribute("aria-haspopup", "listbox");
      // The SDK sets a verbose native title (including the cache item ID).
      // Show the accessible x0XP tooltip instead of two overlapping tooltips.
      if (image?.hasAttribute("title")) image.removeAttribute("title");

      const menu = getMenu(trigger);
      if (!menu) continue;
      if (!menu.id) menu.id = "trainer-item-options-" + ++menuSequence;
      if (trigger.getAttribute("aria-controls") !== menu.id) {
        trigger.setAttribute("aria-controls", menu.id);
      }
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-label", "Select replacement item");
      for (const option of Array.from(menu.children)) {
        if (!(option instanceof HTMLElement)) continue;
        option.setAttribute("role", "option");
        option.tabIndex = -1;
        // A menu row already displays its item name.
        if (option.hasAttribute("title")) option.removeAttribute("title");
      }
    }
  };

  const hideTooltip = () => {
    tooltip.hidden = true;
    currentTrigger = null;
  };

  const showTooltip = (trigger: HTMLButtonElement) => {
    const image = trigger.querySelector<HTMLImageElement>("img[alt]");
    if (!image?.alt) return hideTooltip();
    currentTrigger = trigger;
    tooltip.textContent = image.alt;
    const rect = trigger.getBoundingClientRect();
    const x = Math.max(70, Math.min(window.innerWidth - 70, rect.left + rect.width / 2));
    const above = rect.top >= 42;
    tooltip.style.left = x + "px";
    tooltip.style.top = (above ? rect.top - 7 : rect.bottom + 7) + "px";
    tooltip.dataset.placement = above ? "above" : "below";
    tooltip.hidden = false;
  };

  const onPointerOver = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return;
    const trigger = getTrigger(event.target);
    if (trigger && trigger !== currentTrigger) showTooltip(trigger);
  };

  const onPointerOut = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return;
    const trigger = getTrigger(event.target);
    if (!trigger || trigger !== currentTrigger) return;
    if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
    hideTooltip();
  };

  const onFocusIn = (event: FocusEvent) => {
    const trigger = event.target instanceof Element ? getTrigger(event.target) : null;
    if (trigger) showTooltip(trigger);
    else hideTooltip();
  };

  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    hideTooltip();
  };

  const focusInMenu = (trigger: HTMLButtonElement, last = false) => {
    decorate();
    const menu = getMenu(trigger);
    const options = menu ? optionsFor(menu) : [];
    const selected = last ? options[options.length - 1] : options[0];
    (selected || trigger).focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest<HTMLElement>('[role="option"]');
    const menu = option?.parentElement;
    const optionTrigger = menu?.previousElementSibling;
    const trigger = optionTrigger instanceof HTMLButtonElement
      ? optionTrigger : getTrigger(target);

    if (event.key === "Escape") {
      if (target.tagName === "SELECT") return;
      const open = root.querySelector<HTMLButtonElement>(triggerSelector + '[aria-expanded="true"]');
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        open.click();
        open.focus();
        hideTooltip();
      } else if (root.querySelector('[role="dialog"]')) {
        const close = root.querySelector<HTMLButtonElement>(".osrs-ui-panel > div > .osrs-ui-button");
        if (!close) return;
        event.preventDefault();
        event.stopPropagation();
        close.click();
      }
      return;
    }
    if (!trigger) return;

    if (option && menu && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const options = optionsFor(menu);
      if (options.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const index = options.indexOf(option);
      const next = event.key === "Home" ? 0
        : event.key === "End" ? options.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next].focus();
      options[next].scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (option && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      option.click();
      hideTooltip();
      return;
    }
    if (!option && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      event.stopPropagation();
      if (!getMenu(trigger)) trigger.click();
      schedule(() => focusInMenu(trigger, event.key === "ArrowUp"));
      hideTooltip();
    }
  };

  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLElement>('[role="option"]');
    if (option) {
      const trigger = option.parentElement?.previousElementSibling;
      if (!(trigger instanceof HTMLButtonElement)) return;
      // Wait until the SDK's own onClick handler has updated the loadout.
      schedule(() => {
        if (!root.contains(trigger)) return;
        if (getMenu(trigger)) trigger.click();
        trigger.focus();
      });
      return;
    }
    const trigger = getTrigger(event.target);
    if (trigger && event.detail === 0) {
      // Enter/Space on the native trigger button opens the first list item.
      schedule(() => focusInMenu(trigger));
    }
  };

  const onResize = () => { if (currentTrigger) showTooltip(currentTrigger); };
  root.addEventListener("pointerover", onPointerOver);
  root.addEventListener("pointerout", onPointerOut);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("keydown", onKeyDown, true);
  root.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);
  const observer = new MutationObserver(decorate);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["alt", "title", "aria-expanded"],
  });
  decorate();

  return () => {
    observer.disconnect();
    frames.forEach((id) => cancelFrame(id));
    root.removeEventListener("pointerover", onPointerOver);
    root.removeEventListener("pointerout", onPointerOut);
    root.removeEventListener("focusin", onFocusIn);
    root.removeEventListener("focusout", onFocusOut);
    root.removeEventListener("keydown", onKeyDown, true);
    root.removeEventListener("click", onClick);
    window.removeEventListener("resize", onResize);
    tooltip.remove();
  };
}
