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
})();
