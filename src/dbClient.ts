import { Client } from 'pg';
import { ColumnInfo, ConnectionConfig, DataTypeCategory } from './types';

function normalizeType(rawType: string): DataTypeCategory {
  const t = rawType.toLowerCase();
  if (/^(int|integer|int2|int4|int8|bigint|smallint|serial|bigserial)/.test(t)) return 'integer';
  if (/^(float|float4|float8|real|double|numeric|decimal|money)/.test(t)) return 'numeric';
  if (/^(text|varchar|character varying|char|character|name|citext|uuid)/.test(t)) return 'text';
  if (/^(timestamp|date|time)/.test(t)) return 'timestamp';
  if (/^(bool|boolean)/.test(t)) return 'boolean';
  return 'other';
}

export class DbClient {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private newClient(): Client {
    return new Client({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionTimeoutMillis: 5000,
    });
  }

  async testConnection(): Promise<void> {
    const client = this.newClient();
    await client.connect();
    await client.end();
  }

  async getSchemas(): Promise<string[]> {
    const client = this.newClient();
    await client.connect();
    try {
      const res = await client.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
         ORDER BY schema_name`
      );
      return res.rows.map(r => r.schema_name);
    } finally {
      await client.end();
    }
  }

  async getTables(schema: string): Promise<string[]> {
    const client = this.newClient();
    await client.connect();
    try {
      const res = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema]
      );
      return res.rows.map(r => r.table_name);
    } finally {
      await client.end();
    }
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const client = this.newClient();
    await client.connect();
    try {
      const res = await client.query<{
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
      }>(
        `SELECT column_name, data_type, udt_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table]
      );
      return res.rows.map(r => ({
        name: r.column_name,
        rawType: r.udt_name || r.data_type,
        category: normalizeType(r.udt_name || r.data_type),
        isNullable: r.is_nullable === 'YES',
      }));
    } finally {
      await client.end();
    }
  }
}
