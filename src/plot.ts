import { parseFile } from '@fast-csv/parse';
import DMS from 'geographiclib-dms';
import { Geodesic } from 'geographiclib-geodesic';
import { featureCollection, Point, point } from '@turf/helpers';
import distance from '@turf/distance';

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

const decode = (coords: string) => {
  const components = coords
    .replace(/ +([NESW])/giu, (_, x) => x)
    .split(/[, ]+/);
  if (components.length !== 2) {
    throw new Error(`unable to parse ${coords}`);
  }
  return DMS.DecodeLatLon(...(components as [string, string]));
};

const medals = ['#d6af36', '#d7d7d7', '#a77044'];

const colorFor = (position: number): string => medals[position] ?? '#0000af';

const main = async () => {
  const input = await getCsv(process.argv[2]);
  const target = decode(process.argv[3]);
  const features = input
    .map(({ coords, ...rest }) => {
      const { lat, lon } = decode(coords);
      const dist =
        Geodesic.WGS84.Inverse(
          target.lat,
          target.lon,
          lat,
          lon,
          Geodesic.DISTANCE
        ).s12! / 1000;
      const sphericalDistance = distance([target.lon, target.lat], [lon, lat]);
      return point([lon, lat], { ...rest, dist, sphericalDistance });
    })
    .sort(({ properties: { dist: a } }, { properties: { dist: b } }) => a - b)
    .map((pt, idx) => ({
      ...pt,
      properties: { ...pt.properties, 'marker-color': colorFor(idx) },
    }));
  const targetPt = point([target.lon, target.lat], {
    title: 'Target',
    'marker-color': '#ff0000',
    'marker-symbol': 'star',
  });
  const collection = featureCollection<Point, {}>([...features, targetPt]);
  process.stdout.write(JSON.stringify(collection));
  process.stdout.write('\n');
};

main().catch(console.error);
