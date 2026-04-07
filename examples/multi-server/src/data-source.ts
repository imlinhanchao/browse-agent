import { DataSource } from 'typeorm';
import { InstanceSchema } from './entities/Instance.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: path.join(dataDir, 'instances.db'),
  synchronize: true,
  logging: false,
  entities: [InstanceSchema],
});
