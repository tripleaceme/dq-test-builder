# DQ Test Builder — Great Expectations & Soda

A VS Code extension that lets data engineers build data quality tests visually — no memorising check syntax required.

Connect to your database, browse your tables, pick checks per column from a full catalog, and generate ready-to-use **SodaCL YAML** or **Great Expectations Python** in one click.

---

## Features

- **Auto-connects** from your existing `~/.dbt/profiles.yml` or `.env` — no separate config
- **Sidebar tree** browses schemas → tables live from your database
- **Framework picker** — choose Soda Core or Great Expectations; checks are specific to your selection (no mixing)
- **Full check catalog** per column, filtered by data type:
  - Presence & validity (not null, unique, values in set…)
  - Numeric stats (min, max, average, sum, std dev, percentile…)
  - String patterns (regex, length, date format…)
  - Timestamp & freshness (freshness window, date ranges…)
- **Custom checks** — any check that isn't in the catalog: type a name + your own condition, and it gets generated correctly for whichever framework you picked
- Generated code opens in a **new editor tab** — save it wherever your project expects it

---

## Quick Start

1. Install the extension
2. Open the **Data Quality** icon in the activity bar
3. If no connection is auto-detected, click ⚙ and paste a connection string
4. Click any table → pick your framework → add checks → **Generate Tests**

---

## Supported Databases

| Database | Via |
|---|---|
| PostgreSQL | dbt profiles.yml / .env / connection string |
| Redshift | dbt profiles.yml |

Snowflake and BigQuery support coming soon.

---

## Requirements

- VS Code 1.85+
- A running PostgreSQL (or Redshift) database
- Optional: dbt project with `~/.dbt/profiles.yml`

---

## License

MIT
