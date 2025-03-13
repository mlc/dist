import { createWriteStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { bbox } from '@turf/bbox';
import { Coord, featureCollection, point } from '@turf/helpers';
import Flatbush from 'flatbush';
import { getCoord } from '@turf/invariant';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { format as formatCsv } from '@fast-csv/format';

export interface MapMakingExtra {
  tags?: string[];
  panoId?: string;
  panoDate?: string;
}

export interface MapMakingCoord {
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

export interface MapMaking {
  name: string;
  customCoordinates: MapMakingCoord[];
  extra?: MapMakingExtra;
}

interface OsmProps {
  osm_id: number;
  name: string;
  name_en?: string;
  admin_level: number;
  boundary?: 'administrative';
}

type OsmBoundaries = FeatureCollection<Polygon | MultiPolygon, OsmProps>;

const getMap = (): Promise<MapMaking> =>
  readFile(process.env.HOME + '/Download/merged.json', 'utf-8').then(
    JSON.parse
  );

// https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
// ogr2ogr ne_10m_admin_1_states_provinces.json -f GeoJSON ne_10m_admin_1_states_provinces.shp
const getSubdivs = async (): Promise<OsmBoundaries> => {
  const dir = await readdir(__dirname + '/../osmb', { withFileTypes: true });
  const files = dir
    .filter((file) => file.isFile() && file.name.startsWith('boundaries-'))
    .map((file) => file.name);
  const jsons: OsmBoundaries[] = await Promise.all(
    files.map((fn) =>
      readFile(__dirname + '/../osmb/' + fn, 'utf-8').then(JSON.parse)
    )
  );
  return featureCollection(jsons.flatMap((j) => j.features));
};

const makeIndex = (input: OsmBoundaries) => {
  const index = new Flatbush(input.features.length);
  for (const feat of input.features) {
    const [minX, minY, maxX, maxY] = bbox(feat);
    index.add(minX, minY, maxX, maxY);
  }
  index.finish();
  return index;
};

const findSubdivs = (p: Coord, subdivs: OsmBoundaries, index: Flatbush) => {
  const [x, y] = getCoord(p);
  const candidates = index.search(x, y, x, y).map((i) => subdivs.features[i]);
  return candidates.filter((candidate) => booleanPointInPolygon(p, candidate));
};

const customCleaners: Record<string, RegExp[]> = {
  AE: [/ Emirate$/],
  AL: [/ County$/],
  AM: [/ Province$/],
  AZ: [/ rayonu$/, / District$/],
  BA: [/ Canton$/],
  BD: [/ Division$/],
  BT: [/ District$/],
  BW: [/ District$/],
  BY: [/ Region$/],
  BZ: [/ District$/],
  CL: [/ Region$/],
  CN: [/ Province$/],
  CZ: [/ Region$/],
  DK: [/^Region /],
  EE: [/ County$/],
  ET: [/ Region$/],
  GH: [/ Region$/],
  GT: [/ Department$/],
  HK: [/ District$/],
  HR: [/ County$/, / županija$/],
  HT: [/^Département du /],
  IE: [/^County /],
  IQ: [/ Governorate$/],
  IR: [/ Province$/],
  JP: [/ Prefecture$/],
  KG: [/ Region$/],
  KR: [/ State$/],
  KW: [/ Governorate$/],
  KZ: [/ [Rr]egion$/],
  LA: [/ Province$/],
  LK: [/ District$/],
  LR: [/ County$/],
  LS: [/ District$/],
  MD: [/ District$/, / Municipality$/],
  ME: [/ Municipality$/],
  MM: [/ Region$/, / State$/],
  MV: [/ Atoll$/],
  NA: [/ Region$/],
  NP: [/ Province$/, / Pradesh$/],
  NZ: [/ District$/],
  OT: [/ District$/],
  RW: [/ Province$/],
  SA: [/ Province$/, / Region$/],
  SE: [/ County$/],
  SK: [/ kraj$/, /^Region of/],
  SL: [/ (Province|Area)(, Sierra Leone)?$/],
  SN: [/ Region$/],
  SY: [/ Governorate$/],
  TG: [/ Region$/],
  TH: [/ Province$/],
  TJ: [/ (Autonomous )?Region$/],
  TM: [/ Region$/, / City$/],
  TW: [/ County$/],
  UA: [/ Oblast$/],
  UG: [/ City$/],
  UK: [/ City$/, /^City of /],
  UZ: [/ Region$/],
  VN: [/ Province$/],
  XK: [/^District of /],
  ZM: [/ Province$/],
};

const removeDiacritics = (s: string, country?: string) =>
  (customCleaners[country ?? ''] ?? [])
    .reduce((acc, re) => acc.replace(re, ''), s)
    .normalize('NFD')
    .replace(/[\p{Diacritic}']/gu, '')
    .replace(/[\p{White_Space}_-]+/gu, ' ')
    .replace(/ı/gu, 'i')
    .trim()
    .toLowerCase();

const nameMatch = (tag: string, subdiv: OsmProps, country: string) => {
  const candidates = [subdiv.name, subdiv.name_en];
  const cleanTag = removeDiacritics(tag.split('_').slice(0, -1).join(' '));
  return candidates.some(
    (name) => name && cleanTag === removeDiacritics(name, country)
  );
};

const main = async () => {
  const [map, nat] = await Promise.all([getMap(), getSubdivs()]);
  console.log('read files');
  const index = makeIndex(nat);
  console.log('made index', index.nodeSize);
  const csv = formatCsv({ headers: true });
  csv.pipe(createWriteStream('check-subdivs-report.csv'));
  let trues = 0,
    falses = 0;
  const data = [];
  for (const loc of map.customCoordinates) {
    const taggedSubdiv = loc.extra?.tags?.[0] ?? '';
    const locFeature = point([loc.lng, loc.lat], { subdiv: taggedSubdiv });
    const subdivs = findSubdivs(locFeature, nat, index);
    const country = taggedSubdiv.split('_').at(-1)!;
    const matches = subdivs.some((subdiv) =>
      nameMatch(taggedSubdiv, subdiv.properties, country)
    );
    if (matches) {
      trues += 1;
    } else {
      falses += 1;
    }
    data.push({
      taggedSubdiv,
      country,
      subdivs: subdivs
        .map((sd) => sd.properties.name_en ?? sd.properties.name)
        .join('; '),
      matches,
      url:
        'https://geojson.io/#data=data:application/json,' +
        encodeURIComponent(JSON.stringify(featureCollection([locFeature]))),
    });
  }
  data.sort(
    (a, b) =>
      a.country.localeCompare(b.country) ||
      a.taggedSubdiv.localeCompare(b.taggedSubdiv)
  );
  for (const row of data) {
    csv.write(row);
  }
  csv.end();
  console.log({ trues, falses });
};

main().then(() => {});
