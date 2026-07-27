/* compose.js — 공고 하나를 채널별 문안으로 바꾸는 엔진
 *
 * 규칙은 두 개뿐입니다.
 *   1. {{항목}} 자리에 공고 내용이 들어간다.
 *   2. 내용이 비어 있는 {{항목}} 이 들어간 줄은 통째로 사라진다.
 *
 * 2번 덕분에 공고를 대충 채워도 문안에 "급여 : " 같은 빈 껍데기가 남지 않습니다.
 */

const Compose = (() => {

  const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

  /** 템플릿에서 쓸 수 있는 항목 이름 목록 (편집 화면의 도우미 칩) */
  const tokens = () => Store.FIELDS.map(f => f.key);

  function valueOf(posting, key) {
    const v = posting[key];
    return (v === undefined || v === null) ? '' : String(v).trim();
  }

  /**
   * 템플릿 + 공고 → 완성된 문안
   * 여러 줄짜리 항목(상세·자격·복지)은 줄 수만큼 늘어납니다.
   */
  function render(template, posting) {
    const lines = String(template || '').split('\n');
    const out = [];

    for (const line of lines) {
      const used = [...line.matchAll(TOKEN)].map(m => m[1]);

      // 이 줄이 쓰는 항목 중 하나라도 비어 있으면 줄을 버립니다.
      if (used.length && used.some(k => valueOf(posting, k) === '')) continue;

      let filled = line.replace(TOKEN, (_, k) => valueOf(posting, k));

      // 항목 안에 줄바꿈이 있으면 그만큼 줄을 늘립니다.
      out.push(...filled.split('\n'));
    }

    return tidy(out.join('\n'));
  }

  /** 빈 줄이 세 줄 이상 이어지는 것만 정리합니다. 문단 사이 한 줄은 그대로 둡니다. */
  function tidy(text) {
    return text
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 채널 하나에 올릴 문안.
   * 말투를 따로 넘기면 그 말투로 뽑습니다 (공고에 저장된 말투는 그대로 둔 채 비교해 볼 때).
   */
  function forChannel(posting, channel, style) {
    return render(Store.templateFor(channel, style || posting.style), posting);
  }

  /** 글자수 상태 — 채널 권장 길이를 넘었는지 */
  function measure(text, channel) {
    const kind = Store.KINDS[channel.kind] || Store.KINDS.etc;
    const n = text.length;
    return {
      count: n,
      limit: kind.limit,
      over: n > kind.limit,
      ratio: Math.min(1, n / kind.limit),
    };
  }

  /**
   * 공고를 올리기 전에 짚어줄 것들.
   * 막지는 않습니다 — 비워두는 게 맞는 경우도 있으니까요.
   */
  function warnings(posting) {
    const w = [];
    if (!valueOf(posting, '직무'))   w.push('직무가 비어 있습니다. 제목이 "구합니다"만 남습니다.');
    if (!valueOf(posting, '연락처')) w.push('연락처가 없으면 지원이 들어올 방법이 없습니다.');
    if (!valueOf(posting, '급여'))   w.push('급여를 적은 공고가 문의가 확실히 많습니다.');
    if (!valueOf(posting, '지역'))   w.push('지역이 없으면 동네 채널에서 잘 안 눌립니다.');

    const pay = valueOf(posting, '급여');
    // 2026년 최저임금 10,320원. 시급 표기가 이보다 낮으면 오타일 가능성이 큽니다.
    const m = pay.match(/시급\s*([\d,]+)/);
    if (m) {
      const won = parseInt(m[1].replace(/,/g, ''), 10);
      if (won && won < 10320) w.push(`시급 ${m[1]}원은 2026년 최저임금(10,320원)보다 낮습니다. 확인해 주세요.`);
    }
    return w;
  }

  /** 공고 목록에 보여줄 한 줄 요약 */
  function summary(posting) {
    const bits = ['지역', '직무', '급여'].map(k => valueOf(posting, k)).filter(Boolean);
    return bits.join(' · ') || '내용 없음';
  }

  function title(posting) {
    const 직무 = valueOf(posting, '직무');
    const 업체 = valueOf(posting, '업체명');
    if (직무 && 업체) return `${업체} ${직무}`;
    return 직무 || 업체 || '이름 없는 공고';
  }

  return { render, forChannel, measure, warnings, summary, title, tokens, tidy };

})();
