import { Coord, featureCollection, point } from '@turf/helpers';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { writeFile } from 'fs/promises';
import { getCoord } from '@turf/invariant';
import { featureEach } from '@turf/meta';
import getData from './getData';
import { decodeCoord, distance as getDist, formatCoord } from './util';

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
  if (argc < 3 || argc > 4) {
    throw new Error('provide coords pls');
  }
  const p = await getData();
  const target = decodeCoord(process.argv[2]);
  const points = decoratePoints(target, p).features.sort(
    ({ properties: { distance: a } }, { properties: { distance: b } }) => a - b
  );
  await writeFile('sorted.json', JSON.stringify(points));
  return argc === 4 ? points.slice(0, parseInt(process.argv[3])) : points[0];
};

main().then((np) => console.dir(np, { depth: null }), console.error);
