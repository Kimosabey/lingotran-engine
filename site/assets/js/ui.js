/* ==========================================================================
   Lingotran Engine — UI shell
   Ambient backdrop, top bar + app bar + breadcrumb, mobile drawer, theme,
   global cross-corpus search, in-page section scroll-spy. Vanilla, no deps.
   Reads window.LT (data.js). Exposes window.LTApp helpers (icon, $, el, esc).
   ========================================================================== */
(function () {
  "use strict";
  var LT = window.LT || {};

  /* ---- DOM helpers ----------------------------------------------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  /* ---- Icons (stroke SVG) ---------------------------------------------- */
  var PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    github: '',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    file: '<path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 16l4.5-4.5a1.5 1.5 0 012.1 0L14 15l1.5-1.5a1.5 1.5 0 012.1 0L20 16"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/>',
    tag: '<path d="M20 12.5L12.5 20a1.5 1.5 0 01-2.1 0l-6.4-6.4a1.5 1.5 0 010-2.1L11.5 4H19a1 1 0 011 1v7.5z"/><circle cx="15" cy="9" r="1.4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    type: '<path d="M5 6h14M12 6v13"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="1.4"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    checkSeal: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z"/>',
    doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    gauge: '<path d="M12 13l4-4"/><path d="M4.5 18a9 9 0 1115 0"/>',
    inbox: '<path d="M4 13l2.5-8h11L20 13"/><path d="M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5h-5a3 3 0 01-6 0H4z"/>'
  };
  function icon(key, size) {
    var p = PATHS[key]; if (p == null) return "";
    var s = size || 18;
    if (key === "github") {
      return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17 5 18 5.3 18 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>';
    }
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ---- Theme ----------------------------------------------------------- */
  function currentTheme() {
    var set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function bindTheme() {
    var btn = $("#theme-toggle"); if (!btn) return;
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("lt-theme", next); } catch (e) {}
      document.dispatchEvent(new CustomEvent("lt:themechange", { detail: next }));
    });
  }

  /* ---- Shell (top bar + app bar) --------------------------------------- */
  function pageMeta() {
    var m = $("#site-shell") || document.body;
    return {
      active: m.getAttribute("data-active") || "dashboard",
      root: m.getAttribute("data-root") || "",
      title: m.getAttribute("data-title") || "",
      parent: m.getAttribute("data-parent") || "" // parent slug for breadcrumb
    };
  }
  function renderShell() {
    var shell = $("#site-shell"); if (!shell) return;
    var meta = pageMeta();
    var root = meta.root, active = meta.active;
    var pages = LT.sitePages || [];
    function href(p) { return root + (p.path || ""); }

    function tabsHtml(cls) {
      return pages.map(function (p) {
        var on = p.slug === active ? " active" : "";
        var dis = p.disabled ? ' aria-disabled="true"' : "";
        var sec = p.secondary ? ' data-secondary' : "";
        return '<a class="' + cls + on + '" href="' + href(p) + '"' + dis + sec + '>' + esc(p.label) + "</a>";
      }).join("");
    }

    /* breadcrumb: Home ▸ [parent] ▸ [title] */
    var crumbs = ['<a href="' + root + '">Home</a>'];
    var parentPage = pages.filter(function (p) { return p.slug === meta.parent; })[0];
    if (parentPage) crumbs.push('<span class="sep">/</span><a href="' + href(parentPage) + '">' + esc(parentPage.label) + "</a>");
    var here = meta.title || (pages.filter(function (p) { return p.slug === active; })[0] || {}).label || "";
    if (here) crumbs.push('<span class="sep">/</span><span class="current">' + esc(here) + "</span>");

    shell.innerHTML =
      '<header class="topbar"><div class="topbar-inner container">' +
        '<a class="brand" href="' + root + '" aria-label="Lingotran — home">' +
          '<img class="logo-light" src="' + root + 'assets/img/logo-color.png" alt="Lingotran" width="118" height="25">' +
          '<img class="logo-dark" src="' + root + 'assets/img/logo-white.png" alt="Lingotran" width="118" height="25">' +
          '<span class="brand-kicker">Extraction Engine</span>' +
        "</a>" +
        '<span class="spacer"></span>' +
        '<div class="gsearch">' +
          '<span class="ico">' + icon("search", 16) + "</span>" +
          '<input id="gsearch-input" class="gsearch-input" type="search" role="combobox" aria-expanded="false" aria-controls="gsearch-panel" aria-autocomplete="list" placeholder="Search the corpus…" aria-label="Search the corpus">' +
          "<kbd>/</kbd>" +
          '<div id="gsearch-panel" class="gsearch-panel" role="listbox" aria-label="Search results"></div>' +
        "</div>" +
        '<div class="topbar-actions">' +
          '<a class="icon-btn" href="' + (LT.REPO_URL || "#") + '" target="_blank" rel="noopener" aria-label="GitHub repository">' + icon("github", 18) + "</a>" +
          '<button class="icon-btn" id="theme-toggle" aria-label="Toggle light or dark theme"><span class="sun">' + icon("sun", 18) + '</span><span class="moon">' + icon("moon", 18) + "</span></button>" +
          '<button class="icon-btn hamburger" id="drawer-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">' + icon("menu", 18) + "</button>" +
        "</div>" +
      "</div></header>" +
      '<nav class="appbar" aria-label="Primary"><div class="appbar-inner container">' +
        '<div class="appbar-tabs">' + tabsHtml("") + "</div>" +
        '<div class="breadcrumb">' + crumbs.join("") + "</div>" +
      "</div></nav>";

    /* drawer + scrim (appended to body) */
    var scrim = el("div", { class: "scrim", id: "nav-scrim" });
    var drawer = el("nav", { class: "drawer", id: "drawer", "aria-label": "Menu" });
    drawer.innerHTML =
      '<div class="drawer-head"><span class="lbl">Navigate</span>' +
        '<button class="icon-btn" id="drawer-close" aria-label="Close menu">' + icon("close", 18) + "</button></div>" +
      pages.map(function (p) {
        var on = p.slug === active ? " active" : "";
        var dis = p.disabled ? ' aria-disabled="true"' : "";
        return '<a class="nav-link' + on + '" href="' + href(p) + '"' + dis + ">" + esc(p.label) + "</a>";
      }).join("");
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);
  }

  /* ---- Drawer ---------------------------------------------------------- */
  function bindDrawer() {
    var btn = $("#drawer-toggle"), drawer = $("#drawer"), scrim = $("#nav-scrim"), closeBtn = $("#drawer-close");
    if (!btn || !drawer) return;
    function open() {
      drawer.classList.add("open"); if (scrim) scrim.classList.add("show");
      document.documentElement.classList.add("nav-lock"); btn.setAttribute("aria-expanded", "true");
      var f = drawer.querySelector("a,button"); if (f) f.focus();
    }
    function close() {
      drawer.classList.remove("open"); if (scrim) scrim.classList.remove("show");
      document.documentElement.classList.remove("nav-lock"); btn.setAttribute("aria-expanded", "false");
    }
    btn.addEventListener("click", function () { drawer.classList.contains("open") ? close() : open(); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (scrim) scrim.addEventListener("click", close);
    drawer.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("open")) close(); });
    window.addEventListener("resize", function () { if (drawer.classList.contains("open") && window.innerWidth > 720) close(); });
  }

  /* ---- Global cross-corpus search -------------------------------------- */
  function buildIndex(root) {
    var items = [];
    (LT.sitePages || []).forEach(function (p) {
      if (p.disabled) return;
      items.push({ title: p.label, sub: "Page", href: root + (p.path || ""), kind: "Pages" });
    });
    if (typeof LT.corpus === "function") {
      LT.corpus().forEach(function (c) {
        items.push({
          title: c.title, sub: c.langName + " · " + c.pages + " pages",
          href: root + c.href, kind: "Books & sets", badge: c.langCode,
          hay: (c.title + " " + c.source + " " + (c.author || "") + " " + c.langName).toLowerCase()
        });
      });
    }
    /* current-page sections */
    $all(".section[data-nav]").forEach(function (s) {
      items.push({ title: s.getAttribute("data-nav"), sub: "On this page", href: "#" + s.id, kind: "On this page" });
    });
    items.forEach(function (i) { if (!i.hay) i.hay = (i.title + " " + i.sub).toLowerCase(); });
    return items;
  }
  function bindSearch(root) {
    var input = $("#gsearch-input"), panel = $("#gsearch-panel");
    if (!input || !panel) return;
    var index = buildIndex(root), sel = -1, visible = [];

    function render(q) {
      q = q.trim().toLowerCase();
      panel.innerHTML = ""; sel = -1; visible = [];
      if (!q) { close(); return; }
      var matches = index.filter(function (i) { return i.hay.indexOf(q) !== -1; }).slice(0, 24);
      if (!matches.length) {
        panel.appendChild(el("div", { class: "gsearch-empty" }, 'No matches for "' + q + '". Try a book title or language.'));
        openPanel(); return;
      }
      var groups = {};
      matches.forEach(function (m) { (groups[m.kind] = groups[m.kind] || []).push(m); });
      Object.keys(groups).forEach(function (g) {
        panel.appendChild(el("div", { class: "gsearch-group-label" }, g));
        groups[g].forEach(function (m) {
          var badge = m.badge ? el("span", { class: "lang-pin gi-badge" }, m.badge) : null;
          var a = el("a", { class: "gsearch-item", href: m.href, role: "option" }, [
            badge,
            el("span", { class: "gi-title" }, m.title),
            el("span", { class: "gi-sub" }, m.sub)
          ]);
          panel.appendChild(a); visible.push(a);
        });
      });
      openPanel();
    }
    function openPanel() { panel.classList.add("open"); input.setAttribute("aria-expanded", "true"); }
    function close() { panel.classList.remove("open"); input.setAttribute("aria-expanded", "false"); sel = -1; }
    function move(d) {
      if (!visible.length) return;
      if (sel > -1) visible[sel].setAttribute("aria-selected", "false");
      sel = (sel + d + visible.length) % visible.length;
      visible[sel].setAttribute("aria-selected", "true");
      visible[sel].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && sel > -1) { e.preventDefault(); visible[sel].click(); }
      else if (e.key === "Escape") { input.value = ""; close(); input.blur(); }
    });
    input.addEventListener("focus", function () { if (input.value.trim()) render(input.value); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".gsearch")) close(); });
    window.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) {
        e.preventDefault(); input.focus();
      }
    });
  }

  /* ---- In-page section nav + scroll-spy -------------------------------- */
  function buildSectionNav() {
    var nav = $("#sectionnav"); if (!nav) return;
    var secs = $all(".section[data-nav]");
    secs.forEach(function (s) {
      nav.appendChild(el("a", { href: "#" + s.id, "data-target": s.id }, s.getAttribute("data-nav")));
    });
  }
  function initScrollSpy() {
    var nav = $("#sectionnav");
    var links = nav ? $all("a[data-target]", nav) : [];
    var crumbCurrent = $(".breadcrumb .current");
    var baseTitle = crumbCurrent ? crumbCurrent.textContent : "";
    var secs = $all(".section[data-nav]");
    if (!secs.length) return;
    var byId = {}; links.forEach(function (l) { byId[l.getAttribute("data-target")] = l; });
    var top = (function () {
      var tb = $(".topbar"), ab = $(".appbar");
      return (tb ? tb.offsetHeight : 60) + (ab ? ab.offsetHeight : 48) + (nav ? nav.offsetHeight + 12 : 12) + 16;
    });
    var activeId = null, ticking = false;
    function update() {
      ticking = false;
      var threshold = top();
      var atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 4);
      var cur = secs[0].id;
      if (atBottom) cur = secs[secs.length - 1].id;
      else for (var i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top <= threshold) cur = secs[i].id;
      if (cur === activeId) return;
      activeId = cur;
      links.forEach(function (l) { l.classList.toggle("active", l.getAttribute("data-target") === cur); });
      var a = byId[cur];
      if (a && nav) {
        var r = a.getBoundingClientRect(), nr = nav.getBoundingClientRect();
        if (r.left < nr.left + 8) nav.scrollLeft -= (nr.left + 8 - r.left);
        else if (r.right > nr.right - 8) nav.scrollLeft += (r.right - (nr.right - 8));
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* used by render.js to gate the chart-fill entrance animation */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Hand-authored icon placeholders ([data-ico="key"] in raw HTML) -- */
  function fillIcons() {
    $all("[data-ico]").forEach(function (n) { n.innerHTML = icon(n.getAttribute("data-ico"), n.getAttribute("data-ico-size") || 16); });
  }

  /* ---- Init ------------------------------------------------------------ */
  function init() {
    var meta = pageMeta();
    renderShell();
    bindTheme();
    bindDrawer();
    bindSearch(meta.root);
    fillIcons();
    var y = $("#year"); if (y) y.textContent = "2026";
  }
  function initNav() {   /* run after page renderers so sections exist */
    buildSectionNav();
    initScrollSpy();
  }

  window.LTApp = { $: $, $all: $all, el: el, esc: esc, icon: icon, reduceMotion: reduceMotion, init: init, initNav: initNav, pageMeta: pageMeta };
})();
