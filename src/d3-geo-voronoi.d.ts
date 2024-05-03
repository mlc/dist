import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
  Position,
} from 'geojson';

declare module 'd3-geo-voronoi' {
  interface GeoDelaunay {
    // Returns the closest point to [lon, lat]; optionally starting the search at node to boost the performance.
    find(lon: number, lat: number, node?: number): number;
    // Given a vector of distances (in the same order as the edges list), returns a vector of boolean values: true if the edge belongs to the Urquhart graph, false otherwise.
    urquhart(distances: readonly number[]): boolean[];
    // An array of edges as indices of points [from, to].
    edges: [from: number, to: number][];
    // An array of the triangles, as indices of points [a, b, c]. The triangles are orientated in a clockwise manner, triangles that span more than the hemisphere are removed.
    triangles: [number, number, number][];
    // The array of centers in spherical coordinates; the first t centers are the t triangles’s circumcenters. More centers might be listed in order to build the Voronoi diagram for smaller number of points (n≤3).
    centers: [number, number][];
    // The array of neighbors indices for each vertex.
    neighbors: number[][];
    // Array of Voronoi cells for each vertex. Each cell is an array of centers ordered in a clockwise manner.
    polygons: number[][];
    // An array containing all the edges of the Voronoi polygons.
    mesh: [number, number][];
  }

  interface Accessor<Site> {
    (): (site: Site) => number;
    (newAccessor: (site: Site) => number): void;
  }

  interface VoronoiProps<Site> {
    site: Site;
    sitecoordinates: Position;
    neighbours: number[];
  }

  interface LinksProps<Site> {
    source: Site;
    target: Site;
    length: number;
    urquhart: boolean;
  }

  interface GeoVoronoi<Site> {
    // The geoDelaunay object used to compute this diagram.
    delaunay: GeoDelaunay;
    x: Accessor<Site>;
    y: Accessor<Site>;
    // Returns the Voronoi tessellation of the data as a GeoJSON collection of polygons. (If there is only one data point, returns the Sphere). Each polygon exposes its datum in its properties.
    polygons(): FeatureCollection<Polygon, VoronoiProps<Site>>;
    // Returns the Voronoi tessellation as a GeoJSON mesh (MultiLineString).
    cellMesh(): MultiLineString;
    // Returns the Voronoi tessellation of the data as a GeoJSON collection of polygons. Each triangle exposes in its properties the three sites, its spherical area (in steradians), and its circumcenter.
    triangles(): FeatureCollection<Polygon, { circumcenter: Position }>;
    // Returns the Delaunay edges as a GeoJSON mesh (MultiLineString).
    mesh(): MultiLineString;
    // Returns the Delaunay links of the data as a GeoJSON collection of lines. Each line exposes its source and target in its properties, but also its length (in radians), and a boolean flag for links that belong to the Urquhart graph.
    links(): FeatureCollection<LineString, LinksProps<Site>>;
    // Finds the closest site to point x,y, i.e. the Voronoi polygon that contains it.
    find(x: number, y: number): number;
    // Finds the closest site to point x,y, i.e. the Voronoi polygon that contains it. Return null if the distance between the point and the site is larger than angle degrees.
    find(x: number, y: number, angle: number): number | undefined;
    // Returns the spherical convex hull of the data array, as a GeoJSON polygon. Returns null if the dataset spans more than a hemisphere.
    hull(): Polygon | null;
  }

  export function geoDelaunay(points: readonly Position[]): GeoDelaunay;

  export function geoVoronoi(
    data: FeatureCollection<G, P>
  ): GeoVoronoi<Feature<G, P>>;
  export function geoVoronoi(data: Site[]): GeoVoronoi<Site>;

  interface GeoContour {}

  export function geoContour(): GeoContour;
}
