(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    engine: $('engineSelect'),
    mode: $('modeSelect'),
    category: $('categorySelect'),
    input: $('userInput'),
    execute: $('executeBtn'),
    generate: $('generateBtn'),
    random: $('randomBtn'),
    help: $('helpBtn'),
    helpClose: $('helpClose'),
    helpOverlay: $('helpOverlay'),
    guide: $('operatorGuideBody'),
    dorkText: $('dorkText'),
    variantList: $('variantList'),
    variantBadge: $('variantCountBadge'),
    historyList: $('historyList'),
    analysisGrid: $('analysisGrid'),
    loading: $('loadingEl'),
    openMain: $('openMainBtn'),
    copyPrimary: $('copyPrimaryBtn'),
    copyAll: $('copyAllBtn'),
    exportTxt: $('exportTxtBtn'),
    exportJson: $('exportJsonBtn'),
    clear: $('clearBtn'),
    clearHistory: $('clearHistoryBtn'),
    toast: $('toast'),
    themeToggle: $('themeToggle')
  };

  let currentVariants = [];
  let currentMeta = null;
  let runtimeHistory = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function stripProtocol(value) {
    return normalizeSpaces(value)
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/g, '')
      .replace(/[?#].*$/g, '')
      .trim();
  }

  function isDomain(value) {
    const cleaned = stripProtocol(value);
    return /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/.test(cleaned);
  }

  function removeFillerWords(raw) {
    let text = normalizeSpaces(raw).toLowerCase();
    if (Array.isArray(window.FILLER_WORDS)) {
      window.FILLER_WORDS.forEach((word) => {
        const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`\\b${safe}\\b`, 'gi'), ' ');
      });
    }
    return normalizeSpaces(text) || normalizeSpaces(raw);
  }

  function parseTarget(raw) {
    const input = normalizeSpaces(raw);
    const cleanedInput = removeFillerWords(input);
    const domainCandidate = stripProtocol(cleanedInput.split(' ')[0]);
    const domain = isDomain(domainCandidate) ? domainCandidate.toLowerCase() : '';
    const target = domain || cleanedInput || input;
    const keyword = domain ? normalizeSpaces(cleanedInput.replace(domainCandidate, '')) || domain.split('.')[0] : target;

    return {
      input,
      target,
      domain,
      keyword,
      targetType: domain ? 'Domain' : target.includes(' ') ? 'Topic / Phrase' : 'Keyword'
    };
  }

  function detectCategory(parsed) {
    const selected = els.category.value;
    if (selected && selected !== 'auto') return selected;

    const mode = els.mode.value;
    if (window.MODE_TO_CATEGORY && window.MODE_TO_CATEGORY[mode]) return window.MODE_TO_CATEGORY[mode];

    if (parsed.domain && mode === 'domain_recon') return 'domain_research';

    const text = `${parsed.input} ${parsed.target}`.toLowerCase();
    let best = { cat: parsed.domain ? 'domain_research' : 'documents', score: 0 };

    (window.INTENT_PATTERNS || []).forEach((pattern) => {
      const hits = pattern.keywords.reduce((count, keyword) => {
        return count + (text.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
      const score = hits * (pattern.weight || 1);
      if (score > best.score) best = { cat: pattern.cat, score };
    });

    return best.cat || 'documents';
  }

  function getCategoryLabel(key) {
    return window.CATEGORIES?.[key]?.label || key.replaceAll('_', ' ');
  }

  function getModeLabel(key) {
    return window.MODE_DEFINITIONS?.[key]?.label || key.replaceAll('_', ' ');
  }

  function fillTemplate(template, parsed) {
    return template
      .replaceAll('{{target}}', parsed.target)
      .replaceAll('{{domain}}', parsed.domain || parsed.target)
      .replaceAll('{{keyword}}', parsed.keyword || parsed.target)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function baseTemplatesFor(parsed, categoryKey) {
    const selectedCategory = window.CATEGORIES?.[categoryKey];
    const templates = selectedCategory?.templates ? [...selectedCategory.templates] : [];

    if (templates.length < 12) {
      const fallbackKeys = parsed.domain
        ? ['domain_research', 'documents', 'technical_docs', 'reports']
        : ['documents', 'technical_docs', 'reports', 'code_research', 'news_mentions'];
      fallbackKeys.forEach((key) => {
        if (key !== categoryKey && window.CATEGORIES?.[key]?.templates) {
          templates.push(...window.CATEGORIES[key].templates.slice(0, 4));
        }
      });
    }

    return templates;
  }

  function generateVariants() {
    const parsed = parseTarget(els.input.value);
    if (!parsed.input) {
      showToast('Enter a target first', true);
      els.input.focus();
      return [];
    }

    const categoryKey = detectCategory(parsed);
    const modeKey = els.mode.value;
    const engineKey = els.engine.value;
    const templates = baseTemplatesFor(parsed, categoryKey);
    const seen = new Set();

    const variants = templates.map((tpl) => {
      const query = fillTemplate(tpl.t, parsed);
      const normalized = query.toLowerCase();
      if (!query || seen.has(normalized)) return null;
      seen.add(normalized);
      return {
        title: tpl.title || 'Generated Query',
        purpose: tpl.p || 'Public research query',
        query,
        type: tpl.type || 'query',
        sensitivity: tpl.s || 'medium',
        categoryKey,
        categoryLabel: getCategoryLabel(categoryKey),
        engineKey,
        modeKey
      };
    }).filter(Boolean).slice(0, 15);

    currentMeta = {
      parsed,
      categoryKey,
      categoryLabel: getCategoryLabel(categoryKey),
      modeKey,
      modeLabel: getModeLabel(modeKey),
      engineKey,
      engineLabel: engineKey.charAt(0).toUpperCase() + engineKey.slice(1),
      generatedAt: new Date()
    };

    currentVariants = variants;
    renderPrimary();
    renderVariants();
    renderAnalysis();
    pushHistory();
    showToast(`Generated ${variants.length} variants`);
    return variants;
  }

  function renderPrimary() {
    const primary = currentVariants[0]?.query || '—';
    els.dorkText.textContent = primary;
  }

  function renderVariants() {
    els.variantBadge.textContent = String(currentVariants.length);
    if (!currentVariants.length) {
      els.variantList.innerHTML = '<div class="muted-small">No variants generated yet. Enter a target and click Generate.</div>';
      return;
    }

    els.variantList.innerHTML = currentVariants.map((item, index) => `
      <article class="card">
        <div class="card-head">
          <span class="card-index">${String(index + 1).padStart(2, '0')}</span>
          <div class="card-main">
            <div class="card-title">${escapeHtml(item.title)}</div>
            <code class="card-query">${escapeHtml(item.query)}</code>
            <p class="card-purpose">${escapeHtml(item.purpose)}</p>
            <div class="card-tags">
              <span class="card-tag is-type">${escapeHtml(item.type)}</span>
              <span class="card-tag is-category">${escapeHtml(item.categoryLabel)}</span>
              <span class="card-tag">${escapeHtml(item.sensitivity)} signal</span>
            </div>
            <div class="card-actions">
              <button class="card-btn" data-action="open" data-index="${index}" type="button">↗ Open</button>
              <button class="card-btn" data-action="copy" data-index="${index}" type="button">⧉ Copy</button>
              <button class="card-btn" data-action="load" data-index="${index}" type="button">☆ Main</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  }

  function calculateComplexity(query) {
    const operators = ['site:', 'filetype:', 'ext:', 'inurl:', 'intitle:', 'intext:', 'OR', '-', '"', '(', ')'];
    const used = operators.filter((op) => query.includes(op));
    const score = Math.min(100, 42 + used.length * 7 + Math.min(query.length / 8, 22));
    return { score: Math.round(score), used };
  }

  function estimateVolume(meta) {
    const cat = meta.categoryKey;
    if (['news_mentions', 'forums_discussions', 'public_profiles'].includes(cat)) return 'High';
    if (['documents', 'reports', 'technical_docs'].includes(cat)) return 'Medium';
    return meta.parsed.domain ? 'Focused' : 'Medium';
  }

  function renderAnalysis() {
    if (!currentMeta || !currentVariants.length) {
      els.analysisGrid.innerHTML = '<div class="ap-empty">Waiting for input.</div>';
      return;
    }

    const primary = currentVariants[0].query;
    const complexity = calculateComplexity(primary);
    const operatorList = complexity.used.length ? complexity.used.join(', ') : 'Basic keywords';

    els.analysisGrid.innerHTML = `
      <div class="ap-card">
        <span class="ap-icon">◎</span>
        <div><div class="ap-k">Detected Intent</div><div class="ap-v">${escapeHtml(currentMeta.categoryLabel)}</div><div class="ap-sub">${escapeHtml(currentMeta.modeLabel)}</div></div>
      </div>
      <div class="ap-card">
        <span class="ap-icon">◉</span>
        <div><div class="ap-k">Target Type</div><div class="ap-v">${escapeHtml(currentMeta.parsed.targetType)}</div><div class="ap-sub">${escapeHtml(currentMeta.parsed.target)}</div></div>
      </div>
      <div class="ap-card">
        <span class="ap-icon">▥</span>
        <div><div class="ap-k">Complexity Score</div><div class="ap-v">${complexity.score}/100</div><div class="ap-sub">${escapeHtml(operatorList)}</div></div>
      </div>
      <div class="ap-card">
        <span class="ap-icon">▰</span>
        <div><div class="ap-k">Est. Results</div><div class="ap-v">${escapeHtml(estimateVolume(currentMeta))}</div><div class="ap-sub">${escapeHtml(currentMeta.engineLabel)} recommended</div></div>
      </div>
    `;
  }

  function pushHistory() {
    if (!currentMeta || !currentVariants.length) return;
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      target: currentMeta.parsed.input,
      meta: { ...currentMeta, generatedAt: new Date(currentMeta.generatedAt) },
      variants: currentVariants.map((variant) => ({ ...variant }))
    };
    runtimeHistory = [item, ...runtimeHistory.filter((entry) => entry.target !== item.target)].slice(0, 12);
    renderHistory();
  }

  function renderHistory() {
    if (!runtimeHistory.length) {
      els.historyList.innerHTML = '<div class="muted-small">No history yet.</div>';
      return;
    }

    els.historyList.innerHTML = runtimeHistory.map((item, index) => {
      const time = new Date(item.meta.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `
        <article class="h-item">
          <div class="h-item-input">${escapeHtml(item.target)}</div>
          <div class="h-meta">
            <span>${escapeHtml(item.meta.engineLabel)}</span>
            <span>• ${escapeHtml(item.meta.modeLabel)}</span>
            <span>• ${escapeHtml(item.meta.categoryLabel)}</span>
            <span>${escapeHtml(time)}</span>
          </div>
          <div class="h-actions">
            <button class="h-btn" data-history="load" data-index="${index}" type="button">Load</button>
            <button class="h-btn" data-history="open" data-index="${index}" type="button">Open</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function restoreHistory(index) {
    const item = runtimeHistory[index];
    if (!item) return;
    currentMeta = item.meta;
    currentVariants = item.variants.map((variant) => ({ ...variant }));
    els.input.value = item.target;
    els.engine.value = item.meta.engineKey;
    els.mode.value = item.meta.modeKey;
    els.category.value = item.meta.categoryKey;
    renderPrimary();
    renderVariants();
    renderAnalysis();
    showToast('History loaded');
  }

  async function copyText(text) {
    if (!text || text === '—') {
      showToast('Nothing to copy', true);
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      showToast('Copied');
    } catch (error) {
      showToast('Copy failed', true);
    }
  }

  function openSearch(query) {
    if (!query || query === '—') {
      showToast('Generate a dork first', true);
      return;
    }
    const engine = els.engine.value;
    const base = window.ENGINES?.[engine] || window.ENGINES?.google || 'https://www.google.com/search?q=';
    window.open(`${base}${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }

  function exportFile(kind) {
    if (!currentVariants.length || !currentMeta) {
      showToast('Generate variants first', true);
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTarget = currentMeta.parsed.target.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 36) || 'target';
    let filename = `dork-forge-${safeTarget}-${stamp}.${kind}`;
    let content = '';
    let type = 'text/plain;charset=utf-8';

    if (kind === 'json') {
      type = 'application/json;charset=utf-8';
      content = JSON.stringify({ meta: currentMeta, variants: currentVariants }, null, 2);
    } else {
      content = [
        'DORK FORGE v5 — Export',
        `Target: ${currentMeta.parsed.input}`,
        `Engine: ${currentMeta.engineLabel}`,
        `Mode: ${currentMeta.modeLabel}`,
        `Category: ${currentMeta.categoryLabel}`,
        `Generated: ${new Date().toLocaleString()}`,
        '',
        ...currentVariants.map((variant, index) => `${index + 1}. ${variant.title}\n${variant.query}\nPurpose: ${variant.purpose}\n`)
      ].join('\n');
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`${kind.toUpperCase()} exported`);
  }

  function clearCurrent() {
    currentVariants = [];
    currentMeta = null;
    els.input.value = '';
    els.dorkText.textContent = '—';
    els.variantBadge.textContent = '0';
    els.variantList.innerHTML = '<div class="muted-small">No variants generated yet. Enter a target and click Generate.</div>';
    els.analysisGrid.innerHTML = '<div class="ap-empty">Waiting for input.</div>';
    showToast('Cleared');
  }

  function populateGuide() {
    const operatorRows = (window.OPERATORS || []).map((op) => `
      <div class="op-item">
        <code>${escapeHtml(op.op)}</code>
        <div>
          <div class="op-desc">${escapeHtml(op.desc)}</div>
          <div class="op-example">Example: ${escapeHtml(op.ex)}</div>
        </div>
      </div>
    `).join('');

    const modeRows = Object.entries(window.MODE_DEFINITIONS || {}).map(([key, mode]) => `
      <div class="op-item">
        <code>${escapeHtml(mode.label || key)}</code>
        <div class="op-desc">${escapeHtml(mode.desc || '')}</div>
      </div>
    `).join('');

    els.guide.innerHTML = `
      <div class="op-group">
        <h4>Search Operators</h4>
        ${operatorRows || '<div class="muted-small">No operator data found.</div>'}
      </div>
      <div class="op-group">
        <h4>Modes</h4>
        ${modeRows || '<div class="muted-small">No mode data found.</div>'}
      </div>
      <div class="op-note">This tool is for authorized OSINT and public research only. It does not scan, exploit, brute force, or attack systems.</div>
    `;
  }

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('err', Boolean(isError));
    els.toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function setLoading(active) {
    els.loading.classList.toggle('show', Boolean(active));
  }

  function runGenerate(openAfter = false) {
    setLoading(true);
    window.setTimeout(() => {
      const variants = generateVariants();
      setLoading(false);
      if (openAfter && variants.length) openSearch(variants[0].query);
    }, 120);
  }

  els.generate.addEventListener('click', () => runGenerate(false));
  els.execute.addEventListener('click', () => runGenerate(true));
  els.openMain.addEventListener('click', () => openSearch(currentVariants[0]?.query));
  els.copyPrimary.addEventListener('click', () => copyText(currentVariants[0]?.query));
  els.copyAll.addEventListener('click', () => copyText(currentVariants.map((item, index) => `${index + 1}. ${item.query}`).join('\n')));
  els.exportTxt.addEventListener('click', () => exportFile('txt'));
  els.exportJson.addEventListener('click', () => exportFile('json'));
  els.clear.addEventListener('click', clearCurrent);
  els.clearHistory.addEventListener('click', () => {
    runtimeHistory = [];
    renderHistory();
    showToast('Runtime history cleared');
  });

  els.random.addEventListener('click', () => {
    const samples = window.SAMPLE_TARGETS || ['example.com', 'cybersecurity notes', 'linux tutorial'];
    els.input.value = samples[Math.floor(Math.random() * samples.length)];
    runGenerate(false);
  });

  els.variantList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const item = currentVariants[index];
    if (!item) return;
    if (button.dataset.action === 'open') openSearch(item.query);
    if (button.dataset.action === 'copy') copyText(item.query);
    if (button.dataset.action === 'load') {
      currentVariants = [item, ...currentVariants.filter((_, idx) => idx !== index)];
      renderPrimary();
      renderVariants();
      renderAnalysis();
      showToast('Set as primary');
    }
  });

  els.historyList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-history]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.history === 'load') restoreHistory(index);
    if (button.dataset.history === 'open') openSearch(runtimeHistory[index]?.variants?.[0]?.query);
  });

  els.help.addEventListener('click', () => {
    populateGuide();
    els.helpOverlay.classList.add('show');
  });
  els.helpClose.addEventListener('click', () => els.helpOverlay.classList.remove('show'));
  els.helpOverlay.addEventListener('click', (event) => {
    if (event.target === els.helpOverlay) els.helpOverlay.classList.remove('show');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') els.helpOverlay.classList.remove('show');
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runGenerate(false);
  });

  els.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    els.themeToggle.textContent = document.body.classList.contains('light') ? '☾' : '☀';
  });

  els.input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runGenerate(false);
  });

  renderHistory();
  populateGuide();
})();
