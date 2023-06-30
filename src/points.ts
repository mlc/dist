import { createWriteStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { FeatureCollection, Point } from '@turf/helpers';
import { format as formatCsv } from '@fast-csv/format';
import togeojson from './togeojson.js';
import { distance, formatCoord } from './util';

type FoundFile = [round: string, data: Buffer];

interface ScoreRecord {
  round: number;
  name: string;
  coord: string;
  dist: number;
  score: number;
}

const bannedUsers = new Set<string>(['DrWhoFanJ']);

const nicknamedUsers = new Map<string, string>([
  ['36.874561, 27.256751', 'Nova'],
  ['CallMeTheOceanMan', 'CallMeOceanMan'],
  ['Jaydoo', 'JayDoo909'],
  ['JayDoo', 'JayDoo909'],
  ['Jeune Herisson', 'Jeune Hérisson'],
  ['Jeune Herison', 'Jeune Hérisson'],
  ['JLyons', 'Jake Lyons'],
  ['Mimi_', 'Mimi'],
  ['mimi_', 'Mimi'],
  ['Nobody', 'Nobody1300'],
  ['Olli', 'Olli7'],
  ['Rumi', 'Rumilb'],
  ['Schludy', 'schludy'],
  ['Sheepie', 'Sheepie1204'],
  ['Speedy Gwen', 'Speedy__Gwen'],
  ['Toro3317', 'Toro'],
  ['toro3317', 'Toro'],
  ['UCLA Jesus', 'UCLA_Jesus'],
  ['UltraTech', 'UltraTech66'],
  ['Zoe', 'Zoe//SpottedPandas'],
]);

const addRound =
  (round: string) =>
  (buf: Buffer): FoundFile =>
    [round, buf];

const getZipEntry = (entry: AdmZip.IZipEntry): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    entry.getDataAsync((data, err) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  );

// look through a directory and yield found KML files, looking inside KMZs
// to get the underlying document if needed
async function* findFiles(dirname: string): AsyncGenerator<FoundFile> {
  const paths = await readdir(dirname, { withFileTypes: true });
  for (const path of paths) {
    if (path.isFile()) {
      const filename = join(dirname, path.name);
      const round = path.name.match(/\d+/)?.[0] ?? path.name;
      if (path.name.endsWith('.kml')) {
        yield readFile(filename).then(addRound(round));
      } else if (path.name.endsWith('.kmz')) {
        const zip = new AdmZip(filename);
        for (const entry of zip.getEntries()) {
          if (entry.name.endsWith('.kml')) {
            yield getZipEntry(entry).then(addRound(round));
          }
        }
      }
    }
  }
}

const cleanName = (name: string): string => {
  const withoutSpaces = name.trim();
  return nicknamedUsers.get(withoutSpaces) ?? withoutSpaces;
};

// go through the files and write the data to a CSV
const parse = async () => {
  const parser = new DOMParser();
  const rows: ScoreRecord[] = [];
  for await (const [round, file] of findFiles('kmzs')) {
    console.log(round);
    const doc = parser.parseFromString(file.toString('utf-8'));
    const data = togeojson.kml(doc) as FeatureCollection<
      Point,
      { name: string }
    >;
    const target = data.features[0];
    rows.push(
      ...data.features.slice(1).flatMap((feature, i) => {
        const dist = distance(target, feature);
        // https://www.reddit.com/r/geoguessr/comments/6fe4fi/2_weekly_random_11_locations_added_in_the_past_2/diie3qf/
        const score = Math.round(5000 * Math.exp(-dist / 2000));
        const coord = formatCoord(feature);
        return feature.properties.name
          .split(/;\s+/)
          .map(cleanName)
          .filter((name) => !bannedUsers.has(name))
          .map(
            (name): ScoreRecord => ({
              round: Number(round),
              name,
              coord,
              dist,
              score,
            })
          );
      })
    );
  }
  rows.sort(
    ({ round: around, score: ascore }, { round: bround, score: bscore }) =>
      around - bround || bscore - ascore
  );
  const seenRows = new Set<string>();
  const csv = formatCsv({ headers: true });
  csv.pipe(createWriteStream('scores.csv'));
  rows.forEach((row) => {
    const key = [row.name, row.round].join('/');
    if (seenRows.has(key)) {
      console.warn(`${key} dup`);
    } else {
      seenRows.add(key);
      csv.write(row);
    }
  });
  csv.end();
};

parse().catch(console.error);
