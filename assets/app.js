
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
      const to = Number((el.textContent || '').replace(/[^\d.]/g, ''));
      if (!Number.isFinite(to)) return;
      el.textContent = '0';
      const started = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - started) / 650);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased);
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = String(to);
      }
      requestAnimationFrame(frame);
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
  const AI_PRIOS = [
    { key: 'hdt', label: '耐温', short: 'HDT', unit: '°C', dir: 1, theme: '#E8590C', ink: '#fff' },
    { key: 'strength', label: '强度', short: '强度', unit: 'MPa', dir: 1, theme: '#2AAEC6', ink: '#062C33' },
    { key: 'stiffness', label: '刚度', short: '模量', unit: 'MPa', dir: 1, theme: '#7C20A3', ink: '#fff' },
    { key: 'toughness', label: '韧性', short: '韧性', unit: 'kJ/m²', dir: 1, theme: '#2E9E5B', ink: '#fff' },
    { key: 'water', label: '低吸水', short: '吸水', unit: '%', dir: -1, theme: '#0A7EA4', ink: '#fff' },
    { key: 'shrink', label: '低收缩', short: '收缩', unit: '%', dir: -1, theme: '#0A7EA4', ink: '#fff' },
    { key: 'density', label: '轻量', short: '密度', unit: 'g/cm³', dir: -1, theme: '#044792', ink: '#fff' },
    { key: 'mfi', label: '高流动', short: '熔指', unit: 'g/10min', dir: 1, theme: '#DA291C', ink: '#fff' },
  ];
  const aiState = new Set(['hdt', 'strength']);
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
        const vals = PRODUCTS.map(x => x[prio.key]).filter(v => typeof v === 'number');
        if (!vals.length || typeof p[prio.key] !== 'number') return;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        let n = hi > lo ? (p[prio.key] - lo) / (hi - lo) : 0.5;
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
        .map(p => `${UI.SHORT?.[p.key] || p.short} ${fmt(r.p[p.key], p.unit)}`).join(' · ') || '综合评分';
      return `<div class="ai-result ${i === 0 ? 'top' : ''}" data-idx="${r.idx}">
        <div class="ai-rank">${i + 1}</div>
        <div class="ai-r-main"><div class="ai-r-name" style="color:${ths[r.idx]?.querySelector('.pm')?.style.getPropertyValue('--product-color') || 'inherit'}">${r.p.model}<small style="color:${ths[r.idx]?.querySelector('.pc')?.style.getPropertyValue('--product-color') || 'inherit'}">${all[r.idx]?.color || r.p.color}</small></div>
        <div class="ai-r-stats">${stats}</div></div>
        <div class="ai-score">${r.score}</div>
        <button class="ai-add" type="button" data-ai-pick="${r.idx}">${UI.ADD || '加入对比'}</button>
      </div>`;
    }).join('');
    aiNote.textContent = `${UI.TOP_LABEL || 'Top'} ${n} / ${PRODUCTS.length} · ${UI.NOTE || '本地排序'}`;
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
    aiPanel.style.overflow = 'hidden';
    const anim = aiPanel.animate([
      { height: first.height + 'px', width: first.width + 'px' },
      { height: last.height + 'px', width: last.width + 'px' }
    ], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
    anim.onfinish = () => {
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
    requestAnimationFrame(() => aiModal.classList.add('open'));
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
    const delay = REDUCED ? 0 : 320;
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

  const AI_ENDPOINT = document.querySelector('meta[name="ipcon-ai-endpoint"]')?.content?.trim() || '';
  const chatLog = document.getElementById('aiChatLog');
  chatLog?.addEventListener('scroll', updateChatScrollState, { passive: true });
  const chatForm = document.getElementById('aiChatForm');
  const chatInput = document.getElementById('aiChatInput');
  const chatSuggest = document.getElementById('aiChatSuggest');
  const isCN = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');

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
    if (source) {
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
    return PRODUCTS.map(p =>
      `${p.model} | color:${p.color} | HDT:${p.hdt} | strength:${p.strength} | stiffness:${p.stiffness} | toughness:${p.toughness} | water:${p.water} | shrink:${p.shrink} | density:${p.density} | MFI:${p.mfi} | AMS:${p.ams}`
    ).join('\n');
  }

  function ensureChat() {
    if (!chatLog || chatLog.children.length) return;
    addChat('bot', isCN ? '可以直接问表内数据，比如：耐温最高的三款？最韧的是哪几款？' : 'Ask about the table data, e.g. Top 3 for heat? Which are toughest?', isCN ? '本地数据' : 'Local data');
    chatSuggest.innerHTML = '';
    (UI.CHAT_SUGGEST || []).forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => submitQuestion(text));
      chatSuggest.appendChild(b);
    });
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
    const pending = addChat('bot', isCN ? '正在连接 DeepSeek…' : 'Connecting to DeepSeek…', '', false);
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
          body: JSON.stringify({ question, context: buildAIContext() }),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const before = aiPanel ? aiPanel.getBoundingClientRect() : null;
      pending.textContent = data.answer || data.error || local;
      if (!REDUCED) pending.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      const src = document.createElement('span'); src.className = 'src'; src.textContent = 'DeepSeek'; pending.appendChild(src);
      animatePanelFrom(before);
      scrollPanelToBottom();
    } catch (e) {
      pending.textContent = local;
      const src = document.createElement('span'); src.className = 'src'; src.textContent = isCN ? '本地数据 · AI 不可用' : 'Local data · AI unavailable'; pending.appendChild(src);
    }
  }

  chatInput?.addEventListener('focus', scrollPanelToBottom);

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
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !aiModal.hidden) closeAI(); });

  load();
  build();
  apply(true);
  initCountUps();
  if ('requestIdleCallback' in window) requestIdleCallback(prewarmAI, { timeout: 1200 });
  else setTimeout(prewarmAI, 500);
})();