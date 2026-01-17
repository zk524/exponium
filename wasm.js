let w = null, G = null;
export async function initWasm() {
    if (w) return w;
    const m = await import('./pkg/exponium.js');
    await m.default();
    G = m.WasmGame;
    return w = m;
}
export const createGame = (r, c) => new G(String(r), String(c));
export const isReady = () => w !== null;
