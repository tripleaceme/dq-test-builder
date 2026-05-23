import { ConnectionConfig, CustomCheck, GenerateRequest, SelectedCheck } from '../types';

// ── Connection string with real values, password placeholder ────────────────

function connectionStringTemplate(cfg: ConnectionConfig | undefined, schema: string): string {
  if (!cfg) return 'postgresql+psycopg2://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:5432/YOUR_DATABASE';

  switch (cfg.type) {
    case 'snowflake': {
      const u  = cfg.user      ?? 'YOUR_USER';
      const a  = cfg.account   ?? 'YOUR_ACCOUNT';
      const db = cfg.database  ?? 'YOUR_DATABASE';
      const sc = cfg.schema    ?? schema;
      const wh = cfg.warehouse ?? 'YOUR_WAREHOUSE';
      const rl = cfg.role      ?? 'YOUR_ROLE';
      return `snowflake://${u}:YOUR_PASSWORD@${a}/${db}/${sc}?warehouse=${wh}&role=${rl}`;
    }
    case 'bigquery': {
      const project = cfg.projectId ?? cfg.database ?? 'YOUR_PROJECT';
      const dataset = cfg.dataset ?? schema;
      const base = `bigquery://${project}/${dataset}`;
      return cfg.keyFile ? `${base}?credentials_path=${cfg.keyFile}` : base;
    }
    case 'redshift': {
      const u  = cfg.user     ?? 'YOUR_USER';
      const h  = cfg.host     ?? 'YOUR_HOST';
      const p  = cfg.port     ?? 5439;
      const db = cfg.database ?? 'YOUR_DATABASE';
      return `redshift+redshift_connector://${u}:YOUR_PASSWORD@${h}:${p}/${db}`;
    }
    default: {
      const u  = cfg.user     ?? 'YOUR_USER';
      const h  = cfg.host     ?? 'YOUR_HOST';
      const p  = cfg.port     ?? 5432;
      const db = cfg.database ?? 'YOUR_DATABASE';
      return `postgresql+psycopg2://${u}:YOUR_PASSWORD@${h}:${p}/${db}`;
    }
  }
}

function installLine(type: ConnectionConfig['type'] | undefined): string {
  switch (type) {
    case 'snowflake': return '# pip install great_expectations snowflake-sqlalchemy';
    case 'bigquery':  return '# pip install great_expectations sqlalchemy-bigquery google-cloud-bigquery';
    case 'redshift':  return '# pip install great_expectations sqlalchemy redshift_connector';
    default:          return '# pip install great_expectations sqlalchemy psycopg2-binary';
  }
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

  const connStr = connectionStringTemplate(connectionConfig, table.schema);
  const isBigQuery = connectionConfig?.type === 'bigquery';

  const lines: string[] = [
    `# Great Expectations — ${fqn}`,
    `# Generated by DQ Test Builder`,
    `#`,
    installLine(connectionConfig?.type),
    `#`,
    `# Usage:`,
    ...(isBigQuery
      ? [`#   python <this_file>.py`]
      : [
          `#   export DATABASE_URL="${connStr}"`,
          `#   python <this_file>.py`,
        ]
    ),
    ``,
    `import os`,
    `import great_expectations as gx`,
    ``,
    `context = gx.get_context()`,
    ``,
    `# ── Datasource ─────────────────────────────────────────────────────────────`,
    ...(isBigQuery
      ? [`CONNECTION_STRING = "${connStr}"`]
      : [
          `# Replace YOUR_PASSWORD, or export DATABASE_URL to skip this line entirely`,
          `CONNECTION_STRING = os.environ.get("DATABASE_URL", "${connStr}")`,
        ]
    ),
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
