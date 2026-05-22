import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import { ConnectionConfig } from './types';

interface DbtOutput { [key: string]: unknown }
interface DbtProfile {
  [profileName: string]: {
    target: string;
    outputs: { [target: string]: DbtOutput };
  };
}

// ── Parse a single dbt output block ────────────────────────────────────────

function parseOutput(output: DbtOutput): ConnectionConfig | null {
  const type = output['type'] as string;

  if (type === 'postgres' || type === 'redshift') {
    return {
      type,
      host: (output['host'] as string) || 'localhost',
      port: (output['port'] as number) || (type === 'redshift' ? 5439 : 5432),
      database: (output['dbname'] as string) || (output['database'] as string) || '',
      user: (output['user'] as string) || '',
      password: (output['password'] as string) || '',
      schema: (output['schema'] as string) || 'public',
    };
  }

  if (type === 'snowflake') {
    return {
      type: 'snowflake',
      account: (output['account'] as string) || '',
      user: (output['user'] as string) || '',
      password: (output['password'] as string) || '',
      database: (output['database'] as string) || '',
      schema: (output['schema'] as string) || 'PUBLIC',
      warehouse: (output['warehouse'] as string) || '',
      role: (output['role'] as string) || undefined,
    };
  }

  if (type === 'bigquery') {
    return {
      type: 'bigquery',
      projectId: (output['project'] as string) || '',
      dataset: (output['dataset'] as string) || '',
      keyFile: (output['keyfile'] as string) || undefined,
    };
  }

  return null;
}

// ── File readers ────────────────────────────────────────────────────────────

function tryProfilesFile(filePath: string): ConnectionConfig | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const profiles = yaml.load(fs.readFileSync(filePath, 'utf8')) as DbtProfile;
    for (const key of Object.keys(profiles)) {
      if (key === 'config') continue;
      const profile = profiles[key];
      const output = profile?.outputs?.[profile.target];
      if (output) {
        const config = parseOutput(output);
        if (config) return config;
      }
    }
  } catch { /* ignore malformed files */ }
  return null;
}

function tryBigQueryKeyFile(filePath: string): ConnectionConfig | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw.type === 'service_account' && raw.project_id) {
      return { type: 'bigquery', projectId: raw.project_id, keyFile: filePath };
    }
  } catch { /* ignore */ }
  return null;
}

function tryEnvFile(filePath: string): ConnectionConfig | null {
  if (!fs.existsSync(filePath)) return null;
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  const host = env['DB_HOST'] || env['POSTGRES_HOST'] || env['DATABASE_HOST'];
  const user = env['DB_USER'] || env['POSTGRES_USER'] || env['DATABASE_USER'];
  const database = env['DB_NAME'] || env['POSTGRES_DB'] || env['DATABASE_NAME'];
  if (!host || !user || !database) return null;
  return {
    type: 'postgres',
    host,
    port: parseInt(env['DB_PORT'] || env['POSTGRES_PORT'] || '5432'),
    database,
    user,
    password: env['DB_PASSWORD'] || env['POSTGRES_PASSWORD'] || env['DATABASE_PASSWORD'] || '',
    schema: env['DB_SCHEMA'] || 'public',
  };
}

// ── Auto-detect ─────────────────────────────────────────────────────────────

export async function detectConnection(): Promise<ConnectionConfig | null> {
  // 1. Honour user-configured path from VS Code settings
  const customPath = vscode.workspace.getConfiguration('dq-test-builder').get<string>('credentialsPath');
  if (customPath) {
    const expanded = customPath.replace(/^~/, os.homedir());
    const config = tryProfilesFile(expanded) ?? tryBigQueryKeyFile(expanded) ?? tryEnvFile(expanded);
    if (config) return config;
  }

  // 2. Default dbt profiles.yml
  const fromProfiles = tryProfilesFile(path.join(os.homedir(), '.dbt', 'profiles.yml'));
  if (fromProfiles) return fromProfiles;

  // 3. Workspace .env
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const fromEnv = tryEnvFile(path.join(folder.uri.fsPath, '.env'));
    if (fromEnv) return fromEnv;
  }

  return null;
}

// ── Manual connection prompt ────────────────────────────────────────────────

export async function promptForConnection(): Promise<ConnectionConfig | null> {
  const dbType = await vscode.window.showQuickPick(
    [
      { label: '$(database) PostgreSQL', value: 'postgres' },
      { label: '$(database) Redshift', value: 'redshift' },
      { label: '$(server-environment) Snowflake', value: 'snowflake' },
      { label: '$(cloud) BigQuery (service account JSON)', value: 'bigquery' },
      { label: '$(link) Connection string (Postgres / Redshift)', value: 'connstring' },
    ],
    { placeHolder: 'Select database type' }
  );
  if (!dbType) return null;

  // BigQuery: pick service account JSON file
  if (dbType.value === 'bigquery') {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'Service Account JSON': ['json'] },
      openLabel: 'Select service account key file',
    });
    if (!uris?.[0]) return null;
    const config = tryBigQueryKeyFile(uris[0].fsPath);
    if (!config) {
      vscode.window.showErrorMessage('File does not look like a BigQuery service account key.');
      return null;
    }
    await persistPath(uris[0].fsPath);
    return config;
  }

  // Connection string shortcut
  if (dbType.value === 'connstring') {
    const str = await vscode.window.showInputBox({
      prompt: 'Enter a PostgreSQL / Redshift connection string',
      placeHolder: 'postgresql://user:password@host:5432/database',
      ignoreFocusOut: true,
    });
    if (!str) return null;
    try {
      const url = new URL(str);
      return {
        type: 'postgres' as const,
        host: url.hostname,
        port: parseInt(url.port || '5432'),
        database: url.pathname.replace('/', ''),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        schema: 'public',
      };
    } catch {
      vscode.window.showErrorMessage('Invalid connection string format.');
      return null;
    }
  }

  // All other types: browse for credentials file
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'dbt profiles / YAML / env': ['yml', 'yaml', 'env'] },
    openLabel: 'Select credentials file',
    title: `Browse for ${dbType.label.replace(/^\$\([^)]+\) /, '')} credentials`,
  });
  if (!uris?.[0]) return null;

  const filePath = uris[0].fsPath;
  const config = tryProfilesFile(filePath) ?? tryEnvFile(filePath);
  if (!config) {
    vscode.window.showErrorMessage('Could not parse a connection from the selected file.');
    return null;
  }

  await persistPath(filePath);
  return config;
}

async function persistPath(filePath: string) {
  await vscode.workspace.getConfiguration('dq-test-builder').update(
    'credentialsPath', filePath, vscode.ConfigurationTarget.Global
  );
}
