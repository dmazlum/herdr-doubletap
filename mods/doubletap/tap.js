// Plain logic for the double-tap tab bar: what a double-click on the empty bar
// starts, and telling one click from two. No UI here, so tests can import it.

/** Where the choice is kept: shared state, so it survives restarts and every copy agrees. */
export const KEY = "doubletap.action";

/** The system's double-click interval when it can't be read (macOS's default), ms. */
export const DEFAULT_WAIT = 500;

/** A press that moved further than this (px) before release was a drag, not a click. */
export const SLOP = 4;

/** A press this soon (ms) after the window became active is the click that activated it. */
export const ACTIVATION = 300;

/** The + menu, as Herdr's tab bar opens it. `at` is added for a double-click. */
export const NEW_MENU = Object.freeze({ mod: "new-menu", kind: "popup", width: 250, height: 512 });

export const TERMINAL = { kind: "terminal" };

/**
 * How long a lone click waits for a second press: the system's double-click
 * interval, from `defaults read -g com.apple.mouse.doubleClick` (seconds), plus
 * a little slack so a second press right at the limit still wins.
 */
export function waitFrom(stdout) {
  const s = Number.parseFloat(String(stdout ?? "").trim());
  const ms = Number.isFinite(s) && s > 0 ? s * 1000 : DEFAULT_WAIT;
  return Math.round(Math.min(2000, Math.max(200, ms)) + 30);
}

const strings = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === "string");

/** The stored choice, or a terminal when nothing (or something unreadable) is stored. */
export function choice(value) {
  if (value?.kind === "menu") return { kind: "menu" };
  if (value?.kind === "agent" && typeof value.key === "string" && strings(value.run)) {
    return {
      kind: "agent", key: value.key,
      name: typeof value.name === "string" && value.name ? value.name : value.key,
      run: [...value.run],
      machine: typeof value.machine === "string" ? value.machine : null,
    };
  }
  return TERMINAL;
}

/** What to store for an agent from `knownAgents()`, picked while a space on `machine` showed. */
export function agentChoice(agent, machine = null) {
  return { kind: "agent", key: agent.key, name: agent.name, run: [...agent.run], machine: machine ?? null };
}

/** Whether a stored choice is this one ("terminal", "menu", or an agent's key). */
export function picked(value, id) {
  const c = choice(value);
  return c.kind === "agent" ? c.key === id : c.kind === id;
}

/**
 * What a double-click does in `space` ({id, machine}):
 *  - `{ run: [command, args] }`
 *  - `{ overlay: spec }`
 *  - `{ lookup: agent }`: the agent was picked on another machine; ask that
 *    space's machine for it (`knownAgents({ on })`) and finish with `resolveAgent`.
 * `at` is the click's window position, where the menu opens.
 */
export function launch(value, space, at) {
  const c = choice(value);
  if (c.kind === "menu") return { overlay: { ...NEW_MENU, at } };
  if (c.kind === "agent") {
    if ((space?.machine ?? null) !== c.machine) return { lookup: c };
    return { run: ["tab.new", { name: c.name, space: space?.id, argv: c.run }] };
  }
  return { run: ["tab.new", { space: space?.id }] };
}

/** The agent picked elsewhere, as `agents` (that machine's `knownAgents()`) knows it: a run, or why not. */
export function resolveAgent(c, space, agents) {
  const a = agents.find((x) => x.key === c.key);
  if (!a?.installed || !strings(a.run)) {
    const where = space?.machine ? ` on ${space.machine}` : " on this computer";
    return { missing: `${c.name} isn't installed${where}` };
  }
  return { run: ["tab.new", { name: a.name, space: space?.id, argv: [...a.run] }] };
}

/**
 * Tells one click on the empty bar from two. Feed it the bar's presses and
 * releases; it says what each one means:
 *  - `down` returns "double" on the second press only (do the action now);
 *    a third or later press of the same run returns null.
 *  - `up` returns "single" when a lone click ended where it began (wait for
 *    a second press, then open the settings), else null. A press that turned
 *    into a window drag never reports its release here, so it does nothing.
 *  - `forget` drops a press: call it whenever something else (a tab) is pressed.
 */
export class Taps {
  constructor() { this.press = null; }

  /** `activating`: this press is the one that brought the window forward. */
  down(event, activating = false) {
    if (event.click_count === 2) { this.press = null; return "double"; }
    this.press = event.click_count === 1 && !activating ? { x: event.position.x, y: event.position.y } : null;
    return null;
  }

  up(event) {
    const p = this.press;
    this.press = null;
    if (!p || event.click_count !== 1) return null;
    const moved = Math.hypot(event.position.x - p.x, event.position.y - p.y);
    return moved <= SLOP ? "single" : null;
  }

  forget() { this.press = null; }
}
