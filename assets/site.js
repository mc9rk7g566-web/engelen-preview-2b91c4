/* Engelen Car Detailing — site.js
   ---------------------------------------------------------------------------
   Vier dingen, verder niets: de zwevende pil, het mobiele paneel, de
   winkelmand en een reveal. Geen bibliotheek.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";
  var minderBeweging = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. de pil volgt de scrollpositie ----------------------------------
     Eén doorlopende waarde 0 -> 1 over de eerste 100 pixels, weggeschreven als
     de custom property --p. Bewust GEEN drempel (`scrollY > 24`): met een
     drempel vliegt de browser er in één frame overheen en zie je de balk
     verspringen in plaats van bewegen. Alles wat aan het materiaal verandert
     hangt in CSS aan --p, dus JS raakt hier verder niets aan. */
  var kop = document.querySelector(".kop");
  if (kop) {
    var wacht = false;
    var schrijf = function () {
      var p = window.scrollY / 100;
      kop.style.setProperty("--p", (p < 0 ? 0 : p > 1 ? 1 : p).toFixed(4));
      wacht = false;
    };
    window.addEventListener("scroll", function () {
      if (!wacht) { wacht = true; requestAnimationFrame(schrijf); }
    }, { passive: true });
    schrijf();
  }

  /* ---- 2. mobiel paneel -------------------------------------------------- */
  var knop = document.querySelector(".pil-hamburger");
  var paneel = document.getElementById("site-menu");
  if (knop && paneel) {
    var zet = function (open) {
      knop.setAttribute("aria-expanded", String(open));
      knop.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
      paneel.classList.toggle("open", open);
    };
    knop.addEventListener("click", function () {
      zet(knop.getAttribute("aria-expanded") !== "true");
    });
    paneel.addEventListener("click", function (e) { if (e.target.closest("a")) zet(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && knop.getAttribute("aria-expanded") === "true") { zet(false); knop.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) zet(false);
    });
  }

  /* ---- 3. winkelmand -----------------------------------------------------
     De DOM is nu al gevormd zoals Shopify hem wil hebben:
     form[action="/cart/add"] met input[name="id"] en button[name="add"].
     Bij de port naar Shopify vervangt POST cart/add.js deze functie en
     blijft de rest van de pagina ongemoeid. Nu nog een demo in het geheugen
     van de tab, want een preview mag geen bestellingen aannemen. */
  var mand = {};
  var drawer = document.getElementById("mand");
  var scherm = document.getElementById("mand-scherm");
  var lijst = document.getElementById("mand-lijst");
  var totaalEl = document.getElementById("mand-totaal");
  var tellerEls = document.querySelectorAll(".mand-teller");

  var euro = function (c) {
    return "€ " + (c / 100).toFixed(2).replace(".", ",");
  };

  function teken() {
    if (!lijst) return;
    var regels = Object.keys(mand), totaal = 0, stuks = 0;
    lijst.innerHTML = "";
    regels.forEach(function (id) {
      var r = mand[id];
      totaal += r.prijs * r.aantal;
      stuks += r.aantal;
      var li = document.createElement("li");
      li.innerHTML =
        '<img src="' + r.beeld + '" alt="" width="64" height="80">' +
        '<div><b>' + r.naam + "</b><br><span class=\"meta\">" + euro(r.prijs) + "</span></div>" +
        '<div class="stepper" data-id="' + id + '">' +
          '<button type="button" data-stap="-1" aria-label="Eén minder">−</button>' +
          "<span>" + r.aantal + "</span>" +
          '<button type="button" data-stap="1" aria-label="Eén meer">+</button>' +
        "</div>";
      lijst.appendChild(li);
    });
    if (!regels.length) {
      lijst.innerHTML = '<li style="display:block;border:0;padding:28px 0;color:var(--inkt-zacht)">Je mand is nog leeg.</li>';
    }
    if (totaalEl) totaalEl.textContent = euro(totaal);
    tellerEls.forEach(function (t) { t.textContent = String(stuks); t.hidden = stuks === 0; });
  }

  function openMand(open) {
    if (!drawer) return;
    drawer.classList.toggle("open", open);
    if (scherm) scherm.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  document.querySelectorAll('form[action="/cart/add"]').forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = f.querySelector('[name="id"]').value;
      if (!mand[id]) {
        mand[id] = {
          naam: f.dataset.naam,
          prijs: parseInt(f.dataset.prijs, 10),
          beeld: f.dataset.beeld,
          aantal: 0
        };
      }
      mand[id].aantal += 1;
      teken();
      openMand(true);
    });
  });

  if (lijst) {
    lijst.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-stap]");
      if (!b) return;
      var id = b.parentNode.dataset.id;
      mand[id].aantal += parseInt(b.dataset.stap, 10);
      if (mand[id].aantal < 1) delete mand[id];
      teken();
    });
  }
  document.querySelectorAll(".mand-knop").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); openMand(true); });
  });
  document.querySelectorAll("[data-mand-sluit]").forEach(function (b) {
    b.addEventListener("click", function () { openMand(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer && drawer.classList.contains("open")) openMand(false);
  });
  teken();

  /* ---- 4. draaitafel -----------------------------------------------------
     Zeven standen van dezelfde fles. Slepen verschuift de index; de afstand
     die één stap kost hangt af van de breedte van het element, zodat de
     draai op een telefoon net zo snel gaat als op een laptop. Pijltoetsen
     doen hetzelfde, want een muisgebaar is geen bediening voor iedereen. */
  var tafel = document.getElementById("draaitafel");
  if (tafel) {
    var beelden = tafel.querySelectorAll("img");
    var streepjes = document.querySelectorAll(".draaitafel-schaal i");
    var stand = 3, sleep = false, startX = 0, startStand = 3;

    var toon = function (i) {
      i = Math.max(0, Math.min(beelden.length - 1, i));
      if (i === stand) return;
      stand = i;
      beelden.forEach(function (b, n) { b.classList.toggle("aan", n === i); });
      streepjes.forEach(function (b, n) { b.classList.toggle("aan", n === i); });
    };

    var beginnen = function (x) {
      sleep = true; startX = x; startStand = stand;
      tafel.classList.add("gebruikt");
    };
    var bewegen = function (x) {
      if (!sleep) return;
      var perStap = tafel.offsetWidth / (beelden.length + 1);
      toon(startStand + Math.round((x - startX) / perStap));
    };

    tafel.addEventListener("pointerdown", function (e) {
      beginnen(e.clientX); tafel.setPointerCapture(e.pointerId);
    });
    tafel.addEventListener("pointermove", function (e) { bewegen(e.clientX); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      tafel.addEventListener(t, function () { sleep = false; });
    });
    tafel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { toon(stand + 1); tafel.classList.add("gebruikt"); e.preventDefault(); }
      if (e.key === "ArrowLeft")  { toon(stand - 1); tafel.classList.add("gebruikt"); e.preventDefault(); }
    });
    tafel.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }

  /* ---- 5. reveal ---------------------------------------------------------
     Faalrichting: zonder JS of zonder IntersectionObserver blijft alles
     gewoon zichtbaar, want de verberging hangt aan .js-aan op <html>. */
  var doelen = document.querySelectorAll(".reveal");
  if (!doelen.length) return;
  if (minderBeweging || !("IntersectionObserver" in window)) {
    doelen.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var kijker = new IntersectionObserver(function (rijen) {
    rijen.forEach(function (r) {
      if (r.isIntersecting) { r.target.classList.add("in"); kijker.unobserve(r.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  doelen.forEach(function (el) { kijker.observe(el); });
})();
