import { readFile, access, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gunzip as rawGunzip } from 'node:zlib';
import type { MapMaking } from './check-subdivs';

const sleep = promisify(setTimeout);
const gunzip = promisify(rawGunzip);

interface Iso3166 {
  name: string;
  'alpha-2': string;
  'alpha-3': string;
  'country-code': string;
  'iso_3166-2': string;
  region: string;
  'sub-region': string;
  'intermediate-region': string;
  'region-code': string;
  'sub-region-code': string;
  'intermediate-region-code': string;
}

const hacks: Record<string, string | undefined> = {
  XK: 'Kosovo',
  UK: 'United Kingdom',
  LA: 'Laos',
  VN: 'Vietnam',
  SY: 'Syria',
  PS: 'Palestinian Territories',
  BN: 'Brunei',
  US: 'United States',
  ST: 'São Tomé and Príncipe',
  VA: 'Vatican City',
  KP: 'North Korea',
  KR: 'South Korea',
  CD: 'Democratic Republic of the Congo',
  VG: 'British Virgin Islands',
  RU: 'Russia',
};

const levels: Record<string, number[] | undefined> = {
  IS: [5],
  FR: [3, 4],
  PT: [4, 6],
  LS: [5],
  SI: [7, 8],
  NL: [3, 4, 8],
  SG: [6],
  HR: [6],
  MC: [2],
  XK: [5],
  EE: [6],
  TC: [6],
  MT: [2],
  ME: [6],
  VC: [2],
  GD: [2],
  KY: [2],
  BB: [2],
  SC: [4, 6],
  AI: [2],
  BS: [8],
  BM: [6],
  JM: [6],
  CV: [6],
  ST: [4, 6],
  AD: [2],
  VA: [2],
  LI: [2],
  SM: [2],
  LU: [6],
  CY: [5],
  MD: [4, 5],
  VG: [2],
  UK: [4, 5, 6],
  AL: [6],
  IE: [6],
  HU: [6],
  BA: [4, 5],
  AZ: [4, 5],
  CZ: [6],
  SO: [4, 5],
  MU: [4, 8],
  AG: [2],
  LK: [5],
  BF: [5],
  GR: [3, 5],
  RS: [6],
  DM: [2],
  LC: [2],
};

const extras: Record<string, number[]> = {
  Gibraltar: [2],
  'Faroe Islands': [2],
  'Akrotiri and Dhekelia': [6],
  'Isle of Man': [2],
  Guernsey: [2],
  Jersey: [2],
};

const extraExtras: [string, string, number[]][] = [
  ['Hong Kong', '-913110', [6]],
  ['Macau', '-1867188', [3]],
  ['Brussels', '-54094', [4]],
  ['Flanders', '-53134', [6]],
  ['Wallonia', '-90348', [6]],
  ['Metropolitan France', '-1403916', [4]],
  ['French Polynesia', '-3412620', [6]],
  ['New Caledonia', '-3407643', [6]],
  ['Dakhla', '-3406823', [4]],
  ['Laayoune', '-2424260', [4]],
  ['Dublin', '-282800', [7]],
];

const noRecurse = new Set(['NL']);

interface TreeEnt {
  parent_boundary_id?: string;
  boundary_id: string;
  name: string;
  name_en: string;
  boundary?: string;
  admin_level: number;
  children?: boolean;
}

const getMap = (): Promise<MapMaking> =>
  readFile(process.env.HOME + '/Download/merged.json', 'utf-8').then(
    JSON.parse
  );

const clean = (s: string) => s?.split(',')[0];

let first = true;

const downloadOrFetch = async (
  iso: string,
  osm: TreeEnt,
  level: number,
  apiKey: string
): Promise<void> => {
  const filename = __dirname + `/../osmb/boundaries-${iso}-${level}.json`;
  const exists = await access(filename).then(
    () => true,
    () => false
  );
  if (exists) {
    return;
  }
  const params = new URLSearchParams({
    db: 'osm20250303',
    osmIds: osm.boundary_id,
    recursive: noRecurse.has(iso) ? 'false' : 'true',
    minAdminLevel: level.toString(),
    maxAdminLevel: level.toString(),
    format: 'GeoJSON',
    srid: '4326',
  });

  console.info('fetching', osm.name_en ?? osm.name, level);
  if (!first) {
    await sleep(1000);
  }
  first = false;
  const response = await fetch(
    'https://osm-boundaries.com/api/v1/download?' + params.toString(),
    {
      method: 'GET',
      headers: {
        'X-OSMB-Api-Key': apiKey,
      },
      redirect: 'follow',
    }
  );
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  const body = await response.bytes();
  const gunzipped = await gunzip(body);
  await writeFile(filename, gunzipped);
};

const main = async () => {
  const map = await getMap();
  const lands = new Set(
    map.customCoordinates.map((c) => c.extra?.tags?.[0]?.split('_')?.at(-1)!)
  );
  lands.delete('OT');
  const countries: Iso3166[] = JSON.parse(
    await readFile(__dirname + '/../iso3166.json', 'utf-8')
  );
  const root: TreeEnt[] = JSON.parse(
    await readFile(__dirname + '/../osmb/roots.json', 'utf-8')
  );
  const apiKey = await readFile(__dirname + '/../.osmbkey', 'utf-8');
  for (const land of lands) {
    const landName =
      hacks[land] ?? clean(countries.find((c) => c['alpha-2'] === land)!.name);
    const osm = root.find(
      ({ name, name_en }) =>
        clean(name) === landName || clean(name_en) === landName
    );
    if (osm) {
      for (const level of levels[land] ?? [4]) {
        await downloadOrFetch(land, osm, level, apiKey);
      }
    }
  }
  for (const [landName, levels] of Object.entries(extras)) {
    const osm = root.find(
      ({ name, name_en }) =>
        clean(name) === landName || clean(name_en) === landName
    );
    for (const level of levels) {
      await downloadOrFetch(
        landName.toLowerCase().replaceAll(' ', '-'),
        osm!,
        level,
        apiKey
      );
    }
  }
  for (const [landName, boundary_id, levels] of extraExtras) {
    const osm = {
      name: landName,
      boundary_id,
      name_en: landName,
      admin_level: 2,
    };
    for (const level of levels) {
      await downloadOrFetch(
        landName.toLowerCase().replaceAll(' ', '-'),
        osm,
        level,
        apiKey
      );
    }
  }
};

main().then(() => {});
