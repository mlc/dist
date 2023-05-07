import clone from '@turf/clone';
import { Coord, Feature, FeatureCollection, Point, point } from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import { featureEach } from '@turf/meta';
import DMS from 'geographiclib-dms';
import geodesic from 'geographiclib-geodesic';
import getData from './getData';

export interface Props {
  url?: string;
  title?: string;
}

export type Data = FeatureCollection<Point, Props>;

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
