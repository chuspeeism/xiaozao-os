// 小灶 OS · 应用内容（终端 / 访达列表 / Safari 起始页 / 通讯录暗色名片）
(function () {
  var CONTENT = window.XZContent || {};
  var BILI = 'https://space.bilibili.com/3537118131391269';
  var QUN = 'https://u.wechat.com/MEW2EgIp6wvap_Y8C3Zuzzk';
  var CALL_DIALING = 'os/media/call-dialing.m4a?v=20260612';
  var CALL_CONNECTED = 'os/media/call-connected.m4a?v=20260612';
  var CALL_DIALING_MS = 7660;
  var CALL_CONNECTED_MS = 6640;
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/"/g, '&quot;');
  }

  /* ---------- 访达 · 文档 ---------- */
  var DOCS = (CONTENT.docs && CONTENT.docs.length) ? CONTENT.docs : [
    { title: 'Claude Design 可交互 PPT 实操手册', url: '#', source: '飞书' },
    { title: '三招去除图片 AI 味 操作清单', url: '#', source: '飞书' },
    { title: 'AI 配音活人感 参数模板', url: '#', source: '飞书' },
    { title: '高级大片感 PPT 三招清单', url: '#', source: '飞书' }
  ];
  function docTag(d) {
    var m = String(d.title || '').match(/^【([^】]+)】/);
    return m ? m[1] : '其他';
  }
  var DOC_TAGS = DOCS.reduce(function (tags, d) {
    var tag = docTag(d);
    if (tags.indexOf(tag) < 0) tags.push(tag);
    return tags;
  }, []);
  var finderBar = '<div class="finder-bar">' +
    '<span class="navs"><img src="os/icons/ctl/back.svg" alt="后退" /><img class="dis" src="os/icons/ctl/forward.svg" alt="前进" /></span>' +
    '<span class="ttl">教程文档</span><span class="sp"></span>' +
    '<span class="seg"><span class="on"><img src="os/icons/ctl/view-2.svg" alt="列表" /></span><span><img src="os/icons/ctl/view-1.svg" alt="图标" /></span></span>' +
    '<span class="search">搜索</span></div>';
  function finderHtml() {
    var rows = DOCS.map(function (d) {
      return '<a class="fl-row" data-doc-tag="' + escAttr(docTag(d)) + '" href="' + escAttr(d.url) + '" target="_blank" rel="noopener">' +
        '<span class="nm"><span class="f-doc"></span><b>' + escHtml(d.title) + '.url</b></span>' +
        '<span class="c2">' + escHtml(d.source || '飞书') + '</span>' +
        '<span class="c3">链接</span>' +
        '<span class="c4">飞书文档</span></a>';
    }).join('');
    var tagItems = DOC_TAGS.map(function (tag) {
      return '<button class="it" type="button" data-doc-filter="' + escAttr(tag) + '"><span class="f-folder"></span>' + escHtml(tag) + '</button>';
    }).join('');
    return '<div class="finder">' +
      '<nav class="finder-side">' +
      '<p class="grp">个人收藏</p>' +
      '<button class="it on" type="button" data-doc-filter=""><span class="f-folder"></span>全部</button>' +
      '<p class="grp">标签</p>' +
      tagItems +
      '<p class="grp">位置</p>' +
      '<span class="it"><span class="f-folder"></span>大师的AI小灶 共享盘</span>' +
      '<span class="it"><span class="f-folder"></span>飞书空间</span>' +
      '</nav>' +
      '<div class="finder-list">' +
      '<div class="fl-head"><span>名称</span><span>来源</span><span>大小</span><span>种类</span></div>' +
      rows +
      '</div></div>' +
      '<div class="finder-crumbs">大师的AI小灶 共享盘 <span class="sep">›</span> 文稿 <span class="sep">›</span> <span class="here">教程文档</span></div>' +
      '<p class="finder-status"><span class="doc-count">' + DOCS.length + '</span> 个项目 · 来自飞书教程文档</p>';
  }

  /* ---------- Safari · 上线效果（双标签页 + 封面案例） ---------- */
  var CASES = window.XZCases || {};
  var FX_URLS = { fable: 'claude-fable.example.com/cases', design: 'claude-design.example.com/cases' };
  var webBar = '<div class="web-bar">' +
    '<span class="navs"><img src="os/icons/ctl/back.svg" alt="后退" /><img class="dis" src="os/icons/ctl/forward.svg" alt="前进" /></span>' +
    '<input class="web-url" id="fx-url" type="text" value="' + escAttr(FX_URLS.fable) + '" readonly aria-label="地址" />' +
    '<span class="acts"><img src="os/icons/ctl/web-share.svg" alt="分享" /><img src="os/icons/ctl/web-add.svg" alt="新建标签页" /><img src="os/icons/ctl/web-tabs.svg" alt="标签页概览" /></span></div>';
  function csCase(c, idx) {
    var inner = '<span class="cov"><img src="' + escAttr(c.cover) + '" alt="" /></span>' +
      '<span class="cs-row">' +
      '<span class="cs-idx">CASE ' + idx + '</span>' +
      '<span class="nm">' + escHtml(c.title) + '</span>' +
      '<span class="cs-go">→</span></span>';
    return '<a class="cs-card" href="' + escAttr(c.url) + '" data-case-title="' + escAttr(c.title) + '">' + inner + '</a>';
  }
  var CS_CONF = {
    fable: {
      cls: '', wm: 'Claude Fable',
      h: '用 Claude Fable，<em>把故事做成作品</em>',
      cases: CASES.fable || []
    },
    design: {
      cls: ' design', wm: 'Claude Design',
      h: '用 Claude Design，<em>把灵感做成界面</em>',
      cases: CASES.design || []
    }
  };
  function csSite(key) {
    var c = CS_CONF[key];
    return '<div class="web-pane" data-pane="' + key + '"' + (key === 'fable' ? '' : ' style="display:none"') + '>' +
      '<div class="cs-site' + c.cls + '">' +
      '<div class="cs-nav"><img src="os/icons/claude.svg" alt="" /><span class="wm">' + c.wm + '</span>' +
      '<span class="x">×</span><span class="by">大师的AI小灶</span>' +
      '<span class="cs-pill">案例集</span></div>' +
      '<h1 class="cs-h">' + c.h + '</h1>' +
      '<p class="cs-sub">' + c.cases.length + ' 个真实工程效果，来自小灶实测项目。</p>' +
      '<div class="cs-grid">' +
      c.cases.map(function (item, i) { return csCase(item, String(i + 1).padStart(2, '0')); }).join('') +
      '</div></div></div>';
  }
  function browserHtml() {
    return '<div class="web-tabbar">' +
      '<button class="web-tab on" data-fx="fable"><img class="fav" src="os/icons/claude.svg" alt="" />Claude Fable</button>' +
      '<button class="web-tab" data-fx="design"><img class="fav" src="os/icons/claude.svg" alt="" />Claude Design</button>' +
      '</div>' +
      '<div class="web-page">' + csSite('fable') + csSite('design') + '</div>';
  }

  /* ---------- 通讯录 · 团队 ---------- */
  var TEAM = [
    { id: 'dashi', nm: '大师', role: '创始人 · AI 实战应用探索家', av: 'os/avatars/dashi.jpg',
      bio: '擅长将复杂技术转化为实用工作流，把「看不懂」变成「马上用」。' },
    { id: 'hongdou', nm: '红豆', role: '创始人 · 运营操盘手', av: 'os/avatars/hongdou.png',
      bio: '曾带领多个爆款产品从 0 到 1，最懂内容如何触达真实需求。' },
    { id: 'jadon7', nm: 'Jadon7', role: '合伙人 · 多面体技术极客', av: 'os/avatars/jadon7.png',
      bio: '热衷于全球 AI 工具的体验、测评与教程，新工具第一手开箱。' }
  ];
  var ctBar = '<div class="ct-bar"><span class="sp"></span>' +
    '<span class="pill">编辑</span><span class="pill">＋</span><span class="pill">搜索</span></div>';
  function contactsHtml() {
    var list = TEAM.map(function (m, i) {
      return '<button class="ct-item' + (i === 0 ? ' on' : '') + '" data-ct="' + m.id + '">' +
        '<span class="mini"><img src="' + m.av + '" alt="" /></span>' +
        '<span class="nm-wrap">' + m.nm + '</span></button>';
    }).join('');
    var cards = TEAM.map(function (m, i) {
      var callAttr = m.id === 'dashi' ? ' data-call="' + m.id + '"' : '';
      return '<div class="ct-card" data-card="' + m.id + '"' + (i === 0 ? '' : ' style="display:none"') + '>' +
        '<img class="big-avatar" src="' + m.av + '" alt="' + m.nm + ' 头像" />' +
        '<h3>' + m.nm + '</h3><p class="role">' + m.role + '</p>' +
        '<div class="ct-actions">' +
        '<button class="ct-action" type="button" aria-label="信息"><img src="os/icons/ctl/ct-msg.svg" alt="" /></button>' +
        '<button class="ct-action ct-call-action" type="button" aria-label="拨打' + escAttr(m.nm) + '"' + callAttr + '><img src="os/icons/ctl/ct-call.svg" alt="" /></button>' +
        '<button class="ct-action" type="button" aria-label="视频"><img src="os/icons/ctl/ct-video.svg" alt="" /></button>' +
        '<button class="ct-action" type="button" aria-label="邮件"><img src="os/icons/ctl/ct-mail.svg" alt="" /></button>' +
        '</div>' +
        '<div class="ct-group">' +
        '<div class="fld"><span class="k">简介</span><span class="v">' + m.bio + '</span></div>' +
        '<div class="fld"><span class="k">坐标</span><span class="v">北京 · 来自头部互联网大厂</span></div>' +
        '</div></div>';
    }).join('');
    return '<div class="contacts">' +
      '<nav class="ct-list">' + list + '<p class="ct-count">3 张名片</p></nav>' +
      '<div class="ct-detail">' + cards +
      '<div class="ct-call-screen" hidden>' +
      '<div class="ct-call-orb"><span></span><span></span><img class="ct-call-avatar" src="os/avatars/dashi.jpg" alt="" /></div>' +
      '<p class="ct-call-chip">小灶音频通话</p>' +
      '<h3 class="ct-call-name">大师</h3>' +
      '<p class="ct-call-status">正在呼叫...</p>' +
      '<button class="ct-hang" type="button" aria-label="挂断"><img src="os/icons/ctl/ct-call.svg" alt="" /></button>' +
      '</div></div></div>';
  }

  /* ---------- 终端 · 关于小灶 ---------- */
  function termHtml() {
    return '<div class="term-body">' +
      '<div class="term-out">' +
      '<p class="ln"><span class="prompt">xiaozao@os</span> <span class="dim">~</span> $ <span class="cmd">xiaozao --about</span></p>' +
      '<p class="term-logo">██ 大师的AI小灶 ██  v2026.06</p>' +
      '<p class="ln">定位      <span class="hl">面向职场人群的 AI 实战内容品牌</span></p>' +
      '<p class="ln">理念      我们不是理论派，而是实战派。</p>' +
      '<p class="ln">          不教大道理，<span class="hl">只传实用技</span>。</p>' +
      '<p class="ln">&nbsp;</p>' +
      '<p class="ln"><span class="dim"># 输入 help 查看可用命令，回车执行。</span></p>' +
      '</div>' +
      '<p class="ln term-inline"><span class="prompt">xiaozao@os</span>&nbsp;<span class="dim">~</span>&nbsp;$&nbsp;<input class="term-in" type="text" autocomplete="off" spellcheck="false" aria-label="终端输入" /></p>' +
      '</div>';
  }

  function termEsc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var TERM_CMDS = {
    help: ['可用命令：', '  about     品牌定位与理念', '  stats     关键数据', '  roadmap   2026 关键目标', '  team      打开通讯录', '  docs      打开文档（访达）', '  cases     打开上线效果（Safari）', '  find      各平台入口', '  clear     清屏'],
    about: ['定位      <span class="hl">面向职场人群的 AI 实战内容品牌</span>', '理念      我们不是理论派，而是实战派。不教大道理，<span class="hl">只传实用技</span>。', '<span class="dim"># 只要敢突破，就是了不起。</span>'],
    stats: ['<span class="ok">✓</span> 全网粉丝        50,000+', '<span class="ok">✓</span> 精选实战教程    10+', '<span class="ok">✓</span> 同步更新平台    5 个'],
    roadmap: ['[1] 完整的「AI小灶」内容体系 — 覆盖 12+ 职场场景', '[2] 知识共创社区 — 经验交流与能力进阶'],
    find: ['B站     <a href="' + BILI + '" target="_blank" rel="noopener" class="hl">完整视频教程</a>', '微信     <a href="' + QUN + '" target="_blank" rel="noopener" class="hl">和我们一起开小灶</a>']
  };

  function termRun(v, out) {
    var cmd = v.toLowerCase().replace(/^xiaozao\s+--?/, '');
    var lines;
    if (cmd === 'clear') { out.innerHTML = ''; return; }
    if (cmd === 'team') { lines = ['正在打开 通讯录…']; setTimeout(function () { window.XZApps.open('team'); }, 250); }
    else if (cmd === 'docs') { lines = ['正在打开 访达…']; setTimeout(function () { window.XZApps.open('doc'); }, 250); }
    else if (cmd === 'cases') { lines = ['正在打开 Safari…']; setTimeout(function () { window.XZApps.open('fx'); }, 250); }
    else if (/^sudo\b/.test(cmd)) { lines = ['权限不足：灶台只有大师能动。']; }
    else if (TERM_CMDS[cmd]) { lines = TERM_CMDS[cmd]; }
    else { lines = ['zsh: command not found: ' + termEsc(v) + '<span class="dim">（试试 help）</span>']; }
    lines.forEach(function (l) {
      var p = document.createElement('p');
      p.className = 'ln';
      p.innerHTML = l;
      out.appendChild(p);
    });
  }

  var APPS = {
    term: { title: 'xiaozao —— -zsh —— 80×24', klass: 'app-term', width: 600, height: 420, html: termHtml() },
    doc:  { title: '文档', klass: 'app-finder', width: 780, height: 500, html: finderHtml(), barHtml: finderBar },
    fx:   { title: '上线效果', klass: 'app-web', width: 980, height: 680, html: browserHtml(), barHtml: webBar },
    team: { title: '通讯录', klass: 'app-ct', width: 680, height: 640, html: contactsHtml(), barHtml: ctBar },
    qrwx: { title: '微信 · 扫码进群', width: 320, html: '<div class="qr-win"><img class="qr-img" src="os/qrs/wechat.png" alt="微信群二维码" /><p>手机微信扫一扫，进群开小灶</p></div>' },
    qrsph: { title: '视频号 · 扫码关注', width: 320, html: '<div class="qr-win"><img class="qr-img" src="os/qrs/shipinhao.png" alt="视频号二维码" /><p>微信扫一扫，关注视频号</p></div>' }
  };

  function wire(id, el) {
    if (id === 'term') {
      var out = el.querySelector('.term-out');
      var inp = el.querySelector('.term-in');
      var body = el.querySelector('.win-body');
      body.addEventListener('click', function (e) {
        if (!window.getSelection().toString()) inp.focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var v = inp.value.trim();
        var echo = document.createElement('p');
        echo.className = 'ln';
        echo.innerHTML = '<span class="prompt">xiaozao@os</span> <span class="dim">~</span> $ <span class="cmd">' + termEsc(inp.value) + '</span>';
        out.appendChild(echo);
        if (v) termRun(v, out);
        inp.value = '';
        body.scrollTop = body.scrollHeight;
      });
      setTimeout(function () { inp.focus(); }, 400);
    }
    if (id === 'doc') {
      el.querySelectorAll('[data-doc-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          var tag = b.getAttribute('data-doc-filter');
          var count = 0;
          el.querySelectorAll('[data-doc-filter]').forEach(function (x) { x.classList.toggle('on', x === b); });
          el.querySelectorAll('.fl-row[data-doc-tag]').forEach(function (row) {
            var show = !tag || row.getAttribute('data-doc-tag') === tag;
            row.style.display = show ? '' : 'none';
            if (show) count += 1;
          });
          var countEl = el.querySelector('.doc-count');
          if (countEl) countEl.textContent = count;
        });
      });
    }
    if (id === 'fx') {
      var tabbar = el.querySelector('.web-tabbar');
      var page = el.querySelector('.web-page');
      function displayUrl(url) {
        if (/^https?:\/\//.test(url) || /^[^/]+\.[^/]+/.test(url)) return url;
        return new URL(url, location.href).href;
      }
      function activateTab(tab, paneMatch, url) {
        el.querySelectorAll('.web-tab').forEach(function (x) { x.classList.toggle('on', x === tab); });
        el.querySelectorAll('.web-pane').forEach(function (p) { p.style.display = paneMatch(p) ? '' : 'none'; });
        var u = el.querySelector('#fx-url');
        if (u) {
          u.value = displayUrl(url);
          u.title = u.value;
        }
      }
      function tabPane(url) {
        return [].slice.call(page.querySelectorAll('.preview-pane')).find(function (p) {
          return p.getAttribute('data-preview-url') === url;
        });
      }
      function switchTab(tab) {
        var key = tab.getAttribute('data-fx');
        var previewUrl = tab.getAttribute('data-preview-url');
        if (key) {
          activateTab(tab, function (p) { return p.getAttribute('data-pane') === key; }, FX_URLS[key]);
        } else if (previewUrl) {
          activateTab(tab, function (p) { return p.getAttribute('data-preview-url') === previewUrl; }, previewUrl);
        }
      }
      function fallbackCopy(text) {
        var t = document.createElement('textarea');
        t.value = text;
        t.setAttribute('readonly', '');
        t.style.position = 'fixed';
        t.style.left = '-9999px';
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        t.remove();
      }
      function copyPreviewLink(btn, url) {
        var fullUrl = new URL(url, location.href).href;
        var done = function () {
          btn.classList.add('copied');
          setTimeout(function () { btn.classList.remove('copied'); }, 900);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullUrl).then(done).catch(function () { fallbackCopy(fullUrl); done(); });
        } else {
          fallbackCopy(fullUrl);
          done();
        }
      }
      function closePreviewTab(tab) {
        var url = tab.getAttribute('data-preview-url');
        var origin = tab.getAttribute('data-origin-fx');
        var wasActive = tab.classList.contains('on');
        var pane = tabPane(url);
        var prevPreview = tab.previousElementSibling && tab.previousElementSibling.hasAttribute('data-preview-url') ? tab.previousElementSibling : null;
        var next = prevPreview || (origin && tabbar.querySelector('[data-fx="' + origin + '"]')) || tab.previousElementSibling || tab.nextElementSibling || tabbar.querySelector('.web-tab');
        tab.remove();
        if (pane) pane.remove();
        if (wasActive && next) switchTab(next);
      }
      tabbar.addEventListener('click', function (e) {
        var copy = e.target.closest('.tab-copy');
        if (copy) {
          e.stopPropagation();
          copyPreviewLink(copy, copy.closest('.web-tab').getAttribute('data-preview-url'));
          return;
        }
        var close = e.target.closest('.tab-close');
        if (close) {
          e.stopPropagation();
          closePreviewTab(close.closest('.web-tab'));
          return;
        }
        var b = e.target.closest('.web-tab');
        if (!b) return;
        switchTab(b);
      });
      var urlInput = el.querySelector('#fx-url');
      if (urlInput) {
        urlInput.addEventListener('click', function () { urlInput.select(); });
        urlInput.addEventListener('focus', function () { urlInput.select(); });
      }
      el.querySelectorAll('.cs-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          e.preventDefault();
          var url = card.getAttribute('href');
          var title = card.getAttribute('data-case-title') || card.textContent.trim();
          var tab = [].slice.call(tabbar.querySelectorAll('[data-preview-url]')).find(function (x) {
            return x.getAttribute('data-preview-url') === url;
          });
          if (!tab) {
            var originPane = card.closest('.web-pane');
            var origin = originPane && originPane.getAttribute('data-pane');
            tab = document.createElement('button');
            tab.className = 'web-tab preview-tab';
            tab.type = 'button';
            tab.setAttribute('data-preview-url', url);
            if (origin) tab.setAttribute('data-origin-fx', origin);
            tab.innerHTML = '<span class="tab-title">' + escHtml(title) + '</span>' +
              '<span class="tab-copy" role="button" aria-label="复制链接" title="复制链接">⧉</span>' +
              '<span class="tab-close" role="button" aria-label="关闭标签" title="关闭标签">×</span>';
            tabbar.appendChild(tab);
            var pane = document.createElement('div');
            pane.className = 'web-pane preview-pane';
            pane.setAttribute('data-preview-url', url);
            pane.style.display = 'none';
            pane.innerHTML = '<iframe class="case-preview" src="' + escAttr(url) + '" title="' + escAttr(title) + '"></iframe>';
            page.appendChild(pane);
          }
          activateTab(tab, function (p) { return p.getAttribute('data-preview-url') === url; }, url);
          tabbar.scrollLeft = tab.offsetLeft;
        });
      });
    }
    if (id === 'team') {
      var callAudio = null;
      var callTimer = null;
      var callRun = 0;
      var callScreen = el.querySelector('.ct-call-screen');
      var callStatus = el.querySelector('.ct-call-status');
      function stopCallAudio() {
        if (callAudio) {
          try {
            callAudio.pause();
            callAudio.currentTime = 0;
            callAudio.muted = true;
            callAudio.removeAttribute('src');
            callAudio.load();
          } catch (e) {}
          callAudio = null;
        }
        if (callTimer) {
          clearTimeout(callTimer);
          callTimer = null;
        }
      }
      function showContactCard(key) {
        if (callScreen) callScreen.hidden = true;
        el.querySelectorAll('.ct-card').forEach(function (c) {
          c.style.display = c.getAttribute('data-card') === key ? '' : 'none';
        });
      }
      function setCallState(text, cls) {
        if (!callScreen || !callStatus) return;
        callScreen.classList.remove('dialing', 'connected', 'ended');
        callScreen.classList.add(cls);
        callStatus.textContent = text;
      }
      function hangUp(run) {
        if (run && run !== callRun) return;
        callRun += 1;
        stopCallAudio();
        setCallState('已挂断', 'ended');
        callTimer = setTimeout(function () { showContactCard('dashi'); }, 900);
      }
      function scheduleClipEnd(run, done, ms) {
        if (callTimer) clearTimeout(callTimer);
        callTimer = setTimeout(function () {
          callTimer = null;
          if (run === callRun) done();
        }, ms);
      }
      function playClip(audio, run, ms, done) {
        callAudio = audio;
        audio.currentTime = 0;
        audio.addEventListener('ended', function () {
          if (callTimer) {
            clearTimeout(callTimer);
            callTimer = null;
          }
          if (run === callRun) done();
        }, { once: true });
        var p = audio.play();
        if (p && p.catch) p.catch(function () {
          if (run === callRun) scheduleClipEnd(run, done, ms);
        });
      }
      function startDashiCall() {
        callRun += 1;
        var run = callRun;
        stopCallAudio();
        showContactCard('');
        if (callScreen) {
          callScreen.hidden = false;
          callScreen.scrollIntoView({ block: 'start' });
        }
        setCallState('正在呼叫...', 'dialing');
        playClip(new Audio(CALL_DIALING), run, CALL_DIALING_MS, function () {
          setCallState('已接通', 'connected');
          playClip(new Audio(CALL_CONNECTED), run, CALL_CONNECTED_MS, function () { hangUp(run); });
        });
      }
      el.querySelectorAll('.ct-item').forEach(function (b) {
        b.addEventListener('click', function () {
          var key = b.getAttribute('data-ct');
          callRun += 1;
          stopCallAudio();
          if (callScreen) callScreen.hidden = true;
          el.querySelectorAll('.ct-item').forEach(function (x) { x.classList.toggle('on', x === b); });
          el.querySelectorAll('.ct-card').forEach(function (c) {
            c.style.display = c.getAttribute('data-card') === key ? '' : 'none';
          });
        });
      });
      el.querySelectorAll('[data-call="dashi"]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          startDashiCall();
        });
      });
      var hang = el.querySelector('.ct-hang');
      if (hang) hang.addEventListener('click', function () { hangUp(); });
    }
  }

  window.XZApps = {
    open: function (id, pos) {
      var app = APPS[id];
      if (!app) return;
      var opts = pos ? Object.assign({}, app, pos) : app;
      var el = window.XZWM.open(id, app.title, app.html, opts);
      if (el && !el.__wired) { el.__wired = true; wire(id, el); }
      return el;
    }
  };
})();
