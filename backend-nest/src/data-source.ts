import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { dbConfigFactory } from './config/database.config';

export function createDataSource(): DataSource {
  // TypeOrmModuleOptions extends DataSourceOptions, so we can safely cast
  // DataSource constructor will ignore NestJS-specific properties like autoLoadEntities
  return new DataSource(dbConfigFactory() as DataSourceOptions);
}

export const AppDataSource = createDataSource();
export default AppDataSource;
