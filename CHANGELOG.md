# Changelog

## [0.1.0] — 2026-05-22

### Added
- Sidebar tree view: auto-detects PostgreSQL connection from dbt `profiles.yml` or `.env`
- Framework picker: choose between **Soda Core** or **Great Expectations** per session
- Full check catalog: 18 Soda checks + 17 GE checks, filtered per column data type
- Custom check support: name + condition fields, with per-framework syntax hints
- Code generation: outputs SodaCL YAML or GE Python directly into a new editor tab
- One-click connection string fallback for projects without dbt
