// The popup a single click on the empty tab bar opens: what a double-click there starts.
import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, spaces, knownAgents, closeOverlay, props, shared, setShared } from "herdr";
import { KEY, TERMINAL, agentChoice, picked } from "./tap.js";

export const WIDTH = 250;

/** Height for a list of `n` agents, so the popup fits its rows without a scrollbar when it can. */
export function height(n) {
  return Math.min(460, 150 + Math.max(1, n) * 31);
}

export class Settings {
  init(cx) {
    this.agents = [];
    this.loading = true;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try { this.agents = (await knownAgents({ on: spaces().find((s) => s.active)?.machine })).filter((a) => a.installed); }
      catch { this.failed = true; }
      this.loading = false;
      cx.notify();
    });
  }

  pick(value) {
    setShared(KEY, value);
    closeOverlay(props().overlay);
  }

  row(id, icon, name, value, hint = "") {
    const t = theme();
    const on = picked(shared(KEY), id);
    return h_flex().id(`pick-${id}`).h(31).px(9).gap(10).rounded(7).items_center().flex_none()
      .text_color(t.foreground).bg(on ? t.selected : t.popover).hover((s) => s.bg(t.hover))
      .on_click(() => this.pick(value))
      .child(div().w(14).flex_none().flex().justify_center().child(icon))
      .child(div().flex_1().truncate().child(name))
      .child(div().text_size(11).text_color(t.dim).child(hint))
      .child(div().w(12).flex_none().text_color(t.accent).child(on ? "✓" : ""));
  }

  render() {
    const t = theme();
    const heading = (text) => div().px(9).pt(8).pb(4).text_size(11).text_color(t.dim).child(text);
    return v_flex().id("doubletap-settings").track_focus(this.handle).w_full().min_h(0).h(height(this.agents.length)).bg(t.popover).p(5).text_size(12.8)
      .on_key_down((e) => {
        if (e.modifiers.control || e.modifiers.platform || e.modifiers.alt) return;
        if (e.key === "t") this.pick(TERMINAL);
        else if (e.key === "m") this.pick({ kind: "menu" });
        else if (/^[1-9]$/.test(e.key) && this.agents[Number(e.key) - 1]) this.pick(agentChoice(this.agents[Number(e.key) - 1]));
      })
      .child(div().px(9).pt(4).pb(2).text_size(12).font_semibold().text_color(t.foreground).child("Double-click opens"))
      .child(this.row("terminal", svg("icons/shell.svg").size(14), "Terminal", TERMINAL, "T"))
      .child(this.row("menu", div().child("+"), "Menu, choose each time", { kind: "menu" }, "M"))
      .child(heading("An agent"))
      .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
        .children(this.agents.map((a, i) => this.row(a.key, a.tint ? svg(a.icon).size(14).text_color(t.foreground) : image(a.icon).size(14), a.name, agentChoice(a), i < 9 ? String(i + 1) : "")))
        .when(this.agents.length === 0, (el) => el.child(div().px(9).py(6).text_color(t.dim)
          .child(this.loading ? "Checking installed agents…" : this.failed ? "Could not load agents" : "No agents installed"))));
  }
}
