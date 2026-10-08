// Hash routing between course dashboards + a generated, scroll-aware outline.
// Every course is an <article class="course" id="...">; every anchor inside it is
// prefixed with the course id, so a hash alone tells us which course to show.
// Outline entries come from <section data-n data-short> and their <h3>s, so a new
// course only needs that markup to get numbering and a contents tree for free.
(function () {
  const courses = [...document.querySelectorAll('article.course')];
  const tabs = [...document.querySelectorAll('.tab[data-course]')];
  const CHEVRON = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- number subsections and build the outline ----------
  courses.forEach(course => {
    const secs = [...course.querySelectorAll('section[data-short]')];
    secs.forEach(sec => {
      [...sec.querySelectorAll('h3')].forEach((h, i) => {
        h.id = h.id || `${sec.id}-${i + 1}`;
        if (sec.dataset.n && !h.querySelector('.h-num')) {
          h.insertAdjacentHTML('afterbegin', `<span class="h-num">${sec.dataset.n}.${i + 1}</span>`);
        }
      });
    });

    course.querySelectorAll('nav.outline').forEach(nav => {
      nav.innerHTML = secs.map(sec => {
        const subs = [...sec.querySelectorAll('h3')].map(h => {
          const num = h.querySelector('.h-num');
          const text = [...h.childNodes].filter(n => n !== num).map(n => n.textContent).join('').trim();
          return `<a class="o-sub${num ? '' : ' no-n'}" href="#${h.id}" data-id="${h.id}">${num ? `<span class="o-sn">${num.textContent}</span>` : ''}<span>${text}</span></a>`;
        }).join('');
        return `<div class="o-sec" data-sec="${sec.id}">
          <div class="o-row">
            <a class="o-link" href="#${sec.id}"><span class="o-n">${sec.dataset.n || '·'}</span><span class="o-t">${sec.dataset.short}</span></a>
            ${subs ? `<button class="o-caret" type="button" aria-expanded="false" aria-label="Show subsections">${CHEVRON}</button>` : ''}
          </div>
          ${subs ? `<div class="o-kids"><div class="o-kids-inner"><span class="o-track"><i></i></span>${subs}</div></div>` : ''}
        </div>`;
      }).join('');
    });
  });

  // ---------- search ----------
  // Index margin terms, result names, glossary terms and subsection titles. Built before
  // MathJax runs, so TeX is flattened to plain text for display and matching.
  const clean = t => t.replace(/\$([^$]*)\$/g, (_, m) => m
      .replace(/\\mathbb\s*\{?([RQZN])\}?/g, (_, c) => ({ R: 'ℝ', Q: 'ℚ', Z: 'ℤ', N: 'ℕ' })[c])
      .replace(/\\times/g, '×').replace(/\\prod/g, '∏').replace(/\\sim/g, '∼').replace(/\\alpha/g, 'α').replace(/\\cong/g, '≅')
      .replace(/\\[a-zA-Z]+/g, '').replace(/[{}_^]/g, ''))
    .replace(/\s+/g, ' ').trim();
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const index = new Map();
  courses.forEach(course => {
    const items = [];
    let k = 0;
    course.querySelectorAll('.thm:not(.exs):not(.note), dl.gloss > div, section[data-short]:not(.proofs):not(.defs) h3').forEach(el => {
      let label;
      if (el.matches('h3')) label = [...el.childNodes].filter(n => !(n.classList && n.classList.contains('h-num'))).map(n => n.textContent).join('');
      else if (el.matches('dl.gloss > div')) label = el.querySelector('dt').textContent;
      else {
        const kind = el.querySelector('.th-k'), name = el.querySelector('.th-n');
        if (!kind) return;
        label = kind.textContent + (name ? ' · ' + name.textContent.replace(/\.$/, '') : '');
      }
      if (!el.id) el.id = `${course.id}-i-${++k}`;
      const sec = el.closest('section[data-short]');
      const term = el.matches('dl.gloss > div') || !!el.querySelector('.th-term');
      items.push({ id: el.id, label: clean(label), kind: term ? 0 : el.matches('h3') ? 2 : 1, sec: sec ? (sec.dataset.n ? sec.dataset.n + ' · ' : '') + sec.dataset.short : '' });
    });
    index.set(course.id, items);
    course.querySelectorAll('nav.outline').forEach(nav => nav.insertAdjacentHTML('beforebegin',
      '<div class="search"><input type="search" placeholder="Search" aria-label="Search terms and results" autocomplete="off" spellcheck="false"><div class="s-results" hidden></div></div>'));
  });

  function resetSearch(box) {
    box.querySelector('input').value = '';
    box.querySelector('.s-results').hidden = true;
    box.parentElement.querySelector('nav.outline').hidden = false;
  }
  document.addEventListener('input', e => {
    const inp = e.target.closest('.search input');
    if (!inp) return;
    const box = inp.closest('.search'), res = box.querySelector('.s-results');
    const q = inp.value.trim().toLowerCase();
    if (!q) { resetSearch(box); return; }
    // exact > prefix > word start > anywhere; ties go to terms, then results, then headings
    const rank = it => {
      const l = it.label.toLowerCase();
      return (l === q ? 0 : l.startsWith(q) ? 1 : new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(l) ? 2 : 3) * 3 + it.kind;
    };
    const hits = index.get(inp.closest('article.course').id)
      .filter(it => it.label.toLowerCase().includes(q)).sort((a, b) => rank(a) - rank(b)).slice(0, 12);
    res.innerHTML = hits.length
      ? hits.map((it, i) => `<a href="#${it.id}"${i ? '' : ' class="first"'}><span>${esc(it.label)}</span><small>${esc(it.sec)}</small></a>`).join('')
      : '<p class="s-none">No matches</p>';
    res.hidden = false;
    box.parentElement.querySelector('nav.outline').hidden = true;
  });
  document.addEventListener('keydown', e => {
    const t = e.target.closest ? e.target : document.body;
    const inp = t.closest('.search input');
    if (inp && e.key === 'Enter') {
      const first = inp.closest('.search').querySelector('.s-results a');
      if (first) { e.preventDefault(); first.click(); }
    } else if (inp && e.key === 'Escape') {
      resetSearch(inp.closest('.search')); inp.blur();
    } else if (e.key === '/' && !t.closest('input, textarea, [contenteditable]')) {
      const course = activeCourse(), side = course && course.querySelector('.sidebar');
      if (!course) return;
      e.preventDefault();
      if (side && side.offsetParent) side.querySelector('.search input').focus();
      else { openDrawer(); course.querySelector('.drawer .search input').focus(); }
    }
  });

  // ---------- expand / collapse ----------
  // The current section opens automatically; carets override that per section.
  const opened = new Set(), closed = new Set();
  let expandAll = false;

  function syncOpen(course, currentId) {
    course.querySelectorAll('.o-sec').forEach(el => {
      const id = el.dataset.sec;
      const open = !closed.has(id) && (expandAll || opened.has(id) || id === currentId);
      el.classList.toggle('open', open);
      const b = el.querySelector('.o-caret');
      if (b) b.setAttribute('aria-expanded', open);
    });
    course.querySelectorAll('.s-toggle').forEach(b => b.textContent = expandAll ? 'Collapse' : 'Expand all');
  }

  document.addEventListener('click', e => {
    const caret = e.target.closest('.o-caret');
    if (caret) {
      const sec = caret.closest('.o-sec'), id = sec.dataset.sec;
      if (sec.classList.contains('open')) { closed.add(id); opened.delete(id); }
      else { opened.add(id); closed.delete(id); }
      spy(true);
      return;
    }
    const toggle = e.target.closest('.s-toggle');
    if (toggle) { expandAll = !expandAll; opened.clear(); closed.clear(); spy(true); return; }
    const hit = e.target.closest('.s-results a');
    if (hit) { const box = hit.closest('.search'); setTimeout(() => resetSearch(box), 0); }
    if (e.target.closest('.drawer a')) closeDrawer();
  });

  // ---------- mobile drawer ----------
  function openDrawer() {
    const course = activeCourse(); const d = course && course.querySelector('.drawer');
    if (!d) return;
    d.hidden = false; requestAnimationFrame(() => d.classList.add('in'));
    course.querySelector('.jump-btn').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    const cur = d.querySelector('.o-sub.on') || d.querySelector('.o-link.on');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function closeDrawer() {
    document.querySelectorAll('.drawer.in').forEach(d => {
      d.classList.remove('in'); setTimeout(() => { d.hidden = true; }, 200);
    });
    document.querySelectorAll('.jump-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.jump-btn').forEach(b => b.addEventListener('click', openDrawer));
  document.querySelectorAll('.drawer').forEach(d => d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('.drawer-close')) closeDrawer();
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // ---------- routing ----------
  function activeCourse() { return courses.find(c => c.classList.contains('active')); }

  function show(courseId) {
    courses.forEach(c => c.classList.toggle('active', c.id === courseId));
    tabs.forEach(t => t.dataset.course === courseId
      ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'));
    const c = document.getElementById(courseId);
    if (c && c.dataset.title) document.title = c.dataset.title + ' · Class Notes';
  }

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    const course = target ? target.closest('article.course') : null;
    show(course ? course.id : courses[0].id);
    if (target && target !== course) target.scrollIntoView();
    else window.scrollTo(0, 0);
    spy(true);
  }

  // ---------- scroll spy ----------
  const state = { sec: null, sub: null };
  function spy(force) {
    const course = activeCourse();
    if (!course) return;
    const secs = [...course.querySelectorAll('section[data-short]')];
    const line = window.innerHeight * 0.28;
    let cur = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s;
    let sub = null;
    for (const h of cur.querySelectorAll('h3')) if (h.getBoundingClientRect().top <= line) sub = h;

    const r = cur.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
    course.querySelectorAll(`.o-sec[data-sec="${cur.id}"] .o-track i`).forEach(i => i.style.height = (p * 100) + '%');

    if (!force && state.sec === cur.id && state.sub === (sub && sub.id)) return;
    state.sec = cur.id; state.sub = sub && sub.id;

    course.querySelectorAll('.o-sec').forEach(el => el.classList.toggle('current', el.dataset.sec === cur.id));
    course.querySelectorAll('.o-link').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur.id && !sub));
    course.querySelectorAll('.o-sub').forEach(a => a.classList.toggle('on', !!sub && a.dataset.id === sub.id));
    syncOpen(course, cur.id);

    // keep the highlighted entry visible inside a long sidebar
    const side = course.querySelector('.sidebar');
    const on = side && (side.querySelector('.o-sub.on') || side.querySelector(`.o-sec[data-sec="${cur.id}"] .o-link`));
    if (on) {
      const sr = side.getBoundingClientRect(), or = on.getBoundingClientRect();
      if (or.top < sr.top + 40 || or.bottom > sr.bottom - 40) side.scrollTop += or.top - sr.top - sr.height / 3;
    }

    const jt = course.querySelector('.jb-text');
    if (jt) {
      const unit = course.dataset.unit || 'Lec';
      const label = cur.dataset.n ? `${unit} ${cur.dataset.n}` : cur.dataset.short;
      const link = sub && course.querySelector(`.sidebar .o-sub[data-id="${sub.id}"]`);
      const subHTML = link ? link.innerHTML : (cur.dataset.n ? cur.dataset.short : '');
      jt.innerHTML = `<b>${label}</b>${subHTML ? `<span class="jb-sub">${subHTML}</span>` : ''}`;
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(() => { spy(); ticking = false; }); }
  }, { passive: true });
  window.addEventListener('resize', () => spy(true));
  window.addEventListener('hashchange', route);
  route();
  // Typeset math changes the page height; re-land on the hash target once it's done.
  document.addEventListener('math-ready', () => {
    const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t && !t.matches('article.course')) t.scrollIntoView();
    spy(true);
  });
})();
