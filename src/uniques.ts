import { MultiMap } from 'mnemonist';
import { parseFile } from '@fast-csv/parse';
import { writeToPath } from '@fast-csv/format';

interface Row {
  '': string;
  Name: string;
  Visitors: string;
  NumVisitors: string;
  UniqueLocs: string;
  MostSimilarPeer: string;
  MostSimilarPeerNumVisitors: string;
  MostSimilarPeerJaccard: string;
}

const readCsv = (): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const result: Row[] = [];
    parseFile('location_data.csv', { headers: true })
      .on('data', (r) => result.push(r))
      .on('error', (e) => reject(e))
      .on('end', () => resolve(result));
  });

const parseLocs = (rs: Row[]) => {
  const result = new Map<string, string[]>();
  for (const r of rs) {
    const locs: string[] = JSON.parse(r.Visitors.replaceAll("'", '"'));
    result.set(r.Name, locs);
  }
  return result;
};

const print = (r: object[]) =>
  new Promise<void>((resolve, reject) => {
    writeToPath('uniques.csv', r, { headers: true })
      .on('error', (e) => reject(e))
      .on('end', () => resolve());
  });

const main = async () => {
  const rows = await readCsv();
  const locs = parseLocs(rows);
  const uniques = new MultiMap<string, string>();
  for (const [name, visitors] of locs) {
    if (visitors.length === 1) {
      uniques.set(visitors[0], name);
    }
  }

  const result = [...uniques.associations()]
    .map(([user, regions]) => ({
      user,
      count: regions.length,
      'unique regions': regions
        .toSorted((a, b) => a.localeCompare(b))
        .join(', '),
    }))
    .toSorted((a, b) => b.count - a.count || a.user.localeCompare(b.user));

  await print(result);
};

main().catch(console.error);
