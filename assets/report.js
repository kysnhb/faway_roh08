/* VULCAN 보고서 — 각주 모달 + 자동 번호 매김
   사용법:  <span class="fn" data-t="제목" data-c="설명 HTML">  ← 번호는 자동 부여
*/
(function () {
  'use strict';

  function build() {
    var marks = document.querySelectorAll('.fn');
    if (!marks.length) return;

    // 각주 자동 번호
    marks.forEach(function (m, i) {
      if (!m.textContent.trim()) m.textContent = i + 1;
      m.setAttribute('role', 'button');
      m.setAttribute('tabindex', '0');
      m.setAttribute('aria-label', '각주 ' + (i + 1) + ' 열기');
    });

    // 모달 1개만 생성해 재사용
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
      var n = el.textContent.trim();
      ttl.textContent = '[' + n + '] ' + (el.dataset.t || '주석');
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

    // ESC 닫기 — 캡처 단계에서 처리해 다른 핸들러보다 먼저 잡는다
    function onEsc(e) {
      if (!mask.classList.contains('on')) return;
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener('keydown', onEsc, true);
    window.addEventListener('keydown', onEsc, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
