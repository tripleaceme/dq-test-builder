import { ConnectionConfig, CustomCheck, GenerateRequest, SelectedCheck } from '../types';

// ── Install hints ───────────────────────────────────────────────────────────

function installLine(type: ConnectionConfig['type'] | undefined): string {
  switch (type) {
    case 'snowflake': return '# pip install great_expectations snowflake-sqlalchemy';
    case 'bigquery':  return '# pip install great_expectations sqlalchemy-bigquery google-cloud-bigquery';
    case 'redshift':  return '# pip install great_expectations sqlalchemy redshift_connector';
    default:          return '# pip install great_expectations sqlalchemy psycopg2-binary';
  }
}

// ── Datasource block, filled with real values from the active connection ────

function datasourceBlock(cfg: ConnectionConfig | undefined, schema: string): string[] {
  if (!cfg) {
    return [
      `CONNECTION_STRING = os.environ.get("DATABASE_URL", "dialect+driver://user:password@host:port/database")`,
    ];
  }

  switch (cfg.type) {
    case 'snowflake': {
      const lines = [
        `# Connection details from your DQ Test Builder session`,
        `# Set SNOWFLAKE_PASSWORD in your environment before running`,
        `SF_ACCOUNT   = ${q(cfg.account)}`,
        `SF_USER      = ${q(cfg.user)}`,
        `SF_DATABASE  = ${q(cfg.database)}`,
        `SF_SCHEMA    = ${q(cfg.schema ?? schema)}`,
        `SF_WAREHOUSE = ${q(cfg.warehouse)}`,
        `SF_ROLE      = ${q(cfg.role)}`,
        `SF_PASSWORD  = os.environ.get("SNOWFLAKE_PASSWORD", "")`,
        ``,
        `CONNECTION_STRING = (`,
        `    f"snowflake://{SF_USER}:{SF_PASSWORD}@{SF_ACCOUNT}/{SF_DATABASE}/{SF_SCHEMA}"`,
        `    f"?warehouse={SF_WAREHOUSE}&role={SF_ROLE}"`,
        `)`,
      ];
      return lines;
    }

    case 'bigquery': {
      const project = cfg.projectId ?? cfg.database;
      const dataset = cfg.dataset ?? schema;
      const lines = [
        `# Connection details from your DQ Test Builder session`,
        `BQ_PROJECT  = ${q(project)}`,
        `BQ_DATASET  = ${q(dataset)}`,
      ];
      if (cfg.keyFile) {
        lines.push(
          `BQ_KEY_FILE = ${q(cfg.keyFile)}`,
          ``,
          `CONNECTION_STRING = f"bigquery://{BQ_PROJECT}/{BQ_DATASET}?credentials_path={BQ_KEY_FILE}"`,
        );
      } else {
        lines.push(
          ``,
          `CONNECTION_STRING = f"bigquery://{BQ_PROJECT}/{BQ_DATASET}"`,
          `# If using a service account key: append ?credentials_path=/path/to/key.json`,
        );
      }
      return lines;
    }

    case 'redshift':
    default: {
      const dialect = cfg.type === 'redshift'
        ? 'redshift+redshift_connector'
        : 'postgresql+psycopg2';
      const defaultPort = cfg.type === 'redshift' ? 5439 : 5432;
      const envVar = cfg.type === 'redshift' ? 'REDSHIFT_PASSWORD' : 'DB_PASSWORD';
      return [
        `# Connection details from your DQ Test Builder session`,
        `# Set ${envVar} in your environment before running`,
        `DB_HOST     = ${q(cfg.host)}`,
        `DB_PORT     = ${cfg.port ?? defaultPort}`,
        `DB_USER     = ${q(cfg.user)}`,
        `DB_NAME     = ${q(cfg.database)}`,
        `DB_PASSWORD = os.environ.get(${q(envVar)}, "")`,
        ``,
        `CONNECTION_STRING = f"${dialect}://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"`,
      ];
    }
  }
}

function q(v: string | number | undefined): string {
  if (v === undefined || v === null) return '"YOUR_VALUE"';
  return `"${v}"`;
}

// ── Per-check rendering ─────────────────────────────────────────────────────

