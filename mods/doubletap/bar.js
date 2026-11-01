// Double-click the empty part of a tab bar to start a terminal, the + menu or an
// agent; click it once to pick which. Drop this file and tap.js into any tab bar
// mod to give it the gesture (README, "Your own tab bar"). The choice popup is drawn
// by the doubletap mod, so that mod must be installed, though no layout needs to show it.
import { spaces, run, openOverlay, window, shared, exec, knownAgents, notify } from "herdr";
import { KEY, DEFAULT_WAIT, ACTIVATION, Taps, launch, resolveAgent, waitFrom } from "./tap.js";

/** The choice popup: the doubletap mod as an overlay. */
export const POPUP = Object.freeze({ mod: "doubletap", kind: "popup", width: 250, height: 460 });

export class EmptyBar {
  /** Call from the bar's `init(props, cx)`. */
  constructor(cx) {
    this.taps = new Taps();
    this.waiting = null;
    this.wait = DEFAULT_WAIT;
    this.wasActive = Boolean(window()?.active);
    this.activatedAt = 0;
    // A lone click waits as long as the system's double-click interval.
    if (window()?.platform === "macos") cx.spawn(async () => {
      try {
        const r = await exec("defaults", ["read", "-g", "com.apple.mouse.doubleClick"]);
        this.wait = waitFrom(r.code === 0 ? r.stdout : "");
      } catch { this.wait = waitFrom(""); }
    });
  }

  /** Call at the top of the bar's `render()`: notes when the window comes forward. */
  track() {
    const active = Boolean(window()?.active);
    if (active && !this.wasActive) this.activatedAt = Date.now();
    this.wasActive = active;
  }

  /** Call from every press that isn't the empty bar's (a tab, a button): no click of ours is under way. */
  cancel() {
    this.taps.forget();
    this.waiting?.cancel(); this.waiting = null;
  }

  /** The empty bar's `.on_mouse_down("left", (e, cx) => bar.down(e, cx))`. */
  down(e, cx) {
    const activating = !window()?.active || Date.now() - this.activatedAt < ACTIVATION;
    if (this.taps.down(e, activating) !== "double") {
      if (e.click_count > 2) cx.stop_propagation(); // nor a third press
      return;
    }
    cx.stop_propagation(); // a double-click here isn't a window_drag block's maximize
    this.waiting?.cancel(); this.waiting = null;
    const space = spaces().find(p => p.active);
    const did = launch(shared(KEY), space, { x: e.position.x, y: e.position.y });
    if (did.overlay) openOverlay(did.overlay);
    else if (did.run) run(...did.run);
    else if (did.lookup) cx.spawn(async () => {
      // Picked while another machine's space showed: start it as this space's machine knows it.
      let agents = [];
      try { agents = await knownAgents({ on: space?.machine }); } catch { /* reported as missing */ }
      const r = resolveAgent(did.lookup, space, agents);
      if (r.run) run(...r.run);
      else notify({ title: r.missing, body: "Click the empty tab bar to pick what a double-click opens.", level: "warning" });
    });
  }

  /** The empty bar's `.on_mouse_up("left", (e, cx) => bar.up(e, cx))`. */
  up(e, cx) {
    if (this.taps.up(e) !== "single") return;
    const at = { x: e.position.x, y: e.position.y };
    this.waiting?.cancel();
    this.waiting = cx.timer.after(this.wait, () => {
      this.waiting = null;
      openOverlay({ ...POPUP, at, props: { view: "settings" } });
    });
  }
}
