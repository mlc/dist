import { stdout } from 'node:process';
import { parseFile } from '@fast-csv/parse';
import { feature, featureCollection } from '@turf/helpers';
import turfDist from '@turf/distance';
import type { Point } from 'geojson';
import { copy, decodeCoord, distance } from './util';

interface Row {
  coords: string;
}

const getCsv = (fn: string) =>
  new Promise<Row[]>((resolve, reject) => {
    const rows: Row[] = [];
    parseFile(fn, { headers: true })
      .on('data', (row) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });

const medals = ['#d6af36', '#d7d7d7', '#a77044'];

const colorFor = (position: number, total: number): string => {
  if (position < 3) {
    return medals[position];
  } else if (position < total / 2) {
    return '#b8b8e6';
  } else {
    return '#0000af';
  }
};

const main = async () => {
  const input = await getCsv(process.argv[2]);
  const target = decodeCoord(process.argv[3]);
  const features = input
    .map(({ coords, ...rest }) => {
      const us = decodeCoord(coords);
      const dist = distance(target, us);
      return feature(us, {
        ...rest,
        dist,
        score: Math.round(5000 * Math.exp(-dist / 2000)),
        sphericalDistance: turfDist(target, us),
      });
    })
    .sort(({ properties: { dist: a } }, { properties: { dist: b } }) => a - b)
    .map((pt, idx, { length }) => ({
      ...pt,
      properties: {
        ...pt.properties,
        'marker-color': colorFor(idx, length),
      },
    }));
  const targetPt = feature(target, {
    title: 'Target',
    'marker-color': '#ff0000',
    'marker-symbol': 'star',
  });
  const collection = featureCollection<Point, {}>([...features, targetPt]);

  await copy(
    `https://geojson.io/#data=data:application/json,${encodeURIComponent(
      JSON.stringify(collection)
    )}`
  );

  stdout.write(JSON.stringify(collection));
  stdout.write('\n');
};

main().catch(console.error);
