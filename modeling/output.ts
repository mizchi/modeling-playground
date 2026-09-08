import { mkdir } from 'node:fs/promises';

/** Builders live in <model>/src; generated files belong to its sibling output directory. */
export async function prepareOutput(sourceUrl: string | URL): Promise<URL> {
  const directory = new URL('../output/', sourceUrl);
  await mkdir(directory, { recursive: true });
  return directory;
}
