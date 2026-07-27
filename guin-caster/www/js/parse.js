/* parse.js — 남의 공고를 붙여넣으면 뜯어서 항목으로 나눕니다.
 *
 * 하는 일: 급여·근무시간·근무형태·지역·직무 같은 **사실**을 찾아내
 *          내 공고 항목에 채워 넣습니다. 그러면 내 말투로 다시 쓰입니다.
 *
 * 일부러 하지 않는 일:
 *   · 상대 업체의 상호와 연락처는 **가져오지 않습니다.** 찾아내되 따로 빼서
 *     "이건 넣지 않았습니다" 하고 보여주기만 합니다. 그대로 두면 남의 가게로
 *     지원 전화가 갑니다.
 *   · 상대가 쓴 문장을 상세 설명에 그대로 복사하지 않습니다. 남의 글이고,
 *     베낀 티가 나는 공고는 어차피 반응이 없습니다.
 *     참고하고 싶으면 원문을 따로 보여드리니 직접 골라 쓰시면 됩니다.
 */

const Parse = (() => {

  /* 자주 쓰이는 직무 이름. 여기 걸리면 가장 믿을 만합니다. */
  const JOBS = [
    '주방보조', '주방 보조', '조리보조', '조리사', '주방장', '홀서빙', '서빙', '홀알바', '홀 담당',
    '카운터', '캐셔', '캐시어', '바리스타', '제빵', '제과', '베이커리',
    '배달', '배송', '라이더', '기사', '운전', '상하차', '물류', '검수', '포장', '피킹',
    '판매', '매장관리', '매니저', '점장',
    '청소', '미화', '경비', '주차', '세차',
    '사무보조', '경리', '회계', '총무', '인사', '고객상담', '상담원', '텔레마케터',
    '간호조무사', '간호사', '요양보호사', '사회복지사', '보육교사', '보조교사', '강사',
    '생산직', '조립', '가공', '용접', '도장', '전기', '설비',
    '헤어', '미용', '네일', '피부관리', '헬퍼', '보조',
    '디자이너', '개발자', '마케터', 'MD', '영업',
  ];

  const FORMS = [
    [/주\s*(\d)\s*일/, (m) => `주 ${m[1]}일`],
    [/주말\s*(?:알바|근무)?/, () => '주말'],
    [/평일\s*(?:알바|근무)?/, () => '평일'],
    [/단기/, () => '단기'],
    [/장기/, () => '장기'],
    [/파트\s?타임|파트/, () => '파트타임'],
    [/풀\s?타임/, () => '풀타임'],
    [/정규직/, () => '정규직'],
    [/계약직/, () => '계약직'],
    [/아르바이트|알바/, () => '아르바이트'],
    [/오전\s?타임/, () => '오전타임'],
    [/오후\s?타임/, () => '오후타임'],
    [/마감\s?타임/, () => '마감타임'],
    [/시간\s?협의/, () => '시간 협의'],
    [/교대/, () => '교대'],
  ];

  const BENEFIT_WORDS = /식사|중식|석식|조식|밥|4대\s?보험|사대보험|보험|퇴직금|퇴직 ?연금|주차|인센티브|상여|명절|휴게|기숙사|숙소|간식|유니폼|교통비|월차|연차|승진|정직원 ?전환/;
  const REQUIRE_HEAD  = /^[\[\(\s■·\-*●▶]*\s*(지원\s?자격|자격\s?요건|우대\s?사항|자격|우대|조건|경력|필수)/;
  const BENEFIT_HEAD  = /^[\[\(\s■·\-*●▶]*\s*(복리\s?후생|근무\s?조건|복리|복지|혜택)/;

  /** 일할 곳 이름. 직무를 못 찾았을 때 "편의점 알바" 식으로 씁니다. */
  const PLACES = [
    '편의점', 'PC방', '피시방', '주유소', '노래방', '고깃집', '치킨집', '호프', '술집',
    '카페', '베이커리', '빵집', '분식집', '식당', '마트', '정육점', '세차장',
    '물류센터', '공장', '미용실', '네일샵', '학원', '독서실', '펜션', '모텔',
    '헬스장', '요양원', '어린이집', '병원', '약국',
  ];

  /** 접미사가 없어 따로 봐야 하는 광역 단위 */
  const REGIONS = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  ];

  /** 끝이 '구' 지만 지역이 아닌 말들 — "3번 출구" 같은 것에 걸리지 않도록 */
  const NOT_AREA = /^(급구|충원|출구|입구|창구|연구|요구|지구|학구|친구|도구|기구|가구|인구|축구|야구|농구|배구|탁구|안구|절구|욕구|생구|화구)$/;

  /** 끝이 '면' 이지만 지역이 아닌 말들 — "근무하시면" 같은 활용형 */
  const VERBISH = /하시|합니|습니|(하|되|이|으|었|겠|드|주|보|가|오|시)면$/;

  const clean = (s) => String(s || '')
    .replace(/^[\s■·\-*●▶◆▪️•]+/, '')
    .replace(/^[\[\(]\s*/, '')
    .replace(/\s*[\]\)]\s*$/, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')   // "급여 : " 같은 앞머리 제거
    .trim();

  /** 값만 남깁니다 — 항목 이름을 지우지 않습니다 (이미 떼어낸 뒤에 씁니다). */
  const tidy = (s) => String(s || '')
    .replace(/^[\s■·\-*●▶◆▪️•]+/, '')
    .replace(/\s*[\]\)]\s*$/, '')
    .trim();

  /** "■ 자격 요건 : 경력무관" → "경력무관" (머리말만 있으면 빈 문자열) */
  function afterHead(line, re) {
    const m = line.match(re);
    if (!m) return tidy(line);
    return tidy(line.slice(m[0].length).replace(/^[\s:：\-·]+/, ''));
  }

  /* ─────────── 항목별 찾기 ─────────── */

  /** 12000 → 12,000 (이미 쉼표가 있으면 그대로) */
  const comma = (s) => /,/.test(s) ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function findPay(t) {
    let m = t.match(/(시급|일급|주급|월급|연봉)\s*[:：]?\s*([\d][\d,]*)(\s*만)?\s*(원)?/);
    if (m) {
      const man = m[3] ? '만' : '';
      const num = man ? m[2] : comma(m[2]);   // "280만원" 은 쉼표를 넣지 않습니다
      return `${m[1]} ${num}${man}원`;
    }
    m = t.match(/(시급|일급|주급|월급|연봉)\s*[:：]?\s*협의/);
    if (m) return `${m[1]} 협의`;

    m = t.match(/월\s*([\d,]+)\s*만\s*원/);
    if (m) return `월급 ${m[1]}만원`;

    m = t.match(/([\d,]{4,})\s*원\s*\/?\s*(?:시간|시)/);
    if (m) return `시급 ${m[1]}원`;

    if (/급여\s*[:：]?\s*협의|보수\s*협의/.test(t)) return '협의';
    return '';
  }

  function findHours(t) {
    const AMPM = '(?:오전|오후|아침|저녁|밤|새벽|낮|점심)?';
    let m = t.match(new RegExp(`(${AMPM}\\s*\\d{1,2}\\s*시(?:\\s*\\d{1,2}\\s*분)?)\\s*[~\\-–—]\\s*(${AMPM}\\s*\\d{1,2}\\s*시(?:\\s*\\d{1,2}\\s*분)?)`));
    if (m) return `${m[1].replace(/\s+/g, ' ').trim()} ~ ${m[2].replace(/\s+/g, ' ').trim()}`;

    m = t.match(/(\d{1,2}:\d{2})\s*[~\-–—]\s*(\d{1,2}:\d{2})/);
    if (m) return `${m[1]} ~ ${m[2]}`;

    m = t.match(/(\d{1,2})\s*[~\-–—]\s*(\d{1,2})\s*시/);
    if (m) return `${m[1]}시 ~ ${m[2]}시`;

    return '';
  }

  function findForm(t) {
    const out = [];
    for (const [re, make] of FORMS) {
      const m = t.match(re);
      if (m) {
        const v = make(m);
        if (!out.includes(v)) out.push(v);
      }
    }
    return out.slice(0, 3).join(' · ');
  }

  function findArea(t) {
    const hits = [];
    const push = (v) => { if (v && !hits.includes(v)) hits.push(v); };

    // 서울·경기처럼 접미사가 없는 광역 단위
    const big = REGIONS.find(r => t.includes(r)) || '';

    // 시·군·구가 가장 믿을 만합니다. ("서구" 처럼 한 글자짜리도 있습니다)
    for (const m of t.matchAll(/([가-힣]{1,5}(?:시|군|구))(?![가-힣])/g)) {
      if (!NOT_AREA.test(m[1])) push(m[1]);
    }
    // 앞의 것이 없을 때만 역 이름
    if (!hits.length) {
      for (const m of t.matchAll(/([가-힣A-Za-z0-9]{2,8}역)(?![가-힣])/g)) push(m[1]);
    }
    // 동·읍·면은 오탐이 많아(근무하시면…) 마지막에 봅니다.
    if (!hits.length) {
      for (const m of t.matchAll(/([가-힣]{2,4}(?:동|읍|면))(?![가-힣])/g)) {
        if (!VERBISH.test(m[1])) push(m[1]);
      }
    }

    const out = hits.slice(0, 2);
    if (big && !out.some(v => v.startsWith(big))) out.unshift(big);
    return out.slice(0, 3).join(' ');
  }

  function findJob(t) {
    // 1) 알려진 직무 이름 — 가장 정확합니다.
    for (const j of JOBS) {
      if (t.includes(j)) return j.replace(/\s+/g, '');
    }
    // 2) "○○ 모집 / 구합니다" 앞의 말
    const m = t.match(/([가-힣A-Za-z]{2,10})\s*(?:직원)?\s*(?:을|를)?\s*(?:모집|구인|채용|구합니다|구해요|구함)/);
    if (m) {
      const w = m[1].replace(/^(급구|알바|신입|경력|정규직|계약직|직원|사람)$/, '');
      if (w && w.length >= 2) return w;
    }
    // 3) 직무 이름이 없으면 일할 곳으로 — "편의점 알바" 처럼
    for (const p of PLACES) {
      if (t.includes(p)) return p + ' 알바';
    }
    return '';
  }

  function findDeadline(t) {
    if (/채용\s?시\s?마감|충원\s?시\s?마감/.test(t)) return '채용 시 마감';
    if (/상시\s?(모집|채용)/.test(t)) return '상시 모집';
    const m = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:까지|마감)/);
    if (m) return `${m[1]}월 ${m[2]}일까지`;
    return '';
  }

  /** 줄 단위로 훑어야 하는 항목 (자격·복지) */
  function findBlocks(lines) {
    const req = [], ben = [];
    const usedIdx = new Set();

    lines.forEach((line, i) => {
      if (!line || usedIdx.has(i)) return;

      /* "■ 자격 요건" 처럼 머리말만 있는 줄과
         "자격요건 : 경력무관" 처럼 값이 붙은 줄을 같이 다룹니다.
         머리말은 값에 섞이지 않게 떼어냅니다.                        */
      const collect = (head, into, span) => {
        const rest = afterHead(line, head);
        if (rest) { into.push(rest); }
        usedIdx.add(i);

        for (let j = i + 1; j < Math.min(i + span, lines.length); j++) {
          if (!lines[j] || /^[\[\(■]/.test(lines[j])) break;
          // 값이 이미 붙어 있던 줄이면, 뒤따르는 항목 줄만 더 가져옵니다.
          if (rest && !/^[·\-*●▶▪️•]/.test(lines[j])) break;
          const v = clean(lines[j]);
          if (v) { into.push(v); usedIdx.add(j); }
        }
      };

      if (REQUIRE_HEAD.test(line))  { collect(REQUIRE_HEAD, req, 5); return; }
      if (BENEFIT_HEAD.test(line))  { collect(BENEFIT_HEAD, ben, 6); return; }

      // 머리말이 없어도 복지 낱말이 들어간 짧은 줄은 복지로 봅니다.
      if (BENEFIT_WORDS.test(line) && line.length <= 40) {
        const v = clean(line);
        if (v && !ben.includes(v)) { ben.push(v); usedIdx.add(i); }
      }
    });

    return {
      자격: [...new Set(req)].slice(0, 4).join('\n'),
      복지: [...new Set(ben)].slice(0, 5).join(', '),
      usedIdx,
    };
  }

  /* ─────────── 상대 업체 것 (가져오지 않음) ─────────── */

  function findTheirs(t, lines, area) {
    const theirs = {};

    const phone = t.match(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/)
               || t.match(/(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/);
    if (phone) theirs.연락처 = phone.slice(1).join('-');

    // 맨 앞 [상호]. 다만 "[강남]" 처럼 지역을 넣어두는 경우가 많아 걸러냅니다.
    const looksLikeArea = (v) =>
      /(시|군|구|동|읍|면|역)$/.test(v) ||
      REGIONS.some(r => v === r || v.startsWith(r)) ||
      (area && area.includes(v));

    let name = '';
    const bracket = (lines[0] || '').match(/^\[([^\]]{2,20})\]/);
    if (bracket && !looksLikeArea(bracket[1].trim())) name = bracket[1].trim();

    if (!name) {
      const m = t.match(/([가-힣A-Za-z0-9]{2,10}(?:\s[가-힣A-Za-z0-9]{1,8})?)\s*(?:에서|입니다)/);
      if (m) name = m[1].trim();
    }
    if (name && !/모집|구인|채용|급구|알바/.test(name) && !looksLikeArea(name)) {
      theirs.업체명 = name;
    }

    return theirs;
  }

  /* ─────────── 본체 ─────────── */

  /**
   * @returns {{fields, theirs, leftover, found:string[], missing:string[]}}
   *   fields   내 공고에 채워 넣을 항목
   *   theirs   상대 업체 것이라 일부러 빼둔 항목
   *   leftover 어디에도 안 들어간 원문 줄들 (참고용)
   */
  function analyze(raw) {
    const text = String(raw || '').replace(/\r/g, '').trim();
    const lines = text.split('\n').map(l => l.trim());
    const flat = text.replace(/\n/g, ' ');

    const blocks = findBlocks(lines);

    const fields = {
      직무:     findJob(flat),
      지역:     findArea(flat),
      근무형태: findForm(flat),
      근무시간: findHours(flat),
      급여:     findPay(flat),
      자격:     blocks.자격,
      복지:     blocks.복지,
      마감:     findDeadline(flat),
    };

    const theirs = findTheirs(text, lines, fields.지역);

    // 어느 항목에도 안 쓰인 줄 = 상대가 직접 쓴 문장. 참고용으로만 보여줍니다.
    const consumed = new Set(blocks.usedIdx);
    const leftover = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) =>
        l && !consumed.has(i) && l.length > 6 &&
        !/^[\[\(■·\-*=─━]+$/.test(l) &&
        !(theirs.연락처 && l.includes(theirs.연락처.replace(/-/g, ''))) &&
        !/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/.test(l))
      .map(({ l }) => l);

    const found   = Object.entries(fields).filter(([, v]) => v).map(([k]) => k);
    const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);

    return { fields, theirs, leftover, found, missing };
  }

  return { analyze, JOBS };

})();