function renderCheck(c: SelectedCheck): string {
  const p = c.params;
  const col = `"${c.columnName}"`;

  switch (c.checkId) {
    case 'not_null':
      return `validator.expect_column_values_to_not_be_null(${col})`;
    case 'unique':
      return `validator.expect_column_values_to_be_unique(${col})`;
    case 'null_percent':
      return `validator.expect_column_values_to_not_be_null(${col}, mostly=${p['mostly']})`;
    case 'values_in_set': {
      const vals = p['values'].split(',').map(v => `"${v.trim()}"`).join(', ');
      return `validator.expect_column_values_to_be_in_set(${col}, value_set=[${vals}])`;
    }
    case 'values_not_in_set': {
      const vals = p['values'].split(',').map(v => `"${v.trim()}"`).join(', ');
      return `validator.expect_column_values_to_not_be_in_set(${col}, value_set=[${vals}])`;
    }
    case 'unique_proportion':
      return `validator.expect_column_proportion_of_unique_values_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'min_between':
      return `validator.expect_column_min_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'max_between':
      return `validator.expect_column_max_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'mean_between':
      return `validator.expect_column_mean_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'sum_between':
      return `validator.expect_column_sum_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'stdev_between':
      return `validator.expect_column_stdev_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'quantile_between':
      return [
        `validator.expect_column_quantile_values_to_be_between(`,
        `    ${col},`,
        `    quantile_ranges={"quantiles": [${p['quantile']}], "value_ranges": [[${p['min']}, ${p['max']}]]}`,
        `)`,
      ].join('\n');
    case 'length_between':
      return `validator.expect_column_value_lengths_to_be_between(${col}, min_value=${p['min']}, max_value=${p['max']})`;
    case 'match_regex':
      return `validator.expect_column_values_to_match_regex(${col}, regex=r"${p['regex']}")`;
    case 'strftime_format':
      return `validator.expect_column_values_to_match_strftime_format(${col}, strftime_format="${p['format']}")`;
    case 'date_parseable':
      return `validator.expect_column_values_to_be_dateutil_parseable(${col})`;
    case 'date_between':
      return `validator.expect_column_values_to_be_between(${col}, min_value="${p['min']}", max_value="${p['max']}")`;
    default:
      return `# unknown check: ${c.checkId}`;
  }
}

function renderCustom(c: CustomCheck): string {
  return [
    `validator.expect_column_values_to_satisfy(`,
    `    column="${c.columnName}",`,
    `    condition_parser="pandas",`,
    `    row_condition="${c.expression}",`,
    `    meta={"name": "${c.name}"}`,
    `)`,
  ].join('\n');
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generateGE(req: GenerateRequest): string {
  const { table, checks, customChecks, connectionConfig } = req;
  const fqn       = `${table.schema}.${table.table}`;
  const suiteName = `${table.table}_suite`;
  const dsName    = `${table.schema}_datasource`;
  const ckptName  = `${table.table}_checkpoint`;

  const lines: string[] = [
    `# Great Expectations — ${fqn}`,
    `# Generated by DQ Test Builder`,
    `#`,
    installLine(connectionConfig?.type),
    `#`,
    `# Usage:`,
    `#   1. Set the password env var shown below`,
    `#   2. python <this_file>.py`,
    ``,
    `import os`,
    `import great_expectations as gx`,
    ``,
    `context = gx.get_context()`,
    ``,
    `# ── Datasource ─────────────────────────────────────────────────────────────`,
    ...datasourceBlock(connectionConfig, table.schema),
    ``,
    `datasource = context.sources.add_or_update_sql(`,
    `    name="${dsName}",`,
    `    connection_string=CONNECTION_STRING,`,
    `)`,
    `asset = datasource.add_table_asset(`,
    `    "${table.table}",`,
    `    table_name="${table.table}",`,
    `    schema_name="${table.schema}",`,
    `)`,
    `batch_request = asset.build_batch_request()`,
    ``,
    `# ── Expectation suite ───────────────────────────────────────────────────────`,
    `suite_name = "${suiteName}"`,
    `suite = context.add_or_update_expectation_suite(expectation_suite_name=suite_name)`,
    `validator = context.get_validator(`,
    `    batch_request=batch_request,`,
    `    expectation_suite_name=suite_name,`,
    `)`,
    ``,
    `# ── Checks ──────────────────────────────────────────────────────────────────`,
  ];

  const byColumn = new Map<string, SelectedCheck[]>();
  for (const c of checks) {
    if (!byColumn.has(c.columnName)) byColumn.set(c.columnName, []);
    byColumn.get(c.columnName)!.push(c);
  }

  for (const [col, colChecks] of byColumn) {
    lines.push(`# ${col}`);
    for (const c of colChecks) lines.push(renderCheck(c));
    lines.push('');
  }

  for (const c of customChecks) {
    lines.push(`# ${c.columnName} — custom: ${c.name}`);
    lines.push(renderCustom(c));
    lines.push('');
  }

  lines.push(
    `validator.save_expectation_suite(discard_failed_expectations=False)`,
    ``,
    `# ── Run validation ──────────────────────────────────────────────────────────`,
    `checkpoint = context.add_or_update_checkpoint(`,
    `    name="${ckptName}",`,
    `    validator=validator,`,
    `)`,
    `result = checkpoint.run()`,
    `print(result)`,
    ``,
  );

  return lines.join('\n');
}
