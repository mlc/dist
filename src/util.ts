import type { Coord } from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import geodesic from 'geographiclib-geodesic';
import DMS from 'geographiclib-dms';

// compute the distance between two points
export const distance = (a: Coord, b: Coord): number => {
  const [lon1, lat1] = getCoord(a);
  const [lon2, lat2] = getCoord(b);
  const { s12 } = geodesic.Geodesic.WGS84.Inverse(
    lat1,
    lon1,
    lat2,
    lon2,
    geodesic.Geodesic.DISTANCE
  );
  return s12! / 1000;
};

export const formatCoord = (pt: Coord): string => {
  const [lng, lat] = getCoord(pt);
  return [
    DMS.Encode(lat, DMS.DEGREE, 4, DMS.LATITUDE),
    DMS.Encode(lng, DMS.DEGREE, 4, DMS.LONGITUDE),
  ].join(' ');
};
