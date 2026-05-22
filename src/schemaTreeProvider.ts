import * as vscode from 'vscode';
import { DbClient } from './dbClient';

type NodeKind = 'schema' | 'table' | 'error' | 'loading' | 'empty';

export class SchemaNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: NodeKind,
    public readonly schema?: string,
    public readonly table?: string
  ) {
    super(
      label,
      kind === 'schema'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = kind;

    if (kind === 'table') {
      this.iconPath = new vscode.ThemeIcon('table');
      this.command = {
        command: 'dq-builder.openTable',
        title: 'Open Test Builder',
        arguments: [schema, table],
      };
    } else if (kind === 'schema') {
      this.iconPath = new vscode.ThemeIcon('database');
    } else if (kind === 'error') {
      this.iconPath = new vscode.ThemeIcon('error');
    } else if (kind === 'loading') {
      this.iconPath = new vscode.ThemeIcon('loading~spin');
    }
  }
}

export class SchemaTreeProvider implements vscode.TreeDataProvider<SchemaNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SchemaNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private client: DbClient | null = null;
  private error: string | null = null;

  setClient(client: DbClient | null) {
    this.client = client;
    this.error = null;
    this.refresh();
  }

  setError(message: string) {
    this.error = message;
    this.client = null;
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SchemaNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SchemaNode): Promise<SchemaNode[]> {
    if (this.error) {
      return [new SchemaNode(this.error, 'error')];
    }
    if (!this.client) {
      return [new SchemaNode('No connection — click ⚙ to configure', 'empty')];
    }

    try {
      if (!element) {
        const schemas = await this.client.getSchemas();
        return schemas.map(s => new SchemaNode(s, 'schema', s));
      }
      if (element.kind === 'schema' && element.schema) {
        const tables = await this.client.getTables(element.schema);
        if (tables.length === 0) {
          return [new SchemaNode('(no tables)', 'empty')];
        }
        return tables.map(t => new SchemaNode(t, 'table', element.schema, t));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return [new SchemaNode(`Error: ${msg}`, 'error')];
    }

    return [];
  }
}
