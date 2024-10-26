import { randomFillSync } from 'node:crypto';

const buf = Buffer.alloc(8);
const randomFloat = (): number => {
  randomFillSync(buf);
  buf[7] = 0x3f;
  buf[6] |= 0xf0;
  return buf.readDoubleLE() - 1;
};

const continents = {
  Asia: 44_614_000,
  Africa: 30_365_000,
  NorthAmerica: 24_230_000,
  SouthAmerica: 17_814_000,
  // Antarctica: 14_200_000,
  Europe: 10_000_000,
  Oceania: 8_510_926,
};

const sum = (as: number[]) => as.reduce((acc, cur) => acc + cur, 0);

const totalArea = sum(Object.values(continents));
const eachOdds: [string, number][] = Object.entries(continents).map(
  ([k, v]) => [k, v / totalArea]
);
const cumOdds = (() => {
  const result: [string, number][] = [];
  let acc = 0;
  eachOdds.forEach(([k, v]) => {
    acc += v;
    result.push([k, acc]);
  });
  return result;
})();

const pick = (n: number) => cumOdds.find(([_, v]) => v >= n)![0];

const finds: Record<string, number> = Object.fromEntries(
  Object.entries(continents).map(([k]) => [k, 0])
);

const runs = 10_000_000;
let last: string | undefined = undefined;
for (let i = 0; i < runs; ++i) {
  let p: string;
  do {
    p = pick(randomFloat());
  } while (p === last);
  //} while (false);
  last = p;
  finds[p] += 1;
}

const table = eachOdds.map(([k, v]) => [
  k,
  v.toFixed(4),
  (finds[k] / runs).toFixed(4),
]);

console.log(table);
