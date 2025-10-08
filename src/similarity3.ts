import { writeToPath } from '@fast-csv/format';
import { parseFile } from '@fast-csv/parse';

interface Row {
  '': string;
  Name: string;
  Locs: string;
  NumLocs: string;
  UniqueLocs: string;
  NumUniqueLocs: string;
  MostSimilarPeer: string;
  MostSimilarPeerNumLocs: string;
  MostSimilarPeerJaccard: string;
}

const jaccard = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const i = a.intersection(b).size;
  return i / (a.size + b.size - i);
};

const readCsv = (): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const result: Row[] = [];
    parseFile('visitor_data.csv', { headers: true })
      .on('data', (r) => result.push(r))
      .on('error', (e) => reject(e))
      .on('end', () => resolve(result));
  });

const print = (r: object[]) =>
  new Promise<void>((resolve, reject) => {
    writeToPath('simi.csv', r, { headers: true })
      .on('error', (e) => reject(e))
      .on('end', () => resolve());
  });

const parseLocs = (rs: Row[]) => {
  const result = new Map<string, Set<string>>();
  for (const r of rs) {
    const locs: string[] = JSON.parse(r.Locs.replaceAll("'", '"'));
    result.set(r.Name, new Set(locs));
  }
  return result;
};

const main = async () => {
  const rows = await readCsv();
  const locs = parseLocs(rows);
  const result: object[] = [];

  for (const [name1, terrs1] of locs) {
    const row: Record<string, string | number> = { name: name1 };
    for (const [name2, terrs2] of locs) {
      row[name2] = jaccard(terrs1, terrs2);
    }
    result.push(row);
  }

  print(result);
};

main().then(() => console.log('done'), console.error);
