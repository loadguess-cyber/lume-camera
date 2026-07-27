/* publish.js — 문안을 실제로 채널까지 옮기는 부분
 *
 * 여기서 분명히 해둘 것: 이 앱은 대신 글을 올려주지 않습니다.
 * 블로그·카페·당근·오픈톡 어디에도 "외부 프로그램이 글을 등록하는" 공식 통로가 없습니다.
 * (네이버 블로그 글쓰기 API는 2020년에 폐지됐고, 카카오는 임의의 오픈톡방에
 *  메시지를 보내는 API를 열어두지 않았습니다.)
 *
 * 그래서 하는 일은 이겁니다 — 문안을 클립보드에 넣고, 그 채널을 띄우고,
 * 돌아오면 "올렸음"으로 기록합니다. 붙여넣기 한 번만 사람이 합니다.
 */

const Publish = (() => {

  /* ─────────── 클립보드 ─────────── */

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 권한이 없거나 https 가 아닐 때 — 옛날 방식으로 한 번 더 시도합니다.
      return legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* ─────────── 공유 (카톡으로 바로 보낼 때) ─────────── */

  const canShare = () => typeof navigator.share === 'function';

  async function share(text, title) {
    if (!canShare()) return false;
    try {
      await navigator.share({ text, title: title || '구인 공고' });
      return true;
    } catch (e) {
      // 사용자가 공유 창을 닫은 것도 여기로 옵니다 — 실패로 치지 않습니다.
      return e && e.name === 'AbortError' ? 'cancel' : false;
    }
  }

  /** 이미지까지 같이 공유 (오픈톡·당근에 카드 이미지를 붙일 때) */
  async function shareWithImage(text, blob, filename) {
    if (!canShare() || !blob) return share(text);
    const file = new File([blob], filename || '공고.png', { type: 'image/png' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return share(text);
    try {
      await navigator.share({ text, files: [file] });
      return true;
    } catch (e) {
      return e && e.name === 'AbortError' ? 'cancel' : false;
    }
  }

  /* ─────────── 채널 열기 ─────────── */

  /** 카카오톡 앱 자체를 띄우는 주소. 특정 방까지는 못 갑니다 — 방 선택은 사람이 합니다. */
  const KAKAO_SCHEME = 'kakaotalk://';

  function open(channel) {
    const url = (channel.url || '').trim();

    if (url) {
      window.open(url, '_blank', 'noopener');
      return true;
    }

    // 주소를 안 적어둔 오픈톡·단톡 채널이면 카카오톡을 띄웁니다.
    if (channel.kind === 'openchat') {
      location.href = KAKAO_SCHEME;
      return true;
    }

    return false; // 열 곳이 없음 — 화면에서 안내합니다.
  }

  /* ─────────── 게재 큐 ───────────
   * 공고 하나를 여러 채널에 순서대로 올리는 흐름을 들고 있습니다.  */

  function makeQueue(postingId, channelIds) {
    return {
      postingId,
      ids: channelIds.slice(),
      index: 0,
      done: [],
      get current() { return Store.channel(this.ids[this.index]); },
      get remaining() { return this.ids.length - this.index; },
      get finished() { return this.index >= this.ids.length; },
      /** 올렸다고 기록하고 다음 채널로 */
      complete() {
        const ch = this.current;
        if (!ch) return;
        Store.logPost(this.postingId, ch.id);
        this.done.push(ch.id);
        this.index++;
      },
      /** 이번 채널은 건너뛰기 (기록하지 않음) */
      skip() { this.index++; },
      back() { if (this.index > 0) this.index--; },
    };
  }

  /* ─────────── 파일로 내려받기 ─────────── */

  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { copy, share, shareWithImage, canShare, open, makeQueue, download };

})();
