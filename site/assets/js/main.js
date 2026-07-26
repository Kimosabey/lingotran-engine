/* ==========================================================================
   Lingotran Engine — boot sequence
   Order matters: shell first (so search index can see LT.corpus()), then
   data renderers fill the page, then the corpus console (Dashboard only —
   mount() no-ops elsewhere), then section-nav/scroll-spy/reveal last (needs
   final DOM from the renderers).
   ========================================================================== */
(function () {
  "use strict";
  function boot() {
    if (!window.LTApp) return;
    window.LTApp.init();
    if (window.LTRender) window.LTRender.run();
    if (window.LTCorpus) window.LTCorpus.mount("#corpus-console");
    window.LTApp.initNav();
    /* Enable smooth in-page scrolling only after the browser's own initial
       #hash landing (if any) has already happened instantly — see base.css. */
    setTimeout(function () { document.documentElement.classList.add("smooth-nav"); }, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
