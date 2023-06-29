import { spawn } from 'node:child_process';
import { stdout } from 'node:process';
import { parseFile } from '@fast-csv/parse';
import { Feature, feature, featureCollection, Point } from '@turf/helpers';
import turfDist from '@turf/distance';
import { decodeCoord, distance } from './util';

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

const colorFor = (position: number): string => medals[position] ?? '#0000af';

const copy = (data: string) =>
  new Promise<void>((resolve, reject) => {
    const process = spawn('xclip', ['-i', '-selection', 'clipboard'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    process.on('error', (e) => reject(e));
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`process exited with ${code}`));
      }
    });
    process.stdin.write(Buffer.from(data, 'utf-8'));
    process.stdin.end();
  });

const main = async () => {
  const input = await getCsv(process.argv[2]);
  const target = decodeCoord(process.argv[3]);
  const features: Feature<Point, {}>[] = input
    .map(({ coords, ...rest }) => {
      const us = decodeCoord(coords);
      const dist = distance(target, us);
      const sphericalDistance = turfDist(target, us);
      return feature(us, { ...rest, dist, sphericalDistance });
    })
    .sort(({ properties: { dist: a } }, { properties: { dist: b } }) => a - b)
    .map((pt, idx) => ({
      ...pt,
      properties: { ...pt.properties, 'marker-color': colorFor(idx) },
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
