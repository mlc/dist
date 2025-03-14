import { readdir, readFile } from 'node:fs/promises';
import { featureCollection } from '@turf/helpers';
import type { OsmBoundaries } from './check-subdivs';
import { copy } from './util';

const getSubdivs = async (filter: string): Promise<OsmBoundaries> => {
  const dir = await readdir(__dirname + '/../osmb', { withFileTypes: true });
  const files = dir
    .filter(
      (file) =>
        file.isFile() &&
        file.name.startsWith('boundaries-') &&
        file.name.includes(filter)
    )
    .map((file) => file.name);
  const jsons: OsmBoundaries[] = await Promise.all(
    files.map((fn) =>
      readFile(__dirname + '/../osmb/' + fn, 'utf-8').then(JSON.parse)
    )
  );
  return featureCollection(jsons.flatMap((j) => j.features));
};

const main = async (args: string[]) => {
  if (args.length !== 4) {
    throw new Error('usage: get-subdiv REGION SUBDIV');
  }
  const sd = await getSubdivs(args[2]);
  const r = sd.features.find(
    ({ properties: { name, name_en } }) =>
      name === args[3] || name_en === args[3]
  );
  if (!r) {
    console.warn('not found');
    return 1;
  }
  console.debug(r.properties);
  await copy(JSON.stringify(r));
  return 0;
};

main(process.argv).then((code) => process.exit(code));
