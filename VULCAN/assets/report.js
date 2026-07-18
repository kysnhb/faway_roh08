/* VULCAN 보고서 — 상단 내비게이션 + 각주 모달
   nav : 모든 페이지에 자동 주입 (현재 페이지 자동 활성화)
   각주: <span class="fn" data-t="제목" data-c="설명 HTML">  ← 번호 자동 부여
*/
(function () {
  'use strict';

  var PAGES = [
    { f: 'index.html',        n: '',   s: '표지',    t: '표지 및 목차' },
    { f: '01-cs.html',        n: '01', s: 'CS',      t: 'CS 접수 해부 리포트' },
    { f: '02-analytics.html', n: '02', s: '계측',    t: 'Firebase 계측 요청서' },
    { f: '03-users.html',     n: '03', s: '유저',    t: '유저 반응 심층 분석' },
    { f: '04-balance.html',   n: '04', s: '밸런스',  t: '밸런스 실측 및 교차 검증' },
    { f: '05-data.html',      n: '05', s: '데이터',  t: '데이터 룸' },
    { f: '06-cost.html',      n: '06', s: '비용',    t: '비용 구조 분석' },
    { f: '07-benchmark.html', n: '07', s: '업계',    t: '업계 비교' },
    { f: '08-ui.html',        n: '08', s: 'UI',      t: 'UI 개선안' },
    { f: '09-proposal.html',  n: '09', s: '제안',    t: '개선 제안' },
    { f: '10-notes.html',     n: '10', s: '방법론',  t: '방법론 및 한계' },
    { f: '11-content.html',   n: '11', s: '콘텐츠',  t: '콘텐츠 및 UI 개선' },
    { f: '12-roadmap.html',   n: '12', s: '업데이트', t: '향후 업데이트 로드맵' },
    { f: '13-events.html',    n: '13', s: '이벤트',  t: '이벤트 제안' },
    { f: '14-monetize.html',  n: '14', s: '유료상품', t: '유료 상품 제안' }
  ];

  function currentFile() {
    var p = location.pathname.split('/').pop();
    return (!p || p === '') ? 'index.html' : p;
  }

  /* ───────── 상단 내비게이션 ───────── */
  function buildNav() {
    var bar = document.querySelector('.topbar .wrap');
    if (!bar) return;

    var cur = currentFile();
    var crumb = bar.querySelector('.crumb');
    var pg = bar.querySelector('.pg');
    if (crumb) crumb.remove();   // 내비가 대체
    if (pg) pg.remove();

    // 데스크톱 내비
    var nav = document.createElement('nav');
    nav.className = 'tnav';
    PAGES.forEach(function (p) {
      var a = document.createElement('a');
      a.href = p.f;
      a.title = p.t;
      a.className = (p.f === cur) ? 'on' : '';
      a.innerHTML = (p.n ? '<b>' + p.n + '</b>' : '') + p.s;
      nav.appendChild(a);
    });
    bar.appendChild(nav);

    // 햄버거
    var burger = document.createElement('button');
    burger.className = 'burger';
    burger.setAttribute('aria-label', '메뉴 열기');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    bar.appendChild(burger);

    // 모바일 드로어
    var drawer = document.createElement('div');
    drawer.className = 'drawer';
    var inner = document.createElement('div');
    inner.className = 'dwrap';
    var head = document.createElement('div');
    head.className = 'dhead';
    head.textContent = '목차';
    inner.appendChild(head);
    PAGES.forEach(function (p) {
      var a = document.createElement('a');
      a.href = p.f;
      a.className = (p.f === cur) ? 'on' : '';
      a.innerHTML = '<span class="dn">' + (p.n || '—') + '</span><span class="dt">' + p.t + '</span>';
      inner.appendChild(a);
    });
    drawer.appendChild(inner);
    document.body.appendChild(drawer);

    function setDrawer(open) {
      drawer.classList.toggle('on', open);
      burger.classList.toggle('x', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () {
      setDrawer(!drawer.classList.contains('on'));
    });
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) setDrawer(false);
    });
    window.__closeDrawer = function () { setDrawer(false); };

    // 현재 항목을 데스크톱 내비에서 보이게 스크롤
    var act = nav.querySelector('a.on');
    if (act && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = act.offsetLeft - nav.clientWidth / 2 + act.offsetWidth / 2;
    }
  }

  /* ───────── 각주 모달 ───────── */
  function buildFootnotes() {
    var marks = document.querySelectorAll('.fn');
    if (!marks.length) return null;

    marks.forEach(function (m, i) {
      if (!m.textContent.trim()) m.textContent = i + 1;
      m.setAttribute('role', 'button');
      m.setAttribute('tabindex', '0');
      m.setAttribute('aria-label', '각주 ' + (i + 1) + ' 열기');
    });

    var mask = document.createElement('div');
    mask.className = 'fnmask';
    mask.innerHTML =
      '<div class="fnbox" role="dialog" aria-modal="true">' +
      '<div class="fh"><span class="ft"></span>' +
      '<button class="fx" aria-label="닫기">&times;</button></div>' +
      '<div class="fb"></div></div>';
    document.body.appendChild(mask);

    var box = mask.querySelector('.fnbox');
    var ttl = mask.querySelector('.ft');
    var bdy = mask.querySelector('.fb');
    var last = null;

    function open(el) {
      last = el;
      ttl.textContent = '[' + el.textContent.trim() + '] ' + (el.dataset.t || '주석');
      bdy.innerHTML = el.dataset.c || '';
      mask.classList.add('on');
      document.body.style.overflow = 'hidden';
      mask.querySelector('.fx').focus();
    }
    function close() {
      mask.classList.remove('on');
      document.body.style.overflow = '';
      if (last) { last.focus(); last = null; }
    }

    marks.forEach(function (m) {
      m.addEventListener('click', function () { open(m); });
      m.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(m); }
      });
    });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('.fx').addEventListener('click', close);
    box.addEventListener('click', function (e) { e.stopPropagation(); });

    return { isOpen: function () { return mask.classList.contains('on'); }, close: close };
  }

  /* ───────── KPI 광택 레이어 ───────── */
  function buildShine() {
    document.querySelectorAll('.kpi').forEach(function (k) {
      if (k.querySelector('.shine')) return;
      var s = document.createElement('span');
      s.className = 'shine';
      k.appendChild(s);
    });
  }

  /* ───────── 초기화 ───────── */
  function init() {
    buildNav();
    buildShine();
    var fn = buildFootnotes();

    // ESC — 캡처 단계에서 한 번만 처리 (모달 우선, 그다음 드로어)
    function onEsc(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc' && e.keyCode !== 27) return;
      if (fn && fn.isOpen()) { e.preventDefault(); e.stopPropagation(); fn.close(); return; }
      var d = document.querySelector('.drawer.on');
      if (d && window.__closeDrawer) { e.preventDefault(); window.__closeDrawer(); }
    }
    document.addEventListener('keydown', onEsc, true);
    window.addEventListener('keydown', onEsc, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
