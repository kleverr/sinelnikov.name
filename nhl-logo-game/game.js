(function () {
  const pool = document.getElementById('pool');
  const timelineEl = document.getElementById('timeline');
  const teamNav = document.getElementById('teamNav');
  // alias for backwards-compat with older code referencing teamNav
  const sidebar = teamNav;
  const guessBtn = document.getElementById('guessBtn');
  const nextBtn = document.getElementById('nextBtn');
  const replayBtn = document.getElementById('replayBtn');
  const resultEl = document.getElementById('result');
  const totalScoreEl = document.getElementById('totalScore');

  const STORAGE_KEY = 'nhl-logos-game-v3';
  let state = loadState();
  let currentTeamIdx = 0;
  let locked = false;

  // Sort teams alphabetically once at startup so currentTeamIdx is stable.
  TEAMS.sort((a, b) => a.name.localeCompare(b.name));
  currentTeamIdx = Math.max(0, TEAMS.findIndex(t => t.id === 'bruins'));

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && raw.teamScores) return raw;
    } catch {}
    return { teamScores: {} };
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function totalPoints() {
    return Object.values(state.teamScores).reduce((sum, s) => sum + (s.best || 0), 0);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function render() {
    renderTeams();
    renderRound();
    totalScoreEl.textContent = totalPoints();
  }

  function renderTeams() {
    teamNav.innerHTML = '';
    TEAMS.forEach((team, i) => {
      const btn = document.createElement('button');
      btn.className = 'team-btn' + (i === currentTeamIdx ? ' active' : '');
      if (team.color) btn.style.setProperty('--team-color', team.color);
      if (team.textColor) btn.style.setProperty('--team-text', team.textColor);
      const best = state.teamScores[team.id]?.best;
      const total = team.logos.length;
      const modernLogo = team.logos[team.logos.length - 1].src;
      btn.innerHTML = `
        <img class="team-logo" src="${modernLogo}" alt="" />
        <span class="team-name">${team.name}</span>
        <span class="team-score">${best ?? 0}/${total}</span>
      `;
      btn.onclick = () => {
        if (i === currentTeamIdx && !locked) return;
        currentTeamIdx = i;
        render();
        // Make sure the just-pressed team stays visible. On mobile the
        // sidebar is a horizontal scroller and the active pill can be
        // off-screen; on desktop it's a vertical column.
        requestAnimationFrame(() => {
          const active = teamNav.querySelector('.team-btn.active');
          active?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        });
      };
      teamNav.appendChild(btn);
    });
  }

  function renderRound() {
    locked = false;
    // Remove only logos from the pool — keep .pool-hint and .result around
    // (innerHTML='' would detach them and break the cached resultEl handle).
    pool.querySelectorAll('.logo').forEach(el => el.remove());
    timelineEl.innerHTML = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    resultEl.classList.remove('perfect');
    nextBtn.hidden = true;
    replayBtn.hidden = true;
    guessBtn.hidden = false;
    guessBtn.disabled = false;

    const team = TEAMS[currentTeamIdx];
    document.documentElement.style.setProperty('--team-color', team.color || 'var(--fg)');
    document.documentElement.style.setProperty('--team-text', team.textColor || 'white');

    // Pool: assign each logo a fixed grid cell so removing one doesn't reflow
    // the others. Cells persist on the element via inline style so when a
    // logo is dragged to an era and back, it returns to its original cell.
    // Each row is also horizontally centered within the fixed grid columns.
    const fitCols = getFitCols();
    // Use only as many columns as we need so the pool spans the same effective
    // width as the timeline (one bucket per logo, both centered in the page).
    // When a team has more logos than fitCols, wrap to multiple rows.
    const cols = Math.min(team.logos.length, fitCols);
    pool.style.setProperty('--pool-cols', cols);
    const shuffled = shuffle([...team.logos]);
    let i = 0, row = 1;
    while (i < shuffled.length) {
      const inRow = Math.min(shuffled.length - i, cols);
      const offset = Math.floor((cols - inRow) / 2);
      for (let c = 0; c < inRow; c++) {
        const el = makeLogoEl(shuffled[i]);
        el.style.gridRow = row;
        el.style.gridColumn = offset + c + 1;
        pool.appendChild(el);
        i++;
      }
      row++;
    }

    // Timeline: each era is a uniform-width bucket. Real-year proportional
    // mode existed earlier but produced too much vertical stacking; equal
    // buckets keep the timeline tight and easier to drop logos into.
    team.logos.forEach(logo => {
      const era = document.createElement('div');
      era.className = 'era';
      era.dataset.period = logo.period;
      era.style.flex = '1';

      const drop = document.createElement('div');
      drop.className = 'era-drop';
      era.appendChild(drop);

      const bar = document.createElement('div');
      bar.className = 'era-bar';
      era.appendChild(bar);

      const label = document.createElement('div');
      label.className = 'era-years';
      label.textContent = logo.period;
      era.appendChild(label);

      timelineEl.appendChild(era);
    });

    layoutTimeline();
  }

  /**
   * Equal-width buckets don't need row-stacking — every bucket is the same
   * width, so there's no reason to lift some logos up. We just clear any
   * stale --row values and tag narrow eras (used to soften the date label
   * styling on tight viewports). All logos sit at row 0, anchored to the
   * bottom of their bucket above the date strip.
   *
   * Also scales --era-logo-size down so logos don't overflow narrow buckets
   * on phones with many-era teams (e.g. Bruins on iPhone has ~36px buckets).
   */
  function layoutTimeline() {
    const eras = [...timelineEl.querySelectorAll('.era')];
    if (!eras.length) return;
    let minBucket = Infinity;
    eras.forEach(era => {
      era.style.removeProperty('--row');
      era.classList.remove('narrow');
      const r = era.getBoundingClientRect();
      if (r.width < 60) era.classList.add('narrow');
      if (r.width < minBucket) minBucket = r.width;
    });

    const w = window.innerWidth;
    const defaultSize = w < 480 ? 56 : w < 720 ? 72 : 84;
    const inset = w < 480 ? 4 : 6;
    const size = Math.max(
      28,
      Math.min(defaultSize, Math.floor(minBucket - inset))
    );
    timelineEl.style.setProperty('--era-logo-size', size + 'px');
    timelineEl.style.setProperty('--logo-h', size + 'px');
  }

  function getFitCols() {
    const w = window.innerWidth;
    if (w < 480)  return 4;
    if (w < 720)  return 3;
    if (w < 1100) return 4;
    if (w < 1500) return 5;
    if (w < 1900) return 7;
    return 9;
  }

  /**
   * Lock pool and timeline heights so they don't jump between teams or while
   * dragging. We compute the max needed across ALL teams so the size stays
   * stable when adding more teams later.
   */
  function applyLockedSizes() {
    const w = window.innerWidth;
    const isPhone  = w < 480;
    const isMobile = w < 720;
    const isTablet = w < 1100 && !isMobile;
    const POOL_LOGO = isPhone ? 60 : isMobile ? 88  : isTablet ? 100 : 110;
    const POOL_GAP  = isPhone ? 10 : isMobile ? 14  : isTablet ? 20  : 28;
    const POOL_PAD  = isPhone ? 10 : isMobile ? 14  : isTablet ? 16  : 18;

    const fitCols = getFitCols();
    const maxLogos = Math.max(...TEAMS.map(t => t.logos.length));
    const poolRows = Math.ceil(maxLogos / fitCols);
    const HINT_H = isPhone ? 14 : 16;
    const poolH = poolRows * POOL_LOGO + (poolRows - 1) * POOL_GAP + 2 * POOL_PAD + HINT_H;
    pool.style.height = poolH + 'px';
    pool.style.setProperty('--pool-cols', fitCols);

    // Timeline: equal buckets, single row, fixed height. No row-stacking,
    // so the height is just one logo + gap + label-strip + padding.
    const TL_LOGO    = isPhone ? 56 : isMobile ? 72 : 84;
    const barH       = isPhone ? 26 : 34;
    const logoBarGap = isPhone ? 6  : 10;
    const padTop     = isPhone ? 4  : 8;
    const padBottom  = isPhone ? 2  : 4;
    const tlH = padTop + TL_LOGO + logoBarGap + barH + padBottom;
    timelineEl.style.height = tlH + 'px';
  }

  /**
   * On resize the column count may change. Reassign each pool logo's grid
   * cell based on its current order in the pool so layout adapts cleanly.
   */
  function relayoutPoolGrid() {
    const fitCols = getFitCols();
    const inPool = [...pool.querySelectorAll('.logo')];
    let i = 0, row = 1;
    while (i < inPool.length) {
      const inRow = Math.min(inPool.length - i, fitCols);
      const offset = Math.floor((fitCols - inRow) / 2);
      for (let c = 0; c < inRow; c++) {
        inPool[i].style.gridRow = row;
        inPool[i].style.gridColumn = offset + c + 1;
        i++;
      }
      row++;
    }
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyLockedSizes();
      relayoutPoolGrid();
      layoutTimeline();
    }, 120);
  });

  function makeLogoEl(logo) {
    const el = document.createElement('div');
    el.className = 'logo';
    el.dataset.period = logo.period;
    if (logo.scale && logo.scale !== 1) {
      el.style.setProperty('--logo-scale', logo.scale);
    }
    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = logo.period;
    img.draggable = false;
    el.appendChild(img);
    return el;
  }

  // ---- Drag and drop (pointer events) ----
  let dragged = null;
  let origin = null;
  let offX = 0, offY = 0;

  function elementBelow(x, y) {
    if (!dragged) return document.elementFromPoint(x, y);
    const prev = dragged.style.display;
    dragged.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    dragged.style.display = prev;
    return el;
  }

  document.addEventListener('pointerdown', (e) => {
    if (locked) return;
    const logo = e.target.closest('.logo');
    if (!logo) return;
    e.preventDefault();
    dragged = logo;
    origin = logo.parentElement;
    const rect = logo.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    logo.style.width = rect.width + 'px';
    logo.style.height = rect.height + 'px';
    logo.style.position = 'fixed';
    logo.style.left = rect.left + 'px';
    logo.style.top = rect.top + 'px';
    logo.style.margin = '0';
    logo.classList.add('dragging');
    document.body.appendChild(logo);
    document.body.style.cursor = 'grabbing';
  });

  document.addEventListener('pointermove', (e) => {
    if (!dragged) return;
    dragged.style.left = (e.clientX - offX) + 'px';
    dragged.style.top = (e.clientY - offY) + 'px';

    document.querySelectorAll('.era.over').forEach(s => s.classList.remove('over'));
    const era = findEraAt(e.clientX, e.clientY);
    if (era) era.classList.add('over');
  });

  /**
   * Find the era under the pointer. If pointer is directly over an era's drop zone
   * we use it. Otherwise, if pointer is within the timeline's vertical band, snap
   * to the era whose horizontal center is closest — forgives narrow eras.
   */
  function findEraAt(x, y) {
    const below = elementBelow(x, y);
    const direct = below?.closest('.era');
    if (direct) return direct;

    const tlRect = timelineEl.getBoundingClientRect();
    const yPad = 40;
    if (y < tlRect.top - yPad || y > tlRect.bottom + yPad) return null;
    if (x < tlRect.left - 20 || x > tlRect.right + 20) return null;

    let best = null, bestDist = Infinity;
    timelineEl.querySelectorAll('.era').forEach(era => {
      const r = era.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(cx - x);
      if (d < bestDist) { bestDist = d; best = era; }
    });
    return best;
  }

  document.addEventListener('pointerup', (e) => {
    if (!dragged) return;
    const below = elementBelow(e.clientX, e.clientY);
    const poolHit = below?.closest('.pool');
    const era = findEraAt(e.clientX, e.clientY);

    let target;
    if (era) {
      const existing = era.querySelector('.logo');
      if (existing && existing !== dragged) {
        if (origin && origin !== era) origin.appendChild(existing);
        else pool.appendChild(existing);
      }
      target = era;
    } else if (poolHit) {
      target = pool;
    } else {
      target = origin;
    }

    dragged.style.position = '';
    dragged.style.left = '';
    dragged.style.top = '';
    dragged.style.width = '';
    dragged.style.height = '';
    dragged.style.margin = '';
    dragged.classList.remove('dragging');
    document.body.style.cursor = '';
    document.querySelectorAll('.era.over').forEach(s => s.classList.remove('over'));

    target.appendChild(dragged);
    // Repack the pool so its remaining logos fill from the top-left
    // (otherwise logos sit in their original grid cells and look scattered
    // when several are placed in eras).
    relayoutPoolGrid();
    dragged = null;
    origin = null;
  });

  // ---- Guess ----
  guessBtn.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    guessBtn.disabled = true;

    const team = TEAMS[currentTeamIdx];
    const eras = [...timelineEl.querySelectorAll('.era')];

    // 1. Score based on user's placement.
    const eraResults = eras.map(era => {
      const logo = era.querySelector('.logo');
      const isCorrect = !!logo && logo.dataset.period === era.dataset.period;
      return { era, isCorrect };
    });
    const correct = eraResults.filter(r => r.isCorrect).length;

    // 2. Reveal verdict in place: color the bars and show ✓/✗ on the user's
    // currently-placed logos. Hold this for a beat so the user can see what
    // they got right and wrong before logos fly to their correct homes.
    eraResults.forEach(({ era, isCorrect }) => {
      era.classList.add(isCorrect ? 'correct' : 'wrong');
      const placedLogo = era.querySelector('.logo');
      if (placedLogo) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = isCorrect ? '✓' : '✗';
        placedLogo.appendChild(badge);
      }
      requestAnimationFrame(() => era.classList.add('revealed'));
    });

    const VERDICT_HOLD = 1400;
    const FLIGHT_MS = 720;
    const easing = 'cubic-bezier(0.34, 1.18, 0.64, 1)';

    setTimeout(() => {
      // Fade out and remove badges — the colored bars are enough now.
      const badges = [...timelineEl.querySelectorAll('.badge')];
      badges.forEach(b => {
        b.style.transition = 'opacity 180ms ease, transform 180ms ease';
        b.style.opacity = '0';
        b.style.transform = 'scale(0.6)';
      });

      // 3. FLIP — capture FIRST positions of all logos.
      const allLogos = [...document.querySelectorAll('.logo')];
      const firstRects = new Map(allLogos.map(l => [l, l.getBoundingClientRect()]));

      // 4. Move each logo to its correct era.
      allLogos.forEach(l => l.remove());
      team.logos.forEach(logoData => {
        const era = eras.find(s => s.dataset.period === logoData.period);
        const logoEl = allLogos.find(l => l.dataset.period === logoData.period);
        if (era && logoEl) era.appendChild(logoEl);
      });

      // Badges were re-attached to logos when they were re-parented. Strip
      // them now so they don't fly along with the logos.
      timelineEl.querySelectorAll('.badge').forEach(b => b.remove());

      // 5. Apply inverse transform so they appear in their FIRST positions.
      allLogos.forEach((l, i) => {
        const first = firstRects.get(l);
        const last = l.getBoundingClientRect();
        const dx = (first.left + first.width / 2) - (last.left + last.width / 2);
        const dy = (first.top + first.height / 2) - (last.top + last.height / 2);
        l.style.transition = 'none';
        l.style.width  = first.width  + 'px';
        l.style.height = first.height + 'px';
        const baseTransform = l.parentElement.classList.contains('era')
          ? 'translateX(-50%)' : '';
        l.style.transform = `translate(${dx}px, ${dy}px) ${baseTransform}`;
        l.style.zIndex = '5';
        l.dataset._delay = String(i * 50);
        l.dataset._lastW = String(last.width);
        l.dataset._lastH = String(last.height);
      });

      // 6. Force reflow then play.
      void document.body.offsetHeight;
      requestAnimationFrame(() => {
        allLogos.forEach(l => {
          const delay = l.dataset._delay || '0';
          const baseTransform = l.parentElement.classList.contains('era')
            ? 'translateX(-50%)' : '';
          l.style.transition =
            `transform ${FLIGHT_MS}ms ${easing} ${delay}ms,` +
            `width ${FLIGHT_MS}ms ${easing} ${delay}ms,` +
            `height ${FLIGHT_MS}ms ${easing} ${delay}ms`;
          l.style.transform = baseTransform;
          l.style.width  = l.dataset._lastW + 'px';
          l.style.height = l.dataset._lastH + 'px';
        });
      });

      // 7. After flight, finalize result.
      const totalDelay = FLIGHT_MS + allLogos.length * 50 + 80;
      setTimeout(() => {
        allLogos.forEach(l => {
          l.style.transition = '';
          l.style.zIndex = '';
          l.style.transform = '';
          l.style.width = '';
          l.style.height = '';
          delete l.dataset._delay;
          delete l.dataset._lastW;
          delete l.dataset._lastH;
        });

        const total = team.logos.length;
        const isPerfect = correct === total;
        const score = correct;

        const prevBest = state.teamScores[team.id]?.best || 0;
        if (score > prevBest) {
          state.teamScores[team.id] = { best: score };
          saveState();
        }

        resultEl.hidden = false;
        resultEl.classList.toggle('perfect', isPerfect);
        resultEl.innerHTML = `
          <span class="big">${score} / ${total}</span>
          <span class="sub">${isPerfect ? 'Perfect round' : 'correct'}</span>
        `;
        nextBtn.hidden = false;
        replayBtn.hidden = false;
        totalScoreEl.textContent = totalPoints();
        renderTeams();
      }, totalDelay);
    }, VERDICT_HOLD);
  });

  nextBtn.addEventListener('click', () => {
    currentTeamIdx = (currentTeamIdx + 1) % TEAMS.length;
    render();
  });

  replayBtn.addEventListener('click', () => {
    renderRound();
  });

  // Keep --topbar-h and --footer-h in sync with the actual rendered heights
  // so the fixed sidebar lines up exactly with the topbar's bottom border
  // and stops cleanly above the footer (instead of overlapping it).
  function syncChromeMetrics() {
    const topbarH = document.querySelector('.topbar').offsetHeight;
    const footerH = document.querySelector('.footer').offsetHeight;
    const root = document.documentElement;
    root.style.setProperty('--topbar-h', topbarH + 'px');
    root.style.setProperty('--footer-h', footerH + 'px');
  }
  syncChromeMetrics();
  let metricsTimer;
  window.addEventListener('resize', () => {
    clearTimeout(metricsTimer);
    metricsTimer = setTimeout(syncChromeMetrics, 80);
  });

  applyLockedSizes();
  render();
  // Center the initial active team in the (possibly horizontal) sidebar.
  requestAnimationFrame(() => {
    const active = teamNav.querySelector('.team-btn.active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
})();
