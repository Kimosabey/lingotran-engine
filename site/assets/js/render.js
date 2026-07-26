/* ==========================================================================
   Lingotran Engine — Data-driven renderers
   Fills [data-render] / [data-chart] / [data-meter] / [data-qa] mounts from
   window.LT. Every chart also carries its numbers as text (no chart is the
   sole source of a value). Uses window.LTApp helpers.
   ========================================================================== */
(function () {
  "use strict";
  var LT = window.LT || {}, A = window.LTApp;
  if (!A) return;
  var el = A.el, esc = A.esc, icon = A.icon, $all = A.$all, reduce = A.reduceMotion;

  function sum(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); }
  function resolve(path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, LT); }

  /* ---- reveal-on-scroll fill animation --------------------------------- */
  function animateFills(root) {
    var fills = $all("[data-w]", root);
    function paint() { fills.forEach(function (f) { f.style.width = (f.getAttribute("data-w") || 0) + "%"; }); }
    if (reduce || !("IntersectionObserver" in window)) { paint(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { paint(); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(root);
  }

  /* ---- primitives ------------------------------------------------------ */
  function table(headers, rows, cls) {
    var thead = el("thead", {}, [el("tr", {}, headers.map(function (h) {
      return el("th", h.cls ? { class: h.cls } : {}, h.label != null ? h.label : h);
    }))]);
    var tbody = el("tbody", {}, rows.map(function (r) {
      return el("tr", {}, r.map(function (c) {
        return el("td", (c && c.cls) ? { class: c.cls } : {},
          (c && c.node) ? c.node : el("span", { html: (c && c.html != null) ? c.html : esc(c && c.text != null ? c.text : c) }));
      }));
    }));
    return el("div", { class: "table-wrap scroll-thin" }, [el("table", cls ? { class: cls } : {}, [thead, tbody])]);
  }
  function codeblock(label, text) {
    var pre = el("pre", { class: "scroll-thin" }, [document.createTextNode(text)]);
    var copy = el("button", { class: "copy", type: "button" }, "Copy");
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "Copied ✓"; setTimeout(function () { copy.textContent = "Copy"; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    });
    return el("div", { class: "codeblock" }, [el("div", { class: "code-head" }, [el("span", { class: "fname" }, label), copy]), pre]);
  }
  function barChart(mount, data, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    var total = sum(data, function (d) { return d.v; }) || 1;
    var wrap = el("div", { class: "chart", role: "img", "aria-label": opts.label || "bar chart" });
    data.forEach(function (d) {
      var pct = Math.round((d.v / total) * 100);
      wrap.appendChild(el("div", { class: "row" }, [
        el("span", { class: "k", title: d.k }, d.k),
        el("span", { class: "track" }, [el("span", { class: "fill" + (opts.fillCls ? " " + opts.fillCls : ""), "data-w": Math.max(2, Math.round((d.v / max) * 100)) })]),
        el("span", { class: "v", html: esc(d.v) + (opts.pct !== false ? ' <small>' + pct + '%</small>' : "") })
      ]));
    });
    mount.appendChild(wrap); animateFills(wrap);
  }
  function meters(mount, data) {
    data.forEach(function (m) {
      var pct = m.of ? Math.round((m.value / m.of) * 100) : 0;
      var box = el("div", { class: "meter" }, [
        el("div", { class: "top" }, [el("span", { class: "name" }, m.name),
          el("span", { class: "pct" + (m.cls === "f-verified" ? " p-verified" : "") }, pct + "%")]),
        el("div", { class: "track" }, [el("div", { class: "fill" + (m.cls ? " " + m.cls : ""), "data-w": pct })]),
        el("div", { class: "cap" }, m.value + " of " + m.of + (m.unit || " spreads"))
      ]);
      mount.appendChild(box); animateFills(box);
    });
  }
  function qaDonut(mount, pass, fail) {
    var total = pass + fail || 1, pct = Math.round((pass / total) * 100);
    var donut = el("div", { class: "donut", style: "--v:" + pct, role: "img", "aria-label": pass + " clean, " + fail + " flagged" },
      [el("div", { class: "hole" }, [el("b", {}, pct + "%"), el("span", {}, "clean")])]);
    var legend = el("div", { class: "legend" }, [
      el("div", { class: "item" }, [el("span", { class: "sw ok" }), el("span", { class: "n" }, String(pass)), el("span", { class: "l" }, "clean (ok: true)")]),
      el("div", { class: "item" }, [el("span", { class: "sw flag" }), el("span", { class: "n" }, String(fail)), el("span", { class: "l" }, "flagged for repair")]),
      el("div", { class: "item" }, [el("span", { class: "sw mut" }), el("span", { class: "n" }, String(total)), el("span", { class: "l" }, "QA verdicts on disk")])
    ]);
    mount.appendChild(el("div", { class: "qa-split" }, [donut, legend]));
  }
  function statCards(mount, cards, gridCls) {
    var wrap = el("div", { class: "kpis" + (gridCls ? " " + gridCls : "") });
    cards.forEach(function (s) {
      wrap.appendChild(el("div", { class: "kpi" + (s.cls ? " " + s.cls : "") }, [
        el("div", { class: "kpi-top" }, [el("span", { class: "kpi-ico", html: icon(s.icon || "grid", 18) }), s.badge || null]),
        el("div", { class: "kpi-num num" }, String(s.num)),
        el("div", { class: "kpi-lab" }, s.lab),
        s.sub ? el("div", { class: "kpi-sub" }, s.sub) : null
      ]));
    });
    mount.appendChild(wrap);
  }
  function langPin(code) { return el("span", { class: "lang-pin" }, code); }
  /* Reads b.status text directly (French books author it, e.g. "complete (21
     disclosed gaps)") rather than re-deriving from qaFail/verified counts —
     matching the canonical stateOf() logic in data.js's corpus(). A book with
     confirmed, disclosed, permanent gaps is complete, not "in progress". */
  function bookStatusBadge(b) {
    var extra = b.qaFail ? " · " + b.qaFail + " disclosed" : "";
    if (/complete/i.test(b.status || "")) return el("span", { class: "badge badge-verified" }, [el("span", { class: "dot" }), "complete" + extra]);
    if (!b.transcribed) return el("span", { class: "badge badge-idle" }, [el("span", { class: "dot" }), "not started"]);
    return el("span", { class: "badge badge-progress" }, [el("span", { class: "dot" }), "in progress" + extra]);
  }

  /* ---- fidelity signature card ----------------------------------------- */
  function fidelityCard(mount) {
    var scan = el("div", { class: "scan" });
    scan.innerHTML =
      '<span class="scanbeam" aria-hidden="true"></span>' +
      '<div class="scan-label">netzwerk-a1-kursbuch · page-066.png · 300 DPI</div>' +
      '<div class="scan-title"></div>' +
      '<div class="ln long"></div><div class="ln mid"></div><div class="ln long"></div><div class="ln short"></div>' +
      '<div class="scan-tbl"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="ln mid" style="margin-top:14px"></div><div class="ln short"></div>';
    var arrow = el("div", { class: "fidelity-arrow", "aria-hidden": "true" }, [el("div", { class: "rail" })]);
    var structured = el("div", { class: "structured" });
    [["source", "netzwerk-a1-kursbuch", false], ["page", "066", true], ["content", "dialogue · communication", false], ["qa", "ok: true", true]]
      .forEach(function (r) {
        structured.appendChild(el("div", { class: "srow" }, [
          el("span", { class: "key" }, r[0] + ":"),
          el("span", {}, r[1]),
          r[2] ? el("span", { class: "ok", html: icon("check", 14) }) : null
        ]));
      });
    var seal = el("div", { class: "fidelity-seal", html: icon("checkSeal", 14) + "<span>Verified</span>" });
    mount.appendChild(el("div", { class: "fidelity" }, [seal, scan, arrow, structured]));
  }

  /* ---- renderers dispatch ---------------------------------------------- */
  var R = {
    fidelity: function (m) { fidelityCard(m); },

    "hero-tags": function (m) {
      var g = LT.metrics || [], qa = LT.qaGlobal;
      var pages = g[1] ? g[1].num : "";
      m.appendChild(el("div", { class: "hero-meta" }, [
        chip("2 languages · " + pages + " pages"),
        qa ? chip(qa.pct + "% QA pass rate", true) : null,
        chip("Zero data loss", true)
      ]));
    },

    "kpi-global": function (m) {
      var g = LT.metrics || [];
      var icons = ["layers", "doc", "type", "checkSeal", "gauge"];
      var cards = g.map(function (s, i) { return { num: s.num, lab: s.lab, sub: s.sub, cls: s.cls === "green" ? "k-verified" : "", icon: icons[i] || "grid" }; });
      statCards(m, cards, cards.length === 5 ? "k5" : "");
    },

    "progress-languages": function (m) {
      var f = LT.french.aggregate, d = LT.german.aggregate;
      meters(m, [
        { name: "French — QA-verified", value: f.verified, of: f.spreads, cls: "f-verified", unit: " spreads" },
        { name: "German — QA-verified", value: d.verified, of: d.pages, cls: "f-verified", unit: " pages" }
      ]);
    },

    "qa-global": function (m) {
      var f = LT.french.aggregate;
      qaDonut(m, f.qaPass, f.qaFail);
    },

    "content-mix": function (m) {
      barChart(m, (LT.german.itemTypes || []).slice(0, 8), { label: "German exercise item types", pct: true });
    },

    "journey-ledger": function (m) {
      var e = LT.orchestration.effort;
      var icons = ["type", "checkSeal", "grid", "book"];
      statCards(m, e.ledger.map(function (c, i) { return { num: c.num, lab: c.lab, sub: c.sub, icon: icons[i], cls: i === 1 ? "k-verified" : "" }; }));
    },

    "languages": function (m) {
      var grid = el("div", { class: "grid grid-3" });
      (LT.engine.languages || []).forEach(function (l) {
        var active = l.status === "active";
        var attrs = { class: "card lang-card" + (active ? " card-hover card-link" : " soon") };
        if (active) attrs.href = l.href;
        var card = el(active ? "a" : "div", attrs, [
          el("span", { class: "lang-pin-lg" + (active ? "" : " soon") }, l.code),
          el("h3", {}, l.name),
          el("div", { class: "card-sub" }, active ? (l.meta || (l.books + " books · " + l.spreads + " spreads")) : "Planned target"),
          el("div", { class: "card-foot" }, [
            active ? el("span", { class: "badge badge-verified" }, [el("span", { class: "dot" }), "active"])
                   : el("span", { class: "badge badge-idle" }, [el("span", { class: "dot" }), "planned"]),
            active ? el("span", { class: "go" }, [document.createTextNode("Explore"), spanArrow()]) : null
          ])
        ]);
        grid.appendChild(card);
      });
      m.appendChild(grid);
    },

    /* ---- French ---- */
    "french-kpi": function (m) {
      var a = LT.french.aggregate;
      statCards(m, [
        { num: a.books, lab: "Workbooks", icon: "book" },
        { num: a.spreads, lab: "Page spreads", icon: "doc" },
        { num: a.transcribed, lab: "Transcribed", sub: pctOf(a.transcribed, a.spreads), icon: "type" },
        { num: a.verified, lab: "QA-verified", sub: pctOf(a.verified, a.spreads), cls: "k-verified", icon: "checkSeal" }
      ]);
    },
    "french-books": function (m) {
      var books = LT.french.books;
      var grid = el("div", { class: "grid grid-2" });
      Object.keys(books).forEach(function (slug) {
        var b = books[slug];
        grid.appendChild(el("a", { class: "card lang-card card-hover card-link", href: slug + "/" }, [
          el("div", { class: "toprow" }, [
            el("div", {}, [el("h3", {}, b.title), el("div", { class: "kpi-sub mono" }, b.source)]),
            bookStatusBadge(b)
          ]),
          el("p", { class: "card-sub", style: "margin-top:12px" }, b.subtitle),
          el("div", { class: "cluster", style: "margin-top:10px" }, [
            chip(b.spreads + " spreads"), chip(b.transcribed + " transcribed"), chip(b.verified + " verified", true)
          ]),
          el("div", { class: "card-foot" }, [
            el("span", { class: "kpi-sub" }, b.author ? (b.author + (b.publisher ? " · " + b.publisher : "")) : ""),
            el("span", { class: "go" }, [document.createTextNode("Open"), spanArrow()])
          ])
        ]));
      });
      m.appendChild(grid);
    },
    "book-kpi": function (m) {
      var b = resolve(m.getAttribute("data-book")); if (!b) return;
      statCards(m, [
        { num: b.spreads, lab: "Page spreads", icon: "doc" },
        { num: b.transcribed, lab: "Transcribed", sub: pctOf(b.transcribed, b.spreads), icon: "type" },
        { num: b.verified, lab: "QA-verified", sub: pctOf(b.verified, b.spreads), cls: "k-verified", icon: "checkSeal" },
        { num: b.qaFail, lab: "Flagged for repair", cls: b.qaFail ? "k-flag" : "", icon: "wrench" }
      ]);
    },

    /* ---- German ---- */
    "german-kpi": function (m) {
      var a = LT.german.aggregate;
      statCards(m, [
        { num: a.collections, lab: "Book / exam sets", icon: "book" },
        { num: a.pages, lab: "Pages", icon: "doc" },
        { num: a.verified, lab: "QA-verified", sub: "100% zero-loss", cls: "k-verified", icon: "checkSeal" },
        { num: a.questions.toLocaleString(), lab: "Questions", icon: "type" },
        { num: a.words.toLocaleString(), lab: "Vocabulary words", icon: "tag" }
      ], "k5");
    },
    "german-channels": function (m) {
      var grid = el("div", { class: "grid grid-3" });
      (LT.german.channels || []).forEach(function (c) {
        grid.appendChild(el("div", { class: "card" }, [
          el("div", { class: "toprow" }, [el("h3", {}, c.name), el("span", { class: "badge badge-verified" }, [el("span", { class: "dot" }), "verified"])]),
          el("p", { class: "card-sub", style: "margin-top:10px" }, c.blurb),
          el("div", { class: "cluster", style: "margin-top:14px" }, [chip(c.pages + " pages"), chip(c.verified + " verified", true)]),
          el("div", { class: "kpi-sub", style: "margin-top:12px" }, c.note)
        ]));
      });
      m.appendChild(grid);
    },
    "german-collections": function (m) {
      var cols = LT.german.collections || {};
      var grid = el("div", { class: "grid grid-2" });
      Object.keys(cols).forEach(function (slug) {
        var c = cols[slug];
        var chips = [chip(c.pages + " pages"), chip(c.verified + " verified", true)];
        if (c.questions) chips.push(chip(c.questions.toLocaleString() + " questions"));
        if (c.words) chips.push(chip(c.words.toLocaleString() + " words"));
        grid.appendChild(el("div", { class: "card", id: "col-" + slug }, [
          el("div", { class: "toprow" }, [
            el("div", {}, [el("h3", {}, c.title), el("div", { class: "kpi-sub mono" }, c.variant.replace(/-/g, " "))]),
            el("span", { class: "badge badge-verified" }, [el("span", { class: "dot" }), "complete"])
          ]),
          el("div", { class: "cluster", style: "margin-top:12px" }, chips)
        ]));
      });
      m.appendChild(grid);
    },
    "german-itemtypes": function (m) { barChart(m, LT.german.itemTypes || [], { label: "Question item types across the German corpus" }); },
    "german-exports": function (m) {
      m.appendChild(table(["Deliverable", "File", "What it holds"], (LT.german.exports || []).map(function (r) {
        return [{ text: r[0], cls: "td-strong" }, { node: el("code", { class: "code-inline" }, r[1]) }, r[2]];
      })));
    },

    /* ---- Engine ---- */
    "orch-flow": function (m) {
      var o = LT.orchestration; if (!o) return;
      var pipe = el("div", { class: "pipe" });
      o.flow.forEach(function (s, i) {
        if (i) pipe.appendChild(el("div", { class: "link", "aria-hidden": "true" }, [el("span", { class: "dot" })]));
        var node = el("div", { class: "node k-" + s.kind, style: "--i:" + i }, [
          el("span", { class: "ic", html: icon(s.icon, 22) }), el("span", { class: "nt" }, s.title), el("span", { class: "ns" }, s.sub)]);
        pipe.appendChild(node);
      });
      m.appendChild(pipe);
      m.appendChild(el("div", { class: "pipe-legend" }, [
        legendItem("k-vision", "Vision model (Opus)"), legendItem("k-text", "Text model (Sonnet/Haiku)"), legendItem("k-free", "Python (free)")]));
    },
    "orch-usecases": function (m) {
      (LT.orchestration.usecases || []).forEach(function (u, i) {
        var mini = el("div", { class: "steps-mini" });
        u.steps.forEach(function (s, j) {
          if (j) mini.appendChild(el("span", { class: "ar" }, "→"));
          mini.appendChild(el("span", { class: "st" }, [el("span", { class: "st-ic", html: icon(s.icon, 14) }), s.label]));
        });
        m.appendChild(el("div", { class: "card usecase", style: "--i:" + i }, [
          el("h3", {}, u.title), el("p", { class: "card-sub", style: "margin-top:6px" }, u.input), mini,
          el("div", { class: "usecase-out" }, [el("span", { class: "uo-lab" }, "Result"), el("code", { class: "code-inline" }, u.output)])
        ]));
      });
    },
    "orch-roles": function (m) {
      var grid = el("div", { class: "grid grid-2" });
      (LT.orchestration.roles || []).forEach(function (r, i) {
        grid.appendChild(el("div", { class: "card role k-" + r.kind, style: "--i:" + i }, [
          el("div", { class: "toprow" }, [el("h3", {}, r.name), tierPill(r.kind)]),
          el("p", { class: "card-sub", style: "margin:8px 0 0" }, r.does),
          el("div", { class: "role-model" }, [el("span", { class: "mono" }, r.model)])
        ]));
      });
      m.appendChild(grid);
    },
    "orch-tiers": function (m) {
      var grid = el("div", { class: "grid grid-3" });
      (LT.orchestration.tiers || []).forEach(function (t, i) {
        var dot = el("span", { class: "tier-dot k-" + t.key, html: icon(t.icon, 16) });
        grid.appendChild(el("div", { class: "card tier k-" + t.key, style: "--i:" + i }, [
          el("div", { class: "tier-head" }, [dot, el("h3", {}, t.title)]),
          el("div", { class: "tier-model" }, t.model),
          el("p", { class: "card-sub", style: "margin:10px 0 12px" }, t.why),
          el("div", { class: "cluster" }, t.jobs.map(function (j) { return chip(j); }))
        ]));
      });
      m.appendChild(grid);
    },
    "orch-layers": function (m) {
      var wrap = el("div", { class: "layers" });
      (LT.orchestration.layers || []).forEach(function (L, i) {
        wrap.appendChild(el("div", { class: "layer k-" + L.kind, style: "--i:" + i }, [
          el("span", { class: "ln" }, String(L.n)),
          el("div", {}, [
            el("div", { class: "lname" }, [el("b", {}, L.name), tierPill(L.kind)]),
            el("div", { class: "ltool" }, L.tool),
            el("div", { class: "lout" }, "→ " + L.out)
          ])
        ]));
      });
      m.appendChild(wrap);
    },
    "orch-cost": function (m) {
      var chart = el("div", { class: "chart" });
      (LT.orchestration.cost || []).forEach(function (c) {
        chart.appendChild(el("div", { class: "row" }, [
          el("div", { class: "k" }, c.k),
          el("div", { class: "track" }, [el("div", { class: "fill f-cost", "data-w": c.v })]),
          el("div", { class: "v" }, c.v + "%")
        ]));
        chart.appendChild(el("div", { class: "cost-note" }, c.note));
      });
      m.appendChild(chart); animateFills(chart);
    },
    "orch-savers": function (m) {
      var box = el("div", { class: "savers" });
      (LT.orchestration.savers || []).forEach(function (s, i) {
        box.appendChild(el("div", { class: "saver", style: "--i:" + i }, [
          el("span", { class: "sv-n" }, String(i + 1)),
          el("div", {}, [el("b", {}, s[0]), el("p", { class: "card-sub", style: "margin:4px 0 0" }, s[1])])
        ]));
      });
      m.appendChild(box);
    },
    "orch-ledger": function (m) {
      var e = LT.orchestration.effort;
      var icons = ["type", "checkSeal", "grid", "book"];
      statCards(m, e.ledger.map(function (c, i) { return { num: c.num, lab: c.lab, sub: c.sub, icon: icons[i], cls: i === 1 ? "k-verified" : "" }; }));
    },
    "orch-timeline": function (m) {
      var e = LT.orchestration.effort;
      var wrap = el("div", { class: "layers" });
      e.timeline.forEach(function (t, i) {
        wrap.appendChild(el("div", { class: "layer", style: "--i:" + i }, [
          el("span", { class: "ln" }, String(i + 1)),
          el("div", {}, [
            el("div", { class: "lname" }, [el("b", {}, t.phase), el("span", { class: "tier-pill k-vision" }, t.eta)]),
            el("div", { class: "lout", style: "margin-top:4px" }, t.detail)
          ])
        ]));
      });
      m.appendChild(wrap);
      var res = el("div", { class: "cluster", style: "margin-top:18px" });
      e.resilience.forEach(function (r) { res.appendChild(chip(r, true)); });
      m.appendChild(res);
    },
    "prompts": function (m) {
      var p = LT.workflow && LT.workflow.prompts; if (!p) return;
      m.appendChild(codeblock("Transcribe prompt", p.transcribe));
      m.appendChild(codeblock("Adversarial QA prompt", p.qa));
      m.appendChild(codeblock("Repair prompt", p.repair));
    },

    /* ---- Reference ---- */
    "tools": function (m) {
      var grid = el("div", { class: "grid grid-2" });
      (LT.tools || []).forEach(function (t) {
        var card = el("div", { class: "card" }, [
          el("h3", { html: '<code class="code-inline">' + esc(t.file) + "</code>" }),
          el("p", { class: "card-sub", style: "margin:6px 0 10px" }, t.lang),
          el("p", { class: "prose" }, [el("p", {}, t.purpose)])
        ]);
        if (t.commands) { var dl = el("dl", { class: "dl" }); t.commands.forEach(function (c) { dl.appendChild(el("dt", {}, c[0])); dl.appendChild(el("dd", {}, c[1])); }); card.appendChild(dl); }
        card.appendChild(codeblock("usage", t.usage));
        grid.appendChild(card);
      });
      m.appendChild(grid);
    },
    "conv-tree": function (m) { m.appendChild(codeblock("french/extracted/", LT.conventions.tree)); },
    "conv-naming": function (m) { m.appendChild(el("p", { class: "prose" }, [el("p", {}, LT.conventions.naming)])); },
    "conv-frontmatter": function (m) {
      m.appendChild(table(["Field", "Meaning"], LT.conventions.frontmatter.map(function (r) {
        return [{ node: el("code", { class: "code-inline" }, r[0]) }, r[1]];
      })));
    },
    "conv-status": function (m) {
      var badgeFor = { ok: "badge-verified", warn: "badge-flag", idle: "badge-idle" };
      var labFor = { ok: "verified", warn: "attention", idle: "idle" };
      m.appendChild(table(["Status", "State", "Meaning"], LT.conventions.status.map(function (r) {
        return [{ node: el("code", { class: "code-inline" }, r[0]) },
          { node: el("span", { class: "badge " + (badgeFor[r[1]] || "badge-idle") }, [el("span", { class: "dot" }), labFor[r[1]] || r[1]]) }, r[2]];
      })));
    }
  };

  /* small helpers */
  function pctOf(a, b) { return b ? Math.round((a / b) * 100) + "% of pages" : ""; }
  function spanArrow() { return el("span", { class: "go-arrow", html: icon("arrow", 15) }); }
  function chip(text, ok) { var c = el("span", { class: "chip" }, [ok ? mkChipIco() : null, text]); return c; }
  function mkChipIco() { var s = el("span", { class: "chip-ico" }); s.innerHTML = icon("check", 12); return s; }
  function legendItem(k, label) { return el("span", { class: "lg " + k }, [el("i"), label]); }
  function tierPill(kind) {
    var label = kind === "vision" ? "vision" : kind === "text" ? "text" : "free";
    var ico = kind === "vision" ? "eye" : kind === "text" ? "type" : "cpu";
    return el("span", { class: "tier-pill k-" + kind, html: icon(ico, 12) + "<span>" + label + "</span>" });
  }

  /* ---- run ------------------------------------------------------------- */
  function run() {
    $all("[data-render]").forEach(function (m) {
      var fn = R[m.getAttribute("data-render")];
      if (fn) try { fn(m); } catch (e) { console.error("render", m.getAttribute("data-render"), e); }
    });
    $all("[data-chart]").forEach(function (m) { var d = resolve(m.getAttribute("data-chart")); if (d) barChart(m, d, { label: m.getAttribute("data-label"), fillCls: m.getAttribute("data-fill") }); });
    $all("[data-meter]").forEach(function (m) { var d = resolve(m.getAttribute("data-meter")); if (d) meters(m, d); });
    $all("[data-qa]").forEach(function (m) { var b = resolve(m.getAttribute("data-qa")); if (b) qaDonut(m, b.qaPass, b.qaFail); });
    $all("[data-chapters]").forEach(function (m) {
      var rows = resolve(m.getAttribute("data-chapters")); var label = m.getAttribute("data-chapters-label") || "Chapter";
      if (rows) m.appendChild(table([{ label: "Ch.", cls: "th-num" }, label, { label: "Printed p.", cls: "th-num" }],
        rows.map(function (r) { return [{ text: r[0], cls: "td-num" }, r[1], { text: r[2], cls: "td-num" }]; })));
    });
    $all("[data-units]").forEach(function (m) {
      var rows = resolve(m.getAttribute("data-units"));
      if (rows) m.appendChild(table([{ label: "Unit", cls: "th-num" }, "Topic", { label: "Printed p.", cls: "th-num" }],
        rows.map(function (r) { return [{ text: r[0], cls: "td-num" }, r[1], { text: r[2] == null ? "—" : r[2], cls: "td-num" }]; })));
    });
  }
  window.LTRender = { run: run, table: table, codeblock: codeblock, barChart: barChart, chip: chip };
})();
