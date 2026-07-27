/* store.js — 저장소 · 데이터 모델
 *
 * 전부 기기 안(localStorage)에만 저장됩니다. 서버로 나가는 것이 없습니다.
 * 기기를 바꿀 때는 [설정 → 내보내기] 로 만든 .json 파일을 옮기면 됩니다.
 */

const Store = (() => {

  const KEY = 'guincaster.v1';

  /* ─────────── 채널 종류 ───────────
   * 종류마다 기본 문안 템플릿과 권장 글자수가 다릅니다.            */
  const KINDS = {
    blog:     { label: '블로그',   limit: 4000, desc: '길게 써도 되는 곳. 검색 유입을 노립니다.' },
    cafe:     { label: '카페',     limit: 1500, desc: '지역 카페·커뮤니티. 본문은 중간 길이로.' },
    daangn:   { label: '당근알바', limit:  800, desc: '동네 구인. 말투가 짧고 담백할수록 반응이 옵니다.' },
    openchat: { label: '오픈톡·단톡', limit: 300, desc: '스크롤로 흘러가는 곳. 3~5줄이 한계입니다.' },
    sms:      { label: '문자',     limit:   90, desc: 'LMS 기준. 넘기면 요금이 올라갑니다.' },
    etc:      { label: '기타',     limit: 2000, desc: '' },
  };

  /* ─────────── 처음 켰을 때 들어있는 채널 ───────────
   * 실제 쓰는 채널로 바꾸시면 됩니다. 오픈톡방은 방마다 하나씩 만드는 걸 권합니다.
   * bumpDays = 며칠 뒤에 다시 올릴지 (끌어올리기 주기)                  */
  const SEED_CHANNELS = [
    { name: '네이버 블로그',   kind: 'blog',     url: 'https://blog.naver.com/GoBlogWrite.naver', bumpDays: 7 },
    { name: '지역 맘카페',     kind: 'cafe',     url: '',                                        bumpDays: 7 },
    { name: '당근알바',        kind: 'daangn',   url: 'https://www.daangn.com/kr/jobs/',          bumpDays: 3 },
    { name: '오픈톡방 ①',      kind: 'openchat', url: '',                                        bumpDays: 2 },
    { name: '동네 단톡방',     kind: 'openchat', url: '',                                        bumpDays: 2 },
  ];

  /* 문안 템플릿은 tone.js 가 말투별로 들고 있습니다. */

  const EMPTY_POSTING = () => ({
    id: uid(),
    업체명: '', 직무: '', 지역: '',
    근무형태: '', 근무시간: '', 급여: '',
    자격: '', 복지: '', 상세: '',
    연락처: '', 마감: '',
    태그: '',
    style: Tone.DEFAULT_STYLE,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  /* 공고에서 쓰는 항목 순서 — 편집 화면과 템플릿 도우미가 이걸 따라갑니다. */
  const FIELDS = [
    { key: '업체명',   hint: '가게·회사 이름',            type: 'line' },
    { key: '직무',     hint: '주방보조, 배송기사, 홀서빙…', type: 'line' },
    { key: '지역',     hint: '수원 영통, 강남역 3번출구…',  type: 'line' },
    { key: '근무형태', hint: '주 5일 / 주말 알바 / 단기',   type: 'line' },
    { key: '근무시간', hint: '오전 9시~오후 6시',           type: 'line' },
    { key: '급여',     hint: '시급 12,000원 / 월 280만원',  type: 'line' },
    { key: '자격',     hint: '경력 무관, 초보 환영',        type: 'text' },
    { key: '복지',     hint: '식사 제공, 4대보험, 주차 가능', type: 'text' },
    { key: '상세',     hint: '길게 쓰고 싶은 이야기',       type: 'text' },
    { key: '연락처',   hint: '010-0000-0000',              type: 'line' },
    { key: '마감',     hint: '채용 시 마감 / 3월 20일',     type: 'line' },
    { key: '태그',     hint: '#수원알바 #주방보조',         type: 'line' },
  ];

  let state = load();

  /* ─────────── 저장 · 불러오기 ─────────── */

  function blank() {
    return {
      postings: [],
      channels: SEED_CHANNELS.map((c, i) => ({ id: uid(), enabled: true, order: i, ...c })),
      templates: Tone.seed(),
      logs: [],
      settings: { cardTheme: 'ink' },
    };
  }

  /**
   * 저장된 템플릿을 지금 구조에 맞춥니다.
   *
   * 말투가 생기기 전 저장본은 {blog:'…', cafe:'…'} 처럼 종류만 있었습니다.
   * 그 문안들이 지금의 '친근·동네' 말투 그대로라, 친근 쪽으로 옮겨 담습니다.
   * 직접 고쳐 쓰시던 문안이 그대로 살아남습니다.
   */
  function mergeTemplates(saved) {
    const base = Tone.seed();
    if (!saved || typeof saved !== 'object') return base;

    const isNewShape = Tone.ids().some(id => saved[id]);
    if (!isNewShape) {
      const old = {};
      for (const kind of Object.keys(KINDS)) {
        if (typeof saved[kind] === 'string') old[kind] = saved[kind];
      }
      base.friendly = { ...base.friendly, ...old };
      return base;
    }

    for (const id of Tone.ids()) {
      if (saved[id] && typeof saved[id] === 'object') {
        base[id] = { ...base[id], ...saved[id] };
      }
    }
    return base;
  }

  /* 말투가 없던 시절의 공고에 기본 말투를 달아 줍니다.
   *
   * 화살표 함수(const)로 두면 안 됩니다. 맨 위의 `let state = load()` 가
   * 이 줄보다 먼저 실행되는데, const 는 그때 아직 없는 것으로 취급돼
   * load() 안에서 터지고, 그 오류가 try/catch 에 삼켜져
   * 저장해 둔 내용이 통째로 사라집니다. 선언문이어야 끌어올려집니다.        */
  function fillPostings(list) {
    return (list || []).map(p => (p.style ? p : { ...p, style: Tone.DEFAULT_STYLE }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      // 나중에 항목이 늘어나도 예전 저장본이 깨지지 않게 채워 둡니다.
      const base = blank();
      return {
        postings: fillPostings(s.postings),
        channels: s.channels || base.channels,
        templates: mergeTemplates(s.templates),
        logs: s.logs || [],
        settings: { ...base.settings, ...(s.settings || {}) },
      };
    } catch (e) {
      // 여기로 오면 저장해 둔 내용이 통째로 버려집니다.
      // 조용히 넘어가면 알아챌 방법이 없으니 확실하게 남깁니다.
      console.error('저장본을 읽지 못해 새로 시작합니다 — 저장된 내용이 사라집니다', e);
      return blank();
    }
  }

  let warnedAboutSaving = false;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // 저장이 막힌 상황(용량 초과·사생활 보호 모드 등).
      // 조용히 죽는 것보다 알려주는 편이 낫지만, 한 번만 알립니다.
      if (!warnedAboutSaving) {
        warnedAboutSaving = true;
        alert('이 기기에 저장할 수 없습니다.\n' +
              '저장 공간이 찼거나 브라우저가 저장을 막고 있습니다. ' +
              '지금 쓰신 내용은 창을 닫으면 사라집니다.');
      }
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ─────────── 공고 ─────────── */

  const postings = () => state.postings.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const posting  = (id) => state.postings.find(p => p.id === id);

  function upsertPosting(p) {
    p.updatedAt = Date.now();
    const i = state.postings.findIndex(x => x.id === p.id);
    if (i >= 0) state.postings[i] = p; else state.postings.push(p);
    save();
    return p;
  }

  function removePosting(id) {
    state.postings = state.postings.filter(p => p.id !== id);
    state.logs     = state.logs.filter(l => l.postingId !== id);
    save();
  }

  /** 공고를 그대로 베낍니다. 비슷한 자리를 또 올릴 때 씁니다. */
  function duplicatePosting(id) {
    const src = posting(id);
    if (!src) return null;
    const copy = { ...src, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
    state.postings.push(copy);
    save();
    return copy;
  }

  /* ─────────── 채널 ─────────── */

  const channels = () => state.channels.slice().sort((a, b) => a.order - b.order);
  const channel  = (id) => state.channels.find(c => c.id === id);
  const activeChannels = () => channels().filter(c => c.enabled);

  function upsertChannel(c) {
    const i = state.channels.findIndex(x => x.id === c.id);
    if (i >= 0) state.channels[i] = c;
    else {
      c.id = c.id || uid();
      c.order = state.channels.length;
      state.channels.push(c);
    }
    save();
    return c;
  }

  function removeChannel(id) {
    state.channels = state.channels.filter(c => c.id !== id);
    state.logs     = state.logs.filter(l => l.channelId !== id);
    save();
  }

  function moveChannel(id, dir) {
    const list = channels();
    const i = list.findIndex(c => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
    save();
  }

  /* ─────────── 문안 템플릿 ───────────
   * 말투(style) × 채널 종류(kind) 로 한 벌씩 있습니다.            */

  const styleOf = (s) => (state.templates[s] ? s : Tone.DEFAULT_STYLE);

  /**
   * 채널에 개별 템플릿이 걸려 있으면 그것이 우선입니다 (말투와 무관하게 그 채널만의 문안).
   * 없으면 말투 × 종류의 기본 문안을 씁니다.
   */
  function templateFor(ch, style) {
    if (ch && ch.template) return ch.template;
    const set = state.templates[styleOf(style)];
    return set[ch ? ch.kind : 'etc'] || set.etc;
  }

  function setTemplate(style, kind, text) {
    state.templates[styleOf(style)][kind] = text;
    save();
  }

  function resetTemplate(style, kind) {
    state.templates[styleOf(style)][kind] = Tone.TEMPLATES[styleOf(style)][kind];
    save();
  }

  const templateOf = (style, kind) => state.templates[styleOf(style)][kind] || '';

  /* ─────────── 게재 이력 ─────────── */

  function logPost(postingId, channelId) {
    state.logs.push({ id: uid(), postingId, channelId, at: Date.now() });
    save();
  }

  function unlogLast(postingId, channelId) {
    // 실수로 눌렀을 때 되돌리기 — 가장 최근 것 하나만 지웁니다.
    let last = -1;
    state.logs.forEach((l, i) => {
      if (l.postingId === postingId && l.channelId === channelId) last = i;
    });
    if (last >= 0) { state.logs.splice(last, 1); save(); }
    return last >= 0;
  }

  const logs = () => state.logs.slice().sort((a, b) => b.at - a.at);

  /** 이 공고를 이 채널에 마지막으로 올린 시각 (없으면 null) */
  function lastPostedAt(postingId, channelId) {
    let t = null;
    for (const l of state.logs) {
      if (l.postingId === postingId && l.channelId === channelId) {
        if (t === null || l.at > t) t = l.at;
      }
    }
    return t;
  }

  const DAY = 86400000;

  /**
   * 채널별 게재 상태를 계산합니다.
   *   status: 'never'  아직 안 올림
   *           'due'    끌어올릴 때가 됨
   *           'fresh'  아직 올려둔 게 살아 있음
   */
  function statusOf(postingId, ch) {
    const at = lastPostedAt(postingId, ch.id);
    if (at === null) return { status: 'never', at: null, days: null, dueIn: 0 };
    const days = Math.floor((Date.now() - at) / DAY);
    const bump = ch.bumpDays || 7;
    return {
      status: days >= bump ? 'due' : 'fresh',
      at, days,
      dueIn: Math.max(0, bump - days),
    };
  }

  /** 오늘 손봐야 할 것들 — 홈 화면 맨 위에 뜨는 목록입니다. */
  function todo() {
    const out = [];
    for (const p of state.postings) {
      for (const ch of activeChannels()) {
        const s = statusOf(p.id, ch);
        if (s.status !== 'fresh') out.push({ posting: p, channel: ch, ...s });
      }
    }
    // 오래 방치된 것부터
    return out.sort((a, b) => (b.days === null ? 1e9 : b.days) - (a.days === null ? 1e9 : a.days));
  }

  /* ─────────── 설정 · 백업 ─────────── */

  const settings = () => state.settings;

  function setSetting(k, v) { state.settings[k] = v; save(); }

  function exportJSON() {
    return JSON.stringify({ app: 'guin-caster', version: 1, exportedAt: Date.now(), data: state }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    if (!data || !Array.isArray(data.postings)) throw new Error('구인 캐스터 백업 파일이 아닙니다.');
    state = {
      postings: fillPostings(data.postings),
      channels: data.channels || blank().channels,
      templates: mergeTemplates(data.templates),
      logs: data.logs || [],
      settings: { ...blank().settings, ...(data.settings || {}) },
    };
    save();
  }

  function wipe() {
    state = blank();
    save();
  }

  return {
    KINDS, FIELDS, EMPTY_POSTING, uid,
    postings, posting, upsertPosting, removePosting, duplicatePosting,
    channels, channel, activeChannels, upsertChannel, removeChannel, moveChannel,
    templateFor, templateOf, setTemplate, resetTemplate, templates: () => state.templates,
    logPost, unlogLast, logs, lastPostedAt, statusOf, todo,
    settings, setSetting, exportJSON, importJSON, wipe,
  };

})();
