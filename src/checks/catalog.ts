import { CheckDefinition } from '../types';

export const SODA_CHECKS: CheckDefinition[] = [
  // ── Presence & Validity ──────────────────────────────────────────────────
  {
    id: 'missing_count',
    label: 'Not Null',
    description: 'No missing (null) values allowed',
    applies: 'all',
    params: [],
  },
  {
    id: 'duplicate_count',
    label: 'Unique',
    description: 'No duplicate values allowed',
    applies: 'all',
    params: [],
  },
  {
    id: 'missing_percent',
    label: 'Missing % below threshold',
    description: 'Percentage of nulls must stay below a limit',
    applies: 'all',
    params: [{ name: 'threshold', label: 'Max % missing', type: 'percentage', placeholder: '5' }],
  },
  {
    id: 'duplicate_percent',
    label: 'Duplicate % below threshold',
    description: 'Percentage of duplicates must stay below a limit',
    applies: 'all',
    params: [{ name: 'threshold', label: 'Max % duplicates', type: 'percentage', placeholder: '1' }],
  },
  {
    id: 'valid_values',
    label: 'Values in set',
    description: 'All values must be from an allowed list',
    applies: ['text', 'integer'],
    params: [{ name: 'values', label: 'Allowed values (comma-separated)', type: 'list', placeholder: 'pending, shipped, delivered' }],
  },
  {
    id: 'invalid_count',
    label: 'Invalid count = 0',
    description: 'Zero values outside of allowed set',
    applies: ['text', 'integer'],
    params: [{ name: 'values', label: 'Valid values (comma-separated)', type: 'list', placeholder: 'active, inactive' }],
  },
  // ── Numeric ──────────────────────────────────────────────────────────────
  {
    id: 'min_gte',
    label: 'Min ≥ value',
    description: 'Minimum value in column must be at least X',
    applies: ['integer', 'numeric'],
    params: [{ name: 'value', label: 'Min value', type: 'number', placeholder: '0' }],
  },
  {
    id: 'max_lte',
    label: 'Max ≤ value',
    description: 'Maximum value in column must not exceed X',
    applies: ['integer', 'numeric'],
    params: [{ name: 'value', label: 'Max value', type: 'number', placeholder: '1000000' }],
  },
  {
    id: 'avg_between',
    label: 'Average between',
    description: 'Column average must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min avg', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max avg', type: 'number', placeholder: '500' },
    ],
  },
  {
    id: 'sum_between',
    label: 'Sum between',
    description: 'Column sum must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min sum', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max sum', type: 'number', placeholder: '1000000' },
    ],
  },
  {
    id: 'stddev_between',
    label: 'Std dev between',
    description: 'Standard deviation must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min stddev', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max stddev', type: 'number', placeholder: '100' },
    ],
  },
  {
    id: 'percentile',
    label: 'Percentile between',
    description: 'Value at a given percentile must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'pct', label: 'Percentile (0-100)', type: 'number', placeholder: '95' },
      { name: 'min', label: 'Min value', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max value', type: 'number', placeholder: '1000' },
    ],
  },
  // ── String ───────────────────────────────────────────────────────────────
  {
    id: 'min_length',
    label: 'Min length ≥',
    description: 'All string values must be at least N characters long',
    applies: ['text'],
    params: [{ name: 'value', label: 'Min length', type: 'number', placeholder: '1' }],
  },
  {
    id: 'max_length',
    label: 'Max length ≤',
    description: 'All string values must not exceed N characters',
    applies: ['text'],
    params: [{ name: 'value', label: 'Max length', type: 'number', placeholder: '255' }],
  },
  {
    id: 'avg_length',
    label: 'Avg length between',
    description: 'Average string length must fall within a range',
    applies: ['text'],
    params: [
      { name: 'min', label: 'Min avg length', type: 'number', placeholder: '5' },
      { name: 'max', label: 'Max avg length', type: 'number', placeholder: '100' },
    ],
  },
  // ── Timestamp ────────────────────────────────────────────────────────────
  {
    id: 'freshness',
    label: 'Freshness — updated within',
    description: 'The most recent timestamp must be within the specified duration',
    applies: ['timestamp'],
    params: [{ name: 'duration', label: 'Max age (e.g. 24h, 7d)', type: 'duration', placeholder: '24h' }],
  },
  {
    id: 'date_min',
    label: 'Date not before',
    description: 'All dates must be on or after a given date',
    applies: ['timestamp'],
    params: [{ name: 'value', label: 'Earliest allowed date', type: 'text', placeholder: '2020-01-01' }],
  },
  {
    id: 'date_max',
    label: 'Date not after',
    description: 'All dates must be on or before a given date',
    applies: ['timestamp'],
    params: [{ name: 'value', label: 'Latest allowed date', type: 'text', placeholder: '2030-12-31' }],
  },
];

