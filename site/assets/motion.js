// Hero «Le passe»: passe.js (three.js, ~140 KB gzip) si carica dopo `load`, solo su schermi ≥ 860px e senza risparmio dati.
// Su telefono, senza JS o senza WebGL resta la versione HTML/CSS dei bon.
(function () {
  var box = document.querySelector('.passe-scene');
  if (!box || (navigator.connection || {}).saveData || !matchMedia('(min-width: 860px)').matches) return;
  addEventListener('load', function () {
    (window.requestIdleCallback || setTimeout)(function () {
      var s = document.createElement('script');
      s.src = box.getAttribute('data-src');
      document.head.appendChild(s);
    }, { timeout: 1200 });
  });
})();

// Video di servizio: play quando visibile al 50%, pause quando esce. Niente se l'utente chiede meno movimento o risparmio dati.
(function () {
  var nav = navigator.connection || {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || nav.saveData || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.intersectionRatio >= 0.5) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }, { threshold: [0, 0.5] });
  document.querySelectorAll('video').forEach(function (v) { io.observe(v); });

  // Inclinazione prospettica che segue il puntatore (porte e cornici video), solo con mouse. Gli angoli vanno in variabili CSS.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.door, .frame').forEach(function (el) {
    if (el.classList.contains('frame') && !el.querySelector('video')) return;
    el.classList.add('tilt');
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 7 + 'deg');
      el.style.setProperty('--rx', (.5 - (e.clientY - r.top) / r.height) * 7 + 'deg');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
})();
