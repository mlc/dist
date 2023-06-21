import {
  Coord,
  Feature,
  featureCollection,
  FeatureCollection,
  Point,
  point,
} from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import { featureEach } from '@turf/meta';
import DMS from 'geographiclib-dms';
import getData from './getData';
import { distance as getDist, formatCoord } from './util';

export interface Props {
  url?: string;
  title?: string;
  imgUrl?: string;
}

export type Data = FeatureCollection<Point, Props>;

const decoratePoints = <P extends object>(
  targetPoint: Coord,
  points: FeatureCollection<Point, P>
): FeatureCollection<Point, P & { distance: number; strCoord: string }> => {
  const targetCoord = getCoord(targetPoint) as [number, number];
  const result: Feature<Point, P & { distance: number; strCoord: string }>[] =
    [];
  featureEach(points, (pt) => {
    const distance = getDist(targetCoord, pt);
    result.push(
      point(getCoord(pt), {
        ...pt.properties,
        distance,
        strCoord: formatCoord(pt),
      })
    );
  });
  return featureCollection(result);
};

const main = async () => {
  const argc = process.argv.length;
  if (argc < 4 || argc > 5) {
    throw new Error('provide coords pls');
  }
  const p = await getData();
  const dms = DMS.DecodeLatLon(
    ...(process.argv.slice(2, 4) as [string, string])
  );
  const target = point([dms.lon, dms.lat]);
  const points = decoratePoints(target, p).features.sort(
    ({ properties: { distance: a } }, { properties: { distance: b } }) => a - b
  );
  return argc === 5 ? points.slice(0, parseInt(process.argv[4])) : points[0];
};

main().then((np) => console.dir(np, { depth: null }), console.error);
