/* ==========================================================================
   Lingotran Extraction Dashboard — behavior + data-driven rendering
   Vanilla JS, no dependencies. Reads window.LT (see data.js).
   ========================================================================== */
(function () {
  "use strict";
  var LT = window.LT || {};

  /* ---- tiny DOM helpers ------------------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
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

  /* ---- Iconography (inline SVG, stroke-based — matches the topbar icons) */
  var ICON_PATHS = {
    file: '<path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 16l4.5-4.5a1.5 1.5 0 012.1 0L14 15l1.5-1.5a1.5 1.5 0 012.1 0L20 16"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/>',
    tag: '<path d="M20 12.5L12.5 20a1.5 1.5 0 01-2.1 0l-6.4-6.4a1.5 1.5 0 010-2.1L11.5 4H19a1 1 0 011 1v7.5z"/><circle cx="15" cy="9" r="1.4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    type: '<path d="M5 6h14M12 6v13"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="1.4"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>'
  };
  function icon(key, size) {
    var s = size || 18, p = ICON_PATHS[key];
    if (!p) return "";
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function resolve(path) { // "french.books.conjugaison-a1-a2.charts.contentType"
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, LT);
  }
  function sum(arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); }

  /* ---- 1. Theme -------------------------------------------------------- */
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function currentTheme() {
    var set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function initTheme() {
    var btn = $("#theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("lt-theme", next); } catch (e) {}
    });
  }

  /* ---- 3. Build the app-bar section tabs from sections ----------------- */
  function buildSubnav() {
    var nav = $("#subnav");
    if (!nav) return;
    var lastGroup = null;
    $all(".section[data-nav]").forEach(function (sec) {
      var g = sec.getAttribute("data-nav-group") || "";
      if (lastGroup !== null && g !== lastGroup) nav.appendChild(el("span", { class: "divider", "aria-hidden": "true" }));
      lastGroup = g;
      nav.appendChild(el("a", { href: "#" + sec.id, "data-target": sec.id, title: g }, sec.getAttribute("data-nav")));
    });
  }

  /* ---- 4. Scroll-spy --------------------------------------------------- */
  function initScrollSpy() {
    var links = $all("#subnav a[data-target]");
    if (!links.length) return;
    var byId = {};
    links.forEach(function (l) { byId[l.getAttribute("data-target")] = l; });
    var secs = $all(".section[data-nav]");
    if (!secs.length) return;
    var tb = $(".topbar");
    var snv = $("#subnav");
    var activeId = null, ticking = false;

    function keepInView(link) {
      if (!snv) return;
      var r = link.getBoundingClientRect(), nr = snv.getBoundingClientRect();
      if (r.left < nr.left + 8) snv.scrollLeft -= (nr.left + 8 - r.left);
      else if (r.right > nr.right - 8) snv.scrollLeft += (r.right - (nr.right - 8));
    }
    function update() {
      ticking = false;
      var threshold = (tb ? tb.offsetHeight : 60) + (snv ? snv.offsetHeight : 0) + 20;
      var doc = document.documentElement;
      var atBottom = (window.innerHeight + window.scrollY) >= (doc.scrollHeight - 4);
      var current = secs[0].id;
      if (atBottom) {
        current = secs[secs.length - 1].id;
      } else {
        for (var i = 0; i < secs.length; i++) {
          if (secs[i].getBoundingClientRect().top <= threshold) current = secs[i].id;
        }
      }
      if (current === activeId) return;
      activeId = current;
      links.forEach(function (l) { l.classList.toggle("active", l.getAttribute("data-target") === current); });
      if (byId[current]) keepInView(byId[current]);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* ---- 5. Filter the app-bar tabs via the search box ------------------- */
  function initSearch() {
    var input = $("#search-input");
    if (!input) return;
    var tabs = $all("#subnav a");
    function run() {
      var q = input.value.trim().toLowerCase();
      tabs.forEach(function (a) {
        a.classList.toggle("hide", !!q && a.textContent.toLowerCase().indexOf(q) === -1);
      });
    }
    input.addEventListener("input", run);
    window.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
      if (e.key === "Escape" && document.activeElement === input) { input.value = ""; run(); input.blur(); }
    });
  }

  /* ---- 6. Topbar links from data -------------------------------------- */
  function initTopbar() {
    $all("[data-repo]").forEach(function (r) { if (LT.REPO_URL) r.setAttribute("href", LT.REPO_URL); });
    var y = $("#year"); if (y) y.textContent = "2026";
  }

  /* ---- 7. Code block --------------------------------------------------- */
  function codeblock(label, text) {
    var pre = el("pre", {}, [document.createTextNode(text)]);
    var copy = el("button", { class: "copy", type: "button", text: "Copy" });
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "Copied ✓"; setTimeout(function () { copy.textContent = "Copy"; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    });
    var head = el("div", { class: "code-head" }, [el("span", { class: "fname", text: label }), copy]);
    return el("div", { class: "codeblock has-head" }, [head, pre]);
  }

  /* ---- 8. Charts ------------------------------------------------------- */
  function barChart(mount, data, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    var total = sum(data, function (d) { return d.v; }) || 1;
    var wrap = el("div", { class: "chart", role: "img", "aria-label": (opts.label || "bar chart") });
    data.forEach(function (d) {
      var pct = Math.round((d.v / total) * 100);
      var row = el("div", { class: "row" }, [
        el("span", { class: "k", title: d.k, text: d.k }),
        el("span", { class: "track" }, [el("span", { class: "fill", style: "width:0" })]),
        el("span", { class: "v", html: esc(d.v) + ' <small>' + pct + '%</small>' })
      ]);
      wrap.appendChild(row);
      var fill = row.querySelector(".fill");
      requestAnimationFrame(function () { fill.style.width = Math.max(2, (d.v / max) * 100) + "%"; });
    });
    mount.appendChild(wrap);
  }
  function meters(mount, data) {
    data.forEach(function (m) {
      var pct = m.of ? Math.round((m.value / m.of) * 100) : 0;
      var box = el("div", { class: "meter" }, [
        el("div", { class: "top" }, [
          el("span", { class: "name", text: m.name }),
          el("span", { class: "pct", text: pct + "%" })
        ]),
        el("div", { class: "track" }, [el("div", { class: "fill" + (m.cls ? " " + m.cls : ""), style: "width:0" })]),
        el("div", { class: "cap", text: m.value + " of " + m.of + " spreads" })
      ]);
      mount.appendChild(box);
      var fill = box.querySelector(".fill");
      requestAnimationFrame(function () { fill.style.width = pct + "%"; });
    });
  }
  function qaDonut(mount, pass, fail) {
    var total = pass + fail || 1;
    var pct = Math.round((pass / total) * 100);
    var donut = el("div", { class: "donut", style: "--v:" + pct, role: "img",
      "aria-label": pass + " clean, " + fail + " flagged" },
      [el("div", { class: "hole" }, [el("b", { text: pct + "%" }), el("span", { text: "clean" })])]);
    var legend = el("div", { class: "legend" }, [
      el("div", { class: "item" }, [el("span", { class: "sw ok" }),
        el("span", { class: "n", text: pass }), el("span", { class: "l", text: "clean (ok: true)" })]),
      el("div", { class: "item" }, [el("span", { class: "sw flag" }),
        el("span", { class: "n", text: fail }), el("span", { class: "l", text: "flagged for repair" })]),
      el("div", { class: "item" }, [el("span", { class: "sw", style: "background:var(--muted)" }),
        el("span", { class: "n", text: total }), el("span", { class: "l", text: "QA verdicts on disk" })])
    ]);
    mount.appendChild(el("div", { class: "qa-split" }, [donut, legend]));
  }

  /* ---- 9. Tables ------------------------------------------------------- */
  function table(headers, rows) {
    var thead = el("thead", {}, [el("tr", {}, headers.map(function (h) {
      return el("th", h.cls ? { class: h.cls } : {}, h.label != null ? h.label : h);
    }))]);
    var tbody = el("tbody", {}, rows.map(function (r) {
      return el("tr", {}, r.map(function (c) {
        return el("td", (c && c.cls) ? { class: c.cls } : {}, (c && c.node) ? c.node : el("span", { html: (c && c.html != null) ? c.html : esc(c && c.text != null ? c.text : c) }));
      }));
    }));
    return el("div", { class: "table-wrap" }, [el("table", {}, [thead, tbody])]);
  }

  /* ---- 10. Renderers dispatch ----------------------------------------- */
  var renderers = {
    metrics: function (m) {
      var wrap = el("div", { class: "stat-cards" });
      (LT.metrics || []).forEach(function (s) {
        wrap.appendChild(el("div", { class: "stat-card" + (s.cls ? " " + s.cls : "") }, [
          el("div", { class: "num", text: s.num }),
          el("div", { class: "lab", text: s.lab }),
          s.sub ? el("div", { class: "sub", text: s.sub }) : null
        ]));
      });
      m.appendChild(wrap);
    },
    workflow: function (m) {
      var w = LT.workflow; if (!w) return;
      var flow = el("div", { class: "flow" });
      w.phases.forEach(function (p) {
        flow.appendChild(el("div", { class: "phase" }, [
          el("span", { class: "step", text: p.n }),
          el("h4", { text: p.title }),
          el("p", { text: p.detail }),
          el("div", { class: "meta", text: p.meta })
        ]));
      });
      m.appendChild(flow);
    },
    prompts: function (m) {
      var p = LT.workflow && LT.workflow.prompts; if (!p) return;
      m.appendChild(codeblock("Transcribe prompt", p.transcribe));
      m.appendChild(codeblock("Adversarial QA prompt", p.qa));
      m.appendChild(codeblock("Repair prompt", p.repair));
    },
    tools: function (m) {
      var grid = el("div", { class: "grid cols-2" });
      (LT.tools || []).forEach(function (t) {
        var card = el("div", { class: "card" }, [
          el("h3", { html: '<code class="code-inline">' + esc(t.file) + '</code>' }),
          el("p", { class: "card-sub", text: t.lang }),
          el("p", { text: t.purpose })
        ]);
        if (t.commands) {
          var dl = el("dl", { class: "dl" });
          t.commands.forEach(function (c) { dl.appendChild(el("dt", { text: c[0] })); dl.appendChild(el("dd", { text: c[1] })); });
          card.appendChild(dl);
        }
        card.appendChild(codeblock("usage", t.usage));
        grid.appendChild(card);
      });
      m.appendChild(grid);
    },
    "conv-tree": function (m) { m.appendChild(codeblock("french/extracted/", LT.conventions.tree)); },
    "conv-frontmatter": function (m) {
      m.appendChild(table(["Field", "Meaning"], LT.conventions.frontmatter.map(function (r) {
        return [{ node: el("code", { text: r[0] }) }, r[1]];
      })));
    },
    "conv-status": function (m) {
      m.appendChild(table(["Status", "State", "Meaning"], LT.conventions.status.map(function (r) {
        return [
          { node: el("code", { text: r[0] }) },
          { node: el("span", { class: "badge " + r[1] }, [el("span", { class: "d" }), r[1] === "ok" ? "verified" : r[1] === "warn" ? "attention" : "idle"]) },
          r[2]
        ];
      })));
    },
    languages: function (m) {
      var grid = el("div", { class: "lang-grid" });
      (LT.engine.languages || []).forEach(function (l) {
        var active = l.status === "active";
        var attrs = { class: "lang-card" + (active ? "" : " soon") };
        if (active) attrs.href = l.href;
        var card = el(active ? "a" : "div", attrs, [
          el("div", { class: "lang-badge" + (active ? "" : " soon"), text: l.code }),
          el("h3", { text: l.name }),
          el("div", { class: "meta", text: active ? (l.meta || (l.books + " books · " + l.spreads + " spreads")) : "Planned" }),
          el("div", { class: "foot" }, [
            active ? el("span", { class: "badge ok" }, [el("span", { class: "d" }), "active"])
                   : el("span", { class: "badge idle" }, [el("span", { class: "d" }), "planned"]),
            active ? el("span", { class: "go", text: "Explore →" }) : null
          ])
        ]);
        grid.appendChild(card);
      });
      m.appendChild(grid);
    },
    "french-aggregate": function (m) {
      var a = LT.french && LT.french.aggregate; if (!a) return;
      var cells = [["Books", a.books], ["Spreads", a.spreads], ["Transcribed", a.transcribed],
        ["QA-verified", a.verified]];
      var band = el("div", { class: "stat-band" });
      cells.forEach(function (c) {
        band.appendChild(el("div", { class: "cell" }, [
          el("div", { class: "num", text: c[1] }), el("div", { class: "lab", text: c[0] })]));
      });
      m.appendChild(band);
    },
    "book-stats": function (m) {
      var b = resolve(m.getAttribute("data-book")); if (!b) return;
      var cards = [
        { num: b.spreads, lab: "Page spreads", cls: "" },
        { num: b.transcribed, lab: "Transcribed", cls: "" },
        { num: b.verified, lab: "QA-verified", cls: "green" },
        { num: b.qaFail, lab: "Flagged for repair", cls: "coral" }
      ];
      var wrap = el("div", { class: "stat-cards" });
      cards.forEach(function (s) {
        wrap.appendChild(el("div", { class: "stat-card" + (s.cls ? " " + s.cls : "") }, [
          el("div", { class: "num", text: s.num }), el("div", { class: "lab", text: s.lab })]));
      });
      m.appendChild(wrap);
    },
    "french-books": function (m) {
      var books = LT.french.books;
      var grid = el("div", { class: "grid cols-2" });
      Object.keys(books).forEach(function (slug) {
        var b = books[slug];
        var started = b.transcribed > 0;
        var card = el("a", { class: "card lang-card", href: slug + "/" }, [
          el("div", { class: "book-card" }, [
            el("div", { class: "toprow" }, [
              el("div", {}, [ el("h3", { text: b.title }), el("div", { class: "src", text: b.source }) ]),
              el("span", { class: "badge " + (started ? "ok" : "idle") }, [el("span", { class: "d" }), b.status])
            ]),
            el("p", { class: "card-sub", style: "margin-top:12px", text: b.subtitle }),
            el("div", { class: "chips", style: "margin-top:6px" }, [
              el("span", { class: "chip-tag", text: b.spreads + " spreads" }),
              el("span", { class: "chip-tag", text: b.transcribed + " transcribed" }),
              el("span", { class: "chip-tag", text: b.verified + " verified" })
            ]),
            el("div", { class: "foot", style: "margin-top:16px" }, [
              el("span", { class: "meta", text: b.author ? (b.author + (b.publisher ? " · " + b.publisher : "")) : "" }),
              el("span", { class: "go", text: "Open →" })
            ])
          ])
        ]);
        grid.appendChild(card);
      });
      m.appendChild(grid);
    },

    "german-aggregate": function (m) {
      var a = LT.german && LT.german.aggregate; if (!a) return;
      var cells = [["Document sets", a.collections], ["Pages", a.pages], ["QA-verified", a.verified],
        ["Questions", a.questions], ["Words", a.words]];
      var band = el("div", { class: "stat-band" });
      cells.forEach(function (c) {
        band.appendChild(el("div", { class: "cell" }, [
          el("div", { class: "num", text: c[1] }), el("div", { class: "lab", text: c[0] })]));
      });
      m.appendChild(band);
    },

    "german-channels": function (m) {
      var chans = (LT.german && LT.german.channels) || [];
      var grid = el("div", { class: "grid cols-2" });
      chans.forEach(function (c) {
        grid.appendChild(el("div", { class: "card" }, [
          el("div", { class: "toprow" }, [
            el("h3", { text: c.name }),
            el("span", { class: "badge ok" }, [el("span", { class: "d" }), "verified"])
          ]),
          el("p", { class: "card-sub", style: "margin-top:12px", text: c.blurb }),
          el("div", { class: "chips", style: "margin-top:6px" }, [
            el("span", { class: "chip-tag", text: c.pages + " pages" }),
            el("span", { class: "chip-tag", text: c.verified + " verified" })
          ]),
          el("div", { class: "meta", style: "margin-top:14px", text: c.note })
        ]));
      });
      m.appendChild(grid);
    },

    "german-collections": function (m) {
      var cols = (LT.german && LT.german.collections) || {};
      var grid = el("div", { class: "grid cols-2" });
      Object.keys(cols).forEach(function (slug) {
        var b = cols[slug];
        var chips = [
          el("span", { class: "chip-tag", text: b.pages + " pages" }),
          el("span", { class: "chip-tag", text: b.verified + " verified" })
        ];
        if (b.questions) chips.push(el("span", { class: "chip-tag", text: b.questions + " questions" }));
        if (b.words) chips.push(el("span", { class: "chip-tag", text: b.words + " words" }));
        grid.appendChild(el("div", { class: "card" }, [
          el("div", { class: "toprow" }, [
            el("div", {}, [el("h3", { text: b.title }), el("div", { class: "src", text: slug })]),
            el("span", { class: "badge ok" }, [el("span", { class: "d" }), "verified"])
          ]),
          el("div", { class: "chips", style: "margin-top:12px" }, chips)
        ]));
      });
      m.appendChild(grid);
    },

    /* ---- Engine / orchestration page ---------------------------------- */
    "orch-flow": function (m) {
      var o = LT.orchestration; if (!o) return;
      var pipe = el("div", { class: "pipe" });
      o.flow.forEach(function (s, i) {
        if (i) pipe.appendChild(el("div", { class: "link", "aria-hidden": "true" }, [el("span", { class: "dot" })]));
        pipe.appendChild(el("div", { class: "node k-" + s.kind, style: "--i:" + i }, [
          el("span", { class: "ic", html: icon(s.icon, 22) }),
          el("span", { class: "nt", text: s.title }),
          el("span", { class: "ns", text: s.sub })
        ]));
      });
      m.appendChild(pipe);
      var lg = el("div", { class: "pipe-legend" }, [
        el("span", { class: "lg k-vision" }, [el("i"), "Vision model (Opus)"]),
        el("span", { class: "lg k-text" }, [el("i"), "Text model (Haiku/Sonnet)"]),
        el("span", { class: "lg k-free" }, [el("i"), "Python (free)"])
      ]);
      m.appendChild(lg);
    },
    "orch-usecases": function (m) {
      var o = LT.orchestration; if (!o) return;
      o.usecases.forEach(function (u, i) {
        var mini = el("div", { class: "steps-mini" });
        u.steps.forEach(function (s, j) {
          if (j) mini.appendChild(el("span", { class: "ar", text: "→" }));
          mini.appendChild(el("span", { class: "st" }, [el("span", { class: "st-ic", html: icon(s.icon, 14) }), s.label]));
        });
        m.appendChild(el("div", { class: "card usecase reveal", style: "--i:" + i }, [
          el("h3", { text: u.title }),
          el("p", { class: "card-sub", style: "margin:6px 0 0", text: u.input }),
          mini,
          el("div", { class: "usecase-out" }, [
            el("span", { class: "uo-lab", text: "Result" }),
            el("code", { class: "code-inline", text: u.output })
          ])
        ]));
      });
    },
    "orch-roles": function (m) {
      var o = LT.orchestration; if (!o) return;
      var grid = el("div", { class: "grid cols-2" });
      o.roles.forEach(function (r, i) {
        grid.appendChild(el("div", { class: "card role reveal k-" + r.kind, style: "--i:" + i }, [
          el("div", { class: "toprow" }, [el("h3", { text: r.name }),
            el("span", { class: "tier-pill k-" + r.kind, html: icon(r.kind === "vision" ? "eye" : r.kind === "text" ? "type" : "cpu", 12) + "<span>" + (r.kind === "vision" ? "vision" : r.kind === "text" ? "text" : "free") + "</span>" })]),
          el("p", { class: "card-sub", style: "margin:8px 0 12px", text: r.does }),
          el("div", { class: "role-model" }, [el("span", { class: "mono", text: r.model })])
        ]));
      });
      m.appendChild(grid);
    },
    "orch-tiers": function (m) {
      var o = LT.orchestration; if (!o) return;
      var grid = el("div", { class: "grid cols-3" });
      o.tiers.forEach(function (t, i) {
        grid.appendChild(el("div", { class: "card tier reveal k-" + t.key, style: "--i:" + i }, [
          el("div", { class: "tier-head" }, [
            el("span", { class: "tier-dot k-" + t.key, html: icon(t.icon, 16) }),
            el("h3", { text: t.title })
          ]),
          el("div", { class: "tier-model mono", text: t.model }),
          el("p", { class: "card-sub", style: "margin:10px 0 12px", text: t.why }),
          el("div", { class: "chips" }, t.jobs.map(function (j) { return el("span", { class: "chip-tag", text: j }); }))
        ]));
      });
      m.appendChild(grid);
    },
    "orch-layers": function (m) {
      var o = LT.orchestration; if (!o) return;
      var wrap = el("div", { class: "layers" });
      o.layers.forEach(function (L, i) {
        wrap.appendChild(el("div", { class: "layer reveal k-" + L.kind, style: "--i:" + i }, [
          el("span", { class: "ln", text: L.n }),
          el("div", { class: "lbody" }, [
            el("div", { class: "lname" }, [el("b", { text: L.name }),
              el("span", { class: "tier-pill k-" + L.kind, html: icon(L.kind === "vision" ? "eye" : L.kind === "text" ? "type" : "cpu", 11) + "<span>" + (L.kind === "vision" ? "vision" : L.kind === "text" ? "text" : "free") + "</span>" })]),
            el("div", { class: "ltool mono", text: L.tool }),
            el("div", { class: "lout", text: "→ " + L.out })
          ])
        ]));
      });
      m.appendChild(wrap);
    },
    "orch-cost": function (m) {
      var o = LT.orchestration; if (!o) return;
      var chart = el("div", { class: "chart" });
      o.cost.forEach(function (c) {
        chart.appendChild(el("div", { class: "row" }, [
          el("div", { class: "k", text: c.k }),
          el("div", { class: "track" }, [el("div", { class: "fill cost-fill", "data-w": c.v, style: "width:0" })]),
          el("div", { class: "v" }, [document.createTextNode(c.v + "%")])
        ]));
        chart.appendChild(el("div", { class: "cost-note", text: c.note }));
      });
      m.appendChild(chart);
      // animate fills in when scrolled into view
      revealFills(chart);
    },
    "orch-savers": function (m) {
      var o = LT.orchestration; if (!o) return;
      var ol = el("div", { class: "savers" });
      o.savers.forEach(function (s, i) {
        ol.appendChild(el("div", { class: "saver reveal", style: "--i:" + i }, [
          el("span", { class: "sv-n", text: (i + 1) }),
          el("div", {}, [el("b", { text: s[0] }), el("p", { class: "card-sub", style: "margin:4px 0 0", text: s[1] })])
        ]));
      });
      m.appendChild(ol);
    },

    "orch-ledger": function (m) {
      var e = LT.orchestration && LT.orchestration.effort; if (!e) return;
      var grid = el("div", { class: "stat-cards" });
      e.ledger.forEach(function (c) {
        grid.appendChild(el("div", { class: "stat-card" }, [
          el("div", { class: "num", text: c.num }), el("div", { class: "lab", text: c.lab }),
          el("div", { class: "sub", text: c.sub })
        ]));
      });
      m.appendChild(grid);
    },
    "orch-timeline": function (m) {
      var e = LT.orchestration && LT.orchestration.effort; if (!e) return;
      var wrap = el("div", { class: "layers" });
      e.timeline.forEach(function (t, i) {
        wrap.appendChild(el("div", { class: "layer reveal", style: "--i:" + i }, [
          el("span", { class: "ln", text: i + 1 }),
          el("div", { class: "lbody" }, [
            el("div", { class: "lname" }, [el("b", { text: t.phase }), el("span", { class: "tier-pill", style: "background:var(--accent)", text: t.eta })]),
            el("div", { class: "lout", style: "margin-top:4px", text: t.detail })
          ])
        ]));
      });
      m.appendChild(wrap);
      var res = el("div", { class: "chips", style: "margin-top:18px" });
      e.resilience.forEach(function (r) { res.appendChild(el("span", { class: "chip-tag" }, [el("span", { class: "chip-ic", html: icon("check", 12) }), r])); });
      m.appendChild(res);
    },

    "german-exports": function (m) {
      var rows = (LT.german && LT.german.exports) || [];
      var tbl = el("table", { class: "table" });
      var thead = el("thead", {}, [el("tr", {}, [
        el("th", { text: "Deliverable" }), el("th", { text: "File" }), el("th", { text: "What it holds" })])]);
      var tb = el("tbody");
      rows.forEach(function (r) {
        tb.appendChild(el("tr", {}, [
          el("td", { text: r[0] }),
          el("td", {}, [el("code", { class: "code-inline", text: r[1] })]),
          el("td", { text: r[2] })
        ]));
      });
      tbl.appendChild(thead); tbl.appendChild(tb);
      m.appendChild(el("div", { class: "table-wrap" }, [tbl]));
    }
  };

  /* ---- Scroll reveal (progressive, no-JS-safe) ------------------------- */
  var _reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function initReveal() {
    var nodes = $all(".reveal");
    if (!nodes.length) return;
    if (_reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    document.documentElement.classList.add("js-reveal"); // gate: hidden only when JS+IO present
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function revealFills(root) {
    var fills = $all(".cost-fill", root);
    function paint() { fills.forEach(function (f) { f.style.width = (f.getAttribute("data-w") || 0) + "%"; }); }
    if (_reduceMotion || !("IntersectionObserver" in window)) { paint(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { paint(); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(root);
  }

  function runRenderers() {
    $all("[data-render]").forEach(function (m) {
      var fn = renderers[m.getAttribute("data-render")];
      if (fn) try { fn(m); } catch (e) { console.error("render", m.getAttribute("data-render"), e); }
    });
    // charts by data path
    $all("[data-chart]").forEach(function (m) {
      var data = resolve(m.getAttribute("data-chart"));
      if (data) barChart(m, data, { label: m.getAttribute("data-label") });
    });
    $all("[data-meter]").forEach(function (m) {
      var data = resolve(m.getAttribute("data-meter"));
      if (data) meters(m, data);
    });
    $all("[data-qa]").forEach(function (m) {
      var b = resolve(m.getAttribute("data-qa"));
      if (b) qaDonut(m, b.qaPass, b.qaFail);
    });
    $all("[data-chapters]").forEach(function (m) {
      var rows = resolve(m.getAttribute("data-chapters"));
      if (rows) m.appendChild(table(
        [{ label: "Ch." }, "Chapter (tense)", { label: "Printed p.", cls: "num" }],
        rows.map(function (r) { return [{ text: r[0], cls: "num" }, r[1], { text: r[2], cls: "num" }]; })
      ));
    });
    $all("[data-units]").forEach(function (m) {
      var rows = resolve(m.getAttribute("data-units"));
      if (rows) m.appendChild(table(
        [{ label: "Unit" }, "Topic", { label: "Printed p.", cls: "num" }],
        rows.map(function (r) { return [{ text: r[0], cls: "num" }, r[1], { text: r[2] == null ? "—" : r[2], cls: "num" }]; })
      ));
    });
  }

  /* ---- boot ------------------------------------------------------------ */
  function boot() {
    initTopbar();
    runRenderers();
    buildSubnav();
    initSearch();
    initScrollSpy();
    initTheme();
    initReveal();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
