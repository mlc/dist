import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { FeatureCollection, Polygon } from 'geojson';
import { bbox } from '@turf/bbox';
import { Coord, point } from '@turf/helpers';
import Flatbush from 'flatbush';
import { getCoord } from '@turf/invariant';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { format as formatCsv } from '@fast-csv/format';

interface MapMakingExtra {
  tags?: string[];
  panoId?: string;
  panoDate?: string;
}

interface MapMakingCoord {
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  zoom: number;
  panoId: string | null;
  countryCode: null;
  stateCode: null;
  extra?: MapMakingExtra;
}

interface MapMaking {
  name: string;
  customCoordinates: MapMakingCoord[];
  extra?: MapMakingExtra;
}

interface Admin1Properties {
  // there are more than this but who cares
  featurecla: 'Admin-1 states provinces';
  iso_a2: string;
  name: string;
  name_en: string;
  name_alt?: string;
  name_local?: string;
  admin: string;
}

type Admin1 = FeatureCollection<Polygon, Admin1Properties>;

const getMap = (): Promise<MapMaking> =>
  readFile(process.env.HOME + '/Download/merged.json', 'utf-8').then(
    JSON.parse
  );

// https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
// ogr2ogr ne_10m_admin_1_states_provinces.json -f GeoJSON ne_10m_admin_1_states_provinces.shp
const getSubdivs = (): Promise<Admin1> =>
  readFile(
    process.env.HOME + '/Download/ne_10m_admin_1_states_provinces.json',
    'utf-8'
  ).then(JSON.parse);

const makeIndex = (input: Admin1) => {
  const index = new Flatbush(input.features.length);
  for (const feat of input.features) {
    const [minX, minY, maxX, maxY] = bbox(feat);
    index.add(minX, minY, maxX, maxY);
  }
  index.finish();
  return index;
};

const findSubdiv = (p: Coord, subdivs: Admin1, index: Flatbush) => {
  const [x, y] = getCoord(p);
  const candidates = index.search(x, y, x, y).map((i) => subdivs.features[i]);
  return candidates.find((candidate) => booleanPointInPolygon(p, candidate));
};

const removeDiacritics = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{White_Space}_]+/gu, ' ')
    .toLowerCase();

const nameMatch = (tag: string, subdiv: Admin1Properties) => {
  const candidates = [
    subdiv.name,
    subdiv.name_en,
    subdiv.name_alt,
    subdiv.name_local,
  ].flatMap((names) => (names ? names.split('|') : []));
  return candidates.some(
    (name) =>
      removeDiacritics(tag) === removeDiacritics(`${name}_${subdiv.iso_a2}`)
  );
};

const main = async () => {
  const [map, nat] = await Promise.all([getMap(), getSubdivs()]);
  const index = makeIndex(nat);
  const csv = formatCsv({ headers: true });
  csv.pipe(createWriteStream('check-subdivs-report.csv'));
  for (const loc of map.customCoordinates) {
    const locFeature = point([loc.lng, loc.lat]);
    const subdiv = findSubdiv(locFeature, nat, index);
    const taggedSubdiv = loc.extra?.tags?.[0] ?? '';
    const country = taggedSubdiv.split('_').at(-1);
    const matches = subdiv ? nameMatch(taggedSubdiv, subdiv.properties) : false;
    csv.write({
      country,
      taggedSubdiv,
      natEarthName: subdiv?.properties?.name,
      natEarthCountry: subdiv?.properties?.admin,
      matches,
    });
  }
  csv.end();
};

main().then(() => {});
