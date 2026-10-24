(() => {
  const table = document.querySelector('table.grid');
  if (!table) return;
  const vp = document.querySelector('.table-viewport');
  if (vp) vp.addEventListener('scroll', () => vp.classList.toggle('scrolled', vp.scrollTop > 4), { passive: true });
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COUNT_MS = 800;

  function animateNodeValue(node, to, decimals) {
    const started = performance.now();
    const startVal = 0;
    function frame(now) {
      const t = Math.min(1, (now - started) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      node.nodeValue = node.nodeValue.replace(/-?\d+(?:\.\d+)?/, (startVal + (to - startVal) * eased).toFixed(decimals));
      if (t < 1) requestAnimationFrame(frame);
      else node.nodeValue = node.nodeValue.replace(/-?\d+(?:\.\d+)?/, to.toFixed(decimals));
    }
    requestAnimationFrame(frame);
  }

  function animateBar(cell) {
    if (REDUCED) return;
    const bar = cell.querySelector('.bar i, .relbar i');
    if (!bar || bar.dataset.animated === '1') return;
    bar.dataset.animated = '1';
    const targetW = bar.dataset.targetWidth || bar.style.width || '0%';
    bar.dataset.targetWidth = targetW;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth;
    // two frames: let the zero-width state paint first, then animate to target
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = 'width .8s cubic-bezier(.2,.7,.2,1)';
        bar.style.width = targetW;
      });
    });
  }

  function fadeThresholdNote(cell) {
    const vt = cell.querySelector('.vt');
    if (!vt || REDUCED) return;
    const noteRe = /（不断）|\(no break\)/;
    const walker = document.createTreeWalker(vt, NodeFilter.SHOW_TEXT);
    let node = null;
    while (walker.nextNode()) {
      if (noteRe.test(walker.currentNode.nodeValue)) { node = walker.currentNode; break; }
    }
    if (!node) return;
    const note = node.nodeValue.match(noteRe)[0];
    const span = document.createElement('span');
    span.className = 'threshold-note';
    span.textContent = note;
    node.nodeValue = node.nodeValue.replace(note, '');
    node.parentNode.insertBefore(span, node.nextSibling);
    requestAnimationFrame(() => requestAnimationFrame(() => span.classList.add('show')));
  }

  function countCell(cell) {
    if (!cell || cell.dataset.counted === '1') return;
    animateBar(cell);
    const vt = cell.querySelector('.vt');
    if (!vt) return;
    const raw = (vt.textContent || '').trim();
    if (!raw || raw.includes('\n') || /^(N\/A|—|-|不断|no break)$/i.test(raw)) return;

    // Threshold values ("> 125.0", "> 124.0") keep the number static:
    // animate the bar and fade the "no break" annotation instead.
    if (/^[>≥]/.test(raw)) {
      cell.dataset.counted = '1';
      animateBar(cell);
      fadeThresholdNote(cell);
      return;
    }

    const m = raw.match(/^([~≈]?\s*)(\d+(?:\.\d+)?)(.*)$/s);
    if (!m) return;
    const numText = m[2];
    const suffix = m[3];
    if (/^\s*[–—-]\s*\d/.test(suffix)) return;
    if (/\d/.test(suffix.replace(/g\/10\s*min|g\/10min/, ''))) return;
    if (!/^\s*(MPa|kJ|°C|%|g\/cm|g\/10|A|D|$)/i.test(suffix) && suffix.trim()) return;
    const target = Number(numText);
    if (!Number.isFinite(target)) return;
    const decimals = (numText.split('.')[1] || '').length;
    const walker = document.createTreeWalker(vt, NodeFilter.SHOW_TEXT);
    let node = null;
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes(numText)) { node = walker.currentNode; break; }
    }
    if (!node) return;
    cell.dataset.counted = '1';
    if (REDUCED) return;
    const startText = (0).toFixed(decimals);
    node.nodeValue = node.nodeValue.replace(numText, startText);
    animateNodeValue(node, target, decimals);
  }

  function initCountUps() {
    const cells = [...document.querySelectorAll('table.grid td.v')];
    if (REDUCED) { cells.forEach(c => c.dataset.counted = '1'); return; }
    const bars = [...document.querySelectorAll('table.grid .bar i, table.grid .relbar i')];
    bars.forEach(bar => {
      if (bar.dataset.targetWidth) return;
      bar.dataset.targetWidth = bar.style.width || '0%';
      bar.style.transition = 'none';
      bar.style.width = '0%';
    });
    if (!('IntersectionObserver' in window)) { cells.forEach(countCell); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { io.unobserve(en.target); countCell(en.target); }
      });
    }, { threshold: 0.12 });
    cells.forEach(c => io.observe(c));
  }

  function animateScores() {
    if (REDUCED) return;
    document.querySelectorAll('.ai-score').forEach(el => {
      // Keep the real score visible at all times; animate the arrival only.
      const to = Number((el.textContent || '').replace(/[^\d.]/g, ''));
      if (!Number.isFinite(to)) return;
      el.textContent = String(to);
      el.animate(
        [{ opacity: .35, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'ease-out' }
      );
    });
  }
  const ths = [...table.querySelectorAll('th.prod')];
  ths.forEach((th, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prod-x';
    btn.dataset.remove = String(i);
    btn.setAttribute('aria-label', (document.documentElement.lang || 'zh').startsWith('zh') ? '移除此耗材' : 'Remove this filament');
    btn.textContent = '×';
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      // Reuse the checkbox change handler so chip/table state stays in one path.
      const input = document.querySelector(`.tb-pick input[data-i="${i}"]`);
      if (input) input.click();
    });
    th.appendChild(btn);
  });
  const tableShell = document.querySelector('.table-shell');
  const tableViewport = document.querySelector('.table-viewport');
  const shadeRight = document.querySelector('.table-shade-right');
  const shadeBottom = document.querySelector('.table-shade-bottom');
  const tableHint = document.getElementById('tableHint');
  const isCNPage = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
  function updateTableEdges() {
    if (!tableViewport || !tableHint) return;
    const maxX = tableViewport.scrollWidth - tableViewport.clientWidth;
    const maxY = tableViewport.scrollHeight - tableViewport.clientHeight;
    const rightShowing = maxX > 2 && tableViewport.scrollLeft < maxX - 2;
    const bottomShowing = maxY > 2 && tableViewport.scrollTop < maxY - 2;
    shadeRight?.classList.toggle('show', rightShowing);
    shadeBottom?.classList.toggle('show', bottomShowing);
    const rightEdge = tableViewport.scrollLeft + tableViewport.clientWidth;
    const hiddenCols = [...document.querySelectorAll('th.prod')]
      .filter(th => getComputedStyle(th).display !== 'none')
      .filter(th => th.offsetLeft + th.offsetWidth > rightEdge + 2).length;
    const parts = [];
    if (hiddenCols) parts.push(isCNPage ? `→ 右侧还有 ${hiddenCols} 个耗材` : `→ ${hiddenCols} more filaments`);
    if (bottomShowing) parts.push(isCNPage ? '↓ 下方还有内容' : '↓ more below');
    tableHint.textContent = parts.join(' · ');
    tableHint.classList.toggle('show', parts.length > 0);
  }
  tableViewport?.addEventListener('scroll', updateTableEdges, { passive: true });
  window.addEventListener('resize', updateTableEdges);
  if ('ResizeObserver' in window) new ResizeObserver(updateTableEdges).observe(tableViewport);

  const picks = document.getElementById('picks');
  const count = document.getElementById('selCount');
  const search = document.getElementById('prodSearch');
  const cards = [...document.querySelectorAll('.appgrid .card')];
  cards.forEach(card => {
    const idx = +card.dataset.col;
    if (!Number.isFinite(idx)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-x';
    btn.setAttribute('aria-label', (document.documentElement.lang || 'zh').startsWith('zh') ? '移除此耗材' : 'Remove this filament');
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const input = document.querySelector(`.tb-pick input[data-i="${idx}"]`);
      if (input) input.click();
    });
    card.appendChild(btn);
  });
  const all = ths.map((th, i) => ({
    i,
    model: (th.querySelector('.pm')?.textContent || '').trim(),
    color: (th.querySelector('.pc')?.textContent || '').trim(),
    nameColor: (th.querySelector('.pm')?.style.getPropertyValue('--product-color') || (th.querySelector('.pm') ? getComputedStyle(th.querySelector('.pm')).color : '')),
    colorColor: (th.querySelector('.pc')?.style.getPropertyValue('--product-color') || (th.querySelector('.pc') ? getComputedStyle(th.querySelector('.pc')).color : '')),
  }));
  const selected = new Set(all.map(p => p.i));
  let prevSelected = new Set();
  const key = 'ipcon-web-selection';

  const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');

  function build() {
    picks.innerHTML = '';
    all.forEach(p => {
      const label = document.createElement('label');
      label.className = 'tb-pick';
      label.dataset.search = norm(p.model + ' ' + p.color);
      label.innerHTML = `<input type="checkbox" data-i="${p.i}" ${selected.has(p.i) ? 'checked' : ''}><span>${p.model}</span>`;
      picks.appendChild(label);
    });
  }

  const CARD_MS = 320;
  function applyCards() {
    cards.forEach(card => {
      const idx = +card.dataset.col;
      const show = selected.has(idx);
      const hidden = card.style.display === 'none';
      if (show) {
        if (hidden) {
          card.style.display = '';
          card.classList.add('card-enter');
          card.classList.remove('card-hidden');
          requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('card-enter')));
        } else {
          card.classList.remove('card-hidden');
        }
      } else if (!hidden) {
        card.classList.add('card-hidden');
        setTimeout(() => {
          if (!selected.has(idx)) card.style.display = 'none';
        }, CARD_MS);
      }
    });
  }

  function resetCellAnimation(cell) {
    delete cell.dataset.counted;
    const bar = cell.querySelector('.bar i, .relbar i');
    if (!bar) return;
    if (!bar.dataset.targetWidth) bar.dataset.targetWidth = bar.style.width || '0%';
    delete bar.dataset.animated;
    bar.style.transition = 'none';
    bar.style.width = '0%';
  }

  function apply(fromLoad = false) {
    const newly = [...selected].filter(i => !prevSelected.has(i));
    document.querySelectorAll('[data-col]').forEach(el => {
      el.style.display = selected.has(+el.dataset.col) ? '' : 'none';
    });
    [...picks.children].forEach((el, i) => el.classList.toggle('off', !selected.has(i)));
    applyCards();
    prevSelected = new Set(selected);
    requestAnimationFrame(updateTableEdges);
    if (!fromLoad && newly.length) {
      requestAnimationFrame(() => {
        newly.forEach(i => {
          document.querySelectorAll(`td.v[data-col="${i}"]`).forEach(cell => {
            resetCellAnimation(cell);
            countCell(cell);
          });
        });
      });
    }
    count.textContent = `${UI.SELECTED || '已选'} ${selected.size} / ${all.length}`;
    const empty = document.getElementById('emptyState');
    if (empty) { empty.hidden = selected.size > 0; empty.textContent = UI.EMPTY || '未选择耗材，请勾选产品或点「全选」'; }
    if (!fromLoad) {
      const q = selected.size === all.length ? '' : '?p=' + [...selected].join(',');
      history.replaceState(null, '', location.pathname + q);
      try { localStorage.setItem(key, [...selected].join(',')); } catch (e) {}
    }
  }

  function load() {
    const url = new URL(location.href);
    let raw = url.searchParams.get('p');
    if (raw) {
      selected.clear();
      raw.split(',').map(Number).filter(n => n >= 0 && n < all.length).forEach(n => selected.add(n));
    } else {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          selected.clear();
          saved.split(',').map(Number).filter(n => n >= 0 && n < all.length).forEach(n => selected.add(n));
        }
      } catch (e) {}
    }
    if (!selected.size) {
      const compact = window.matchMedia('(max-width: 760px)').matches;
      const n = compact ? Math.min(6, all.length) : all.length;
      selected.clear();
      for (let i = 0; i < n; i++) selected.add(i);
    }
  }

  picks.addEventListener('change', e => {
    const i = +e.target.dataset.i;
    if (e.target.checked) selected.add(i); else selected.delete(i);
    build(); apply();
  });

  search.addEventListener('input', () => {
    const q = norm(search.value);
    [...picks.children].forEach(el => {
      el.style.display = !q || el.dataset.search.includes(q) ? '' : 'none';
    });
  });

  document.getElementById('selAll').addEventListener('click', () => {
    all.forEach(p => selected.add(p.i)); build(); apply();
  });
  document.getElementById('selClear').addEventListener('click', () => {
    selected.clear(); build(); apply();
  });

  const langHref = document.querySelector('.hdr-lang');
  if (langHref && location.search) langHref.href = langHref.getAttribute('href') + location.search;
  // ---- local selection assistant ----
  const UI = JSON.parse(document.getElementById('uiData')?.textContent || '{}');
  const PRODUCTS = JSON.parse(document.getElementById('productData')?.textContent || '[]');
  const AI_PRIOS = JSON.parse(document.getElementById('propertyData')?.textContent || '[]');

  const aiState = new Set();
  const aiModal = document.getElementById('aiModal');
  const aiPrios = document.getElementById('aiPriorities');
  const aiResults = document.getElementById('aiResults');
  const aiNote = document.getElementById('aiNote');
  let aiTop = [];
  let aiTopN = 3;
  const aiTopSelect = document.getElementById('aiTopN');
  function buildTopOptions() {
    if (!aiTopSelect) return;
    aiTopSelect.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${UI.TOP_BTN || 'Compare top'} ${i} ${UI.TOP_SUFFIX || ''}`.trim();
      aiTopSelect.appendChild(opt);
    }
    aiTopSelect.value = String(Math.max(1, Math.min(10, aiTopN)));
  }

  const fmt = (v, unit) => v == null ? '—' : `${Number(v).toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${unit}`;

  function buildAIPrios() {
    aiPrios.innerHTML = AI_PRIOS.map(p =>
      `<button type="button" class="ai-prio ${aiState.has(p.key) ? 'on' : ''}" data-ai-prio="${p.key}" style="--p-color:${p.theme};--p-ink:${p.ink}"><span class="pdot"></span>${UI.PRIOS?.[p.key] || p.label}</button>`
    ).join('');
  }

  function scoreProducts() {
    const active = AI_PRIOS.filter(p => aiState.has(p.key));
    if (!active.length) return [];
    const use = active;
    return PRODUCTS.map((p, idx) => {
      let total = 0, weight = 0;
      use.forEach(prio => {
        const vals = prio.values.filter(v => typeof v === 'number');
        const value = prio.values[idx];
        if (!vals.length || typeof value !== 'number') return;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        let n = hi > lo ? (value - lo) / (hi - lo) : 0.5;
        if (prio.dir < 0) n = 1 - n;
        total += n; weight += 1;
      });
      return { idx, p, score: weight ? Math.round(total / weight * 100) : 0 };
    }).sort((a, b) => b.score - a.score || a.idx - b.idx);
  }

  function renderAIInner() {
    const active = AI_PRIOS.filter(p => aiState.has(p.key));
    if (!active.length) {
      aiTop = [];
      aiResults.innerHTML = `<div class="ai-empty">${UI.AI_EMPTY || '请至少选择一个偏好'}</div>`;
      aiNote.textContent = UI.AI_EMPTY_NOTE || '未选择偏好';
      if (aiTopSelect) aiTopSelect.disabled = true;
      return;
    }
    if (aiTopSelect) aiTopSelect.disabled = false;
    const n = Math.max(1, Math.min(15, aiTopN || 3));
    aiTop = scoreProducts().slice(0, n);
    aiResults.innerHTML = aiTop.map((r, i) => {
      const stats = AI_PRIOS.filter(p => aiState.has(p.key)).slice(0, 3)
        .map(p => `${p.short || p.label} ${fmt(p.values[r.idx], p.unit)}`).join(' · ') || '综合评分';
      return `<div class="ai-result ${i === 0 ? 'top' : ''}" data-idx="${r.idx}">
        <div class="ai-rank">${i + 1}</div>
        <div class="ai-r-main"><div class="ai-r-name" style="color:${ths[r.idx]?.querySelector('.pm')?.style.getPropertyValue('--product-color') || 'inherit'}">${r.p.model}<small style="color:${ths[r.idx]?.querySelector('.pc')?.style.getPropertyValue('--product-color') || 'inherit'}">${all[r.idx]?.color || r.p.color}</small></div>
        <div class="ai-r-stats">${stats}</div></div>
        <div class="ai-score">${r.score}</div>
        <button class="ai-add" type="button" data-ai-pick="${r.idx}">${UI.ADD || '加入对比'}</button>
      </div>`;
    }).join('');
    aiNote.textContent = `${UI.TOP_LABEL || 'Top'} ${n} / ${PRODUCTS.length} · ${AI_ENDPOINT ? (UI.NOTE_AI || 'DeepSeek 已接入') : (UI.NOTE || '本地排序')}`;
    animateScores();
  }

  const BRAND_SPEED = 5.4;
  function syncBrandPhase() {
    const delay = -((performance.now() / 1000) % BRAND_SPEED);
    document.querySelectorAll('.ai-primary, .ai-prio.on').forEach(el => {
      el.style.animationDelay = delay.toFixed(3) + 's';
    });
  }

  const aiPanel = document.querySelector('.ai-panel');
  function animatePanelFrom(first) {
    if (!aiPanel || !first || REDUCED) return;
    const last = aiPanel.getBoundingClientRect();
    const dh = last.height - first.height;
    const dw = last.width - first.width;
    if (Math.abs(dh) < 2 && Math.abs(dw) < 2) return;
    aiPanel.getAnimations().forEach(a => a.cancel());
    aiPanel.style.overflow = 'hidden';
    const animKeep = aiPanel.animate([
      { height: first.height + 'px', width: first.width + 'px' },
      { height: last.height + 'px', width: last.width + 'px' }
    ], { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
    animKeep.onfinish = () => {
      aiPanel.style.height = '';
      aiPanel.style.width = '';
      aiPanel.style.overflow = '';
    };
  }

  const panelScroller = document.querySelector('.ai-panel-scroll');
  const scrollRail = document.getElementById('aiScrollRail');
  const scrollThumb = document.getElementById('aiScrollThumb');
  let railHideTimer = null;
  function canScrollPanel() {
    return !!panelScroller && (panelScroller.scrollHeight - panelScroller.clientHeight) > 2;
  }
  function showPanelScrollbar(ms = 1100) {
    if (!scrollRail) return;
    if (!canScrollPanel() || aiModal.hidden) {
      scrollRail.classList.remove('visible');
      return;
    }
    scrollRail.classList.add('visible');
    clearTimeout(railHideTimer);
    railHideTimer = setTimeout(() => scrollRail.classList.remove('visible'), ms);
  }
  function updatePanelScrollbar() {
    if (!panelScroller || !scrollRail || !scrollThumb) return;
    const max = panelScroller.scrollHeight - panelScroller.clientHeight;
    const show = max > 2 && !aiModal.hidden;
    if (!show) {
      scrollRail.classList.remove('visible');
      panelScroller.classList.remove('fade-top', 'fade-bottom');
      return;
    }
    const atTop = panelScroller.scrollTop <= 28;
    const atBottom = panelScroller.scrollTop >= max - 32;
    panelScroller.classList.toggle('fade-top', !atTop);
    panelScroller.classList.toggle('fade-bottom', !atBottom);
    const track = scrollRail.clientHeight;
    const th = Math.max(20, Math.min(track, track * panelScroller.clientHeight / panelScroller.scrollHeight));
    scrollThumb.style.height = th + 'px';
    scrollThumb.style.transform = `translateY(${(panelScroller.scrollTop / max) * (track - th)}px)`;
  }
  panelScroller?.addEventListener('scroll', () => { updatePanelScrollbar(); showPanelScrollbar(); }, { passive: true });
  window.addEventListener('resize', updatePanelScrollbar);
  if ('ResizeObserver' in window) {
    new ResizeObserver(updatePanelScrollbar).observe(panelScroller);
  }

  function animatePanelChange(update) {
    const first = aiPanel ? aiPanel.getBoundingClientRect() : null;
    update();
    animatePanelFrom(first);
    updatePanelScrollbar();
  }

  function renderAI() {
    animatePanelChange(() => {
      const prev = new Map([...document.querySelectorAll('.ai-result[data-idx]')].map(el => [el.dataset.idx, el.getBoundingClientRect()]));
      const apply = () => renderAIInner();
      apply();
      if (!REDUCED) {
      requestAnimationFrame(() => {
        document.querySelectorAll('.ai-result[data-idx]').forEach(el => {
          const old = prev.get(el.dataset.idx);
          if (!old) return;
          const now = el.getBoundingClientRect();
          const dx = old.left - now.left, dy = old.top - now.top;
          if (!dx && !dy) return;
          el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
            { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
        });
      });
    }
    });
  }

  let lockY = 0;
  function lockPage() {
    lockY = window.scrollY || 0;
    document.documentElement.classList.add('modal-locked');
    document.body.classList.add('modal-locked');
    document.body.style.top = `-${lockY}px`;
  }
  function unlockPage() {
    document.documentElement.classList.remove('modal-locked');
    document.body.classList.remove('modal-locked');
    document.body.style.top = '';
    window.scrollTo(0, lockY);
  }

  let closeTimer = null;
  let aiPrewarmed = false;
  function prewarmAI() {
    if (aiPrewarmed) return;
    aiPrewarmed = true;
    if (aiTopSelect && !aiTopSelect.options.length) buildTopOptions();
    if (!aiPrios.children.length) buildAIPrios();
    if (!aiResults.children.length) renderAIInner();
    ensureChat();
  }

  function openAI() {
    prewarmAI();
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    aiModal.hidden = false;
    requestAnimationFrame(() => {
      aiModal.classList.add('open');
      if (!REDUCED && aiPanel) {
        const r = aiPanel.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          aiPanel.animate([
            { width: Math.min(360, r.width) + 'px', height: Math.min(250, r.height) + 'px', opacity: 0, transform: 'translateY(12px) scale(.98)' },
            { width: r.width + 'px', height: r.height + 'px', opacity: 1, transform: 'none' }
          ], { duration: 520, easing: 'cubic-bezier(.2,.9,.2,1)' });
        }
      }
    });
    lockPage();
    syncBrandPhase();
    requestAnimationFrame(updatePanelScrollbar);
    setTimeout(() => aiModal.querySelector('.ai-prio')?.focus(), 50);
  }
  function closeAI() {
    if (aiModal.hidden) return;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    aiModal.classList.remove('open');
    clearTimeout(railHideTimer);
    scrollRail?.classList.remove('visible');
    const delay = REDUCED ? 0 : 380;
    closeTimer = setTimeout(() => {
      aiModal.hidden = true;
      closeTimer = null;
      unlockPage();
    }, delay);
  }
  function pickOnly(indices) {
    selected.clear();
    indices.forEach(i => selected.add(i));
    build(); apply();
    closeAI();
  }

  document.getElementById('assistantBtn')?.addEventListener('click', openAI);
  document.querySelector('.ai-x')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); closeAI();
  });
  aiModal?.addEventListener('click', e => {
    if (e.target.closest('[data-ai-close]')) closeAI();
    const pick = e.target.closest('[data-ai-pick]');
    if (pick) {
      selected.add(+pick.dataset.aiPick);
      build(); apply();
      closeAI();
    }
    const prio = e.target.closest('[data-ai-prio]');
    if (prio) {
      const k = prio.dataset.aiPrio;
      if (aiState.has(k)) aiState.delete(k); else aiState.add(k);
      buildAIPrios(); renderAI(); syncBrandPhase();
    }
  });

  const themeBtn = document.getElementById('themeToggle');
  function applyTheme(dark) {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    if (themeBtn) {
      const label = themeBtn.querySelector('.theme-label');
      if (label) label.textContent = dark ? '浅色' : '深色';
      themeBtn.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    }
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('ipcon-theme'); } catch (e) {}
  applyTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  themeBtn?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    applyTheme(dark);
    try { localStorage.setItem('ipcon-theme', dark ? 'dark' : 'light'); } catch (e) {}
  });

  // Hovering a vertical group label highlights the whole rowspan group,
  // not just its first row.
  (function initGroupHover() {
    const table = document.querySelector('.grid');
    if (!table) return;
    table.querySelectorAll('td.grp').forEach(cell => {
      const rows = [];
      let row = cell.closest('tr');
      const span = Number(cell.rowSpan) || 1;
      for (let i = 0; i < span && row; i++, row = row.nextElementSibling) rows.push(row);
      const extraRows = rows.slice(1);
      cell.addEventListener('mouseenter', () => extraRows.forEach(r => r.classList.add('group-row')));
      cell.addEventListener('mouseleave', () => extraRows.forEach(r => r.classList.remove('group-row')));
      // Hovering any row inside the rowspan also marks the vertical group label,
      // not just the first row that physically owns the rowspan cell.
      rows.forEach(r => {
        r.addEventListener('mouseenter', () => cell.classList.add('group-label-hover'));
        r.addEventListener('mouseleave', () => cell.classList.remove('group-label-hover'));
      });
    });
  })();
  const WIKI = JSON.parse(document.getElementById('wikiData')?.textContent || '{}');
  const wikiModal = document.getElementById('wikiModal');
  const wikiHead = document.getElementById('wikiHead');
  const wikiBody = document.getElementById('wikiBody');
  const wikiCN = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
  let wikiIndex = -1;
  let wikiReturnFocus = null;
  let wikiCloseTimer = null;
  let wikiAskProduct = null;

  const WIKI_L = wikiCN ? {
    info: '产品信息', physical: '物理性能', mechanical: '机械性能', settings: '推荐打印设置',
    features: '特点与应用', tds: '下载 TDS', ask: '问 AI 这款材料', close: '关闭',
    quick: '关键参数', source: '数据来自官方 TDS 与产品表', noTds: '暂无 TDS', method: '测试方法', site: '官网介绍', table: '表格全部参数', web: '官网产品页'
  } : {
    info: 'Product information', physical: 'Physical properties', mechanical: 'Mechanical properties',
    settings: 'Recommended printing settings', features: 'Features & applications',
    tds: 'Download TDS', ask: 'Ask AI about this material', close: 'Close',
    quick: 'Key figures', source: 'From the official TDS and product table', noTds: 'TDS unavailable', method: 'Method', site: 'Official overview', table: 'All table parameters', web: 'Product page'
  };

  const TDS_CN = {
    'Filament Diameter': '线径', 'Net Filament Weight': '净重', 'Filament Length': '长度',
    'Spool Material': '线盘材质', 'Spool Size': '线盘尺寸',
    'Density': '密度', 'Shrinkage Rate*': '收缩率', 'Surface Hardness': '表面硬度',
    'Saturated Water Absorption Rate': '饱和吸水率', 'Melt Index': '熔融指数',
    'Melting Temperature': '熔点', 'Vicar Softening Temperature': '维卡软化温度',
    'Heat Deflection Temperature': '热变形温度', 'Relative Thermal Index (RTI）': '相对热指数 (RTI)',
    'Max Continuous Service': '最高连续使用温度',
    'Tensile Strength XY': '拉伸强度 XY', 'Tensile Strength Z': '拉伸强度 Z',
    "Young's Modulus XY": '杨氏模量 XY', "Young's Modulus Z": '杨氏模量 Z',
    'Breaking Elongation Rate XY': '断裂伸长率 XY', 'Breaking Elongation Rate Z': '断裂伸长率 Z',
    'Flexural Strength XY': '弯曲强度 XY', 'Flexural Strength Z': '弯曲强度 Z',
    'Flexural Modulus XY': '弯曲模量 XY', 'Flexural Modulus Z': '弯曲模量 Z',
    'Impact Strength XY': '冲击强度 XY', 'Impact Strength Z': '冲击强度 Z',
    'Drying Settings Before Printing': '打印前干燥', 'Printing Temperature and Humidity': '打印温湿度',
    'Storage Temperature and Humidity': '存储温湿度', 'Compatible Nozzle': '兼容喷嘴',
    'Nozzle Temperature': '喷嘴温度', 'Bed Temperature': '热床温度', 'Printing Speed': '打印速度',
    'Part Cooling Fan': '部件冷却风扇', 'Enclosure': '封箱',
  };
  const localLabel = label => wikiCN ? (TDS_CN[label] || label) : label;

  function num(v) {
    const m = String(v || '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  function fact(label, value, method) {
    return `<div class="wiki-fact"><span>${esc(localLabel(label))}</span><b>${esc(value || '—')}</b>${method ? `<small>${esc(method)}</small>` : ''}</div>`;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function maxFor(label) {
    let mx = 0;
    Object.values(WIKI).forEach(w => {
      [...(w.physical || []), ...(w.mechanical || [])].forEach(x => {
        if (x.label === label) { const n = num(x.value); if (n != null) mx = Math.max(mx, n); }
      });
    });
    return mx || 1;
  }
  function quickStats(w) {
    const labels = ['Density', 'Heat Deflection Temperature', 'Tensile Strength XY', 'Flexural Modulus XY', 'Impact Strength XY', 'Saturated Water Absorption Rate'];
    const all = [...(w.physical || []), ...(w.mechanical || [])];
    return labels.map(label => {
      const item = all.find(x => x.label === label);
      if (!item) return '';
      const n = num(item.value);
      const pct = n == null ? 0 : Math.max(4, Math.min(100, n / maxFor(label) * 100));
      return `<div class="wiki-stat"><span>${esc(localLabel(label))}</span><b>${esc(item.value)}</b><i><em style="width:${pct.toFixed(1)}%"></em></i></div>`;
    }).join('');
  }
  function renderWiki(idx) {
    const p = PRODUCTS[idx];
    const d = p && WIKI[p.model];
    if (!d) return;
    const card = document.querySelectorAll('.appgrid .card')[idx];
    const color = card?.querySelector('.cmodel')?.style.getPropertyValue('--swatch-color') || '#7A7A80';
    const tds = d.tds ? encodeURI(d.tds) : '';
    wikiHead.innerHTML = `
      <div class="wiki-title-row">
        <div class="wiki-title"><i style="background:${color}"></i><h3 id="wikiTitle">${esc(d.model)}</h3><span>${esc(d.color)}</span></div>
        <div class="wiki-actions">
          ${tds ? `<a class="wiki-btn" href="${tds}" target="_blank" rel="noopener">${WIKI_L.tds} ↗</a>` : `<span class="wiki-btn disabled">${WIKI_L.noTds}</span>`}
          ${d.site?.url ? `<a class="wiki-btn" href="${esc(d.site.url)}" target="_blank" rel="noopener">${WIKI_L.web} ↗</a>` : ''}
          <button class="wiki-btn primary" type="button" data-wiki-ai="${esc(d.model)}">${WIKI_L.ask}</button>
        </div>
      </div>
      <div class="wiki-source">${WIKI_L.source}</div>`;
    const section = (title, rows) => rows?.length ? `<section class="wiki-card"><h4>${title}</h4><div class="wiki-facts">${rows.map(r => fact(r.label, r.value, r.method)).join('')}</div></section>` : '';
    const featureList = d.features_lang?.[wikiCN ? 'CN' : 'EN'] || d.features || [];
    const features = featureList?.length ? `<section class="wiki-card wide"><h4>${WIKI_L.features}</h4><div class="wiki-prose">${featureList.map(x => `<p>${esc(x)}</p>`).join('')}</div></section>` : '';
    const overview = (!wikiCN || /[\u4e00-\u9fff]/.test(d.site?.description || '')) && d.site?.description ? `<section class="wiki-card wide"><h4>${WIKI_L.site}</h4><div class="wiki-prose"><p>${esc(d.site.description)}</p><a class="wiki-inline-link" href="${esc(d.site.url)}" target="_blank" rel="noopener">${WIKI_L.web} ↗</a></div></section>` : '';
    const tableRows = (d.table?.[wikiCN ? 'CN' : 'EN'] || []).map(g => `<section class="wiki-card wide"><h4>${esc(g.label)}</h4><div class="wiki-facts wiki-facts-two">${g.rows.map(r => fact(r.label, r.value, r.detail)).join('')}</div></section>`).join('');
    wikiBody.innerHTML = `
      <section class="wiki-card wide"><h4>${WIKI_L.quick}</h4><div class="wiki-stats">${quickStats(d)}</div></section>
      ${overview}
      <div class="wiki-grid">
        ${section(WIKI_L.info, d.info)}
        ${section(WIKI_L.settings, d.settings)}
        ${section(WIKI_L.physical, d.physical)}
        ${section(WIKI_L.mechanical, d.mechanical)}
        ${features}
        ${tableRows}
      </div>`;
  }
  function openWiki(idx) {
    if (wikiCloseTimer) { clearTimeout(wikiCloseTimer); wikiCloseTimer = null; }
    wikiIndex = idx;
    renderWiki(idx);
    wikiReturnFocus = document.activeElement;
    wikiModal.hidden = false;
    requestAnimationFrame(() => wikiModal.classList.add('open'));
    lockPage();
    setTimeout(() => wikiModal.querySelector('.wiki-btn.primary')?.focus(), 50);
  }
  function closeWiki() {
    if (wikiModal.hidden) return;
    wikiModal.classList.remove('open');
    const delay = REDUCED ? 0 : 320;
    wikiCloseTimer = setTimeout(() => {
      wikiModal.hidden = true;
      wikiCloseTimer = null;
      unlockPage();
      wikiReturnFocus?.focus?.();
    }, delay);
  }
  document.querySelectorAll('.appgrid .card[data-wiki]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('a, .card-x, input, button')) return;
      openWiki(Number(card.dataset.wiki));
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWiki(Number(card.dataset.wiki)); }
    });
  });
  wikiModal?.addEventListener('click', e => {
    if (e.target.closest('[data-wiki-close]')) closeWiki();
    const ai = e.target.closest('[data-wiki-ai]');
    if (ai) {
      const model = ai.dataset.wikiAi;
      wikiAskProduct = model;
      closeWiki();
      setTimeout(() => {
        openAI();
        setTimeout(() => {
          if (!chatInput || !chatForm) return;
          chatInput.value = wikiCN ? `请介绍 ${model} 的 TDS 关键参数、应用场景和打印注意事项` : `Summarize the TDS, applications and printing tips for ${model}`;
          chatForm.requestSubmit();
        }, 400);
      }, 260);
    }
  });
  document.addEventListener('keydown', e => {
    if (wikiModal?.hidden) return;
    if (e.key === 'Escape') { closeWiki(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...wikiModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!wikiModal.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const AI_ENDPOINT = document.querySelector('meta[name="ipcon-ai-endpoint"]')?.content?.trim() || '';
  const aiDsStatus = document.getElementById('aiDsStatus');
  function setAIStatus(state, label) {
    if (!aiDsStatus) return;
    aiDsStatus.dataset.state = state;
    const em = aiDsStatus.querySelector('em');
    if (em) em.textContent = label;
  }
  async function checkAIStatus() {
    if (!AI_ENDPOINT) { setAIStatus('off', isCN ? 'DeepSeek 暂不可用' : 'DeepSeek unavailable'); return; }
    setAIStatus('checking', isCN ? '检测中' : 'Checking');
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(new URL('health', AI_ENDPOINT), { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('health');
      const data = await res.json();
      if (data.ok && data.deepseek) setAIStatus('ok', isCN ? 'DeepSeek 可用' : 'DeepSeek available');
      else setAIStatus('off', isCN ? 'DeepSeek 暂不可用' : 'DeepSeek unavailable');
    } catch (e) {
      setAIStatus('off', isCN ? 'DeepSeek 暂不可用' : 'DeepSeek unavailable');
    }
  }

  const chatLog = document.getElementById('aiChatLog');
  chatLog?.addEventListener('scroll', updateChatScrollState, { passive: true });
  const chatForm = document.getElementById('aiChatForm');
  const chatInput = document.getElementById('aiChatInput');
  const chatSuggest = document.getElementById('aiChatSuggest');
  const isCN = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
  checkAIStatus();
  setInterval(checkAIStatus, 60000);

  function updateChatScrollState() {
    if (chatLog) chatLog.classList.toggle('is-scrollable', chatLog.scrollHeight - chatLog.clientHeight > 2);
  }

  function scrollPanelToBottom() {
    if (!panelScroller || aiModal.hidden) return;
    panelScroller.scrollTo({ top: panelScroller.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function addChat(role, text, source, animate = true) {
    if (!chatLog) return null;
    const first = (animate && !aiModal.hidden && aiPanel) ? aiPanel.getBoundingClientRect() : null;
    const el = document.createElement('div');
    el.className = 'ai-msg ' + role;
    el.textContent = text;
    if (source === 'DeepSeek') {
      el.classList.add('deepseek');
      const src = document.createElement('span');
      src.className = 'src';
      src.textContent = 'DeepSeek';
      el.appendChild(src);
    } else if (source) {
      const src = document.createElement('span');
      src.className = 'src';
      src.textContent = source;
      el.appendChild(src);
    }
    chatLog.appendChild(el);
    chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' });
    updateChatScrollState();
    if (first) {
      animatePanelFrom(first);
      updatePanelScrollbar();
      scrollPanelToBottom();
    }
    return el;
  }

  function productLabel(p, i) {
    const c = all[i]?.color || p.color;
    return `${p.model}（${c}）`;
  }

  function topBy(key, dir, n) {
    return PRODUCTS.map((p, i) => ({ p, i }))
      .filter(x => typeof x.p[key] === 'number')
      .sort((a, b) => dir > 0 ? b.p[key] - a.p[key] : a.p[key] - b.p[key])
      .slice(0, n || 3);
  }

  function answerTop(key, unit, dir, title) {
    const rows = topBy(key, dir, 3);
    return `${title}\n` + rows.map((x, n) =>
      `${n + 1}. ${productLabel(x.p, x.i)} — ${x.p[key]} ${unit}`).join('\n') +
      (isCN ? '\n\n数据来自当前表格。' : '\n\nFrom the current table.');
  }

  function localAnswer(q) {
    const query = (q || '').toLowerCase();
    if (/ams|cfs/.test(query)) {
      const rows = PRODUCTS.map((p, i) => ({ p, i })).filter(x => x.p.ams).slice(0, 8);
      if (!rows.length) return isCN ? '当前表格没有标注 AMS 兼容。' : 'No AMS compatibility is listed.';
      return (isCN ? '支持 AMS / CFS 的耗材：\n' : 'AMS / CFS compatible:\n') +
        rows.map((x, n) => `${n + 1}. ${productLabel(x.p, x.i)}`).join('\n');
    }
    if (/耐温|耐热|hdt|heat/.test(query)) {
      return answerTop('hdt', '°C', 1, isCN ? '耐温最高的三款：' : 'Top 3 for heat:');
    }
    if (/韧|tough|抗摔/.test(query)) {
      return answerTop('toughness', 'kJ/m²', 1, isCN ? '韧性最好的三款：' : 'Top 3 for toughness:');
    }
    if (/刚度|模量|stiff/.test(query)) {
      return answerTop('stiffness', 'MPa', 1, isCN ? '刚度最高的三款：' : 'Top 3 for stiffness:');
    }
    if (/强度|刚性|strength/.test(query)) {
      return answerTop('strength', 'MPa', 1, isCN ? '强度最高的三款：' : 'Top 3 for strength:');
    }
    if (/吸水|water/.test(query)) {
      return answerTop('water', '%', -1, isCN ? '吸水率最低的三款：' : 'Lowest water uptake:');
    }
    if (/收缩|shrink/.test(query)) {
      return answerTop('shrink', '%', -1, isCN ? '收缩率最低的三款：' : 'Lowest shrinkage:');
    }
    if (/轻|密度|density/.test(query)) {
      return answerTop('density', 'g/cm³', -1, isCN ? '最轻的三款：' : 'Lightest three:');
    }
    if (/流动|熔指|mfi/.test(query)) {
      return answerTop('mfi', 'g/10min', 1, isCN ? '流动性最好的三款：' : 'Highest flow:');
    }
    const model = PRODUCTS.find(p => query.includes(p.model.toLowerCase()));
    if (model) {
      const i = PRODUCTS.indexOf(model);
      return `${productLabel(model, i)}\n` +
        (isCN ? `耐温 ${model.hdt ?? '—'} °C · 强度 ${model.strength ?? '—'} MPa · 韧性 ${model.toughness ?? '—'} kJ/m² · 密度 ${model.density ?? '—'} g/cm³` :
          `HDT ${model.hdt ?? '—'} °C · Strength ${model.strength ?? '—'} MPa · Toughness ${model.toughness ?? '—'} kJ/m² · Density ${model.density ?? '—'} g/cm³`);
    }
    if (/推荐|选|适合|recommend|choose|suitable/.test(query) && aiState.size) {
      const rows = scoreProducts().slice(0, 3);
      return (isCN ? '按当前偏好排序：\n' : 'By current priorities:\n') +
        rows.map((x, n) => `${n + 1}. ${productLabel(x.p, x.i)} — ${x.score} 分`).join('\n');
    }
    return isCN
      ? '我目前只能回答表内数据相关的问题。可以问：耐温最高的三款？最韧的是哪几款？哪些支持 AMS？最轻的材料？'
      : 'I can answer from this table only. Try: Top 3 for heat? Which are toughest? Which support AMS? Lightest material?';
  }

  function buildAIContext() {
    const base = PRODUCTS.map(p =>
      `${p.model} | color:${p.color} | HDT:${p.hdt} | strength:${p.strength} | stiffness:${p.stiffness} | toughness:${p.toughness} | water:${p.water} | shrink:${p.shrink} | density:${p.density} | MFI:${p.mfi} | AMS:${p.ams}`
    ).join('\n');
    const w = wikiAskProduct ? WIKI[wikiAskProduct] : null;
    if (!w) return base;
    const facts = [...(w.info || []), ...(w.physical || []), ...(w.mechanical || []), ...(w.settings || [])]
      .map(x => `${x.label}: ${x.value}${x.method ? ` (${x.method})` : ''}`).join('\n');
    return `${base}\n\nTDS ${w.model} (${w.color}):\n${facts}\n${(w.features || []).join('\n')}`;
  }

  function ensureChat() {
    if (!chatLog || chatLog.children.length) return;
    addChat('bot', isCN ? '可以直接问表内数据，比如：耐温最高的三款？最韧的是哪几款？' : 'Ask about the table data, e.g. Top 3 for heat? Which are toughest?', isCN ? 'IPCON 数据' : 'IPCON data');
    chatSuggest.innerHTML = '';
    (UI.CHAT_SUGGEST || []).forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => submitQuestion(text));
      chatSuggest.appendChild(b);
    });
  }

  function makeTypewriter(el) {
    el.textContent = '';
    const node = document.createTextNode('');
    el.appendChild(node);
    let target = '', shown = 0, finished = false, timer = null, resolveDone, lastPanel = 0, cancelled = false;
    const done = new Promise(r => { resolveDone = r; });
    let lastScroll = 0;
    function step() {
      if (cancelled) return;
      timer = null;
      if (shown < target.length) {
        const rectBefore = aiPanel ? aiPanel.getBoundingClientRect() : null;
        const remain = target.length - shown;
        const add = Math.max(1, Math.min(8, Math.ceil(remain / 90)));
        shown = Math.min(target.length, shown + add);
        node.nodeValue = target.slice(0, shown);
        const now = performance.now();
        if (rectBefore && now - lastPanel > 180) { lastPanel = now; animatePanelFrom(rectBefore); }
        if (now - lastScroll > 55) { lastScroll = now; scrollPanelToBottom(); }
        timer = setTimeout(step, 16);
      } else if (finished) {
        resolveDone();
      } else {
        timer = setTimeout(step, 35);
      }
    }
    function cancel() { cancelled = true; if (timer) clearTimeout(timer); timer = null; }
    return {
      push(t) { if (cancelled || !t) return; target += t; if (!timer) step(); },
      finish() { if (cancelled) return; finished = true; if (!timer) step(); },
      cancel,
      done,
    };
  }

  async function streamAnswer(res, pending, local) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no stream body');
    const decoder = new TextDecoder();
    let buffer = '', answer = '';
    const before = aiPanel ? aiPanel.getBoundingClientRect() : null;
    pending.classList.remove('thinking');
    pending.classList.add('deepseek');
    const typer = makeTypewriter(pending);
    pending._typerCancel = typer.cancel;
    while (true) {
      let timeoutId;
      const timed = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('stream timeout')), 12000);
      });
      let part;
      try { part = await Promise.race([reader.read(), timed]); }
      finally { clearTimeout(timeoutId); }
      if (part.done) break;
      const value = part.value;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const raw = line.trim();
        if (!raw.startsWith('data:')) continue;
        const payload = raw.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) { answer += delta; typer.push(delta); }
        } catch {}
      }
    }
    if (!answer.trim()) throw new Error('empty stream');
    typer.finish();
    await typer.done;
    pending._typerCancel = null;
    const src = document.createElement('span');
    src.className = 'src'; src.textContent = isCN ? '基于当前产品数据' : 'Based on current product data';
    pending.appendChild(src);
    setAIStatus('ok', isCN ? 'DeepSeek 可用' : 'DeepSeek available');
    animatePanelFrom(before);
    scrollPanelToBottom();
  }

  async function submitQuestion(q) {
    const question = (q || '').trim();
    if (!question) return;
    ensureChat();
    const first = aiPanel ? aiPanel.getBoundingClientRect() : null;
    addChat('user', question, '', false);
    const local = localAnswer(question);
    if (!AI_ENDPOINT) {
      addChat('bot', local, isCN ? '本地数据' : 'Local data', false);
      animatePanelFrom(first);
      updatePanelScrollbar();
      scrollPanelToBottom();
      return;
    }
    const pending = addChat('bot', isCN ? '正在思考' : 'Thinking', 'DeepSeek', false);
    pending.classList.add('thinking');
    animatePanelFrom(first);
    updatePanelScrollbar();
    scrollPanelToBottom();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      let res;
      try {
        res = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context: buildAIContext(), stream: true }),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
        await streamAnswer(res, pending, local);
        return;
      }
      const data = await res.json();
      const before = aiPanel ? aiPanel.getBoundingClientRect() : null;
      pending.classList.remove('thinking');
      pending.classList.add('deepseek');
      const typer = makeTypewriter(pending);
      typer.push(data.answer || data.error || local);
      typer.finish();
      await typer.done;
      const src = document.createElement('span');
      src.className = 'src'; src.textContent = isCN ? '基于当前产品数据' : 'Based on current product data';
      pending.appendChild(src);
      setAIStatus('ok', isCN ? 'DeepSeek 可用' : 'DeepSeek available');
      animatePanelFrom(before);
      scrollPanelToBottom();
    } catch (e) {
      console.warn('AI fallback', e);
      pending._typerCancel?.();
      pending._typerCancel = null;
      pending.classList.remove('thinking', 'deepseek');
      const before = aiPanel ? aiPanel.getBoundingClientRect() : null;
      const typer = makeTypewriter(pending);
      typer.push(local);
      typer.finish();
      await typer.done;
      const src = document.createElement('span'); src.className = 'src'; src.textContent = isCN ? '数据来自当前产品表' : 'Data from the current product table'; pending.appendChild(src);
      animatePanelFrom(before);
      scrollPanelToBottom();
    }
  }

  chatForm?.addEventListener('submit', e => {
    e.preventDefault();
    const q = chatInput.value;
    chatInput.value = '';
    submitQuestion(q);
  });

  aiTopSelect?.addEventListener('change', () => {
    aiTopN = Math.max(1, Math.min(10, parseInt(aiTopSelect.value, 10) || 3));
    const nextTop = aiState.size ? scoreProducts().slice(0, aiTopN) : [];
    renderAI(); syncBrandPhase();
    if (nextTop.length) {
      selected.clear();
      nextTop.forEach(x => selected.add(x.idx));
      build(); apply();
    }
  });
  document.addEventListener('keydown', e => {
    if (aiModal.hidden) return;
    if (e.key === 'Escape') { closeAI(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...aiModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!aiModal.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  load();
  build();
  apply(true);
  initCountUps();
  if ('requestIdleCallback' in window) requestIdleCallback(prewarmAI, { timeout: 1200 });
  else setTimeout(prewarmAI, 500);
})();
