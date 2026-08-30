const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseName = process.env.DB_NAME || 'copa_leyendas';

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  console.error(`Invalid DB_NAME "${databaseName}". Use only letters, numbers, and underscore.`);
  process.exit(1);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });

  await client.connect();

  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

  if (exists.rowCount) {
    console.log(`Database "${databaseName}" already exists.`);
    await client.end();
    return;
  }

  await client.query(`CREATE DATABASE "${databaseName}"`);
  console.log(`Database "${databaseName}" created.`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
