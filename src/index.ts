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
    DMS.Encode(lat, DMS.DEGREE, 4, DMS.LATITUDE),
    // @ts-ignore
    DMS.Encode(lng, DMS.DEGREE, 4, DMS.LONGITUDE),
  ].join(' ');
};

const decoratePoints = <P extends object>(
  targetPoint: Coord,
  points: FeatureCollection<Point, P>
): FeatureCollection<Point, P & { distance: number; strCoord: string }> => {
  const targetCoord = getCoord(targetPoint) as [number, number];
  const result: Feature<Point, P & { distance: number; strCoord: string }>[] =
    [];
  featureEach(points, (pt) => {
    const coord = getCoord(pt) as [number, number];
    const geo = geodesic.Geodesic.WGS84.Inverse(
      targetCoord[1],
      targetCoord[0],
      coord[1],
      coord[0],
      geodesic.Geodesic.DISTANCE
    );
    const distance = geo.s12! / 1000;
    result.push(
      point(coord, {
        ...pt.properties,
        distance,
        strCoord: formatCoord(coord),
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
  // @ts-ignore
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
