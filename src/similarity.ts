import * as fs from 'node:fs/promises';
import { stdout } from 'node:process';
import { writeToPath, writeToStream } from '@fast-csv/format';
import { parseFile } from '@fast-csv/parse';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { LocalDate } from '@js-joda/core';

interface Row {
  '': string;
  Name: string;
  Locs: string;
  NumLocs: string;
  UniqueLocs: string;
  NumUniqueLocs: string;
  MostSimilarPeer: string;
  MostSimilarPeerNumLocs: string;
  MostSimilarPeerJaccard: string;
}

const intersect = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const result = new Set<K>();
  for (const k of a) {
    if (b.has(k)) {
      result.add(k);
    }
  }
  return result;
};

const diff = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const result = new Set<K>();
  for (const k of a) {
    if (!b.has(k)) {
      result.add(k);
    }
  }
  return result;
};

const jaccard = <K>(a: Readonly<Set<K>>, b: Readonly<Set<K>>) => {
  const i = intersect(a, b).size;
  return i / (a.size + b.size - i);
};

const readCsv = (): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const result: Row[] = [];
    parseFile('visitor_data.csv', { headers: true })
      .on('data', (r) => result.push(r))
      .on('error', (e) => reject(e))
      .on('end', () => resolve(result));
  });

const print = (r: any[][]) => writeToPath('subsets.csv', r);

const parseLocs = (rs: Row[]) => {
  const result = new Map<string, Set<string>>();
  for (const r of rs) {
    const locs: string[] = JSON.parse(r.Locs.replaceAll("'", '"'));
    result.set(r.Name, new Set(locs));
  }
  return result;
};

const main = async () => {
  const rows = await readCsv();
  const locs = [...parseLocs(rows).entries()];
  const p = new XMLSerializer();

  const dom = new DOMImplementation();
  const doc = dom.createDocument('http://gexf.net/1.3', 'gexf');
  doc.documentElement.setAttribute('version', '1.3');
  doc.documentElement.setAttributeNS(
    'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation',
    'http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd'
  );
  const meta = doc.createElement('meta');
  meta.setAttribute('lastmodifieddate', LocalDate.now().toString());
  doc.documentElement.appendChild(meta);
  const description = doc.createElement('description');
  description.appendChild(doc.createTextNode('subdiv map similarities'));
  meta.appendChild(description);
  const graph = doc.createElement('graph');
  graph.setAttribute('defaultedgetype', 'undirected');
  doc.documentElement.appendChild(graph);
  const nodes = doc.createElement('nodes');
  graph.appendChild(nodes);
  for (let i = 0; i < locs.length; ++i) {
    const node = doc.createElement('node');
    node.setAttribute('id', String(i));
    node.setAttribute('label', locs[i][0]);
    nodes.appendChild(node);
  }
  const edges = doc.createElement('edges');
  graph.appendChild(edges);
  for (let i = 0; i < locs.length; ++i) {
    for (let j = i + 1; j < locs.length; ++j) {
      const weight = jaccard(locs[i][1], locs[j][1]);
      if (weight > 0) {
        const edge = doc.createElement('edge');
        edge.setAttribute('source', String(i));
        edge.setAttribute('target', String(j));
        edge.setAttribute('weight', String(weight));
        edges.appendChild(edge);
      }
    }
  }
  await fs.writeFile('similarity.gexf', p.serializeToString(doc));

  const lookup = new Map<string, Set<string>>();
  for (const [name, subdivs] of locs) {
    for (const subdiv of subdivs) {
      if (!lookup.has(subdiv)) {
        lookup.set(subdiv, new Set());
      }
      lookup.get(subdiv)!.add(name);
    }
  }

  console.log(lookup.size);

  const rowws: (string | number)[][] = [];
  for (const [k1, v1] of lookup.entries()) {
    for (const [k2, v2] of lookup.entries()) {
      if (k1 === k2) {
        continue;
      }
      const both = intersect(v1, v2);
      const onlya = diff(v1, v2);
      if (onlya.size === 0 && both.size > 30) {
        rowws.push([k1, k2, both.size, v2.size - v1.size]);
      }
    }
  }
  print(rowws);
};

main().then(() => console.log('done'), console.error);
