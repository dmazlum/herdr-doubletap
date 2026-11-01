import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// The installed Herdr's tab bar; absent in CI, where this check is skipped.
const shipped = join(process.env.HERDR_APP_HOME ?? join(homedir(), ".config/herdr-app"), "mods/tabs/main.js");
const copy = new URL("../upstream/tabs.main.js", import.meta.url);

test("doubletap is based on the tab bar Herdr ships now", { skip: !existsSync(shipped) && "no Herdr app installed here" }, () => {
  assert.equal(readFileSync(shipped, "utf8"), readFileSync(copy, "utf8"),
    `Herdr's tab bar changed: diff ${shipped} against upstream/tabs.main.js, port the change into mods/doubletap/main.js, then copy it over upstream/tabs.main.js`);
});
