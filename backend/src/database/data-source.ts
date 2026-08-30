import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildStandaloneDataSourceOptions } from './typeorm.config';

export default new DataSource(buildStandaloneDataSourceOptions());
