// The slice of the `herdr` module the mod uses, with state a test can set.
export const store = new Map();
export const state = { runs: [], overlays: [], closed: [], props: {}, agents: [], spaces: [{ id: "sp1", active: true, tabs: [] }] };
export const shared = (key) => store.get(key);
export const setShared = (key, value) => { store.set(key, value); };
export const theme = () => new Proxy({}, { get: (_t, k) => `#${String(k)}` });
export const spaces = () => state.spaces;
export const panes = () => [];
export const window = () => ({ platform: "macos" });
export const layout = () => null;
export const settings = () => ({ zoom: 1 });
export const props = () => state.props;
export const run = (name, args) => { state.runs.push([name, args]); };
export const openOverlay = (spec) => { state.overlays.push(spec); return `ov${state.overlays.length}`; };
export const closeOverlay = (id) => { state.closed.push(id); };
export const knownAgents = async () => state.agents;
