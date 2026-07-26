/* ==========================================================================
   Lingotran Engine — Corpus console
   A read-only browser over LT.corpus(): search, filter by language/status,
   sort, expandable rows with per-book detail. No write actions — this is a
   record, not a form. Desktop = sticky-header table; mobile = card list
   (same markup, CSS reflows it — see .corpus-table in app.css).
   ========================================================================== */
(function () {
  "use strict";
  var LT = window.LT || {}, A = window.LTApp, R = window.LTRender;
  if (!A || !R) return;
  var $ = A.$, $all = A.$all, el = A.el, esc = A.esc, icon = A.icon;

  function mount(hostSel) {
    var host = $(hostSel);
    if (!host || typeof LT.corpus !== "function") return;
    var all = LT.corpus();
    var state = { q: "", lang: "all", status: "all", sort: "title-asc", expanded: null };

    /* ---- toolbar ---------------------------------------------------- */
    var bar = el("div", { class: "console-bar" });
    var searchField = el("div", { class: "field grow" }, [
      el("span", { class: "field-ico", html: icon("search", 15) }),
      el("input", { class: "input input-search", type: "search", placeholder: "Search books, exams, sources…", "aria-label": "Search the corpus" })
    ]);
    var langSel = el("select", { class: "select", "aria-label": "Filter by language" }, [
      el("option", { value: "all" }, "All languages"),
      el("option", { value: "FR" }, "French"),
      el("option", { value: "DE" }, "German")
    ]);
    var statusSel = el("select", { class: "select", "aria-label": "Filter by status" }, [
      el("option", { value: "all" }, "All statuses"),
      el("option", { value: "complete" }, "Complete"),
      el("option", { value: "in-progress" }, "In progress"),
      el("option", { value: "not-started" }, "Not started"),
      el("option", { value: "flags" }, "Has disclosed gaps")
    ]);
    var sortSel = el("select", { class: "select", "aria-label": "Sort by" }, [
      el("option", { value: "title-asc" }, "Sort: Title A–Z"),
      el("option", { value: "pages-desc" }, "Sort: Most pages"),
      el("option", { value: "pct-desc" }, "Sort: Highest QA %"),
      el("option", { value: "pct-asc" }, "Sort: Lowest QA %")
    ]);
    var count = el("span", { class: "console-count", "aria-live": "polite" });
    bar.appendChild(searchField); bar.appendChild(langSel); bar.appendChild(statusSel); bar.appendChild(sortSel); bar.appendChild(count);

    var tableWrap = el("div", { class: "table-wrap scroll-thin" });
    var table = el("table", { class: "corpus-table" });
    var thead = el("thead", {}, [el("tr", {}, [
      el("th", {}, "Book / collection"), el("th", {}, "Language"),
      el("th", { class: "th-num" }, "Pages"), el("th", {}, "QA progress"), el("th", {}, "Status"), el("th", { style: "width:36px" }, "")
    ])]);
    var tbody = el("tbody");
    table.appendChild(thead); table.appendChild(tbody);
    tableWrap.appendChild(table);
    var emptyBox = el("div", { class: "empty hide", role: "status" }, [
      el("div", { class: "empty-ico", html: icon("search", 22) }),
      el("h4", {}, "No matches"),
      el("p", {}, "Try a different language, status, or search term.")
    ]);

    host.appendChild(bar); host.appendChild(tableWrap); host.appendChild(emptyBox);

    /* item.state ("complete" | "in-progress" | "not-started") is computed once
       in data.js's corpus() — read it, don't re-derive it (that duplication is
       exactly how a book with confirmed, disclosed, permanent gaps ended up
       mislabeled "flagged"/"in progress" in one place and "complete" in
       another). qaFail is shown as a qualifier, not as a competing status. */
    function statusBadge(item) {
      var extra = item.qaFail > 0 ? " · " + item.qaFail + " disclosed" : "";
      if (item.state === "complete") return el("span", { class: "badge badge-verified" }, [el("span", { class: "dot" }), "complete" + extra]);
      if (item.state === "not-started") return el("span", { class: "badge badge-idle" }, [el("span", { class: "dot" }), "not started"]);
      return el("span", { class: "badge badge-progress" }, [el("span", { class: "dot" }), "in progress" + extra]);
    }

    function detailFor(item) {
      var b = item.book;
      var left = el("div", { class: "prose" });
      if (b.blurb) left.appendChild(el("p", {}, b.blurb));
      var chipRow = el("div", { class: "cluster" }, [
        R.chip(item.pages + " pages"), R.chip(item.transcribed + " transcribed"),
        R.chip(item.verified + " verified", true)
      ]);
      if (item.questions) chipRow.appendChild(R.chip(item.questions.toLocaleString() + " questions"));
      if (item.words) chipRow.appendChild(R.chip(item.words.toLocaleString() + " words"));
      left.appendChild(chipRow);
      if (b.caveats && b.caveats.length) {
        left.appendChild(el("div", { class: "note note-flag", style: "margin-top:14px" }, [
          el("span", { class: "note-ico", html: icon("wrench", 16) }),
          el("div", {}, [el("b", {}, "Disclosed gap. "), b.caveats.join(" ")])
        ]));
      }
      left.appendChild(el("div", { class: "card-foot", style: "margin-top:14px" }, [
        el("span", { class: "kpi-sub mono" }, item.source || item.slug),
        item.href ? el("a", { class: "go", href: (host.getAttribute("data-root") || "") + item.href }, [document.createTextNode("Open"), el("span", { class: "go-arrow", html: icon("arrow", 14) })]) : null
      ]));

      var right = el("div");
      if (item.qaPass || item.qaFail) {
        var qaHead = el("div", { class: "subhead", style: "margin-top:0" }, "QA split");
        right.appendChild(qaHead);
        var wrap = el("div"); right.appendChild(wrap);
        drawMiniDonut(wrap, item.qaPass, item.qaFail);
      }
      return el("div", { class: "detail-inner" + (right.children.length ? "" : " one-col") }, [left, right.children.length ? right : null]);
    }
    function drawMiniDonut(mount, pass, fail) {
      var total = pass + fail || 1, pct = Math.round((pass / total) * 100);
      mount.appendChild(el("div", { class: "qa-split" }, [
        el("div", { class: "donut", style: "--v:" + pct + ";width:100px;height:100px" }, [
          el("div", { class: "hole", style: "width:70px;height:70px" }, [el("b", { style: "font-size:18px" }, pct + "%"), el("span", {}, "clean")])
        ]),
        el("div", { class: "legend" }, [
          el("div", { class: "item" }, [el("span", { class: "sw ok" }), el("span", { class: "n" }, String(pass)), el("span", { class: "l" }, "clean")]),
          el("div", { class: "item" }, [el("span", { class: "sw flag" }), el("span", { class: "n" }, String(fail)), el("span", { class: "l" }, "flagged")])
        ])
      ]));
    }

    function toggleRow(tr, item) {
      var open = tr.getAttribute("aria-expanded") === "true";
      var existing = tr.nextElementSibling;
      if (existing && existing.classList.contains("corpus-detail")) existing.remove();
      $all(".corpus-row", tbody).forEach(function (r) { r.setAttribute("aria-expanded", "false"); });
      $all(".corpus-detail", tbody).forEach(function (d) { d.remove(); });
      if (open) { state.expanded = null; return; }
      tr.setAttribute("aria-expanded", "true");
      state.expanded = item.id;
      var detailTr = el("tr", { class: "corpus-detail" }, [el("td", { colspan: "6" }, [el("div", { class: "detail-inner" })])]);
      tr.insertAdjacentElement("afterend", detailTr);
      detailTr.querySelector("td").innerHTML = "";
      detailTr.querySelector("td").appendChild(detailFor(item));
    }

    function row(item) {
      var pctCls = item.pct >= 100 ? "f-verified" : "";
      var tr = el("tr", { class: "corpus-row", tabindex: "0", role: "button", "aria-expanded": "false" }, [
        el("td", { "data-col": "Book", class: "c-title-cell" }, [
          el("div", { class: "c-title" }, [el("span", { class: "t" }, item.title), el("span", { class: "s" }, item.subtitle || item.source)])
        ]),
        el("td", { "data-col": "Lang" }, [el("span", { class: "c-flag-lang" }, [el("span", { class: "lang-pin" }, item.langCode), item.langName])]),
        el("td", { "data-col": "Pages", class: "td-num" }, String(item.pages)),
        el("td", { "data-col": "QA" }, [
          el("span", { class: "mini-track" }, [el("span", { class: "mini-fill", style: "width:" + item.pct + "%" })]),
          el("span", { class: "num" }, item.pct + "%")
        ]),
        el("td", { "data-col": "Status" }, [statusBadge(item)]),
        el("td", {}, [el("span", { class: "chev", html: icon("chevron", 16) })])
      ]);
      tr.addEventListener("click", function () { toggleRow(tr, item); });
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(tr, item); } });
      return tr;
    }

    function apply() {
      var q = state.q.trim().toLowerCase();
      var list = all.filter(function (it) {
        if (state.lang !== "all" && it.langCode !== state.lang) return false;
        if (state.status === "flags" && !(it.qaFail > 0)) return false;
        else if (state.status !== "all" && state.status !== "flags" && it.state !== state.status) return false;
        if (q && (it.title + " " + it.source + " " + (it.author || "")).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      list.sort(function (a, b) {
        switch (state.sort) {
          case "pages-desc": return b.pages - a.pages;
          case "pct-desc": return b.pct - a.pct;
          case "pct-asc": return a.pct - b.pct;
          default: return a.title.localeCompare(b.title);
        }
      });
      tbody.innerHTML = "";
      list.forEach(function (it) { tbody.appendChild(row(it)); });
      count.innerHTML = '<b>' + list.length + '</b> of ' + all.length + ' shown';
      tableWrap.classList.toggle("hide", list.length === 0);
      emptyBox.classList.toggle("hide", list.length !== 0);
    }

    var input = searchField.querySelector("input");
    input.addEventListener("input", function () { state.q = input.value; apply(); });
    langSel.addEventListener("change", function () { state.lang = langSel.value; apply(); });
    statusSel.addEventListener("change", function () { state.status = statusSel.value; apply(); });
    sortSel.addEventListener("change", function () { state.sort = sortSel.value; apply(); });

    apply();
  }

  window.LTCorpus = { mount: mount };
})();
