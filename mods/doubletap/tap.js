// Plain logic for the double-tap tab bar: what a double-click on the empty bar
// starts, and telling one click from two. No UI here, so tests can import it.

/** Where the choice is kept: shared state, so it survives restarts and every copy agrees. */
export const KEY = "doubletap.action";

/** How long a single click waits for a second one before it counts as one click (ms). */
export const WAIT = 320;

/** A press that moved further than this (px) before release was a drag, not a click. */
export const SLOP = 4;

export const TERMINAL = { kind: "terminal" };

/** The stored choice, or a terminal when nothing (or something unreadable) is stored. */
export function choice(value) {
  if (value?.kind === "menu") return { kind: "menu" };
  if (value?.kind === "agent" && typeof value.key === "string" && Array.isArray(value.run) && value.run.length > 0 && value.run.every((a) => typeof a === "string")) {
    return { kind: "agent", key: value.key, name: typeof value.name === "string" && value.name ? value.name : value.key, run: [...value.run] };
  }
  return TERMINAL;
}

/** What to store for an agent from `knownAgents()`. */
export function agentChoice(agent) {
  return { kind: "agent", key: agent.key, name: agent.name, run: [...agent.run] };
}

/** Whether a stored choice is this one ("terminal", "menu", or an agent's key). */
export function picked(value, id) {
  const c = choice(value);
  return c.kind === "agent" ? c.key === id : c.kind === id;
}

/** A short label for the choice, for hints. */
export function label(value) {
  const c = choice(value);
  if (c.kind === "menu") return "Menu";
  if (c.kind === "agent") return c.name;
  return "Terminal";
}

/**
 * What a double-click does: `{ run: [command, args] }` or `{ overlay: spec }`.
 * `at` is the click's window position, where the menu opens.
 */
export function launch(value, space, at) {
  const c = choice(value);
  if (c.kind === "menu") return { overlay: { mod: "new-menu", kind: "popup", width: 250, height: 512, at } };
  if (c.kind === "agent") return { run: ["tab.new", { name: c.name, space, argv: c.run }] };
  return { run: ["tab.new", { space }] };
}

/**
 * Tells one click on the empty bar from two. Feed it the bar's presses and
 * releases; it says what each one means:
 *  - `down` returns "double" on a second press (do the action now), else null.
 *  - `up` returns "single" when a lone click ended where it began (wait `WAIT`
 *    for a second press, then open the settings), else null. A press that
 *    turned into a window drag never reports its release here, so it does nothing.
 */
export class Taps {
  constructor() { this.press = null; }

  down(event) {
    if (event.click_count >= 2) { this.press = null; return "double"; }
    this.press = { x: event.position.x, y: event.position.y };
    return null;
  }

  up(event) {
    const p = this.press;
    this.press = null;
    if (!p || event.click_count >= 2) return null;
    const moved = Math.hypot(event.position.x - p.x, event.position.y - p.y);
    return moved <= SLOP ? "single" : null;
  }

  /** A press that started elsewhere (a tab) and was released on the bar isn't ours. */
  forget() { this.press = null; }
}
