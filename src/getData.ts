import { featureCollection, point } from '@turf/helpers';
import { DOMParser } from '@xmldom/xmldom';
import { select } from 'xpath';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import type { Data } from './index';

const selector =
  "//all_media/media[geodata/@latitude and string-length(geodata/@latitude)!=0 and privacy/@public='1']";

const jsonFilename = joinPath(process.env.HOME!, 'photos.json');
const xmlFilename = joinPath(process.env.HOME!, 'photos.xml');

const getMtime = async (fn: string): Promise<number | null> => {
  try {
    const stats = await stat(fn);
    return stats.mtimeMs;
  } catch (e) {
    return null;
  }
};

const read = async (): Promise<Data> => {
  const data = await readFile(jsonFilename, 'utf-8');
  return JSON.parse(data) as Data;
};

const parse = async (): Promise<Data> => {
  const xml = await readFile(xmlFilename, 'utf-8');

  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const nodes = select(selector, doc) as Node[];

  return featureCollection(
    nodes.map((node) => {
      const lat = select('.//geodata/@latitude', node, true) as Attr;
      const lng = select('.//geodata/@longitude', node, true) as Attr;
      const title = select('.//title', node, true) as Node | undefined;
      const url = select('.//publicUrl', node, true) as Node | undefined;
      const imgUrl = select(
        './/image[@type="Large"]/@publicUrl',
        node,
        true
      ) as Attr | undefined;
      return point([Number(lng.value), Number(lat.value)], {
        url: url?.firstChild?.toString(),
        title: title?.firstChild?.toString(),
        imgUrl: imgUrl?.value,
      });
    })
  );
};

const getData = async (): Promise<Data> => {
  const [jsonTs, xmlTs] = await Promise.all(
    [jsonFilename, xmlFilename].map(getMtime)
  );
  if (!xmlTs) {
    throw new Error('no xml file');
  } else if (!jsonTs || jsonTs < xmlTs) {
    const data = await parse();
    await writeFile(jsonFilename, JSON.stringify(data), 'utf-8');
    return data;
  } else {
    return read();
  }
};

export default getData;
