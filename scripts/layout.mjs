// Points a layout's tab bar at the doubletap mod, or back at Herdr's `tabs`.
//
//   node scripts/layout.mjs <layout.json>            tabs → doubletap
//   node scripts/layout.mjs <layout.json> --remove   doubletap → tabs
//   node scripts/layout.mjs <layout.json> --check    whether tabs → doubletap would work; writes nothing
//
// Exits 3 (and changes nothing) when the layout has no block of the mod to
// replace: it draws its tab bar with a mod of its own, which needs bar.js instead.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Every block's mod, in order (pane headers and floating blocks included). */
export function mods(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (typeof node.content?.mod === "string") out.push(node.content.mod);
  if (typeof node.content?.pane?.header?.content?.mod === "string") out.push(node.content.pane.header.content.mod);
  for (const child of node.children ?? []) mods(child, out);
  for (const float of node.floating ?? []) mods(float, out);
  return out;
}

/** Replaces every block whose mod is `from` with `to`; returns how many it changed. */
export function swap(node, from, to) {
  if (!node || typeof node !== "object") return 0;
  let n = 0;
  if (node.content?.mod === from) { node.content.mod = to; n++; }
  for (const child of node.children ?? []) n += swap(child, from, to);
  for (const float of node.floating ?? []) n += swap(float, from, to);
  return n;
}

export const useDoubletap = (layout) => swap(layout, "tabs", "doubletap");
export const useTabs = (layout) => swap(layout, "doubletap", "tabs");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, flag] = process.argv.slice(2);
  if (!file) { console.error("usage: node scripts/layout.mjs <layout.json> [--remove | --check]"); process.exit(2); }
  const layout = JSON.parse(readFileSync(file, "utf8"));
  const remove = flag === "--remove", check = flag === "--check";
  const n = remove ? useTabs(layout) : useDoubletap(layout);
  if (n === 0 && !remove && mods(layout).includes("doubletap")) {
    console.log(`tab bar already doubletap in ${file}`);
    process.exit(0);
  }
  if (n === 0) {
    const has = remove ? "doubletap" : "tabs";
    console.error(`no "${has}" block in ${file}; its mods: ${[...new Set(mods(layout))].join(", ") || "none"}`);
    process.exit(3);
  }
  if (check) process.exit(0);
  writeFileSync(file, JSON.stringify(layout, null, 2) + "\n");
  console.log(remove ? `tab bar back to Herdr's tabs in ${file}` : `tab bar now doubletap in ${file}`);
}
