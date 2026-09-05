// Every GLB in output/ is discovered by Vite and bundled for static distribution.
const files = import.meta.glob('../output/*.glb', { eager: true, query: '?url', import: 'default' });
const metadata = {
  'little-town': { label: 'Petit Quartier · 町並み', direction: [1, .85, 1.4] },
  traveler: { label: 'Milo · 旅人', direction: [.7, .25, 2.2] },
  'traveler-walk': { label: 'Milo · 歩行', direction: [.9, .28, 2.2] },
  'traveler-ik': { label: 'Milo · IKポーズ', direction: [.9, .28, 2.2] },
};

/** @type {Array<{id: string, label: string, filename: string, url: string, direction: number[]}>} */
export const catalog = Object.entries(files).map(([path, url]) => {
  const filename = path.split('/').at(-1);
  const id = filename.slice(0, -4);
  return { id, filename, url, label: metadata[id]?.label ?? filename, direction: metadata[id]?.direction ?? [1, .55, 1.8] };
}).sort((a, b) => a.id.localeCompare(b.id));

export const defaultModel = catalog.find(model => model.id === 'traveler-ik') ?? catalog.find(model => model.id === 'traveler-walk') ?? catalog[0];
