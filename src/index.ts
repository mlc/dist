import { DOMParser } from '@xmldom/xmldom';
import { join as joinPath } from 'node:path';
import { readFile } from 'node:fs/promises';
import { select } from 'xpath';
import { featureCollection, point } from '@turf/helpers';
import nearestPoint from '@turf/nearest-point';

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

const main = async () => {
  if (process.argv.length !== 4) {
    throw new Error('provide coords pls');
  }
  const p = await parse();
  const target = point(process.argv.slice(2).map(parseFloat));
  return nearestPoint(target, p);
};

main().then((np) => console.dir(np, { depth: null }), console.error);
