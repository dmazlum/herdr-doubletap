// Module hooks that stand in for the Herdr app's built-in modules, so the
// mods' plain logic can be imported under Node.
const STUBS = {
  "gpui-kit": "./gpui.mjs",
  "gpui-base": "./gpui.mjs",
  herdr: "./herdr.mjs",
};

export async function resolve(specifier, context, next) {
  if (specifier in STUBS) {
    return { url: new URL(STUBS[specifier], import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
