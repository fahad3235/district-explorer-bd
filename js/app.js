// District Explorer BD \u2014 app logic. Pure ASCII. Zero network requests.
(function () {
  "use strict";

  var LS_LANG = "dx-lang", LS_FAVS = "dx-favs";
  var BN_DIGITS = ["\u09e6","\u09e7","\u09e8","\u09e9","\u09ea","\u09eb","\u09ec","\u09ed","\u09ee","\u09e9"];

  var FLAT = []; // {en, bn, old?, divEn, divBn, divOld?, id}
  DIVISIONS.forEach(function (d, di) {
    d.dist.forEach(function (x, xi) {
      FLAT.push({
        id: di + "-" + xi,
        en: x.en, bn: x.bn, old: x.old || null,
        divEn: d.en, divBn: d.bn, divOld: d.old || null
      });
    });
  });

  var state = {
    lang: localStorage.getItem(LS_LANG) || "en",
    query: "",
    filter: "all", // "all" | "fav" | "div:<i>"
    favs: readFavs(),
    modalId: null
  };

  function readFavs() {
    try {
      var raw = localStorage.getItem(LS_FAVS);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw).filter(function (id) {
        return FLAT.some(function (f) { return f.id === id; });
      }));
    } catch (e) { return new Set(); }
  }
  function saveFavs() {
    localStorage.setItem(LS_FAVS, JSON.stringify(Array.from(state.favs)));
  }

  function t(key) { return I18N[state.lang][key]; }
  function num(n) {
    var s = String(n);
    if (state.lang === "bn") s = s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
    return s;
  }
  function dname(d) { return state.lang === "bn" ? d.bn : d.en; }
  function ddiv(d) { return state.lang === "bn" ? d.divBn : d.divEn; }

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function matches(d, q) {
    if (!q) return true;
    q = q.trim().toLowerCase();
    if (!q) return true;
    return d.en.toLowerCase().indexOf(q) !== -1 ||
           d.bn.indexOf(q.trim()) !== -1 ||
           (d.old && d.old.toLowerCase().indexOf(q) !== -1);
  }

  function visible() {
    return FLAT.filter(function (d) {
      if (state.filter === "fav" && !state.favs.has(d.id)) return false;
      if (state.filter.indexOf("div:") === 0) {
        var di = +state.filter.slice(4);
        if (d.id.split("-")[0] !== String(di)) return false;
      }
      return matches(d, state.query);
    });
  }

  function renderStats() {
    el("statDistricts").textContent = num(FLAT.length) + " " + t("districts");
    el("statDivisions").textContent = num(DIVISIONS.length) + " " + t("divisions");
    el("statFavs").textContent = num(state.favs.size) + " " + t("favCount");
  }

  function renderHeader() {
    document.documentElement.lang = state.lang === "bn" ? "bn" : "en";
    el("appTitle").textContent = t("title");
    el("appSubtitle").textContent = t("subtitle");
    el("langBtn").textContent = t("langBtn");
    el("searchInput").placeholder = t("searchPh");
    el("surpriseBtn").textContent = t("surprise");
    el("footerText").textContent = t("footer");
  }

  function renderChips() {
    var chips = el("chips");
    var html = "";
    html += chipHtml("all", t("all") + " (" + num(FLAT.length) + ")", state.filter === "all");
    html += chipHtml("fav", t("favs") + " (" + num(state.favs.size) + ")", state.filter === "fav");
    DIVISIONS.forEach(function (d, i) {
      var name = state.lang === "bn" ? d.bn : d.en;
      html += chipHtml("div:" + i, esc(name) + " (" + num(d.dist.length) + ")", state.filter === "div:" + i);
    });
    chips.innerHTML = html;
  }
  function chipHtml(key, label, active) {
    return '<button class="chip' + (active ? " active" : "") + '" data-filter="' + esc(key) + '">' + label + "</button>";
  }

  function cardHtml(d) {
    var star = state.favs.has(d.id) ? "\u2605" : "\u2606";
    return '<div class="card" data-id="' + esc(d.id) + '">' +
      '<button class="star' + (state.favs.has(d.id) ? " on" : "") + '" data-star="' + esc(d.id) + '" aria-label="favorite">' + star + "</button>" +
      '<div class="card-name">' + esc(dname(d)) + "</div>" +
      '<div class="card-sub">' + esc(state.lang === "bn" ? d.en : d.bn) + "</div>" +
      '<div class="card-div">' + esc(ddiv(d)) + "</div>" +
      "</div>";
  }

  function renderGrid() {
    var list = visible();
    var grid = el("grid");
    if (list.length === 0) {
      grid.innerHTML = '<div class="empty" id="emptyState">' + esc(t("noMatches")) + "</div>";
    } else if (state.filter === "all" && !state.query.trim()) {
      // grouped by division
      var html = "";
      DIVISIONS.forEach(function (d, di) {
        var divList = FLAT.filter(function (f) { return f.id.split("-")[0] === String(di); });
        html += '<div class="divgroup" id="divgroup-' + di + '">' +
          '<div class="divhead">' + esc(state.lang === "bn" ? d.bn : d.en) +
          ' <span class="divcount">' + num(divList.length) + "</span></div>" +
          '<div class="divcards">' + divList.map(cardHtml).join("") + "</div></div>";
      });
      grid.innerHTML = html;
    } else {
      grid.innerHTML = '<div class="flatcards">' + list.map(cardHtml).join("") + "</div>";
    }
    renderClearBox(list.length);
  }

  function renderClearBox() {
    var box = el("clearBox");
    if (state.filter === "fav" && state.favs.size > 0) {
      box.hidden = false;
      el("clearWarn").textContent = t("clearWarn");
      el("clearBtn").textContent = t("clearFavs");
      el("clearInput").value = "";
      el("clearInput").placeholder = "DELETE";
    } else {
      box.hidden = true;
    }
  }

  function openModal(id) {
    var d = FLAT.find(function (f) { return f.id === id; });
    if (!d) return;
    state.modalId = id;
    var fav = state.favs.has(id);
    var mates = FLAT.filter(function (f) { return f.divEn === d.divEn && f.id !== d.id; });
    var html = '<button class="mstar' + (fav ? " on" : "") + '" id="mStar" aria-label="favorite">' +
      (fav ? "\u2605" : "\u2606") + "</button>" +
      '<h2 class="mname">' + esc(dname(d)) + "</h2>" +
      '<div class="msub">' + esc(state.lang === "bn" ? d.en : d.bn) + "</div>" +
      '<div class="mrow"><span class="mlabel">' + esc(t("division")) + ':</span> ' + esc(ddiv(d)) +
      (d.divOld ? ' <span class="mold">(' + esc(t("oldName")) + ": " + esc(d.divOld) + ")</span>" : "") + "</div>" +
      (d.old ? '<div class="mrow"><span class="mlabel">' + esc(t("oldName")) + ':</span> ' + esc(d.old) + "</div>" : "") +
      '<div class="mrow"><span class="mlabel">' + esc(t("alsoInDivision")) + " (" + num(mates.length) + "):</span></div>" +
      '<div class="mmates">' + mates.map(function (m) {
        return '<button class="mate" data-id="' + esc(m.id) + '">' + esc(dname(m)) + "</button>";
      }).join("") + "</div>" +
      '<div class="mactions">' +
      '<button class="btn" id="mFavBtn">' + esc(fav ? t("removeFav") : t("addFav")) + "</button>" +
      '<button class="btn ghost" id="mClose">' + esc(t("close")) + "</button></div>";
    el("modalBody").innerHTML = html;
    el("modalWrap").hidden = false;
    el("mClose").addEventListener("click", closeModal);
    el("mFavBtn").addEventListener("click", function () { toggleFav(id); });
    el("mStar").addEventListener("click", function () { toggleFav(id); });
    el("modalBody").querySelectorAll(".mate").forEach(function (b) {
      b.addEventListener("click", function () { openModal(b.getAttribute("data-id")); });
    });
  }

  function closeModal() {
    el("modalWrap").hidden = true;
    state.modalId = null;
  }

  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id);
    else state.favs.add(id);
    saveFavs();
    renderStats(); renderChips(); renderGrid();
    if (state.modalId === id) openModal(id); // refresh modal buttons
  }

  function surprise() {
    var d = FLAT[Math.floor(Math.random() * FLAT.length)];
    state.filter = "all"; state.query = ""; el("searchInput").value = "";
    renderChips(); renderGrid();
    openModal(d.id);
  }

  function bind() {
    el("searchInput").addEventListener("input", function (e) {
      state.query = e.target.value;
      renderGrid();
    });
    el("chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (b) { state.filter = b.getAttribute("data-filter"); renderChips(); renderGrid(); }
    });
    el("grid").addEventListener("click", function (e) {
      var s = e.target.closest("[data-star]");
      if (s) { toggleFav(s.getAttribute("data-star")); return; }
      var c = e.target.closest("[data-id]");
      if (c) openModal(c.getAttribute("data-id"));
    });
    el("langBtn").addEventListener("click", function () {
      state.lang = state.lang === "en" ? "bn" : "en";
      localStorage.setItem(LS_LANG, state.lang);
      renderAll();
    });
    el("surpriseBtn").addEventListener("click", surprise);
    el("clearBtn").addEventListener("click", function () {
      if (el("clearInput").value === "DELETE") {
        state.favs.clear(); saveFavs();
        state.filter = "fav";
        renderStats(); renderChips(); renderGrid();
        el("clearedMsg").textContent = t("cleared");
      }
    });
    el("modalWrap").addEventListener("click", function (e) {
      if (e.target === el("modalWrap")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el("modalWrap").hidden) closeModal();
    });
  }

  function renderAll() {
    renderHeader(); renderStats(); renderChips(); renderGrid();
  }

  bind();
  renderAll();
})();
