import { Coord, featureCollection, lineString, point } from '@turf/helpers';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { writeFile } from 'fs/promises';
import { getCoord } from '@turf/invariant';
import { featureEach } from '@turf/meta';
import { format } from 'prettier';
import getData from './getData';
import { decodeCoord, distance as getDist, formatCoord } from './util';
import nearestPointOnLine from '@turf/nearest-point-on-line';

export interface Props {
  url?: string;
  title?: string;
  imgUrl?: string;
}

export type Data = FeatureCollection<Point, Props>;

const decoratePoints = <P extends object>(
  targetPoints: Coord[],
  points: FeatureCollection<Point, P>
): FeatureCollection<Point, P & { distance: number; strCoord: string }> => {
  const target: [number, number] | Feature<LineString> =
    targetPoints.length === 1
      ? (getCoord(targetPoints[0]) as [number, number])
      : lineString(targetPoints.map(getCoord));
  const result: Feature<Point, P & { distance: number; strCoord: string }>[] =
    [];
  featureEach(points, (pt) => {
    let props: { distance: number; pt?: Point };
    if (Array.isArray(target)) {
      props = { distance: getDist(target, pt) };
    } else {
      const result = nearestPointOnLine(target, pt, { units: 'kilometers' });
      props = { distance: result.properties.dist, pt: result.geometry };
    }
    result.push(
      point(getCoord(pt), {
        ...pt.properties,
        ...props,
        strCoord: formatCoord(pt),
      })
    );
  });
  return featureCollection(result);
};

const main = async () => {
  const argc = process.argv.length;
  if (argc < 3) {
    throw new Error('provide coords pls');
  }
  const p = await getData();
  const targets = process.argv.slice(2).map(decodeCoord);
  const points = decoratePoints(targets, p).features.sort(
    ({ properties: { distance: a } }, { properties: { distance: b } }) => a - b
  );
  await format(JSON.stringify(points), { parser: 'json' }).then((txt) =>
    writeFile('sorted.json', txt)
  );
  return points[0];
};

main().then((np) => console.dir(np, { depth: null }), console.error);
