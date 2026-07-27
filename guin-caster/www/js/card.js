/* card.js — 공고 요약을 이미지 한 장으로
 *
 * 오픈톡방이나 당근처럼 글이 순식간에 밀려나는 곳에서는
 * 텍스트보다 이미지 한 장이 훨씬 오래 남습니다.
 * 외부 라이브러리 없이 캔버스로만 그립니다.
 */

const Card = (() => {

  const W = 1080, H = 1350;

  const THEMES = {
    ink:   { name: '먹',     bg: ['#14161A', '#20242B'], fg: '#F4F5F7', dim: '#9AA3AF', accent: '#7BD88F', chip: '#2A2F38' },
    paper: { name: '종이',   bg: ['#FBF7F0', '#F1EADD'], fg: '#1E1B16', dim: '#6E6252', accent: '#B4562A', chip: '#E6DCCA' },
    sky:   { name: '하늘',   bg: ['#0E2A47', '#164066'], fg: '#F2F7FC', dim: '#9EC0DC', accent: '#FFD166', chip: '#1D4E7A' },
    warm:  { name: '노을',   bg: ['#3A1E2A', '#63303A'], fg: '#FDF2EE', dim: '#D8A9A2', accent: '#FFB4A2', chip: '#572B36' },
  };

  const themeList = () => Object.entries(THEMES).map(([id, t]) => ({ id, ...t }));

  /* 시스템에 있는 한글 폰트를 순서대로 시도합니다. */
  const FONT = `"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif`;
  const font = (weight, size) => `${weight} ${size}px ${FONT}`;

  /** 글자를 폭에 맞춰 여러 줄로 자릅니다. 한글은 글자 단위로 끊어도 자연스럽습니다. */
  function wrap(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/(\s+)/);
    const lines = [];
    let line = '';

    const pushChar = (chunk) => {
      for (const ch of chunk) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
          lines.push(line); line = ch;
        } else line += ch;
      }
    };

    for (const w of words) {
      if (ctx.measureText(line + w).width <= maxWidth) { line += w; continue; }
      if (ctx.measureText(w).width > maxWidth) { pushChar(w); continue; }
      lines.push(line.trimEnd()); line = w.trimStart();
    }
    if (line.trim()) lines.push(line.trimEnd());

    if (maxLines && lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      cut[maxLines - 1] = cut[maxLines - 1].replace(/.$/, '…');
      return cut;
    }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  /**
   * 공고 → 캔버스
   * 값이 빈 항목은 아예 그리지 않습니다. 문안 규칙과 같습니다.
   */
  function draw(posting, themeId) {
    const t = THEMES[themeId] || THEMES.ink;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // 배경
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, t.bg[0]);
    g.addColorStop(1, t.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const M = 88;                 // 좌우 여백
    const inner = W - M * 2;

    // 글자를 위쪽 기준으로 그립니다. 기준선(baseline)으로 그리면
    // 글자 크기가 바뀔 때마다 간격을 다시 계산해야 하고, 큰 글자가 위를 침범합니다.
    ctx.textBaseline = 'top';

    const CONTACT_H = 132;
    const CONTACT_Y = H - 100 - CONTACT_H;

    let y = 120;
    const v = (k) => String(posting[k] || '').trim();

    // 마감 — 오른쪽 위 귀퉁이
    if (v('마감')) {
      ctx.font = font(600, 32);
      ctx.textAlign = 'right';
      ctx.fillStyle = t.dim;
      ctx.fillText(v('마감'), W - M, 66);
      ctx.textAlign = 'left';
    }

    // 지역 — 맨 위 작은 라벨
    if (v('지역')) {
      ctx.font = font(600, 38);
      ctx.fillStyle = t.accent;
      ctx.fillText(v('지역'), M, y);
      y += 58;
    }

    // 직무 — 제일 크게
    if (v('직무')) {
      ctx.font = font(800, 96);
      ctx.fillStyle = t.fg;
      for (const line of wrap(ctx, v('직무'), inner, 3)) {
        ctx.fillText(line, M, y);
        y += 112;
      }
      y += 14;
    }

    // 업체명
    if (v('업체명')) {
      ctx.font = font(500, 44);
      ctx.fillStyle = t.dim;
      ctx.fillText(wrap(ctx, v('업체명'), inner, 1)[0], M, y);
      y += 62;
    }

    // 구분선
    y += 20;
    ctx.strokeStyle = t.chip;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
    y += 46;

    // 핵심 항목 — 라벨 + 값
    const rows = [
      ['급여',     v('급여')],
      ['근무시간', v('근무시간')],
      ['근무형태', v('근무형태')],
    ].filter(r => r[1]);

    for (const [label, val] of rows) {
      ctx.font = font(700, 50);
      const lines = wrap(ctx, val, inner - 260, 2);

      // 라벨은 작으니 살짝 내려야 값과 눈높이가 맞습니다.
      ctx.font = font(500, 36);
      ctx.fillStyle = t.dim;
      ctx.fillText(label, M, y + 9);

      ctx.font = font(700, 50);
      ctx.fillStyle = t.fg;
      lines.forEach((line, i) => ctx.fillText(line, M + 260, y + i * 62));

      y += 62 * lines.length + 34;
    }

    // 자격·복지 — 연락처 칸까지 남은 공간에 들어가는 만큼만
    const extra = [v('자격'), v('복지')].filter(Boolean).join(' · ').replace(/\n+/g, ' · ');
    const room = Math.floor((CONTACT_Y - 40 - y) / 52);
    if (extra && room > 0) {
      ctx.font = font(400, 38);
      ctx.fillStyle = t.dim;
      for (const line of wrap(ctx, extra, inner, Math.min(3, room))) {
        ctx.fillText(line, M, y);
        y += 52;
      }
    }

    // 연락처 — 아래쪽에 고정. 이게 없으면 카드가 아무 소용이 없습니다.
    if (v('연락처')) {
      ctx.fillStyle = t.accent;
      roundRect(ctx, M, CONTACT_Y, inner, CONTACT_H, 28);
      ctx.fill();

      ctx.font = font(500, 30);
      ctx.fillStyle = t.bg[0];
      ctx.globalAlpha = 0.7;
      ctx.fillText('문의', M + 40, CONTACT_Y + 24);
      ctx.globalAlpha = 1;

      ctx.font = font(800, 54);
      ctx.fillStyle = t.bg[0];
      ctx.fillText(wrap(ctx, v('연락처'), inner - 80, 1)[0], M + 40, CONTACT_Y + 60);
    }

    return cv;
  }

  function toBlob(canvas) {
    return new Promise(res => canvas.toBlob(res, 'image/png'));
  }

  return { draw, toBlob, THEMES, themeList, W, H };

})();
