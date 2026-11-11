import { enhanceLoadout } from "../ui/loadoutInteractions";

function buildLoadoutFixture() {
  const root = document.createElement("div");
  root.className = "trainer-loadout-root";
  root.innerHTML = `
    <div role="dialog">
      <div class="osrs-ui-panel"><div>
        <button id="close" class="osrs-ui-button">Close</button>
        <section><h3>Inventory</h3><div><div>
          <button id="item" aria-expanded="true">
            <img alt="Saradomin brew" title="Saradomin brew (6685)">
          </button>
          <div id="items">
            <div id="empty">Empty</div>
            <div id="brew">Saradomin brew</div>
            <div id="restore">Super restore</div>
          </div>
        </div></div></section>
      </div></div>
    </div>`;
  document.body.appendChild(root);
  const trigger = root.querySelector<HTMLButtonElement>("#item")!;
  const menu = root.querySelector<HTMLElement>("#items")!;
  const elements = Array.from(menu.children) as HTMLElement[];
  return { root, trigger, menu, elements };
}

function key(element: HTMLElement, name: string) {
  return element.dispatchEvent(new KeyboardEvent("keydown", {
    key: name, bubbles: true, cancelable: true,
  }));
}

describe("Loadout item accessibility", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  test("decorates SDK picker with accessible options and removes duplicate native tooltips", () => {
    const { root, trigger, menu, elements } = buildLoadoutFixture();
    const dispose = enhanceLoadout(root);

    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-label")).toBe("Change Saradomin brew");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(menu.getAttribute("role")).toBe("listbox");
    expect(elements.map((option) => option.getAttribute("role"))).toEqual(["option", "option", "option"]);
    expect(elements.every((option) => option.tabIndex === -1)).toBe(true);
    expect(trigger.querySelector("img")!.hasAttribute("title")).toBe(false);

    trigger.dispatchEvent(new Event("pointerover", { bubbles: true }));
    const tooltip = root.querySelector<HTMLElement>(".trainer-item-tooltip")!;
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("Saradomin brew");
    trigger.dispatchEvent(new Event("pointerout", { bubbles: true }));
    expect(tooltip.hidden).toBe(true);

    dispose();
    expect(root.querySelector(".trainer-item-tooltip")).toBeNull();
  });

  test("arrow keys and Home/End navigate options without activating them", () => {
    const { root, elements } = buildLoadoutFixture();
    const dispose = enhanceLoadout(root);
    const selected = jest.fn();
    elements[1].addEventListener("click", selected);
    elements[0].focus();
    expect(key(elements[0], "ArrowDown")).toBe(false);
    expect(document.activeElement).toBe(elements[1]);
    expect(selected).not.toHaveBeenCalled();
    key(elements[1], "End");
    expect(document.activeElement).toBe(elements[2]);
    key(elements[2], "ArrowDown");
    expect(document.activeElement).toBe(elements[0]);
    key(elements[0], "ArrowUp");
    expect(document.activeElement).toBe(elements[2]);
    key(elements[2], "Home");
    expect(document.activeElement).toBe(elements[0]);
    dispose();
  });

  test("Escape closes an open picker and restores focus to its slot", () => {
    const { root, trigger, elements } = buildLoadoutFixture();
    trigger.addEventListener("click", () => { trigger.setAttribute("aria-expanded", "false"); });
    const dispose = enhanceLoadout(root);
    elements[1].focus();
    expect(key(elements[1], "Escape")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    dispose();
  });

  test("Escape on a closed picker uses the SDK Close button", () => {
    const { root, trigger } = buildLoadoutFixture();
    const close = root.querySelector<HTMLButtonElement>("#close")!;
    const onClose = jest.fn();
    close.addEventListener("click", onClose);
    trigger.setAttribute("aria-expanded", "false");
    const dispose = enhanceLoadout(root);
    trigger.focus();
    expect(key(trigger, "Escape")).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    dispose();
  });
});