export const GE_CHECKS: CheckDefinition[] = [
  // ── Presence & Validity ──────────────────────────────────────────────────
  {
    id: 'not_null',
    label: 'Not Null',
    description: 'No null values allowed in this column',
    applies: 'all',
    params: [],
  },
  {
    id: 'unique',
    label: 'Unique',
    description: 'All values must be unique',
    applies: 'all',
    params: [],
  },
  {
    id: 'null_percent',
    label: 'Null % below threshold',
    description: 'Allow at most X% of rows to be null (mostly parameter)',
    applies: 'all',
    params: [{ name: 'mostly', label: 'Min % non-null (0–1)', type: 'number', placeholder: '0.95' }],
  },
  {
    id: 'values_in_set',
    label: 'Values in set',
    description: 'All values must be from an allowed list',
    applies: ['text', 'integer'],
    params: [{ name: 'values', label: 'Allowed values (comma-separated)', type: 'list', placeholder: 'pending, shipped, delivered' }],
  },
  {
    id: 'values_not_in_set',
    label: 'Values NOT in set',
    description: 'None of the values may be from a blocked list',
    applies: ['text', 'integer'],
    params: [{ name: 'values', label: 'Blocked values (comma-separated)', type: 'list', placeholder: 'unknown, n/a' }],
  },
  {
    id: 'unique_proportion',
    label: 'Unique proportion between',
    description: 'Proportion of unique values must fall within a range',
    applies: 'all',
    params: [
      { name: 'min', label: 'Min proportion (0–1)', type: 'number', placeholder: '0.9' },
      { name: 'max', label: 'Max proportion (0–1)', type: 'number', placeholder: '1.0' },
    ],
  },
  // ── Numeric ──────────────────────────────────────────────────────────────
  {
    id: 'min_between',
    label: 'Min value between',
    description: 'The column minimum must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Lower bound', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Upper bound', type: 'number', placeholder: '100' },
    ],
  },
  {
    id: 'max_between',
    label: 'Max value between',
    description: 'The column maximum must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Lower bound', type: 'number', placeholder: '100' },
      { name: 'max', label: 'Upper bound', type: 'number', placeholder: '1000000' },
    ],
  },
  {
    id: 'mean_between',
    label: 'Mean between',
    description: 'Column mean must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min mean', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max mean', type: 'number', placeholder: '500' },
    ],
  },
  {
    id: 'sum_between',
    label: 'Sum between',
    description: 'Column sum must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min sum', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max sum', type: 'number', placeholder: '1000000' },
    ],
  },
  {
    id: 'stdev_between',
    label: 'Std dev between',
    description: 'Standard deviation must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'min', label: 'Min stdev', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max stdev', type: 'number', placeholder: '100' },
    ],
  },
  {
    id: 'quantile_between',
    label: 'Quantile between',
    description: 'Value at a given quantile must fall within a range',
    applies: ['integer', 'numeric'],
    params: [
      { name: 'quantile', label: 'Quantile (0–1)', type: 'number', placeholder: '0.95' },
      { name: 'min', label: 'Min value', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Max value', type: 'number', placeholder: '1000' },
    ],
  },
  // ── String ───────────────────────────────────────────────────────────────
  {
    id: 'length_between',
    label: 'Length between',
    description: 'String length of all values must fall within a range',
    applies: ['text'],
    params: [
      { name: 'min', label: 'Min length', type: 'number', placeholder: '1' },
      { name: 'max', label: 'Max length', type: 'number', placeholder: '255' },
    ],
  },
  {
    id: 'match_regex',
    label: 'Matches regex',
    description: 'All values must match a regular expression',
    applies: ['text'],
    params: [{ name: 'regex', label: 'Regex pattern', type: 'text', placeholder: '^[A-Z]{2}\\d{4}$' }],
  },
  {
    id: 'strftime_format',
    label: 'Matches date format',
    description: 'All values must match a strftime date format string',
    applies: ['text'],
    params: [{ name: 'format', label: 'strftime format', type: 'text', placeholder: '%Y-%m-%d' }],
  },
  // ── Timestamp ────────────────────────────────────────────────────────────
  {
    id: 'date_parseable',
    label: 'Is date-parseable',
    description: 'All values can be parsed as dates',
    applies: ['text', 'timestamp'],
    params: [],
  },
  {
    id: 'date_between',
    label: 'Date between',
    description: 'All date values must fall within a range',
    applies: ['timestamp'],
    params: [
      { name: 'min', label: 'Min date', type: 'text', placeholder: '2020-01-01' },
      { name: 'max', label: 'Max date', type: 'text', placeholder: '2030-12-31' },
    ],
  },
];
