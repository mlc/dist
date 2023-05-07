import clone from '@turf/clone';
import {
  Coord,
  Feature,
  FeatureCollection,
  featureCollection,
  Point,
  point,
} from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import { featureEach } from '@turf/meta';
import { DOMParser } from '@xmldom/xmldom';
import DMS from 'geographiclib-dms';
import geodesic from 'geographiclib-geodesic';
import { select } from 'xpath';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join as joinPath } from 'node:path';

const selector =
  "//all_media/media[geodata/@latitude and string-length(geodata/@latitude)!=0 and privacy/@public='1']";

const jsonFilename = joinPath(process.env.HOME!, 'photos.json');
const xmlFilename = joinPath(process.env.HOME!, 'photos.xml');

interface Props {
  url?: string;
  title?: string;
}

type Data = FeatureCollection<Point, Props>;

const getMtime = async (fn: string): Promise<number | null> => {
  try {
    const stats = await stat(fn);
    return stats.mtimeMs;
  } catch (e) {
    return null;
  }
};

const read = async (): Promise<Data> => {
  const data = await readFile(jsonFilename, 'utf-8');
  return JSON.parse(data) as Data;
};

const parse = async (): Promise<Data> => {
  const xml = await readFile(xmlFilename, 'utf-8');

  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const nodes = select(selector, doc) as Node[];

  return featureCollection(
    nodes.map((node) => {
      const lat = select('.//geodata/@latitude', node, true) as Attr;
      const lng = select('.//geodata/@longitude', node, true) as Attr;
      const title = select('.//title', node, true) as Node | undefined;
      const url = select('.//publicUrl', node, true) as Node | undefined;
      return point([Number(lng.value), Number(lat.value)], {
        url: url?.firstChild?.toString(),
        title: title?.firstChild?.toString(),
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

const formatCoord = (pt: Coord): string => {
  const [lng, lat] = getCoord(pt);
  return [
    // @ts-ignore
    DMS.Encode(lat, DMS.SECOND, 0, DMS.LATITUDE),
    // @ts-ignore
    DMS.Encode(lng, DMS.SECOND, 0, DMS.LONGITUDE),
  ].join(' ');
};

const nearestPoint = <P>(
  targetPoint: Coord,
  points: FeatureCollection<Point>
): Feature<Point, P & { distance: number; strCoord: string }> => {
  let min = Infinity;
  let idx = 0;
  const targetCoord = getCoord(targetPoint) as [number, number];
  featureEach(points, (pt, i) => {
    const coord = getCoord(pt) as [number, number];
    const geo = geodesic.Geodesic.WGS84.Inverse(
      targetCoord[1],
      targetCoord[0],
      coord[1],
      coord[0],
      geodesic.Geodesic.DISTANCE
    );
    const dist = geo.s12! / 1000;
    if (dist < min) {
      min = dist;
      idx = i;
    }
  });
  const result = clone(points.features[idx]);
  return {
    ...result,
    properties: {
      ...result.properties,
      distance: min,
      strCoord: formatCoord(result),
    },
  };
};

const main = async () => {
  if (process.argv.length !== 4) {
    throw new Error('provide coords pls');
  }
  const p = await getData();
  // @ts-ignore
  const dms = DMS.DecodeLatLon(...(process.argv.slice(2) as [string, string]));
  const target = point([dms.lon, dms.lat]);
  return nearestPoint(target, p);
};

main().then((np) => console.dir(np, { depth: null }), console.error);
