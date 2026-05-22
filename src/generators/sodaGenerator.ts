import { CustomCheck, GenerateRequest, SelectedCheck } from '../types';

function renderCheck(c: SelectedCheck): string {
  const p = c.params;
  const col = c.columnName;

  switch (c.checkId) {
    case 'missing_count':      return `  - missing_count(${col}) = 0`;
    case 'duplicate_count':    return `  - duplicate_count(${col}) = 0`;
    case 'missing_percent':    return `  - missing_percent(${col}) < ${p['threshold']}`;
    case 'duplicate_percent':  return `  - duplicate_percent(${col}) < ${p['threshold']}`;
    case 'valid_values': {
      const vals = p['values'].split(',').map(v => `'${v.trim()}'`).join(', ');
      return `  - invalid_count(${col}) = 0:\n      valid values: [${vals}]`;
    }
    case 'invalid_count': {
      const vals = p['values'].split(',').map(v => `'${v.trim()}'`).join(', ');
      return `  - invalid_count(${col}) = 0:\n      valid values: [${vals}]`;
    }
    case 'min_gte':      return `  - min(${col}) >= ${p['value']}`;
    case 'max_lte':      return `  - max(${col}) <= ${p['value']}`;
    case 'avg_between':  return `  - avg(${col}) between ${p['min']} and ${p['max']}`;
    case 'sum_between':  return `  - sum(${col}) between ${p['min']} and ${p['max']}`;
    case 'stddev_between': return `  - stddev(${col}) between ${p['min']} and ${p['max']}`;
    case 'percentile':   return `  - percentile(${col}, ${p['pct']}) between ${p['min']} and ${p['max']}`;
    case 'min_length':   return `  - min_length(${col}) >= ${p['value']}`;
    case 'max_length':   return `  - max_length(${col}) <= ${p['value']}`;
    case 'avg_length':   return `  - avg_length(${col}) between ${p['min']} and ${p['max']}`;
    case 'freshness':    return `  - freshness(${col}) < ${p['duration']}`;
    case 'date_min':     return `  - min(${col}) >= '${p['value']}'`;
    case 'date_max':     return `  - max(${col}) <= '${p['value']}'`;
    default:             return `  # unknown check: ${c.checkId}`;
  }
}

function renderCustom(c: CustomCheck): string {
  return [
    `  - failed rows:`,
    `      name: ${c.name}`,
    `      fail condition: ${c.expression}`,
  ].join('\n');
}

export function generateSoda(req: GenerateRequest): string {
  const { table, checks, customChecks } = req;
  const tableFqn = `${table.schema}.${table.table}`;

  const lines: string[] = [`checks for ${tableFqn}:`];

  const byColumn = new Map<string, SelectedCheck[]>();
  for (const c of checks) {
    if (!byColumn.has(c.columnName)) byColumn.set(c.columnName, []);
    byColumn.get(c.columnName)!.push(c);
  }

  for (const [col, colChecks] of byColumn) {
    lines.push(`  # ${col}`);
    for (const c of colChecks) lines.push(renderCheck(c));
  }

  if (customChecks.length > 0) {
    lines.push('  # custom checks');
    for (const c of customChecks) lines.push(renderCustom(c));
  }

  return lines.join('\n') + '\n';
}
