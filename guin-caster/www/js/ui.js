/* ui.js — 화면 */

const UI = (() => {

  const view      = document.getElementById('view');
  const topbar    = document.getElementById('topbar');
  const topTitle  = document.getElementById('topTitle');
  const topAction = document.getElementById('topAction');
  const backBtn   = document.getElementById('backBtn');
  const tabbar    = document.getElementById('tabbar');
  const sheet     = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheetBody');
  const toastEl   = document.getElementById('toast');

  let route = { name: 'home', param: null };
  let stack = [];
  let queue = null;          // 진행 중인 게재 큐
  let draftText = null;      // 이번 채널에서 손본 문안

  /* ─────────── 잡동사니 ─────────── */

  const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2000);
  }

  function when(ts) {
    if (!ts) return '';
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return '오늘';
    if (d === 1) return '어제';
    if (d < 30) return `${d}일 전`;
    const dt = new Date(ts);
    return `${dt.getMonth() + 1}월 ${dt.getDate()}일`;
  }

  /** 말투 고르는 칩 줄. onPick(styleId) 로 알려줍니다. */
  function styleChips(current, onPick) {
    const id = 'sc' + Math.random().toString(36).slice(2, 7);
    const html = `<div class="chips style-chips" id="${id}">
      ${Tone.list().map(s => `
        <span class="chip ${s.id === current ? 'on' : ''}" data-s="${s.id}">${esc(s.label)}</span>`).join('')}
    </div>`;
    // 그려진 뒤에 붙여야 해서, 붙이는 일은 돌려주는 함수에 맡깁니다.
    const bind = (root) => {
      const box = (root || document).querySelector('#' + id);
      if (!box) return;
      box.querySelectorAll('.chip').forEach(c => {
        c.onclick = () => {
          box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
          onPick(c.dataset.s);
        };
      });
    };
    return { html, bind };
  }

  function statusPill(s) {
    if (s.status === 'never') return `<span class="badge-pill b-never">미게재</span>`;
    if (s.status === 'due')   return `<span class="badge-pill b-due">올릴 때 · ${when(s.at)}</span>`;
    return `<span class="badge-pill b-fresh">${s.dueIn}일 뒤</span>`;
  }

  /* ─────────── 이동 ─────────── */

  function go(name, param, replace) {
    if (!replace && route.name !== name) stack.push({ ...route });
    route = { name, param: param === undefined ? null : param };
    render();
    view.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function back() {
    if (stack.length) { route = stack.pop(); render(); }
    else go('home', null, true);
  }

  function tabTo(name) {
    stack = [];
    route = { name, param: null };
    render();
    window.scrollTo(0, 0);
  }

  /* ─────────── 시트 ─────────── */

  function openSheet(title, html, bind) {
    sheetBody.innerHTML = (title ? `<h2 class="sheet-title">${esc(title)}</h2>` : '') + html;
    sheet.classList.remove('hidden');
    if (bind) bind(sheetBody);
  }
  function closeSheet() {
    sheet.classList.add('hidden');
    sheetBody.innerHTML = '';
  }

  /* ─────────── 그리기 ─────────── */

  const VIEWS = {};

  function render() {
    const v = VIEWS[route.name] || VIEWS.home;
    topAction.className = 'txt-btn hidden';
    topAction.onclick = null;
    backBtn.classList.toggle('hidden', stack.length === 0);
    v(route.param);
    paintTabs();
  }

  function paintTabs() {
    const map = { home: 'home', edit: 'home', importPaste: 'home',
                  cast: 'cast', castPick: 'cast', castRun: 'cast',
                  channels: 'channels', templates: 'channels', more: 'more' };
    const active = map[route.name] || 'home';
    const due = Store.todo().filter(t => t.status === 'due').length;
    tabbar.querySelectorAll('.tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === active);
      const old = b.querySelector('.badge');
      if (old) old.remove();
      if (b.dataset.tab === 'cast' && due > 0) {
        const s = document.createElement('span');
        s.className = 'badge';
        s.textContent = due > 99 ? '99+' : due;
        b.appendChild(s);
      }
    });
  }

  function setTop(title, actionLabel, onAction) {
    topTitle.textContent = title;
    if (actionLabel) {
      topAction.textContent = actionLabel;
      topAction.className = 'txt-btn';
      topAction.onclick = onAction;
    }
  }

  /* ═══════════════ 공고 목록 ═══════════════ */

  VIEWS.home = () => {
    setTop('공고', '새 공고', () => {
      const p = Store.EMPTY_POSTING();
      Store.upsertPosting(p);
      go('edit', p.id);
    });

    const list = Store.postings();
    const due  = Store.todo().filter(t => t.status === 'due');

    if (!list.length) {
      view.innerHTML = `
        <div class="empty">
          <strong>아직 공고가 없습니다</strong>
          <p>공고를 한 번만 쓰면<br>채널 수만큼 문안이 자동으로 만들어집니다.</p>
        </div>
        <button class="btn primary" id="firstBtn">첫 공고 쓰기</button>
        <div class="btn-row">
          <button class="btn" id="importBtn">다른 공고 보고 만들기</button>
        </div>
        <div class="info">
          이 앱은 글을 대신 올려주지 않습니다. 블로그·카페·당근·오픈톡 어디에도
          외부 프로그램이 글을 등록하는 통로가 없기 때문입니다.
          대신 <b>문안을 만들고, 복사해두고, 그 채널을 띄우고, 언제 다시 올릴지 기억</b>합니다.
          붙여넣기 한 번만 직접 하시면 됩니다.
        </div>`;
      view.querySelector('#firstBtn').onclick = () => {
        const p = Store.EMPTY_POSTING();
        Store.upsertPosting(p);
        go('edit', p.id);
      };
      view.querySelector('#importBtn').onclick = () => go('importPaste');
      return;
    }

    const chs = Store.activeChannels();

    view.innerHTML = `
      ${due.length ? `
        <div class="card tap" id="dueCard" style="border-color:var(--warn)">
          <div class="card-title" style="color:var(--warn)">다시 올릴 곳 ${due.length}군데</div>
          <div class="card-sub">${esc(due.slice(0, 3).map(d => d.channel.name).join(', '))}${due.length > 3 ? ` 외 ${due.length - 3}` : ''}</div>
        </div>` : ''}

      <div class="section-label">공고 ${list.length}개</div>
      ${list.map(p => {
        const posted = chs.filter(c => Store.lastPostedAt(p.id, c.id)).length;
        return `
        <div class="card tap" data-id="${p.id}">
          <div class="card-title">${esc(Compose.title(p))}</div>
          <div class="card-sub">${esc(Compose.summary(p))}</div>
          <div class="card-sub" style="margin-top:6px">
            <span class="badge-pill ${posted ? 'b-fresh' : 'b-never'}">${posted}/${chs.length} 채널</span>
            <span class="badge-pill b-never">${esc(Tone.label(p.style))}</span>
            &nbsp;수정 ${when(p.updatedAt)}
          </div>
        </div>`;
      }).join('')}

      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="importBtn">다른 공고 보고 만들기</button>
      </div>`;

    const dueCard = view.querySelector('#dueCard');
    if (dueCard) dueCard.onclick = () => tabTo('cast');
    view.querySelector('#importBtn').onclick = () => go('importPaste');
    view.querySelectorAll('.card[data-id]').forEach(el => {
      el.onclick = () => go('edit', el.dataset.id);
    });
  };

  /* ═══════════════ 공고 편집 ═══════════════ */

  VIEWS.edit = (id) => {
    const p = Store.posting(id);
    if (!p) return go('home', null, true);

    setTop('공고 쓰기', '완료', () => { flush(); back(); });

    const tone = styleChips(p.style, (s) => {
      p.style = s;
      Store.upsertPosting(p);
      view.querySelector('#toneDesc').textContent = Tone.get(s).desc;
      toast(Tone.label(s) + ' 말투로 씁니다');
    });

    view.innerHTML = `
      <div class="section-label">말투</div>
      ${tone.html}
      <div class="info" id="toneDesc" style="margin-top:8px">${esc(Tone.get(p.style).desc)}</div>

      <div class="section-label">내용</div>
      ${Store.FIELDS.map(f => `
        <div class="field">
          <label for="f-${f.key}">${esc(f.key)} <span class="hint">${esc(f.hint)}</span></label>
          ${f.type === 'text'
            ? `<textarea class="textarea" id="f-${f.key}" data-key="${f.key}" rows="3">${esc(p[f.key])}</textarea>`
            : `<input class="input" id="f-${f.key}" data-key="${f.key}" value="${esc(p[f.key])}">`}
        </div>`).join('')}

      <div id="warnBox"></div>

      <div class="btn-row">
        <button class="btn primary" id="goCast">이 공고 올리러 가기</button>
      </div>
      <div class="btn-row">
        <button class="btn" id="previewBtn">문안 미리보기</button>
        <button class="btn" id="dupBtn">복제</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost danger" id="delBtn">이 공고 삭제</button>
      </div>`;

    tone.bind(view);

    const inputs = view.querySelectorAll('[data-key]');
    let timer;
    const flushNow = () => {
      inputs.forEach(el => { p[el.dataset.key] = el.value; });
      Store.upsertPosting(p);
      paintWarn();
    };
    function flush() { clearTimeout(timer); flushNow(); }

    inputs.forEach(el => {
      el.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(flushNow, 400);
      });
      if (el.tagName === 'TEXTAREA') {
        const grow = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
        el.addEventListener('input', grow);
        grow();
      }
    });

    function paintWarn() {
      const w = Compose.warnings(p);
      view.querySelector('#warnBox').innerHTML = w.length
        ? `<div class="notice"><ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`
        : '';
    }
    paintWarn();

    view.querySelector('#goCast').onclick    = () => { flush(); go('castPick', p.id); };
    view.querySelector('#previewBtn').onclick = () => { flush(); previewSheet(p); };
    view.querySelector('#dupBtn').onclick    = () => {
      flush();
      const c = Store.duplicatePosting(p.id);
      toast('복제했습니다');
      go('edit', c.id, true);
    };
    view.querySelector('#delBtn').onclick = () => {
      if (!confirm('이 공고와 게재 이력을 지웁니다. 되돌릴 수 없습니다.')) return;
      Store.removePosting(p.id);
      stack = [];
      go('home', null, true);
    };
  };

  /**
   * 채널별로 어떤 문안이 나오는지 훑어보는 시트.
   * 위쪽 말투 칩을 누르면 그 자리에서 전부 다시 쓰입니다 — 말투를 비교해 보고 고르는 곳입니다.
   */
  function previewSheet(p) {
    const chs = Store.activeChannels();
    if (!chs.length) return openSheet('문안 미리보기', '<div class="info">켜져 있는 채널이 없습니다.</div>');

    let shown = p.style;
    const tone = styleChips(shown, (s) => { shown = s; paint(); });

    openSheet('문안 미리보기', `
      ${tone.html}
      <div class="info" id="pvNote" style="margin-top:8px"></div>
      <div id="pvBody"></div>
      <div class="btn-row"><button class="btn primary" id="pvUse">이 말투로 정하기</button></div>`,
      (root) => {
        tone.bind(root);
        root.querySelector('#pvUse').onclick = () => {
          p.style = shown;
          Store.upsertPosting(p);
          closeSheet();
          render();
          toast(Tone.label(shown) + ' 말투로 정했습니다');
        };
        paint();
      });

    function paint() {
      const body = sheetBody.querySelector('#pvBody');
      const note = sheetBody.querySelector('#pvNote');
      const use  = sheetBody.querySelector('#pvUse');
      if (!body) return;

      note.textContent = Tone.get(shown).desc;
      use.textContent = shown === p.style
        ? `지금 이 말투입니다 — ${Tone.label(shown)}`
        : `${Tone.label(shown)} 말투로 정하기`;
      use.disabled = shown === p.style;

      body.innerHTML = chs.map(ch => {
        const text = Compose.forChannel(p, ch, shown);
        const m = Compose.measure(text, ch);
        return `
          <div class="section-label">${esc(ch.name)}${ch.template ? ' · 이 채널만의 문안' : ''}</div>
          <div class="preview" style="max-height:200px">${esc(text) || '<i>내용이 없습니다</i>'}</div>
          <div class="counter ${m.over ? 'over' : ''}">
            <span>${m.count}자</span><span>권장 ${m.limit}자</span>
          </div>`;
      }).join('');
    }
  }

  /* ═══════════════ 다른 공고 보고 만들기 ═══════════════ */

  VIEWS.importPaste = () => {
    setTop('다른 공고 보고 만들기');

    view.innerHTML = `
      <div class="info">
        마음에 드는 다른 업체 공고를 통째로 붙여넣으세요.
        급여·근무시간·근무형태·지역·직무를 뽑아내 <b>내 공고 항목에 채워 넣습니다.</b>
        그 다음 내가 고른 말투로 다시 쓰이니, 조건만 참고하고 글은 내 것이 됩니다.
      </div>

      <div class="field">
        <label>붙여넣기</label>
        <textarea class="textarea tall" id="src" placeholder="다른 업체 공고를 여기에 붙여넣으세요"></textarea>
      </div>

      <div class="btn-row">
        <button class="btn primary" id="readBtn">분석하기</button>
        <button class="btn" id="pasteBtn">클립보드에서</button>
      </div>

      <div class="notice" style="background:var(--sunk);color:var(--dim)">
        상대 업체의 <b>상호와 연락처는 가져오지 않습니다.</b> 그대로 두면 남의 가게로 지원 전화가 갑니다.
        상대가 쓴 문장도 그대로 옮기지 않습니다 — 베낀 티가 나는 공고는 어차피 반응이 없고, 남의 글입니다.
      </div>`;

    const src = view.querySelector('#src');

    view.querySelector('#pasteBtn').onclick = async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (!t || !t.trim()) return toast('클립보드가 비어 있습니다');
        src.value = t;
        toast('붙여넣었습니다');
      } catch (e) {
        toast('클립보드를 읽을 수 없습니다. 길게 눌러 붙여넣어 주세요');
      }
    };

    view.querySelector('#readBtn').onclick = () => {
      const raw = src.value.trim();
      if (raw.length < 10) return toast('공고 내용을 붙여넣어 주세요');
      resultSheet(Parse.analyze(raw));
    };
  };

  /** 분석 결과를 보여주고, 확인하면 공고로 만듭니다. */
  function resultSheet(res) {
    const { fields, theirs, leftover, found, missing } = res;
    const has = Object.entries(fields).filter(([, v]) => v);

    openSheet('찾아낸 것', `
      ${has.length ? `
        <div class="section-label">내 공고에 채울 항목 ${found.length}개</div>
        ${has.map(([k, v]) => `
          <div class="row">
            <div class="body">
              <div class="meta">${esc(k)}</div>
              <div class="name" style="white-space:pre-wrap">${esc(v)}</div>
            </div>
          </div>`).join('')}
      ` : `<div class="notice">알아볼 수 있는 항목이 없었습니다.
             공고 형식이 많이 다르면 못 읽습니다 — 직접 쓰시는 편이 빠릅니다.</div>`}

      ${missing.length ? `
        <div class="section-label">못 찾은 항목</div>
        <div class="info">${esc(missing.join(' · '))} — 직접 채워 주세요.</div>` : ''}

      ${(theirs.업체명 || theirs.연락처) ? `
        <div class="section-label">일부러 안 가져온 것</div>
        <div class="notice">
          ${theirs.업체명 ? `상호 <b>${esc(theirs.업체명)}</b><br>` : ''}
          ${theirs.연락처 ? `연락처 <b>${esc(theirs.연락처)}</b><br>` : ''}
          상대 업체 것입니다. 내 상호와 내 번호를 직접 넣으세요.
        </div>` : ''}

      ${leftover.length ? `
        <div class="section-label">원문에서 남은 문장 ${leftover.length}줄</div>
        <div class="preview" style="max-height:160px">${esc(leftover.join('\n'))}</div>
        <label class="pick" id="keepRaw" style="margin-top:8px">
          <span class="box"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="body">
            <span class="name">이 문장들도 상세 설명에 넣기</span>
            <span class="meta">참고용입니다. 그대로 두지 말고 내 말로 고쳐 쓰세요</span>
          </span>
        </label>` : ''}

      <div class="section-label">말투</div>
      <div id="impTone"></div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" id="makeBtn">이걸로 공고 만들기</button>
      </div>`,
      (root) => {
        let style = Tone.DEFAULT_STYLE;
        const tone = styleChips(style, (s) => { style = s; });
        root.querySelector('#impTone').innerHTML = tone.html;
        tone.bind(root);

        let keep = false;
        const box = root.querySelector('#keepRaw');
        if (box) box.onclick = (e) => {
          e.preventDefault();
          keep = !keep;
          box.classList.toggle('on', keep);
        };

        root.querySelector('#makeBtn').onclick = () => {
          const p = Store.EMPTY_POSTING();
          Object.entries(fields).forEach(([k, v]) => { if (v) p[k] = v; });
          if (keep && leftover.length) p.상세 = leftover.join('\n');
          p.style = style;
          Store.upsertPosting(p);
          closeSheet();
          stack = [];
          go('edit', p.id, true);
          toast('업체명과 연락처를 채워 주세요');
        };
      });
  }

  /* ═══════════════ 게재 — 공고 고르기 ═══════════════ */

  VIEWS.cast = () => {
    setTop('게재');
    const list = Store.postings();

    if (!list.length) {
      view.innerHTML = `<div class="empty"><strong>올릴 공고가 없습니다</strong><p>공고 탭에서 먼저 하나 써주세요.</p></div>`;
      return;
    }

    const chs = Store.activeChannels();
    const due = Store.todo().filter(t => t.status === 'due');

    view.innerHTML = `
      ${due.length ? `<div class="notice">
        <b>${due.length}군데</b>가 끌어올릴 때가 됐습니다.
        오래 방치된 순서로 정리했습니다.
      </div>` : ''}

      <div class="section-label">공고를 고르세요</div>
      ${list.map(p => {
        const posted = chs.filter(c => Store.lastPostedAt(p.id, c.id)).length;
        const d = due.filter(x => x.posting.id === p.id).length;
        return `
        <div class="card tap" data-id="${p.id}">
          <div class="card-title">${esc(Compose.title(p))}</div>
          <div class="card-sub">${esc(Compose.summary(p))}</div>
          <div class="card-sub" style="margin-top:6px">
            <span class="badge-pill ${posted ? 'b-fresh' : 'b-never'}">${posted}/${chs.length} 채널</span>
            ${d ? `&nbsp;<span class="badge-pill b-due">${d}군데 올릴 때</span>` : ''}
          </div>
        </div>`;
      }).join('')}`;

    view.querySelectorAll('.card[data-id]').forEach(el => {
      el.onclick = () => go('castPick', el.dataset.id);
    });
  };

  /* ═══════════════ 게재 — 채널 고르기 ═══════════════ */

  let picked = new Set();

  VIEWS.castPick = (id) => {
    const p = Store.posting(id);
    if (!p) return go('cast', null, true);

    setTop(Compose.title(p));
    const chs = Store.activeChannels();

    if (!chs.length) {
      view.innerHTML = `<div class="empty"><strong>켜진 채널이 없습니다</strong><p>채널 탭에서 올릴 곳을 먼저 등록해 주세요.</p></div>`;
      return;
    }

    // 처음 들어오면 "아직 안 올렸거나 올릴 때가 된 곳"을 미리 체크해 둡니다.
    picked = new Set(chs.filter(c => Store.statusOf(p.id, c).status !== 'fresh').map(c => c.id));

    const warn = Compose.warnings(p);

    view.innerHTML = `
      ${warn.length ? `<div class="notice"><ul>${warn.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="section-label">올릴 곳</div>
      <div id="picks">
        ${chs.map(c => {
          const s = Store.statusOf(p.id, c);
          const kind = Store.KINDS[c.kind] || Store.KINDS.etc;
          return `
          <div class="pick ${picked.has(c.id) ? 'on' : ''}" data-id="${c.id}">
            <span class="box"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <span class="body">
              <span class="name">${esc(c.name)}</span>
              <span class="meta">${esc(kind.label)} · ${s.at ? `마지막 ${when(s.at)}` : '올린 적 없음'}</span>
            </span>
            ${statusPill(s)}
          </div>`;
        }).join('')}
      </div>

      <div class="btn-row">
        <button class="btn sm ghost" id="allBtn" style="flex:1">전체 선택</button>
        <button class="btn sm ghost" id="noneBtn" style="flex:1">전체 해제</button>
      </div>

      <div class="btn-row" style="margin-top:16px">
        <button class="btn primary" id="startBtn">게재 시작</button>
      </div>
      <div class="info">
        고른 채널을 하나씩 띄워 드립니다. 문안은 미리 복사되어 있으니
        붙여넣기 → 등록 → <b>올렸어요</b> 만 누르시면 다음 채널로 넘어갑니다.
      </div>`;

    const repaint = () => {
      view.querySelectorAll('.pick').forEach(el => el.classList.toggle('on', picked.has(el.dataset.id)));
      view.querySelector('#startBtn').disabled = picked.size === 0;
      view.querySelector('#startBtn').textContent = picked.size ? `게재 시작 · ${picked.size}군데` : '올릴 곳을 고르세요';
    };

    view.querySelectorAll('.pick').forEach(el => {
      el.onclick = () => {
        const cid = el.dataset.id;
        picked.has(cid) ? picked.delete(cid) : picked.add(cid);
        repaint();
      };
    });
    view.querySelector('#allBtn').onclick  = () => { picked = new Set(chs.map(c => c.id)); repaint(); };
    view.querySelector('#noneBtn').onclick = () => { picked = new Set(); repaint(); };
    view.querySelector('#startBtn').onclick = () => {
      const ids = chs.filter(c => picked.has(c.id)).map(c => c.id);
      if (!ids.length) return;
      queue = Publish.makeQueue(p.id, ids);
      draftText = null;
      go('castRun', p.id);
    };

    repaint();
  };

  /* ═══════════════ 게재 — 진행 ═══════════════ */

  VIEWS.castRun = (id) => {
    const p = Store.posting(id);
    if (!p || !queue) return go('cast', null, true);

    if (queue.finished) return finishView(p);

    const ch = queue.current;
    const kind = Store.KINDS[ch.kind] || Store.KINDS.etc;
    const text = draftText !== null ? draftText : Compose.forChannel(p, ch);

    // 올리려다 말투가 안 맞는다 싶을 때 여기서 바로 바꿉니다. 공고에도 저장됩니다.
    const runTone = styleChips(p.style, (s) => {
      p.style = s;
      Store.upsertPosting(p);
      draftText = null;       // 손봤던 문안은 버리고 새 말투로 다시 뽑습니다
      render();
      toast(Tone.label(s) + ' 말투로 바꿨습니다');
    });
    const m = Compose.measure(text, ch);
    const total = queue.ids.length;
    const step = queue.index + 1;

    setTop(`${step} / ${total}`, '그만두기', () => {
      queue = null; stack = []; go('cast', null, true);
    });

    const isChat = ch.kind === 'openchat';

    view.innerHTML = `
      <div class="progress"><span style="width:${(queue.index / total) * 100}%"></span></div>

      <div class="step-head">
        <div class="step-count">${step}번째 · ${queue.remaining}군데 남음</div>
        <div class="step-name">${esc(ch.name)}</div>
        <div class="step-kind">${esc(kind.label)}${kind.desc ? ' — ' + esc(kind.desc) : ''}</div>
      </div>

      <div class="preview" id="prev">${esc(text)}</div>
      <div class="counter ${m.over ? 'over' : ''}">
        <span>${m.count}자${m.over ? ' — 권장보다 깁니다' : ''}</span>
        <span>권장 ${m.limit}자</span>
      </div>

      <div class="btn-row">
        <button class="btn primary" id="copyOpen">복사하고 ${esc(ch.name)} 열기</button>
      </div>
      <div class="btn-row">
        <button class="btn" id="copyBtn">복사만</button>
        ${Publish.canShare() ? `<button class="btn" id="shareBtn">${isChat ? '카톡으로 공유' : '공유'}</button>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn" id="editBtn">이번만 다듬기</button>
        <button class="btn" id="cardBtn">이미지 카드</button>
      </div>

      <div class="section-label">말투 바꿔보기</div>
      ${runTone.html}

      <div class="btn-row" style="margin-top:20px">
        <button class="btn primary" id="doneBtn">올렸어요 → 다음</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="skipBtn">이번은 건너뛰기</button>
        ${queue.index > 0 ? `<button class="btn ghost" id="prevBtn">이전으로</button>` : ''}
      </div>

      ${!ch.url && !isChat ? `<div class="info">
        이 채널에 주소가 등록되어 있지 않아 "열기"가 동작하지 않습니다.
        채널 탭에서 글쓰기 주소를 넣어두면 한 번에 열립니다.
      </div>` : ''}`;

    const el = (s) => view.querySelector(s);
    runTone.bind(view);

    el('#copyOpen').onclick = async () => {
      const ok = await Publish.copy(text);
      toast(ok ? '복사했습니다. 붙여넣기만 하시면 됩니다' : '복사에 실패했습니다');
      if (!Publish.open(ch)) toast('열 주소가 없습니다. 채널 설정에서 주소를 넣어주세요');
    };

    el('#copyBtn').onclick = async () => {
      toast(await Publish.copy(text) ? '복사했습니다' : '복사에 실패했습니다');
    };

    const shareBtn = el('#shareBtn');
    if (shareBtn) shareBtn.onclick = async () => {
      const r = await Publish.share(text, Compose.title(p));
      if (r === false) toast('이 기기에서는 공유를 쓸 수 없습니다');
    };

    el('#editBtn').onclick = () => {
      openSheet('이번 게재에만 적용', `
        <textarea class="textarea tall" id="tweak">${esc(text)}</textarea>
        <div class="info">여기서 고친 내용은 이번 채널에만 씁니다.
        늘 이렇게 나오게 하려면 채널 탭 → 문안 템플릿을 고치세요.</div>
        <div class="btn-row"><button class="btn primary" id="tweakOk">적용</button></div>`,
        (root) => {
          root.querySelector('#tweakOk').onclick = () => {
            draftText = root.querySelector('#tweak').value;
            closeSheet();
            render();
          };
        });
    };

    el('#cardBtn').onclick = () => cardSheet(p);

    el('#doneBtn').onclick = () => {
      queue.complete();
      draftText = null;
      render();
      window.scrollTo(0, 0);
    };

    el('#skipBtn').onclick = () => {
      queue.skip();
      draftText = null;
      render();
      window.scrollTo(0, 0);
    };

    const prevBtn = el('#prevBtn');
    if (prevBtn) prevBtn.onclick = () => {
      queue.back();
      draftText = null;
      render();
    };
  };

  function finishView(p) {
    setTop('게재 완료');
    const done = queue.done.map(id => Store.channel(id)).filter(Boolean);

    view.innerHTML = `
      <div class="empty">
        <strong>${done.length}군데 올렸습니다</strong>
        <p>${esc(Compose.title(p))}</p>
      </div>
      ${done.map(c => `
        <div class="row">
          <div class="body">
            <div class="name">${esc(c.name)}</div>
            <div class="meta">${c.bumpDays}일 뒤 다시 올릴 때가 됩니다</div>
          </div>
          <span class="badge-pill b-fresh">완료</span>
        </div>`).join('')}
      <div class="btn-row" style="margin-top:16px">
        <button class="btn primary" id="homeBtn">공고 목록으로</button>
      </div>`;

    view.querySelector('#homeBtn').onclick = () => {
      queue = null; stack = []; tabTo('home');
    };
  }

  /* ─────────── 이미지 카드 ─────────── */

  function cardSheet(p) {
    const theme = Store.settings().cardTheme;
    openSheet('이미지 카드', `
      <div id="cardWrap"></div>
      <div class="chips" id="themeChips">
        ${Card.themeList().map(t => `<span class="chip ${t.id === theme ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</span>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn primary" id="cardShare">공유</button>
        <button class="btn" id="cardSave">저장</button>
      </div>
      <div class="info">글이 순식간에 밀려나는 오픈톡·당근에서는 이미지 한 장이 더 오래 남습니다.</div>`,
      (root) => {
        let cur = theme;
        const wrap = root.querySelector('#cardWrap');

        const paint = () => {
          wrap.innerHTML = '';
          wrap.appendChild(Card.draw(p, cur));
          root.querySelectorAll('#themeChips .chip')
              .forEach(c => c.classList.toggle('on', c.dataset.t === cur));
        };

        root.querySelectorAll('#themeChips .chip').forEach(c => {
          c.onclick = () => { cur = c.dataset.t; Store.setSetting('cardTheme', cur); paint(); };
        });

        root.querySelector('#cardSave').onclick = async () => {
          const blob = await Card.toBlob(wrap.querySelector('canvas'));
          Publish.download(`${Compose.title(p)}.png`, blob);
          toast('저장했습니다');
        };

        root.querySelector('#cardShare').onclick = async () => {
          const blob = await Card.toBlob(wrap.querySelector('canvas'));
          const r = await Publish.shareWithImage(Compose.title(p), blob, `${Compose.title(p)}.png`);
          if (r === false) toast('이 기기에서는 공유를 쓸 수 없습니다');
        };

        paint();
      });
  }

  /* ═══════════════ 채널 ═══════════════ */

  VIEWS.channels = () => {
    setTop('채널', '추가', () => channelSheet(null));
    const chs = Store.channels();

    view.innerHTML = `
      <div class="section-label">올리는 곳 ${chs.length}개</div>
      ${chs.map((c, i) => {
        const kind = Store.KINDS[c.kind] || Store.KINDS.etc;
        return `
        <div class="row" data-id="${c.id}" style="${c.enabled ? '' : 'opacity:.5'}">
          <div class="body tap-edit" style="cursor:pointer">
            <div class="name">${esc(c.name)}${c.enabled ? '' : ' · 꺼짐'}</div>
            <div class="meta">${esc(kind.label)} · ${c.bumpDays}일마다 · ${c.url ? esc(c.url.replace(/^https?:\/\//, '').slice(0, 34)) : '주소 없음'}</div>
          </div>
          <div class="acts">
            <button data-move="-1" ${i === 0 ? 'disabled style="opacity:.25"' : ''} aria-label="위로">▲</button>
            <button data-move="1" ${i === chs.length - 1 ? 'disabled style="opacity:.25"' : ''} aria-label="아래로">▼</button>
          </div>
        </div>`;
      }).join('')}

      <div class="section-label">문안 템플릿</div>
      <div class="info">채널 종류마다 문안이 다르게 만들어집니다. 말투가 마음에 안 들면 여기서 고치세요.</div>
      ${Object.entries(Store.KINDS).map(([k, v]) => `
        <div class="row tap-tpl" data-kind="${k}" style="cursor:pointer">
          <div class="body">
            <div class="name">${esc(v.label)}</div>
            <div class="meta">권장 ${v.limit}자${v.desc ? ' · ' + esc(v.desc) : ''}</div>
          </div>
          <span style="color:var(--faint)">›</span>
        </div>`).join('')}`;

    view.querySelectorAll('.row[data-id]').forEach(row => {
      row.querySelector('.tap-edit').onclick = () => channelSheet(row.dataset.id);
      row.querySelectorAll('[data-move]').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          Store.moveChannel(row.dataset.id, parseInt(b.dataset.move, 10));
          render();
        };
      });
    });
    view.querySelectorAll('.tap-tpl').forEach(r => {
      r.onclick = () => go('templates', r.dataset.kind);
    });
  };

  function channelSheet(id) {
    const c = id ? Store.channel(id) : { id: '', name: '', kind: 'openchat', url: '', bumpDays: 7, enabled: true };

    openSheet(id ? '채널 고치기' : '채널 추가', `
      <div class="field">
        <label>이름 <span class="hint">오픈톡방은 방 이름을 그대로 쓰면 헷갈리지 않습니다</span></label>
        <input class="input" id="cName" value="${esc(c.name)}" placeholder="예: 수원맘 오픈톡방">
      </div>
      <div class="field">
        <label>종류 <span class="hint">문안 길이와 말투가 여기서 정해집니다</span></label>
        <select class="input" id="cKind">
          ${Object.entries(Store.KINDS).map(([k, v]) =>
            `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>주소 <span class="hint">글쓰기 화면 주소를 넣으면 한 번에 열립니다</span></label>
        <input class="input" id="cUrl" value="${esc(c.url)}" placeholder="https://..." inputmode="url">
      </div>
      <div class="field">
        <label>끌어올리기 주기 <span class="hint">며칠 뒤에 다시 올릴지</span></label>
        <input class="input" id="cBump" type="number" min="1" max="90" value="${c.bumpDays}" inputmode="numeric">
      </div>
      <div class="field">
        <label class="pick ${c.enabled ? 'on' : ''}" id="cEnabled" style="margin:0">
          <span class="box"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="body"><span class="name">이 채널 사용</span>
          <span class="meta">끄면 게재 목록에 나오지 않습니다</span></span>
        </label>
      </div>

      <div class="btn-row"><button class="btn primary" id="cSave">저장</button></div>
      ${id ? `<div class="btn-row"><button class="btn ghost danger" id="cDel">이 채널 삭제</button></div>` : ''}

      <div class="info">
        오픈톡·단톡방은 주소를 비워두면 카카오톡 앱을 띄웁니다.
        방 목록에서 직접 고르셔야 합니다 — 카카오는 외부에서 특정 방으로 메시지를 보내는 길을 열어두지 않았습니다.
      </div>`,
      (root) => {
        let on = c.enabled;
        const box = root.querySelector('#cEnabled');
        box.onclick = (e) => { e.preventDefault(); on = !on; box.classList.toggle('on', on); };

        root.querySelector('#cSave').onclick = () => {
          const name = root.querySelector('#cName').value.trim();
          if (!name) { toast('이름을 적어주세요'); return; }
          Store.upsertChannel({
            id: c.id,
            name,
            kind: root.querySelector('#cKind').value,
            url: root.querySelector('#cUrl').value.trim(),
            bumpDays: Math.max(1, parseInt(root.querySelector('#cBump').value, 10) || 7),
            enabled: on,
            template: c.template,
            order: c.order,
          });
          closeSheet();
          render();
          toast('저장했습니다');
        };

        const del = root.querySelector('#cDel');
        if (del) del.onclick = () => {
          if (!confirm(`"${c.name}" 채널과 그 게재 이력을 지웁니다.`)) return;
          Store.removeChannel(c.id);
          closeSheet();
          render();
        };
      });
  }

  /* ═══════════════ 문안 템플릿 ═══════════════ */

  /** 마지막으로 편집하던 말투 — 화면을 다시 그려도 유지됩니다. */
  let editingStyle = Tone.DEFAULT_STYLE;

  VIEWS.templates = (kind) => {
    const k = Store.KINDS[kind] ? kind : 'etc';
    const info = Store.KINDS[k];

    setTop(`${info.label} 문안`, '저장', save);

    const tone = styleChips(editingStyle, (s) => {
      if (dirty && !confirm('고치던 내용을 버리고 다른 말투로 넘어갈까요?')) { render(); return; }
      editingStyle = s;
      render();
    });

    view.innerHTML = `
      <div class="section-label">어느 말투의 문안을 고칠까요</div>
      ${tone.html}

      <div class="info" style="margin-top:8px">
        <b>{{항목}}</b> 자리에 공고 내용이 들어갑니다.<br>
        내용이 비어 있는 항목이 들어간 <b>줄은 통째로 사라집니다</b> — 빈칸을 남겨도 문안이 깨지지 않습니다.
      </div>
      <div class="chips" id="tokenChips">
        ${Compose.tokens().map(t => `<span class="chip" data-t="${esc(t)}">${esc(t)}</span>`).join('')}
      </div>
      <div class="field" style="margin-top:12px">
        <textarea class="textarea tall" id="tpl">${esc(Store.templateOf(editingStyle, k))}</textarea>
      </div>

      <div class="section-label">미리보기</div>
      <div class="preview" id="tplPrev"></div>

      <div class="btn-row">
        <button class="btn primary" id="saveBtn">저장</button>
        <button class="btn ghost" id="resetBtn">기본으로</button>
      </div>`;

    tone.bind(view);

    const ta = view.querySelector('#tpl');
    const prev = view.querySelector('#tplPrev');
    const sample = Store.postings()[0] || sampleposting();
    let dirty = false;

    const repaint = () => {
      const text = Compose.render(ta.value, sample);
      prev.textContent = text || '(내용이 없습니다)';
    };

    ta.addEventListener('input', () => { dirty = true; repaint(); });

    view.querySelectorAll('#tokenChips .chip').forEach(c => {
      c.onclick = () => {
        const t = `{{${c.dataset.t}}}`;
        const s = ta.selectionStart, e = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + t + ta.value.slice(e);
        ta.selectionStart = ta.selectionEnd = s + t.length;
        ta.focus();
        dirty = true;
        repaint();
      };
    });

    function save() {
      Store.setTemplate(editingStyle, k, ta.value);
      dirty = false;
      toast(`${Tone.label(editingStyle)} 문안을 저장했습니다`);
    }

    view.querySelector('#saveBtn').onclick = save;
    view.querySelector('#resetBtn').onclick = () => {
      if (!confirm(`${Tone.label(editingStyle)} 말투의 ${info.label} 문안을 처음 상태로 되돌립니다.`)) return;
      Store.resetTemplate(editingStyle, k);
      dirty = false;
      render();
    };

    repaint();
  };

  /** 공고가 하나도 없을 때 템플릿 미리보기에 쓰는 예시 */
  function sampleposting() {
    return {
      업체명: '한빛식당', 직무: '주방보조', 지역: '수원 영통',
      근무형태: '주 5일', 근무시간: '오전 10시~오후 7시', 급여: '시급 12,000원',
      자격: '경력 무관, 초보 환영', 복지: '식사 제공, 4대보험',
      상세: '점심 장사 위주라 저녁이 있는 편입니다.',
      연락처: '010-0000-0000', 마감: '채용 시 마감', 태그: '#수원알바 #주방보조',
      style: Tone.DEFAULT_STYLE,
    };
  }

  /* ═══════════════ 설정 ═══════════════ */

  VIEWS.more = () => {
    setTop('설정');
    const s = Store.settings();
    const nPost = Store.postings().length;
    const nLog  = Store.logs().length;

    view.innerHTML = `
      <div class="section-label">이 앱이 하는 일</div>
      <div class="info">
        공고를 한 번 쓰면 채널마다 다른 문안을 만들고, 복사해두고, 그 채널을 띄우고,
        언제 다시 올려야 하는지 기억합니다.<br><br>
        <b>글을 대신 올려주지는 않습니다.</b> 네이버 블로그는 2020년에 글쓰기 API를 없앴고,
        카카오는 임의의 오픈톡방으로 메시지를 보내는 통로를 열어두지 않았으며,
        당근·카페도 외부 등록 수단이 없습니다.
        자동 로그인으로 우회하는 방법은 전부 약관 위반이고 계정이 막힐 수 있어 넣지 않았습니다.
      </div>

      <div class="section-label">이미지 카드 색</div>
      <div class="chips" id="themeChips">
        ${Card.themeList().map(t => `<span class="chip ${t.id === s.cardTheme ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</span>`).join('')}
      </div>

      <div class="section-label">보관</div>
      <div class="info">모든 내용은 이 기기 안에만 있습니다. 기기를 바꾸실 때는 내보낸 파일을 옮기세요.<br>
      지금 공고 ${nPost}개 · 게재 기록 ${nLog}건.</div>
      <div class="btn-row">
        <button class="btn" id="expBtn">내보내기</button>
        <button class="btn" id="impBtn">가져오기</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost danger" id="wipeBtn">전부 지우기</button>
      </div>
      <input type="file" id="impFile" accept="application/json,.json" class="hidden">

      <div class="section-label">게재 기록</div>
      ${nLog ? Store.logs().slice(0, 20).map(l => {
        const p = Store.posting(l.postingId), c = Store.channel(l.channelId);
        if (!p || !c) return '';
        return `<div class="row"><div class="body">
          <div class="name">${esc(c.name)}</div>
          <div class="meta">${esc(Compose.title(p))} · ${when(l.at)}</div>
        </div></div>`;
      }).join('') : '<div class="info">아직 기록이 없습니다.</div>'}`;

    view.querySelectorAll('#themeChips .chip').forEach(c => {
      c.onclick = () => { Store.setSetting('cardTheme', c.dataset.t); render(); };
    });

    view.querySelector('#expBtn').onclick = () => {
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      Publish.download(`구인캐스터-백업-${stamp}.json`, Store.exportJSON(), 'application/json');
      toast('내보냈습니다');
    };

    const file = view.querySelector('#impFile');
    view.querySelector('#impBtn').onclick = () => file.click();
    file.onchange = () => {
      const f = file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          if (!confirm('지금 들어있는 내용을 파일 내용으로 덮어씁니다. 계속할까요?')) return;
          Store.importJSON(r.result);
          stack = [];
          tabTo('home');
          toast('가져왔습니다');
        } catch (e) {
          alert('읽지 못했습니다 — ' + e.message);
        }
      };
      r.readAsText(f);
      file.value = '';
    };

    view.querySelector('#wipeBtn').onclick = () => {
      if (!confirm('공고·채널·기록을 전부 지웁니다. 되돌릴 수 없습니다.')) return;
      if (!confirm('정말 지울까요? 내보내기를 먼저 해두시는 걸 권합니다.')) return;
      Store.wipe();
      stack = [];
      tabTo('home');
    };
  };

  /* ─────────── 시작 ─────────── */

  function start() {
    backBtn.onclick = back;
    document.getElementById('sheetScrim').onclick = closeSheet;
    document.getElementById('sheetClose').onclick = closeSheet;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { sheet.classList.contains('hidden') ? back() : closeSheet(); }
    });
    tabbar.querySelectorAll('.tab').forEach(b => {
      b.onclick = () => tabTo(b.dataset.tab);
    });
    render();
  }

  return { start, go, back, tabTo, toast, render, closeSheet, get stackDepth() { return stack.length; }, get sheetOpen() { return !sheet.classList.contains('hidden'); } };

})();
