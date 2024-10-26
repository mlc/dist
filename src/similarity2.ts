import * as fs from 'node:fs/promises';
import type { WriteStream } from 'node:fs';
import { parseFile } from '@fast-csv/parse';
import { CsvFormatterStream, format } from '@fast-csv/format';

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

const intersect = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const result = new Set<K>();
  for (const k of a) {
    if (b.has(k)) {
      result.add(k);
    }
  }
  return result;
};

const jaccard = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const i = intersect(a, b).size;
  return i / (a.size + b.size - i);
};

const readCsv = (): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const result: Row[] = [];
    parseFile('location_data.csv', { headers: true })
      .on('data', (r) => result.push(r))
      .on('error', (e) => reject(e))
      .on('end', () => resolve(result));
  });

const close = (str: WriteStream): Promise<void> =>
  new Promise<void>((resolve, reject) =>
    str.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    })
  );

const closeC = (csv: CsvFormatterStream<any, any>): Promise<void> =>
  new Promise<void>((resolve) => csv.end(resolve));

const parseLocs = (rs: Row[]) => {
  const result = new Map<string, Set<string>>();
  for (const r of rs) {
    const locs: string[] = JSON.parse(r.Visitors.replaceAll("'", '"'));
    result.set(r.Name, new Set(locs));
  }
  return result;
};

const main = async () => {
  const rows = await readCsv();

  const gr = rows.filter(({ NumVisitors }) => Number(NumVisitors) >= 5);
  const locs = [...parseLocs(gr)];

  let l = await fs.open('locs.txt', 'w');
  let out = l.createWriteStream();

  out.write(`digraph {\n`);
  out.write(`  node [fontcolor=blue]\n`);
  for (const [loc, visitors] of locs) {
    const [best, bestJac] = locs.reduce<[string, number]>(
      (acc, [l, lv]) => {
        if (l === loc) {
          return acc;
        } else {
          const j = jaccard(lv, visitors);
          if (j > acc[1]) {
            return [l, j];
          } else {
            return acc;
          }
        }
      },
      ['', 0]
    );
    out.write(`  "${loc}" -> "${best}" [weight=${bestJac}]\n`);
  }
  out.write('}');
  await close(out);
  await l.close();

  l = await fs.open('locs2.csv', 'w');
  out = l.createWriteStream();
  const csv = format({ headers: true });
  csv.pipe(out).on('error', console.error);

  for (const [l1, v1] of locs) {
    for (const [l2, v2] of locs) {
      const similarity = jaccard(v1, v2);
      if (similarity > 0) {
        csv.write({ l1, l2, similarity });
      }
    }
  }
  await closeC(csv);
  // await close(out);
  // await l.close();
};

main().then(() => console.log('done'), console.error);
