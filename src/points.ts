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

const addRound =
  (round: string) =>
  (buf: Buffer): FoundFile =>
    [round, buf];

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
            const data = new Promise<Buffer>((resolve, reject) =>
              entry.getDataAsync((data, err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              })
            );
            yield data.then(addRound(round));
          }
        }
      }
    }
  }
}

// go through the files and write the data to a CSV
const parse = async () => {
  const parser = new DOMParser();
  const csv = formatCsv({ headers: true });
  csv.pipe(createWriteStream('scores.csv'));
  for await (const [round, file] of findFiles('kmzs')) {
    const doc = parser.parseFromString(file.toString('utf-8'));
    const data = togeojson.kml(doc) as FeatureCollection<
      Point,
      { name: string }
    >;
    const target = data.features[0];
    data.features.forEach((feature, i) => {
      if (i > 0) {
        const dist = distance(target, feature);
        // https://www.reddit.com/r/geoguessr/comments/6fe4fi/2_weekly_random_11_locations_added_in_the_past_2/diie3qf/
        const score = Math.round(5000 * Math.exp(-dist / 2000));
        const coord = formatCoord(feature);
        for (const name of feature.properties.name.split(/;\s+/)) {
          csv.write({ round, name, coord, dist, score });
        }
      }
    });
  }
  csv.end();
};

parse().catch(console.error);
