import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import getData from './getData';

const main = async () => {
  const cacert = await readFile(__dirname + '/../us-east-1-bundle.pem', 'utf8');
  const data = await getData();

  const cli = new Client({
    user: 'postgres',
    password: '0SfygcLqex0zP3tYEpOb',
    host: 'database-1.ceq00lqmq6yf.us-east-1.rds.amazonaws.com',
    database: 'gis',
    ssl: {
      ca: cacert,
    },
  });

  await cli.connect();

  for (const feat of data.features) {
    await cli.query(
      'INSERT INTO photos (title, url, location) VALUES ($1, $2, ST_GeomFromGeoJSON($3))',
      [
        feat.properties.title,
        feat.properties.url,
        JSON.stringify(feat.geometry),
      ]
    );
  }

  await cli.end();
};

main().then(console.log, console.error);
