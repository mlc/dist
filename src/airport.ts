import { parse as parseCsv } from '@fast-csv/parse';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { distance } from './util';
import { Coord, featureCollection, point } from '@turf/helpers';

interface Airport {
  id: string;
  ident: string;
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  elevation_ft: string;
  continent: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
  scheduled_service: string;
  gps_code: string;
  iata_code: string;
  local_code: string;
  home_link: string;
  wikipedia_link: string;
  keywords: string;
}

const main = async () => {
  const c: FeatureCollection<Point> = JSON.parse(
    await readFile('centroids.json', 'utf-8')
  );
  const bestDistance = (coord: Coord) =>
    c.features.reduce(
      (accum, pt) => Math.min(accum, distance(pt, coord)),
      Number.POSITIVE_INFINITY
    );
  const rs = await new Promise<Feature<Point>[]>((resolve, reject) => {
    const result: Feature<Point>[] = [];
    createReadStream('airports.csv')
      .pipe(parseCsv({ headers: true }))
      .on('error', (e) => reject(e))
      .on('finish', () => resolve(result))
      .on('data', (a: Airport) => {
        if (a.type === 'medium_airport' || a.type === 'large_airport') {
          const coords = [Number(a.longitude_deg), Number(a.latitude_deg)];
          result.push(
            point(coords, {
              ...a,
              score: bestDistance(coords),
            })
          );
        }
      });
  });
  await writeFile(
    'airport-dists.json',
    JSON.stringify(featureCollection(rs)),
    'utf-8'
  );
};

main().then(() => {});
