import { Coord, featureCollection, point } from '@turf/helpers';
import { DOMParser } from '@xmldom/xmldom';
import { select } from 'xpath';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import type { Data } from './index';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import Flatbush from 'flatbush';
import { bbox } from '@turf/bbox';
import { getCoord } from '@turf/invariant';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

const selector =
  '//all_media/media[geodata/@latitude and string-length(geodata/@latitude)!=0]';

const jsonFilename = joinPath(process.env.HOME!, 'photos.json');
const xmlFilename = joinPath(process.env.HOME!, 'photos.xml');

const getMtime = (fn: string): Promise<number | null> =>
  stat(fn).then(
    ({ mtimeMs }) => mtimeMs,
    (e) => ('code' in e && e.code === 'ENOENT' ? null : Promise.reject(e))
  );

const read = async (): Promise<Data> => {
  const data = await readFile(jsonFilename, 'utf-8');
  return JSON.parse(data) as Data;
};

interface CountryProperties {
  featurecla: 'Admin-0 country';
  ISO_A2: string;
  ISO_A3: string;
  NAME: string;
  NAME_LONG: string;
}

type Countries = FeatureCollection<Polygon | MultiPolygon, CountryProperties>;

interface CountryData {
  index: Flatbush;
  countries: Countries;
}

const readCountries = async (): Promise<CountryData> => {
  const data = await readFile(
    joinPath(__dirname, '..', 'countries.geojson'),
    'utf-8'
  );
  const countries = JSON.parse(data) as Countries;
  const index = new Flatbush(countries.features.length);
  for (const feat of countries.features) {
    const [minX, minY, maxX, maxY] = bbox(feat);
    index.add(minX, minY, maxX, maxY);
  }
  index.finish();
  return { index, countries };
};

const findCountry = (p: Coord, c: CountryData) => {
  const [x, y] = getCoord(p);
  const candidates = c.index
    .search(x, y, x, y)
    .map((i) => c.countries.features[i]);
  return candidates.find((candidate) => booleanPointInPolygon(p, candidate))
    ?.properties?.NAME;
};

const parse = async (): Promise<Data> => {
  const [xml, countries] = await Promise.all([
    readFile(xmlFilename, 'utf-8'),
    readCountries(),
  ]);

  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const nodes = select(selector, doc) as Node[];

  return featureCollection(
    nodes.map((node) => {
      const lat = select('.//geodata/@latitude', node, true) as Attr;
      const lng = select('.//geodata/@longitude', node, true) as Attr;
      const title = select('./title', node, true) as Node | undefined;
      const url = select('./publicUrl', node, true) as Node | undefined;
      const imgUrl = select(
        './/image[@type="Large"]/@publicUrl',
        node,
        true
      ) as Attr | undefined;
      const privacy = select('./privacy', node, true) as Element | undefined;
      const altitude = select(
        './/exif[@tag="GPSAltitude"]/@raw',
        node,
        true
      ) as Attr | undefined;
      const altitudeN = altitude
        ? Number.parseFloat(altitude.value)
        : undefined;
      const coords = [Number(lng.value), Number(lat.value)];
      return point(coords, {
        url: url?.firstChild?.toString(),
        title: title?.firstChild?.toString(),
        imgUrl: imgUrl?.value,
        private:
          privacy?.attributes?.getNamedItem('public')?.value === '1'
            ? undefined
            : true,
        altitude:
          typeof altitudeN === 'number' && !Number.isNaN(altitudeN)
            ? altitudeN
            : undefined,
        country: findCountry(coords, countries),
      });
    })
  );
};

const getData = async (): Promise<Data> => {
  const [jsonTs, xmlTs] = await Promise.all(
    [jsonFilename, xmlFilename].map(getMtime)
  );
  if (!xmlTs) {
    throw new Error('no xml file');
  } else if (!jsonTs || jsonTs < xmlTs) {
    const data = await parse();
    await writeFile(jsonFilename, JSON.stringify(data), 'utf-8');
    return data;
  } else {
    return read();
  }
};

export default getData;
