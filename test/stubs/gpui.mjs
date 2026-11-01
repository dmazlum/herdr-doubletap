// Every element builder returns an element that records its calls and
// returns itself for any further builder call.
function element(kind) {
  const calls = [];
  const el = new Proxy({ kind, calls }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => { calls.push([prop, ...args]); return el; };
    },
  });
  return el;
}

export const div = () => element("div");
export const h_flex = () => element("h_flex");
export const v_flex = () => element("v_flex");
export const svg = (path) => element(`svg:${path}`);
export const image = (path) => element(`image:${path}`);
export class View {}
