import * as vscode from 'vscode';
import { GE_CHECKS, SODA_CHECKS } from './checks/catalog';
import { generateGE } from './generators/geGenerator';
import { generateSoda } from './generators/sodaGenerator';
import { CustomCheck, Framework, GenerateRequest, SelectedCheck, TableInfo } from './types';

export class TestBuilderPanel {
  private static instance: TestBuilderPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.panel.webview.html = this.buildHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), null, this.disposables);
  }

  static show(extensionUri: vscode.Uri): TestBuilderPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (TestBuilderPanel.instance) {
      TestBuilderPanel.instance.panel.reveal(column);
      return TestBuilderPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      'dqBuilder',
      'DQ Test Builder',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );
    TestBuilderPanel.instance = new TestBuilderPanel(panel, extensionUri);
    return TestBuilderPanel.instance;
  }

  loadTable(table: TableInfo) {
    this.panel.reveal();
    this.panel.webview.postMessage({ type: 'loadTable', table });
  }

  private async handleMessage(message: {
    type: string;
    framework?: Framework;
    checks?: SelectedCheck[];
    customChecks?: CustomCheck[];
    table?: TableInfo;
  }) {
    switch (message.type) {
      case 'generate': {
        if (!message.framework || !message.table) return;
        const req: GenerateRequest = {
          framework: message.framework,
          table: message.table,
          checks: message.checks ?? [],
          customChecks: message.customChecks ?? [],
        };
        const code = message.framework === 'soda'
          ? generateSoda(req)
          : generateGE(req);

        const ext = message.framework === 'soda' ? 'yml' : 'py';
        const lang = message.framework === 'soda' ? 'yaml' : 'python';
        const doc = await vscode.workspace.openTextDocument({
          language: lang,
          content: code,
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
        break;
      }
    }
  }

  private buildHtml(): string {
    const cspSource = this.panel.webview.cspSource;
    const catalog = JSON.stringify({ soda: SODA_CHECKS, ge: GE_CHECKS });

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DQ Test Builder</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
    }

    /* ── Empty state ─────────────────────────────────── */
    #empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      gap: 12px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    #empty-state .icon { font-size: 48px; }

    /* ── Framework picker ────────────────────────────── */
    #framework-picker {
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .table-heading {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .table-heading span {
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .picker-prompt {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .fw-buttons { display: flex; gap: 10px; }
    .fw-btn {
      padding: 10px 24px;
      border: 1px solid var(--vscode-button-border, var(--vscode-focusBorder));
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.95em;
      font-family: inherit;
      transition: background 0.15s;
    }
    .fw-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .fw-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }

    /* ── Builder ─────────────────────────────────────── */
    #builder { display: none; flex-direction: column; gap: 0; }

    .builder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 16px;
    }
    .fw-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    .switch-link {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: underline;
      background: none;
      border: none;
      font-family: inherit;
      font-size: inherit;
      padding: 0;
    }
    .switch-link:hover { color: var(--vscode-textLink-activeForeground); }

    /* ── Column card ─────────────────────────────────── */
    .col-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .col-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background);
      cursor: pointer;
      user-select: none;
    }
    .col-header:hover { background: var(--vscode-list-hoverBackground); }
    .col-name { font-weight: 600; font-size: 0.95em; }
    .col-type {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin-left: 8px;
    }
    .col-chevron { color: var(--vscode-descriptionForeground); transition: transform 0.2s; }
    .col-card.open .col-chevron { transform: rotate(90deg); }

    .col-body {
      display: none;
      padding: 10px 12px;
      flex-direction: column;
      gap: 6px;
      background: var(--vscode-editor-background);
    }
    .col-card.open .col-body { display: flex; }

    /* ── Check row ───────────────────────────────────── */
    .check-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      background: var(--vscode-input-background);
    }
    .check-row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .check-label { font-size: 0.9em; font-weight: 500; }
    .check-desc { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 1px; }
    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--vscode-errorForeground);
      font-size: 1.1em;
      padding: 0 4px;
      line-height: 1;
    }
    .remove-btn:hover { opacity: 0.7; }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .param-label { font-size: 0.8em; color: var(--vscode-descriptionForeground); min-width: 90px; }
    .param-input {
      flex: 1;
      min-width: 80px;
      padding: 3px 7px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
    }
    .param-input:focus { outline: 1px solid var(--vscode-focusBorder); }

    /* ── Custom check ────────────────────────────────── */
    .custom-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px dashed var(--vscode-focusBorder);
      border-radius: 4px;
      background: var(--vscode-input-background);
    }
    .custom-name-input, .custom-expr-input {
      width: 100%;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
    }
    .custom-expr-input {
      resize: vertical;
      min-height: 52px;
      font-family: var(--vscode-editor-font-family);
    }
    .custom-name-input:focus, .custom-expr-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .custom-field-label {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
    }

    /* ── Add check dropdown ──────────────────────────── */
    .add-check-wrap { position: relative; }
    .add-check-btn {
      width: 100%;
      padding: 5px 10px;
      background: none;
      border: 1px dashed var(--vscode-panel-border);
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.85em;
      text-align: left;
    }
    .add-check-btn:hover { background: var(--vscode-list-hoverBackground); }

    .check-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      max-height: 260px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .dropdown-item {
      padding: 7px 12px;
      cursor: pointer;
      font-size: 0.88em;
    }
    .dropdown-item:hover { background: var(--vscode-list-hoverBackground); }
    .dropdown-item.dimmed { color: var(--vscode-disabledForeground); cursor: default; }
    .dropdown-item .item-desc {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }
    .dropdown-divider {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 4px 0;
    }

    /* ── Generate button ─────────────────────────────── */
    .generate-wrap {
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      margin-top: 8px;
    }
    .generate-btn {
      padding: 8px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.95em;
      font-weight: 600;
    }
    .generate-btn:hover { background: var(--vscode-button-hoverBackground); }
    .generate-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .generate-hint {
      margin-top: 6px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>

<!-- ── Empty state ─────────────────────────────────────── -->
<div id="empty-state">
  <div class="icon">🗃</div>
  <div>Select a table from the <strong>Data Quality</strong> sidebar</div>
  <div style="font-size:0.85em">Schemas → Tables → click any table to begin</div>
</div>

<!-- ── Framework picker ────────────────────────────────── -->
<div id="framework-picker">
  <div class="table-heading" id="picker-table-name"></div>
  <div class="picker-prompt">Choose your testing framework — checks will be tailored to your selection:</div>
  <div class="fw-buttons">
    <button class="fw-btn" id="btn-soda" onclick="pickFramework('soda')">Soda Core</button>
    <button class="fw-btn" id="btn-ge" onclick="pickFramework('ge')">Great Expectations</button>
  </div>
</div>

<!-- ── Builder ──────────────────────────────────────────── -->
<div id="builder">
  <div class="builder-header">
    <div class="table-heading" id="builder-table-name"></div>
    <div class="fw-badge">
      <span id="fw-label"></span>
      <button class="switch-link" onclick="switchFramework()">Switch</button>
    </div>
  </div>
  <div id="columns-container"></div>
  <div class="generate-wrap">
    <button class="generate-btn" id="generate-btn" onclick="generate()">Generate Tests</button>
    <div class="generate-hint">Opens the generated code in a new editor tab — save it wherever you like.</div>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  // Catalog injected from extension host
  const CATALOG = ${catalog};

  // App state
  let state = {
    table: null,       // TableInfo
    framework: null,   // 'soda' | 'ge'
    // columnName → array of { checkId, params: {} }
    checks: {},
    // columnName → array of { name, expression }
    customChecks: {},
  };

  // ── Message from extension ──────────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'loadTable') {
      loadTable(msg.table);
    }
  });

  function loadTable(table) {
    state.table = table;
    state.framework = null;
    state.checks = {};
    state.customChecks = {};

    show('framework-picker');
    document.getElementById('picker-table-name').textContent =
      table.schema + '.' + table.table + ' (' + table.columns.length + ' columns)';
  }

  function pickFramework(fw) {
    state.framework = fw;
    buildUI();
    show('builder');
  }

  function switchFramework() {
    const confirmSwitch = confirm('Switching framework will clear all selected checks. Continue?');
    if (!confirmSwitch) return;
    state.checks = {};
    state.customChecks = {};
    state.framework = null;
    show('framework-picker');
  }

  function show(id) {
    ['empty-state','framework-picker','builder'].forEach(i => {
      document.getElementById(i).style.display = i === id
        ? (i === 'builder' || i === 'framework-picker' ? 'flex' : 'flex')
        : 'none';
    });
  }

  // ── Build column UI ────────────────────────────────────────────────────
  function buildUI() {
    const fw = state.framework;
    document.getElementById('fw-label').textContent =
      fw === 'soda' ? 'Soda Core' : 'Great Expectations';
    document.getElementById('builder-table-name').textContent =
      state.table.schema + '.' + state.table.table;

    const container = document.getElementById('columns-container');
    container.innerHTML = '';

    for (const col of state.table.columns) {
      if (!state.checks[col.name]) state.checks[col.name] = [];
      if (!state.customChecks[col.name]) state.customChecks[col.name] = [];
      container.appendChild(buildColumnCard(col));
    }
  }

  function buildColumnCard(col) {
    const card = document.createElement('div');
    card.className = 'col-card';
    card.id = 'card-' + col.name;

    // Header
    const header = document.createElement('div');
    header.className = 'col-header';
    header.innerHTML =
      '<div><span class="col-name">' + escHtml(col.name) + '</span>' +
      '<span class="col-type">' + escHtml(col.rawType) + '</span></div>' +
      '<span class="col-chevron">›</span>';
    header.addEventListener('click', () => {
      card.classList.toggle('open');
      renderChecks(col);
    });

    const body = document.createElement('div');
    body.className = 'col-body';
    body.id = 'body-' + col.name;

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  function renderChecks(col) {
    const body = document.getElementById('body-' + col.name);
    body.innerHTML = '';

    const checks = state.checks[col.name] || [];
    const customs = state.customChecks[col.name] || [];

    // Existing checks
    checks.forEach((chk, idx) => {
      const def = getCatalog().find(d => d.id === chk.checkId);
      if (!def) return;
      body.appendChild(buildCheckRow(col, chk, def, idx));
    });

    // Custom checks
    customs.forEach((c, idx) => {
      body.appendChild(buildCustomRow(col, c, idx));
    });

    // Add check button + dropdown
    const wrap = document.createElement('div');
    wrap.className = 'add-check-wrap';

    const btn = document.createElement('button');
    btn.className = 'add-check-btn';
    btn.textContent = '+ Add check';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleDropdown(col, wrap, btn);
    });

    wrap.appendChild(btn);
    body.appendChild(wrap);
  }

  function buildCheckRow(col, chk, def, idx) {
    const row = document.createElement('div');
    row.className = 'check-row';

    const top = document.createElement('div');
    top.className = 'check-row-top';
    top.innerHTML =
      '<div><div class="check-label">' + escHtml(def.label) + '</div>' +
      '<div class="check-desc">' + escHtml(def.description) + '</div></div>';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove check';
    removeBtn.addEventListener('click', () => {
      state.checks[col.name].splice(idx, 1);
      renderChecks(col);
    });
    top.appendChild(removeBtn);
    row.appendChild(top);

    // Params
    for (const param of def.params) {
      const paramRow = document.createElement('div');
      paramRow.className = 'param-row';
      paramRow.innerHTML = '<span class="param-label">' + escHtml(param.label) + '</span>';

      const input = document.createElement('input');
      input.className = 'param-input';
      input.type = param.type === 'number' || param.type === 'percentage' ? 'number' : 'text';
      input.placeholder = param.placeholder || '';
      input.value = chk.params[param.name] || '';
      input.addEventListener('input', () => {
        chk.params[param.name] = input.value;
      });

      paramRow.appendChild(input);
      row.appendChild(paramRow);
    }

    return row;
  }

  function buildCustomRow(col, customChk, idx) {
    const fw = state.framework;
    const placeholder = fw === 'soda'
      ? 'e.g.  amount < 0 OR amount > 999999'
      : 'e.g.  amount >= 0 & amount < 999999';

    const row = document.createElement('div');
    row.className = 'custom-row';

    const top = document.createElement('div');
    top.className = 'check-row-top';
    top.innerHTML = '<div class="check-label">Custom check</div>';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.customChecks[col.name].splice(idx, 1);
      renderChecks(col);
    });
    top.appendChild(removeBtn);
    row.appendChild(top);

    // Name field
    row.innerHTML += '<div class="custom-field-label">Name <span style="color:var(--vscode-errorForeground)">*</span></div>';
    const nameInput = document.createElement('input');
    nameInput.className = 'custom-name-input';
    nameInput.placeholder = 'e.g. "Revenue cannot be negative"';
    nameInput.value = customChk.name || '';
    nameInput.addEventListener('input', () => {
      customChk.name = nameInput.value;
    });
    row.appendChild(nameInput);

    // Expression field
    const exprLabel = document.createElement('div');
    exprLabel.className = 'custom-field-label';
    exprLabel.textContent = fw === 'soda' ? 'Fail condition (SodaCL)' : 'Row condition (pandas)';
    row.appendChild(exprLabel);

    const exprInput = document.createElement('textarea');
    exprInput.className = 'custom-expr-input';
    exprInput.placeholder = placeholder;
    exprInput.value = customChk.expression || '';
    exprInput.addEventListener('input', () => {
      customChk.expression = exprInput.value;
    });
    row.appendChild(exprInput);

    return row;
  }

  // ── Dropdown ──────────────────────────────────────────────────────────
  let activeDropdown = null;

  function toggleDropdown(col, wrap, btn) {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
      return;
    }

    const dd = document.createElement('div');
    dd.className = 'check-dropdown';
    activeDropdown = dd;

    const catalog = getCatalog();
    const existingIds = (state.checks[col.name] || []).map(c => c.checkId);

    for (const def of catalog) {
      const applicable = def.applies === 'all' || def.applies.includes(col.category);
      const alreadyAdded = existingIds.includes(def.id);

      const item = document.createElement('div');
      item.className = 'dropdown-item' + (!applicable || alreadyAdded ? ' dimmed' : '');

      item.innerHTML =
        '<div>' + escHtml(def.label) + (alreadyAdded ? ' ✓' : '') + '</div>' +
        '<div class="item-desc">' + escHtml(def.description) + '</div>';

      if (applicable && !alreadyAdded) {
        item.addEventListener('click', () => {
          addCheck(col, def);
          dd.remove();
          activeDropdown = null;
        });
      }
      dd.appendChild(item);
    }

    // Divider + Custom
    const divider = document.createElement('hr');
    divider.className = 'dropdown-divider';
    dd.appendChild(divider);

    const customItem = document.createElement('div');
    customItem.className = 'dropdown-item';
    customItem.innerHTML = '<div>Custom check</div><div class="item-desc">Write your own condition with a name</div>';
    customItem.addEventListener('click', () => {
      addCustomCheck(col);
      dd.remove();
      activeDropdown = null;
    });
    dd.appendChild(customItem);

    wrap.appendChild(dd);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function handler() {
        dd.remove();
        activeDropdown = null;
        document.removeEventListener('click', handler);
      }, { once: true });
    }, 0);
  }

  function addCheck(col, def) {
    if (!state.checks[col.name]) state.checks[col.name] = [];
    const params = {};
    for (const p of def.params) params[p.name] = '';
    state.checks[col.name].push({ checkId: def.id, params });
    const card = document.getElementById('card-' + col.name);
    if (!card.classList.contains('open')) card.classList.add('open');
    renderChecks(col);
  }

  function addCustomCheck(col) {
    if (!state.customChecks[col.name]) state.customChecks[col.name] = [];
    state.customChecks[col.name].push({ name: '', expression: '' });
    const card = document.getElementById('card-' + col.name);
    if (!card.classList.contains('open')) card.classList.add('open');
    renderChecks(col);
  }

  // ── Generate ──────────────────────────────────────────────────────────
  function generate() {
    const allChecks = [];
    const allCustom = [];

    for (const col of state.table.columns) {
      for (const c of (state.checks[col.name] || [])) {
        allChecks.push({ columnName: col.name, checkId: c.checkId, params: c.params });
      }
      for (const c of (state.customChecks[col.name] || [])) {
        if (!c.name.trim() || !c.expression.trim()) {
          alert('Every custom check needs both a Name and a condition. Please complete all custom checks first.');
          return;
        }
        allCustom.push({ columnName: col.name, name: c.name, expression: c.expression });
      }
    }

    if (allChecks.length === 0 && allCustom.length === 0) {
      alert('No checks selected yet. Add at least one check before generating.');
      return;
    }

    vscode.postMessage({
      type: 'generate',
      framework: state.framework,
      table: state.table,
      checks: allChecks,
      customChecks: allCustom,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function getCatalog() {
    return state.framework === 'soda' ? CATALOG.soda : CATALOG.ge;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
</script>
</body>
</html>`;
  }

  dispose() {
    TestBuilderPanel.instance = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
