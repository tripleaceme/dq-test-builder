import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import { ConnectionConfig } from './types';

interface DbtProfile {
  [profileName: string]: {
    target: string;
    outputs: {
      [target: string]: Record<string, unknown>;
    };
  };
}

function parseDbtOutput(output: Record<string, unknown>): ConnectionConfig | null {
  const type = output['type'] as string;
  if (type !== 'postgres' && type !== 'redshift') return null;

  return {
    type: type as ConnectionConfig['type'],
    host: (output['host'] as string) || 'localhost',
    port: (output['port'] as number) || 5432,
    database: (output['dbname'] as string) || (output['database'] as string) || '',
    user: (output['user'] as string) || '',
    password: (output['password'] as string) || '',
    schema: (output['schema'] as string) || 'public',
  };
}

export async function detectConnection(): Promise<ConnectionConfig | null> {
  // 1. Try dbt profiles.yml
  const profilesPath = path.join(os.homedir(), '.dbt', 'profiles.yml');
  if (fs.existsSync(profilesPath)) {
    try {
      const raw = fs.readFileSync(profilesPath, 'utf8');
      const profiles = yaml.load(raw) as DbtProfile;
      for (const profileName of Object.keys(profiles)) {
        if (profileName === 'config') continue;
        const profile = profiles[profileName];
        const target = profile.target;
        const output = profile.outputs?.[target];
        if (output) {
          const config = parseDbtOutput(output);
          if (config) return config;
        }
      }
    } catch {
      // fall through to next source
    }
  }

  // 2. Try workspace .env
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const envPath = path.join(folder.uri.fsPath, '.env');
      if (fs.existsSync(envPath)) {
        const config = parseEnvFile(envPath);
        if (config) return config;
      }
    }
  }

  return null;
}

function parseEnvFile(envPath: string): ConnectionConfig | null {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }

  const host = env['DB_HOST'] || env['POSTGRES_HOST'] || env['DATABASE_HOST'];
  const user = env['DB_USER'] || env['POSTGRES_USER'] || env['DATABASE_USER'];
  const password = env['DB_PASSWORD'] || env['POSTGRES_PASSWORD'] || env['DATABASE_PASSWORD'];
  const database = env['DB_NAME'] || env['POSTGRES_DB'] || env['DATABASE_NAME'];

  if (!host || !user || !database) return null;

  return {
    type: 'postgres',
    host,
    port: parseInt(env['DB_PORT'] || env['POSTGRES_PORT'] || '5432'),
    database,
    user,
    password: password || '',
    schema: env['DB_SCHEMA'] || 'public',
  };
}

export async function promptForConnection(): Promise<ConnectionConfig | null> {
  const connString = await vscode.window.showInputBox({
    prompt: 'Enter a PostgreSQL connection string',
    placeHolder: 'postgresql://user:password@host:5432/database',
    ignoreFocusOut: true,
  });
  if (!connString) return null;

  try {
    const url = new URL(connString);
    return {
      type: 'postgres',
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
