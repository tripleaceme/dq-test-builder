import { Client } from 'pg';
import { ColumnInfo, ConnectionConfig, DataTypeCategory } from './types';

// ── Type normalisation ──────────────────────────────────────────────────────

function normalizeType(raw: string): DataTypeCategory {
  const t = raw.toLowerCase();
  if (/^(int|integer|int2|int4|int8|bigint|smallint|serial|bigserial|fixed)/.test(t)) return 'integer';
  if (/^(float|float4|float8|real|double|numeric|decimal|money|bignumeric|number)/.test(t)) return 'numeric';
  if (/^(text|varchar|character varying|char|character|name|citext|uuid|string|nvarchar|nchar)/.test(t)) return 'text';
  if (/^(timestamp|date|time|datetime)/.test(t)) return 'timestamp';
  if (/^(bool|boolean)/.test(t)) return 'boolean';
  return 'other';
}

// ── Adapter interface ───────────────────────────────────────────────────────

export interface DbAdapter {
  testConnection(): Promise<void>;
  getSchemas(): Promise<string[]>;
  getTables(schema: string): Promise<string[]>;
  getColumns(schema: string, table: string): Promise<ColumnInfo[]>;
}

// ── PostgreSQL / Redshift ───────────────────────────────────────────────────

class PostgresAdapter implements DbAdapter {
  constructor(private config: ConnectionConfig) {}

  private newClient() {
    return new Client({
      host: this.config.host,
      port: this.config.port ?? 5432,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionTimeoutMillis: 5000,
      ssl: this.config.type === 'redshift' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async testConnection() {
    const c = this.newClient(); await c.connect(); await c.end();
  }

  async getSchemas() {
    const c = this.newClient(); await c.connect();
    try {
      const res = await c.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
         ORDER BY schema_name`
      );
      return res.rows.map(r => r.schema_name);
    } finally { await c.end(); }
  }

  async getTables(schema: string) {
    const c = this.newClient(); await c.connect();
    try {
      const res = await c.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
        [schema]
      );
      return res.rows.map(r => r.table_name);
    } finally { await c.end(); }
  }

  async getColumns(schema: string, table: string) {
    const c = this.newClient(); await c.connect();
    try {
      const res = await c.query<{
        column_name: string; udt_name: string; data_type: string; is_nullable: string;
      }>(
        `SELECT column_name, udt_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [schema, table]
      );
      return res.rows.map(r => ({
        name: r.column_name,
        rawType: r.udt_name || r.data_type,
        category: normalizeType(r.udt_name || r.data_type),
        isNullable: r.is_nullable === 'YES',
      }));
    } finally { await c.end(); }
  }
}

// ── Snowflake ───────────────────────────────────────────────────────────────

class SnowflakeAdapter implements DbAdapter {
  constructor(private config: ConnectionConfig) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async execute<T>(sql: string): Promise<T[]> {
    const sf = await import('snowflake-sdk');
    const conn = sf.default.createConnection({
      account: this.config.account!,
      username: this.config.user!,
      password: this.config.password!,
      database: this.config.database,
      warehouse: this.config.warehouse,
      schema: this.config.schema,
      role: this.config.role,
    });
    return new Promise((resolve, reject) => {
      conn.connect(err => {
        if (err) { reject(err); return; }
        conn.execute({
          sqlText: sql,
          complete: (err2, _stmt, rows) => {
            conn.destroy(() => {});
            if (err2) reject(err2);
            else resolve((rows ?? []) as T[]);
          },
        });
      });
    });
  }

  async testConnection() { await this.execute('SELECT 1'); }

  async getSchemas() {
    const rows = await this.execute<{ SCHEMA_NAME: string }>(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
       WHERE SCHEMA_NAME != 'INFORMATION_SCHEMA' ORDER BY SCHEMA_NAME`
    );
    return rows.map(r => r.SCHEMA_NAME);
  }

  async getTables(schema: string) {
    const rows = await this.execute<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = '${schema}' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
    );
    return rows.map(r => r.TABLE_NAME);
  }

  async getColumns(schema: string, table: string) {
    const rows = await this.execute<{
      COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string;
    }>(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
       ORDER BY ORDINAL_POSITION`
    );
    return rows.map(r => ({
      name: r.COLUMN_NAME,
      rawType: r.DATA_TYPE,
      category: normalizeType(r.DATA_TYPE),
      isNullable: r.IS_NULLABLE === 'Y' || r.IS_NULLABLE === 'YES',
    }));
  }
}

// ── BigQuery ────────────────────────────────────────────────────────────────

class BigQueryAdapter implements DbAdapter {
  constructor(private config: ConnectionConfig) {}

  private async bq() {
    const { BigQuery } = await import('@google-cloud/bigquery');
    return new BigQuery({
      projectId: this.config.projectId ?? this.config.database,
      keyFilename: this.config.keyFile,
    });
  }

  async testConnection() {
    const client = await this.bq();
    await client.getDatasets({ maxResults: 1 });
  }

  async getSchemas() {
    const client = await this.bq();
    const [datasets] = await client.getDatasets();
    return datasets.map(d => d.id!).filter(Boolean).sort();
  }

  async getTables(schema: string) {
    const client = await this.bq();
    const [tables] = await client.dataset(schema).getTables();
    return tables.map(t => t.id!).filter(Boolean).sort();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const client = await this.bq();
    const [meta] = await client.dataset(schema).table(table).getMetadata();
    return (meta.schema?.fields ?? []).map((f: { name: string; type: string; mode: string }) => ({
      name: f.name,
      rawType: f.type,
      category: normalizeType(f.type),
      isNullable: f.mode !== 'REQUIRED',
    }));
  }
}

// ── Factory + public DbClient ───────────────────────────────────────────────

export function createAdapter(config: ConnectionConfig): DbAdapter {
  switch (config.type) {
    case 'snowflake': return new SnowflakeAdapter(config);
    case 'bigquery':  return new BigQueryAdapter(config);
    default:          return new PostgresAdapter(config);
  }
}

// Thin wrapper kept so schemaTreeProvider doesn't need changes
export class DbClient implements DbAdapter {
  private adapter: DbAdapter;
  constructor(config: ConnectionConfig) { this.adapter = createAdapter(config); }
  testConnection()               { return this.adapter.testConnection(); }
  getSchemas()                   { return this.adapter.getSchemas(); }
  getTables(s: string)           { return this.adapter.getTables(s); }
  getColumns(s: string, t: string) { return this.adapter.getColumns(s, t); }
}
