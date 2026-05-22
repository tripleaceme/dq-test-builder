import * as vscode from 'vscode';
import { detectConnection, promptForConnection } from './connectionDetector';
import { DbClient } from './dbClient';
import { SchemaTreeProvider } from './schemaTreeProvider';
import { TestBuilderPanel } from './testBuilderPanel';
import { ColumnInfo, ConnectionConfig } from './types';

let dbClient: DbClient | null = null;
let treeProvider: SchemaTreeProvider;

export async function activate(context: vscode.ExtensionContext) {
  treeProvider = new SchemaTreeProvider();

  const treeView = vscode.window.createTreeView('dq-schema-tree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Auto-detect connection on startup
  const config = await detectConnection();
  if (config) {
    await connectWithConfig(config);
  }

  // Command: open table in webview
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'dq-builder.openTable',
      async (schema: string, table: string) => {
        if (!dbClient) {
          vscode.window.showErrorMessage('No database connection. Use ⚙ to configure one.');
          return;
        }
        const panel = TestBuilderPanel.show(context.extensionUri);
        const columns: ColumnInfo[] = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Loading ${schema}.${table}…`,
            cancellable: false,
          },
          () => dbClient!.getColumns(schema, table)
        );
        panel.loadTable({ schema, table, columns });
      }
    )
  );

  // Command: refresh tree
  context.subscriptions.push(
    vscode.commands.registerCommand('dq-builder.refreshTree', () => {
      treeProvider.refresh();
    })
  );

  // Command: configure connection
  context.subscriptions.push(
    vscode.commands.registerCommand('dq-builder.configureConnection', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: '$(search) Auto-detect from dbt profiles.yml / .env', value: 'auto' },
          { label: '$(edit) Enter connection string manually', value: 'manual' },
        ],
        { placeHolder: 'How would you like to connect?' }
      );
      if (!choice) return;

      let config: ConnectionConfig | null = null;
      if (choice.value === 'auto') {
        config = await detectConnection();
        if (!config) {
          vscode.window.showWarningMessage(
            'No connection found in dbt profiles.yml or .env. Try entering one manually.'
          );
          return;
        }
      } else {
        config = await promptForConnection();
      }

      if (config) await connectWithConfig(config);
    })
  );

  context.subscriptions.push(treeView);
}

async function connectWithConfig(config: ConnectionConfig) {
  const client = new DbClient(config);
  try {
    await client.testConnection();
    dbClient = client;
    treeProvider.setClient(dbClient);
    vscode.window.setStatusBarMessage(
      `$(database) DQ Builder connected to ${config.database}`,
      5000
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    treeProvider.setError(`Cannot connect: ${msg}`);
    vscode.window.showErrorMessage(`DQ Builder: connection failed — ${msg}`);
  }
}

export function deactivate() {}
