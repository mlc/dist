import { DOMParser } from '@xmldom/xmldom';
import { join as joinPath } from 'node:path';
import { readFile } from 'node:fs/promises';
import { select } from 'xpath';
import {
  Coord,
  Feature,
  FeatureCollection,
  featureCollection,
  Point,
  point,
} from '@turf/helpers';
import DMS from 'geographiclib-dms';
import geodesic from 'geographiclib-geodesic';
import { featureEach } from '@turf/meta';
import clone from '@turf/clone';
import { getCoord } from '@turf/invariant';

const selector =
  "//all_media/media[geodata/@latitude and string-length(geodata/@latitude)!=0 and privacy/@public='1']";

const parse = async () => {
  const xml = await readFile(
    joinPath(process.env.HOME!, 'photos.xml'),
    'utf-8'
  );

  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const nodes = select(selector, doc) as Node[];

  return featureCollection(
    nodes.map((node) => {
      const lat = select('.//geodata/@latitude', node, true) as Attr;
      const lng = select('.//geodata/@longitude', node, true) as Attr;
      const title = select('.//title', node, true) as Node;
      const url = select('.//publicUrl', node, true) as Node;
      return point([Number(lng.value), Number(lat.value)], {
        url: url.firstChild?.toString(),
        title: title.firstChild?.toString(),
      });
    })
  );
};

const nearestPoint = <P>(
  targetPoint: Coord,
  points: FeatureCollection<Point>
): Feature<Point, P & { distance: number }> => {
  let min = Infinity;
  let idx = 0;
  const targetCoord = getCoord(targetPoint);
  featureEach(points, (pt, i) => {
    const coord = getCoord(pt);
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
    },
  };
};

const main = async () => {
  if (process.argv.length !== 4) {
    throw new Error('provide coords pls');
  }
  const p = await parse();
  // @ts-ignore
  const dms = DMS.DecodeLatLon(...(process.argv.slice(2) as [string, string]));
  const target = point([dms.lon, dms.lat]);
  return nearestPoint(target, p);
};

main().then((np) => console.dir(np, { depth: null }), console.error);
