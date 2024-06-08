import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  Position,
} from 'geojson';
import distance from '@turf/distance';
import { featureCollection, point } from '@turf/helpers';
import getData from './getData';
import type { Props } from './index';
import { copy } from './util';

interface VProps {
  site: Feature<Point, Props>;
  sitecoordinates: Position;
  neighbours: number[];
}

const main = async () => {
  const { geoVoronoi } = await import('d3-geo-voronoi');
  const data = await getData();
  const voronoi = geoVoronoi(data).polygons();

  const [result, d] = voronoi.features.reduce<[Position | null, number]>(
    (a, polygon) =>
      polygon.geometry.coordinates.flat().reduce((b, coord) => {
        const dist = distance(coord, polygon.properties.site);
        if (dist > b[1]) {
          return [coord, dist];
        } else {
          return b;
        }
      }, a),
    [null, 0]
  );

  const sites = voronoi.features
    .filter((polygon) =>
      polygon.geometry.coordinates
        .flat()
        .some((coord) => JSON.stringify(coord) === JSON.stringify(result))
    )
    .map(({ properties: { site } }) => site);

  return featureCollection<Point, any>([...sites, point(result!, { d })]);
};

main().then((p) => {
  console.dir(p, { depth: null });
  return copy(
    `https://geojson.io/#data=data:application/json,${encodeURIComponent(
      JSON.stringify(p)
    )}`
  );
});
