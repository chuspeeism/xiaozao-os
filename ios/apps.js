// 小灶 iOS · App 视图与导航（iOS 26 风格）
(function () {
  var CONTENT = window.XZContent || {};
  var BILI = 'https://space.bilibili.com/3537118131391269';
  var CALL_DIALING = 'os/media/call-dialing.m4a?v=20260612';
  var CALL_CONNECTED = 'os/media/call-connected.m4a?v=20260612';
  var CALL_DIALING_MS = 7660;
  var CALL_CONNECTED_MS = 6640;

  /* ---------- 小图标（currentColor SVG） ---------- */
  var SVG = {
    mag: '<svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"></circle><path d="M13.5 13.5L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>',
    mic: '<svg viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor"></rect><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"></path></svg>',
    cloud: '<svg viewBox="0 0 28 22" fill="none"><path d="M8 18.5h11.5a4.8 4.8 0 0 0 .8-9.54A7 7 0 0 0 7.2 6.9 5.3 5.3 0 0 0 8 18.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"></path><path d="M14 8.5v6.5m0 0-2.4-2.4M14 15l2.4-2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    clock: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="currentColor"></circle><path d="M11 6v5l3.2 2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"></path></svg>',
    folderP: '<svg viewBox="0 0 24 20"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h4l2 2.5h8A2.5 2.5 0 0 1 21 7v8.5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 2 15.5z" fill="currentColor"></path><circle cx="9.5" cy="11" r="2" fill="#fff"></circle><path d="M5.5 16c.5-1.7 2.2-2.6 4-2.6s3.5.9 4 2.6z" fill="#fff"></path></svg>',
    folder: '<svg viewBox="0 0 24 20"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h4l2 2.5h8A2.5 2.5 0 0 1 21 7v8.5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 2 15.5z" fill="currentColor"></path></svg>',
    phone: '<svg viewBox="0 0 22 22"><path d="M6.6 3.2 8.4 6c.4.6.3 1.3-.2 1.8L6.9 9.1a13 13 0 0 0 6 6l1.3-1.3c.5-.5 1.2-.6 1.8-.2l2.8 1.8c.7.5.8 1.5.2 2.1l-1.4 1.4c-.7.7-1.7 1-2.6.7C9.8 18 4 12.2 2.4 7c-.3-1 0-2 .7-2.6l1.4-1.4c.6-.6 1.6-.5 2.1.2z" fill="currentColor"></path></svg>',
    person: '<svg viewBox="0 0 22 22"><circle cx="11" cy="7.5" r="4" fill="currentColor"></circle><path d="M3.5 19c.8-3.6 4-5.5 7.5-5.5s6.7 1.9 7.5 5.5z" fill="currentColor"></path></svg>',
    keypad: (function () {
      var s = '<svg viewBox="0 0 22 22">';
      [4, 11, 18].forEach(function (y, yi) {
        [4, 11, 18].forEach(function (x) {
          if (yi === 2 && x !== 11) return;
          s += '<circle cx="' + x + '" cy="' + y + '" r="2.2" fill="currentColor"></circle>';
        });
      });
      return s + '</svg>';
    })()
  };

  var VIDEOS = (CONTENT.videos && CONTENT.videos.length) ? CONTENT.videos : [
    { title: 'Claude design 可交互 PPT', url: BILI, cover: '', platform: 'B站' },
    { title: '三招去除图片 AI 味', url: BILI, cover: '', platform: 'B站' }
  ];
  var DOCS = (CONTENT.docs && CONTENT.docs.length) ? CONTENT.docs : [
    { title: 'Claude Design 可交互 PPT 实操手册', url: '#', source: '飞书' },
    { title: '三招去除图片 AI 味 操作清单', url: '#', source: '飞书' }
  ];
  var CASES = window.XZCases || {};
  var TEAM = [
    { id: 'dashi', nm: '大师', letter: 'D', role: '创始人 · AI 实战应用探索家', av: 'os/avatars/dashi.jpg',
      bio: '擅长将复杂技术转化为实用工作流，把「看不懂」变成「马上用」。' },
    { id: 'hongdou', nm: '红豆', letter: 'H', role: '创始人 · 运营操盘手', av: 'os/avatars/hongdou.png',
      bio: '曾带领多个爆款产品从 0 到 1，最懂内容如何触达真实需求。' },
    { id: 'jadon7', nm: 'Jadon7', letter: 'J', role: '合伙人 · 多面体技术极客', av: 'os/avatars/jadon7.png',
      bio: '热衷于全球 AI 工具的体验、测评与教程，新工具第一手开箱。' }
  ];
  var FX = {
    fable: {
      wm: 'Claude Fable',
      h: '用 Claude Fable，<em>把故事做成作品</em>',
      cases: CASES.fable || []
    },
    design: {
      wm: 'Claude Design',
      h: '用 Claude Design，<em>把灵感做成界面</em>',
      cases: CASES.design || []
    }
  };
  var QRS = {
    wechat: { t: '微信 · 进群', img: 'os/qrs/wechat.png', hint: '微信扫一扫，进群开小灶' },
    shipinhao: { t: '视频号', img: 'os/qrs/shipinhao.png', hint: '微信扫一扫，关注视频号' }
  };

  /* ---------- 模板 ---------- */
  function nav(backLabel, title) {
    return '<header class="nav"><button class="back" data-back><span class="chev">‹</span> ' + backLabel + '</button><b class="ttl">' + title + '</b></header>';
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function videosScr() {
    var rows = VIDEOS.map(function (v) {
      return '<a class="grow" href="' + attr(v.url) + '" target="_blank" rel="noopener">' +
        '<span class="vthumb">' + (v.cover ? '<img src="' + attr(v.cover) + '" alt="" />' : '') + '<span class="play">▶</span></span>' +
        '<span><span class="fn">' + esc(v.title) + '</span><span class="fmeta">' + esc(v.platform || '视频') + ' · 完整教程</span></span>' +
        '<span class="chev">›</span></a>';
    }).join('');
    return '<div class="scr" id="scr-videos">' + nav('主屏', '教程视频') +
      '<div class="scr-body"><h1 class="big-title">教程视频</h1>' +
      '<p class="glabel">' + VIDEOS.length + ' 个视频 · 原始平台链接</p>' +
      '<div class="glist">' + rows + '</div></div></div>';
  }
  /* 文档 → 文件 App */
  function docScr() {
    var rows = DOCS.map(function (d) {
      return '<a class="fl-row" href="' + attr(d.url) + '" target="_blank" rel="noopener">' +
        '<span class="fl-doc"></span>' +
        '<span class="col"><span class="fn">' + esc(d.title) + '</span><span class="fmeta">飞书文档 · ' + esc(d.source || '教程') + '</span></span>' +
        '<span class="dl">' + SVG.cloud + '</span></a>';
    }).join('');
    return '<div class="scr files" id="scr-doc">' +
      '<button class="fl-float lft" data-back>‹</button>' +
      '<button class="fl-float rgt" type="button">⋯</button>' +
      '<div class="scr-body">' +
      '<h1 class="fl-title">文档</h1>' +
      '<div class="fl-search">' + SVG.mag + ' 搜索 <span class="mic">' + SVG.mic + '</span></div>' +
      rows +
      '<p class="fl-count">' + DOCS.length + ' 项</p>' +
      '</div>' +
      '<div class="fl-tabwrap"><div class="fl-tabbar">' +
      '<button class="fl-tab" type="button">' + SVG.clock + '最近项目</button>' +
      '<button class="fl-tab on" type="button">' + SVG.folderP + '文档</button>' +
      '<button class="fl-tab" type="button">' + SVG.folder + '浏览</button>' +
      '</div></div></div>';
  }
  /* 团队 → 联系人列表 */
  function teamScr() {
    var body = TEAM.map(function (m) {
      return '<p class="sec-letter">' + m.letter + '</p>' +
        '<button class="cts-row" data-member="' + m.id + '"><img src="' + m.av + '" alt="" /><span class="nm">' + m.nm + '</span></button>';
    }).join('');
    var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').join('<br>');
    return '<div class="scr cts" id="scr-team">' +
      '<button class="fl-float lft" data-back>‹</button>' +
      '<p class="cts-title">联系人</p>' +
      '<button class="fl-float rgt" type="button">＋</button>' +
      '<div class="scr-body">' +
      '<div class="me-row"><img src="os/avatars/dashi.jpg" alt="" /><span><span class="nm">大师的AI小灶</span><span class="sub">我的名片</span></span></div>' +
      body +
      '<p class="fl-count">3 张名片</p></div>' +
      '<div class="alpha-index">' + alpha + '</div>' +
      '<div class="fl-tabwrap"><div class="fl-tabbar">' +
      '<button class="fl-tab" type="button">' + SVG.phone + '通话</button>' +
      '<button class="fl-tab on" type="button">' + SVG.person + '通讯录</button>' +
      '<button class="fl-tab" type="button">' + SVG.keypad + '拨号键盘</button>' +
      '</div><button class="fl-circle" type="button">' + SVG.mag + '</button></div></div>';
  }
  /* 名片 → 液态玻璃 */
  function teamDetailScr() {
    return '<div class="scr ct-glass" id="scr-team-d">' +
      '<button class="fl-float lft" data-back>‹</button>' +
      '<button class="fl-float rgt pill" type="button">编辑</button>' +
      '<div class="cg-body" id="ct-detail-body"></div></div>';
  }
  function fillDetail(m) {
    var body = document.getElementById('ct-detail-body');
    body.classList.remove('is-calling');
    var callAttr = m.id === 'dashi' ? ' data-ios-call="' + m.id + '"' : '';
    body.innerHTML =
      '<img class="cg-avatar" src="' + m.av + '" alt="' + m.nm + '" />' +
      '<h2 class="cg-name">' + m.nm + '</h2><p class="cg-role">' + m.role + '</p>' +
      '<div class="cg-acts">' +
      '<button type="button" aria-label="信息"><img src="os/icons/ctl/ct-msg.svg" alt="" /></button>' +
      '<button type="button" aria-label="拨打' + attr(m.nm) + '"' + callAttr + '><img src="os/icons/ctl/ct-call.svg" alt="" /></button>' +
      '<button type="button" aria-label="视频"><img src="os/icons/ctl/ct-video.svg" alt="" /></button>' +
      '<button type="button" aria-label="邮件"><img src="os/icons/ctl/ct-mail.svg" alt="" /></button>' +
      '</div>' +
      '<div class="cg-card"><div class="cg-photo"><img src="' + m.av + '" alt="" /><span class="t">联系人照片与海报</span><span class="chev">›</span></div></div>' +
      '<div class="cg-card">' +
      '<div class="cg-kv"><p class="k">简介</p><p class="v">' + m.bio + '</p></div>' +
      '<div class="cg-kv"><p class="k">坐标</p><p class="v">北京 · 来自头部互联网大厂</p></div>' +
      '</div>';
  }
  var iosCallAudio = null;
  var iosCallTimer = null;
  var iosCallRun = 0;
  var iosCallMember = null;
  function stopIOSCall() {
    if (iosCallAudio) {
      try {
        iosCallAudio.pause();
        iosCallAudio.currentTime = 0;
        iosCallAudio.muted = true;
        iosCallAudio.removeAttribute('src');
        iosCallAudio.load();
      } catch (e) {}
      iosCallAudio = null;
    }
    if (iosCallTimer) {
      clearTimeout(iosCallTimer);
      iosCallTimer = null;
    }
  }
  function fillCall(m, statusText, cls) {
    var body = document.getElementById('ct-detail-body');
    body.classList.add('is-calling');
    body.innerHTML =
      '<div class="cg-call ' + cls + '">' +
      '<div class="cg-call-orb"><span></span><span></span><img src="' + m.av + '" alt="" /></div>' +
      '<p class="cg-call-chip">小灶音频通话</p>' +
      '<h2>' + m.nm + '</h2>' +
      '<p class="cg-call-status">' + statusText + '</p>' +
      '<button class="cg-hang" type="button" data-ios-hang aria-label="挂断">' + SVG.phone + '</button>' +
      '</div>';
  }
  function hangUpIOS(run) {
    if (run && run !== iosCallRun) return;
    iosCallRun += 1;
    stopIOSCall();
    if (iosCallMember) {
      fillCall(iosCallMember, '已挂断', 'ended');
      iosCallTimer = setTimeout(function () { fillDetail(iosCallMember); }, 900);
    }
  }
  function scheduleIOSClipEnd(run, done, ms) {
    if (iosCallTimer) clearTimeout(iosCallTimer);
    iosCallTimer = setTimeout(function () {
      iosCallTimer = null;
      if (run === iosCallRun) done();
    }, ms);
  }
  function playIOSClip(audio, run, ms, done) {
    iosCallAudio = audio;
    audio.currentTime = 0;
    audio.addEventListener('ended', function () {
      if (iosCallTimer) {
        clearTimeout(iosCallTimer);
        iosCallTimer = null;
      }
      if (run === iosCallRun) done();
    }, { once: true });
    var p = audio.play();
    if (p && p.catch) p.catch(function () {
      if (run === iosCallRun) scheduleIOSClipEnd(run, done, ms);
    });
  }
  function startIOSCall(id) {
    var m = TEAM.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    iosCallRun += 1;
    var run = iosCallRun;
    iosCallMember = m;
    stopIOSCall();
    fillCall(m, '正在呼叫...', 'dialing');
    playIOSClip(new Audio(CALL_DIALING), run, CALL_DIALING_MS, function () {
      fillCall(m, '已接通', 'connected');
      playIOSClip(new Audio(CALL_CONNECTED), run, CALL_CONNECTED_MS, function () { hangUpIOS(run); });
    });
  }
  function fxPane(key) {
    var f = FX[key];
    var cases = f.cases.map(function (c, i) {
      return '<a class="mcase" href="' + attr(c.url) + '" target="_blank" rel="noopener">' +
        '<span class="cov"><img src="' + attr(c.cover) + '" alt="" /></span>' +
        '<span class="row"><span class="idx">CASE ' + String(i + 1).padStart(2, '0') + '</span><span class="nm">' + esc(c.title) + '</span><span class="go">→</span></span></a>';
    }).join('');
    return '<div class="cs-wrap pane-' + key + '" data-pane="' + key + '"' + (key === 'fable' ? '' : ' style="display:none"') + '>' +
      '<div class="cs-brand"><img src="os/icons/claude.svg" alt="" /><b>' + f.wm + '</b><span class="x">×</span><span class="by">大师的AI小灶</span></div>' +
      '<h1 class="cs-h-m">' + f.h + '</h1>' + cases + '</div>';
  }
  function fxScr() {
    return '<div class="scr safari" id="scr-fx">' + nav('主屏', '上线效果') +
      '<div class="scr-body">' +
      '<div class="seg"><button class="on" data-seg="fable">Claude Fable</button><button data-seg="design">Claude Design</button></div>' +
      fxPane('fable') + fxPane('design') +
      '</div></div>';
  }
  function termScr() {
    return '<div class="scr term" id="scr-term">' + nav('主屏', 'xiaozao —— -zsh') +
      '<div class="scr-body term-out-m" id="term-out">' +
      '<p class="ln"><span class="prompt">xiaozao@os</span> <span class="dim">~</span> $ <span class="cmd">xiaozao --about</span></p>' +
      '<p class="term-logo">██ 大师的AI小灶 ██  v2026.06</p>' +
      '<p class="ln">定位  <span class="hl">面向职场人群的 AI 实战内容品牌</span></p>' +
      '<p class="ln">理念  我们不是理论派，而是实战派。</p>' +
      '<p class="ln">      不教大道理，<span class="hl">只传实用技</span>。</p>' +
      '<p class="ln">&nbsp;</p>' +
      '<p class="ln"><span class="dim"># 输入 help 查看可用命令，回车执行。</span></p>' +
      '</div>' +
      '<div class="term-line-m"><span class="prompt">xiaozao@os</span><span class="dim">&nbsp;~ $</span><input id="term-in" type="text" autocomplete="off" spellcheck="false" aria-label="终端输入" /></div></div>';
  }

  /* ---------- 终端命令 ---------- */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var QUN = 'https://u.wechat.com/MEW2EgIp6wvap_Y8C3Zuzzk';
  var CMDS = {
    help: ['可用命令：', '  about    品牌定位与理念', '  stats    关键数据', '  roadmap  2026 关键目标', '  find     各平台入口', '  clear    清屏'],
    about: ['定位  <span class="hl">面向职场人群的 AI 实战内容品牌</span>', '理念  不教大道理，<span class="hl">只传实用技</span>。', '<span class="dim"># 只要敢突破，就是了不起。</span>'],
    stats: ['<span class="ok">✓</span> 全网粉丝      50,000+', '<span class="ok">✓</span> 精选实战教程  10+', '<span class="ok">✓</span> 同步更新平台  5 个'],
    roadmap: ['[1] 完整的「AI小灶」内容体系 — 覆盖 12+ 职场场景', '[2] 知识共创社区 — 经验交流与能力进阶'],
    find: ['B站   <a class="hl" href="' + BILI + '" target="_blank" rel="noopener">完整视频教程</a>', '微信   <a class="hl" href="' + QUN + '" target="_blank" rel="noopener">和我们一起开小灶</a>']
  };
  function runCmd(v, out) {
    var cmd = v.toLowerCase().replace(/^xiaozao\s+--?/, '');
    if (cmd === 'clear') { out.innerHTML = ''; return; }
    var lines = /^sudo\b/.test(cmd) ? ['权限不足：灶台只有大师能动。'] :
      CMDS[cmd] || ['zsh: command not found: ' + esc(v) + '<span class="dim">（试试 help）</span>'];
    lines.forEach(function (l) {
      var p = document.createElement('p');
      p.className = 'ln';
      p.innerHTML = l;
      out.appendChild(p);
    });
  }

  /* ---------- 二维码弹层（微信 / 视频号） ---------- */
  function showQr(key) {
    var q = QRS[key];
    if (!q) return;
    var mask = document.createElement('div');
    mask.className = 'qr-mask';
    mask.innerHTML = '<div class="qr-card">' +
      '<h3>' + q.t + '</h3>' +
      '<img class="qr-img" src="' + q.img + '" alt="' + q.t + ' 二维码" />' +
      '<p class="hint">' + q.hint + '</p>' +
      '<button class="close" type="button">关闭</button></div>';
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('.close')) mask.remove();
    });
    document.body.appendChild(mask);
  }

  /* ---------- 装载 & 导航栈 ---------- */
  var screens = document.getElementById('screens');
  screens.innerHTML = videosScr() + docScr() + teamScr() + teamDetailScr() + fxScr() + termScr();

  function startDanmaku() {
    var texts = CONTENT.danmaku || [];
    var home = document.querySelector('.home');
    if (!texts.length || !home) return;
    var wrap = document.createElement('div');
    wrap.className = 'ios-danmaku';
    wrap.setAttribute('aria-hidden', 'true');
    home.appendChild(wrap);
    var lanes = [0, 34, 68].map(function (top) { return { top: top, availableAt: 0 }; });
    function spawn() {
      var now = performance.now();
      var open = lanes.filter(function (lane) { return lane.availableAt <= now; });
      if (!open.length) return;
      var lane = open[Math.floor(Math.random() * open.length)];
      var item = document.createElement('span');
      item.className = 'ios-danmaku-item';
      item.textContent = texts[Math.floor(Math.random() * texts.length)];
      var duration = 20 + Math.random() * 8;
      item.style.top = lane.top + 'px';
      item.style.animationDuration = duration.toFixed(1) + 's';
      item.style.opacity = (0.76 + Math.random() * 0.18).toFixed(2);
      wrap.appendChild(item);
      var width = item.getBoundingClientRect().width;
      var travel = window.innerWidth + width * 1.2;
      var safeDelay = duration * 1000 * Math.min(0.72, (width + 72) / travel);
      lane.availableAt = now + safeDelay;
      item.addEventListener('animationend', function () { item.remove(); });
    }
    for (var i = 0; i < 3; i += 1) setTimeout(spawn, i * 900);
    setInterval(spawn, 1800);
  }
  startDanmaku();

  function initStickerDrag() {
    var sticker = document.querySelector('.ios-sticker');
    if (!sticker) return;
    document.body.appendChild(sticker);
    var dragging = false, sx = 0, sy = 0, startLeft = 0, startTop = 0;
    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }
    sticker.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var r = sticker.getBoundingClientRect();
      startLeft = r.left;
      startTop = r.top;
      sticker.style.left = startLeft + 'px';
      sticker.style.top = startTop + 'px';
      sticker.style.right = 'auto';
      sticker.style.bottom = 'auto';
      sx = e.clientX;
      sy = e.clientY;
      dragging = true;
      sticker.classList.add('dragging');
      sticker.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', moveSticker);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    });
    function moveSticker(e) {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      var maxLeft = window.innerWidth - sticker.offsetWidth;
      var maxTop = window.innerHeight - sticker.offsetHeight;
      sticker.style.left = clamp(startLeft + e.clientX - sx, 0, maxLeft) + 'px';
      sticker.style.top = clamp(startTop + e.clientY - sy, 0, maxTop) + 'px';
    }
    function endDrag(e) {
      if (!dragging) return;
      if (e) e.stopPropagation();
      dragging = false;
      sticker.classList.remove('dragging');
      window.removeEventListener('pointermove', moveSticker);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    }
  }
  initStickerDrag();

  var stack = [];
  var status = document.querySelector('.status');
  function syncStatus() {
    var top = stack[stack.length - 1];
    status.classList.toggle('ink', !!top && !top.classList.contains('term') && !top.classList.contains('ct-glass'));
  }
  function clearAnimTimer(el) {
    if (el._iosAnimTimer) {
      clearTimeout(el._iosAnimTimer);
      el._iosAnimTimer = null;
    }
  }
  function setLaunchFrame(el, origin) {
    var r;
    if (origin && origin.getBoundingClientRect) {
      r = origin.getBoundingClientRect();
      el._iosLaunchOrigin = origin;
    } else if (el._iosLaunchOrigin && el._iosLaunchOrigin.getBoundingClientRect) {
      r = el._iosLaunchOrigin.getBoundingClientRect();
    }
    if (!r || !r.width || !r.height) {
      r = { left: window.innerWidth / 2 - 32, top: window.innerHeight * 0.68, width: 64, height: 64 };
    }
    el.style.setProperty('--launch-x', r.left + 'px');
    el.style.setProperty('--launch-y', r.top + 'px');
    el.style.setProperty('--launch-scale-x', Math.max(0.08, r.width / window.innerWidth));
    el.style.setProperty('--launch-scale-y', Math.max(0.06, r.height / window.innerHeight));
    el.style.setProperty('--launch-radius', Math.min(28, Math.max(18, r.width * 0.24)) + 'px');
  }
  function openScr(id, origin) {
    var el = document.getElementById(id);
    if (!el || stack.indexOf(el) >= 0) return;
    var top = stack[stack.length - 1];
    if (top) { top.classList.add('under'); top.classList.remove('open'); }
    if (!top) {
      clearAnimTimer(el);
      el.classList.remove('closing', 'under', 'open');
      el.classList.add('prelaunch');
      el.classList.add('zoom');
      setLaunchFrame(el, origin);
      el.offsetWidth;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.classList.remove('prelaunch');
          el.classList.add('open');
        });
      });
    } else {
      el.classList.remove('closing');
      el.classList.add('open');
      el.classList.remove('under');
    }
    stack.push(el);
    syncStatus();
  }
  function back() {
    var el = stack.pop();
    if (el) {
      if (el.classList.contains('zoom') && stack.length === 0) {
        clearAnimTimer(el);
        setLaunchFrame(el);
        el.classList.add('closing');
        el.classList.remove('open');
        el._iosAnimTimer = setTimeout(function () {
          el.classList.remove('closing', 'under', 'prelaunch');
          el._iosAnimTimer = null;
        }, 500);
      } else {
        el.classList.remove('open');
      }
    }
    var top = stack[stack.length - 1];
    if (top) { top.classList.remove('under'); top.classList.add('open'); }
    syncStatus();
  }
  function goHome() { while (stack.length) back(); }

  document.body.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-back]'))) { stopIOSCall(); back(); return; }
    if ((b = e.target.closest('[data-qr]'))) { showQr(b.getAttribute('data-qr')); return; }
    if ((b = e.target.closest('[data-ios-call]'))) { startIOSCall(b.getAttribute('data-ios-call')); return; }
    if ((b = e.target.closest('[data-ios-hang]'))) { hangUpIOS(); return; }
    if ((b = e.target.closest('[data-act]'))) { openScr('scr-' + b.getAttribute('data-act'), b); return; }
    if ((b = e.target.closest('[data-member]'))) {
      var m = TEAM.filter(function (x) { return x.id === b.getAttribute('data-member'); })[0];
      if (m) { stopIOSCall(); fillDetail(m); openScr('scr-team-d'); }
      return;
    }
    if ((b = e.target.closest('[data-seg]'))) {
      var key = b.getAttribute('data-seg');
      var scr = document.getElementById('scr-fx');
      scr.querySelectorAll('[data-seg]').forEach(function (x) { x.classList.toggle('on', x === b); });
      scr.querySelectorAll('[data-pane]').forEach(function (p) {
        p.style.display = p.getAttribute('data-pane') === key ? '' : 'none';
      });
      return;
    }
  });

  // 终端输入
  var tin = document.getElementById('term-in');
  var tout = document.getElementById('term-out');
  tin.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var v = tin.value.trim();
    var echo = document.createElement('p');
    echo.className = 'ln';
    echo.innerHTML = '<span class="prompt">xiaozao@os</span> <span class="dim">~</span> $ <span class="cmd">' + esc(tin.value) + '</span>';
    tout.appendChild(echo);
    if (v) runCmd(v, tout);
    tin.value = '';
    tout.scrollTop = tout.scrollHeight;
  });

  window.XZIOS = { openScr: openScr, back: back, goHome: goHome, showQr: showQr };
})();
