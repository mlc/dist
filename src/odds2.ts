import { randomInt } from 'node:crypto';

class Flipper {
  flip(): boolean {
    this._count += 1;
    return randomInt(2) === 1;
  }

  get count() {
    return this._count;
  }

  private _count: number = 0;
}

const run = () => {
  const f = new Flipper();
  let seen = 0;
  while (seen < 7) {
    if (f.flip()) {
      seen++;
    } else {
      seen = 0;
    }
  }

  return f.count;
};

let sum = 0;
for (let i = 0; i < 1000000; i++) {
  sum += run();
}

console.log(sum / 1000000);
