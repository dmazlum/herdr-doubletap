// Points a layout's tab bar at the doubletap mod. Used by install.sh on the
// `doubletap` layout (a clone of Herdr's main layout).
//
//   node scripts/layout.mjs <layout.json>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Replaces every `content.mod: "tabs"` with "doubletap"; returns how many it changed. */
export function useDoubletap(node) {
  let n = 0;
  if (node?.content?.mod === "tabs") { node.content.mod = "doubletap"; n++; }
  for (const child of node?.children ?? []) n += useDoubletap(child);
  for (const float of node?.floating ?? []) n += useDoubletap(float);
  return n;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node scripts/layout.mjs <layout.json>"); process.exit(2); }
  const layout = JSON.parse(readFileSync(file, "utf8"));
  const n = useDoubletap(layout);
  if (n > 0) writeFileSync(file, JSON.stringify(layout, null, 2) + "\n");
  console.log(n > 0 ? `tab bar now doubletap in ${file}` : `no "tabs" block left in ${file} (already done?)`);
}
