import { FeatureCollection } from '@turf/helpers';

interface ToGeoJson {
  kml: (doc: XMLDocument) => FeatureCollection;
  gpx: (doc: XMLDocument) => FeatureCollection;
}

declare const toGeoJSON: ToGeoJson;

export = toGeoJSON;
