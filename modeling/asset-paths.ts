/** Repository-relative asset ownership, shared by generators and tests (no filesystem dependency). */
export const modelDirectories = Object.freeze({
  base45: 'human/models/base45', lumi: 'human/models/lumi',
  suzu: 'human/models/suzu', ashley: 'human/models/ashley',
  aster: 'human/models/aster', fes256: 'human/models/fes256', traveler: 'human/models/traveler',
  raven: 'robot/models/raven', bastion: 'robot/models/bastion', strix: 'robot/models/strix',
  dog: 'models/dog', wyvern: 'models/wyvern',
  'little-town': 'models/little-town', 'sprite-walk': 'models/sprite-walk',
});

export function outputPath(filename: string): string {
  if (typeof filename !== 'string' || !/^(?:parts\/)?[\w.-]+$/.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid asset filename: ${filename}`);
  }
  const name = filename.replace(/^parts\//, '');
  const matches = (prefix: string) => name === prefix || name.startsWith(prefix + '-') || name.startsWith(prefix + '.');
  let family = (Object.keys(modelDirectories) as Array<keyof typeof modelDirectories>).find(matches);
  if (matches('human-female')) family = 'base45';
  else if (matches('human-side-tail')) family = 'lumi';
  else if (matches('corgi')) family = 'dog';
  else if (['ik', 'walk', 'romasaga3-traveler'].some(matches)) family = 'traveler';
  else if (matches('sprite')) family = 'sprite-walk';
  if (family) return `${modelDirectories[family]}/output/${filename}`;
  if (matches('human')) return `human/output/${filename}`;
  if (matches('game')) return `robot/output/${filename}`;
  if (matches('glb-viewer')) return `viewer/output/${filename}`;
  throw new Error(`No model owns asset: ${filename}`);
}

/** Resolve an asset from the repository location, never process.cwd(). */
export function assetUrl(filename: string): URL {
  return new URL(`../${outputPath(filename)}`, import.meta.url);
}
