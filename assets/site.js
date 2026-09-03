/* Engelen Car Detailing — site.js (v2)
   ---------------------------------------------------------------------------
   Geen bibliotheek. Eén veer-klok drijft alles wat beweegt; CSS leidt uit het
   getal dat de veer schrijft de translate, schaal, blur en schaduw af.

   De veer volgt de Apple-regels (skill apple-design): demping en respons in
   plaats van massa/stijfheid, kritisch gedempt tenzij er momentum aan
   voorafging, altijd startend vanaf de HUIDIGE waarde op het scherm, en op
   elk moment te onderbreken door een nieuw doel te geven.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";
  var minder = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var kanHover = window.matchMedia("(hover: hover)").matches;
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 0. de veer ---------------------------------------------------------
     Massa 1. Respons r (s) en demping z (1 = kritisch) worden stijfheid en
     wrijving: k = (2π/r)², c = 4πz/r. Semi-impliciete Euler in stapjes van
     ten hoogste 1/120 s, anders wordt een trage frame instabiel. */
  var actief = [], loopt = false, vorige = 0;
  function klok(nu) {
    var dt = Math.min((nu - vorige) / 1000, 0.064) || 0;
    vorige = nu;
    for (var i = actief.length - 1; i >= 0; i--) {
      if (!actief[i]._stap(dt)) actief.splice(i, 1);
    }
    if (actief.length) requestAnimationFrame(klok); else loopt = false;
  }
  function wek(v) {
    if (actief.indexOf(v) < 0) actief.push(v);
    if (!loopt) { loopt = true; vorige = performance.now(); requestAnimationFrame(klok); }
  }
  function Veer(waarde, schrijf, o) {
    o = o || {};
    this.x = waarde; this.v = 0; this.doel = waarde; this.rust = true;
    this.schrijf = schrijf;
    this.demping = this.rustdemping = o.demping == null ? 1 : o.demping;
    this.respons = this.rustrespons = o.respons || 0.35;
    this.eps = o.eps || 0.001;
    this.klaar = o.klaar || null;
    schrijf(waarde);
  }
  /* Nieuw doel, vanaf waar hij nú is en met de snelheid die hij nú heeft —
     tenzij een gebaar een eigen snelheid meegeeft. */
  Veer.prototype.naar = function (doel, o) {
    o = o || {};
    this.doel = doel;
    if (o.snelheid != null) this.v = o.snelheid;
    // Demping en respons horen bij DEZE beweging, niet bij de veer: anders erft
    // een pijltoets de 0.8 van de vorige flick en schiet hij door zonder momentum.
    this.demping = o.demping != null ? o.demping : this.rustdemping;
    this.respons = o.respons != null ? o.respons : this.rustrespons;
    // Minder beweging: geen sprong maar het eindpunt ineens; de crossfade komt
    // uit CSS. Op een volgend frame, zodat de browser de beginwaarde nog ziet.
    if (minder) { var v = this; requestAnimationFrame(function () { v.zet(doel); }); return this; }
    this.rust = false; wek(this); return this;
  };
  Veer.prototype.zet = function (x) {
    this.x = this.doel = x; this.v = 0; this.rust = true;
    this.schrijf(x); if (this.klaar) this.klaar(x); return this;
  };
  Veer.prototype.grijp = function () { this.doel = this.x; this.v = 0; this.rust = true; return this; };
  Veer.prototype._stap = function (dt) {
    if (this.rust) return false;
    var k = Math.pow(2 * Math.PI / this.respons, 2), c = 4 * Math.PI * this.demping / this.respons;
    while (dt > 0) {
      var h = Math.min(dt, 1 / 120);
      this.v += (-k * (this.x - this.doel) - c * this.v) * h;
      this.x += this.v * h;
      dt -= h;
    }
    if (Math.abs(this.v) < this.eps * 10 && Math.abs(this.x - this.doel) < this.eps) {
      this.x = this.doel; this.v = 0; this.rust = true;
      this.schrijf(this.x); if (this.klaar) this.klaar(this.x);
      return false;
    }
    this.schrijf(this.x);
    return true;
  };
  var prop = function (el, naam) {
    return function (x) { el.style.setProperty(naam, x.toFixed(4)); };
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var euro = function (c) { return "€ " + (c / 100).toFixed(2).replace(".", ","); };
  /* Verbergen mag pas ná de uitgaande beweging. Onder "minder beweging" springt
     de veer meteen op 0, maar dan loopt in CSS nog een crossfade van .15s —
     visibility direct wegzetten maakt daar een harde knip van. */
  var verberg = function (el) {
    if (minder) setTimeout(function () { el.classList.remove("zichtbaar"); }, 170);
    else el.classList.remove("zichtbaar");
  };

  /* ---- 1. de pil volgt de scrollpositie ----------------------------------
     Eén doorlopende waarde 0 -> 1 over de eerste 100 pixels, als --p. Bewust
     GEEN drempel en geen veer: de scrollpositie IS de animatie. Gemeten en
     goedgekeurd, niet vervangen. */
  var kop = document.querySelector(".kop");
  if (kop) {
    var wacht = false;
    var schrijfP = function () {
      var p = window.scrollY / 100;
      kop.style.setProperty("--p", (p < 0 ? 0 : p > 1 ? 1 : p).toFixed(4));
      wacht = false;
    };
    window.addEventListener("scroll", function () {
      if (!wacht) { wacht = true; requestAnimationFrame(schrijfP); }
    }, { passive: true });
    schrijfP();
  }

  /* ---- 2. widgets stijgen op hover ---------------------------------------
     --lift 0..1: vlak licht op, schaduw diept, widget stijgt 3px. Eén veer
     per widget; verlaten mid-vlucht keert gewoon om vanaf de huidige stand. */
  if (kanHover) {
    qsa(".til").forEach(function (el) {
      var v = new Veer(0, prop(el, "--lift"), { respons: 0.3 });
      el.addEventListener("pointerenter", function () { v.naar(1); });
      el.addEventListener("pointerleave", function () { v.naar(0); });
    });
  }

  /* ---- 3. mobiel paneel --------------------------------------------------
     Materialiseert uit de hamburger (transform-origin in CSS): blur, schaal
     en dekking hangen alle drie aan --open. Kritisch gedempt. */
  var knop = document.querySelector(".pil-hamburger");
  var paneel = document.getElementById("site-menu");
  if (knop && paneel) {
    var paneelVeer = new Veer(0, prop(paneel, "--open"), {
      respons: 0.38,
      klaar: function (x) { if (x === 0) verberg(paneel); }
    });
    var zet = function (open) {
      knop.setAttribute("aria-expanded", String(open));
      knop.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
      if (open) paneel.classList.add("zichtbaar");
      paneelVeer.naar(open ? 1 : 0);
    };
    knop.addEventListener("click", function () {
      zet(knop.getAttribute("aria-expanded") !== "true");
    });
    paneel.addEventListener("click", function (e) { if (e.target.closest("a")) zet(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && knop.getAttribute("aria-expanded") === "true") { zet(false); knop.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900 && knop.getAttribute("aria-expanded") === "true") zet(false);
    });
  }

  /* ---- 4. winkelmand -----------------------------------------------------
     De DOM is nu al gevormd zoals Shopify hem wil hebben:
     form[action="/cart/add"] met input[name="id"] en button[name="add"].
     Bij de port vervangt POST cart/add.js deze functie. Nu nog een demo in
     het geheugen van de tab, want een preview mag geen bestellingen aannemen. */
  var mand = {};
  var drawer = document.getElementById("mand");
  var scherm = document.getElementById("mand-scherm");
  var lijst = document.getElementById("mand-lijst");
  var upsellEl = document.getElementById("mand-upsell");
  var totaalEl = document.getElementById("mand-totaal");
  var tellerEls = qsa(".mand-teller");
  var bundelData = document.getElementById("bundel-data");
  var bd = bundelData ? JSON.parse(bundelData.textContent) : { bundels: [], producten: {} };

  var mandVeer = drawer ? new Veer(0, function (x) {
    drawer.style.setProperty("--open", x.toFixed(4));
    if (scherm) scherm.style.setProperty("--open", x.toFixed(4));
  }, {
    respons: 0.4,
    klaar: function (x) {
      if (x === 0) { verberg(drawer); if (scherm) verberg(scherm); }
    }
  }) : null;

  function openMand(open) {
    if (!mandVeer) return;
    if (open) { drawer.classList.add("zichtbaar"); if (scherm) scherm.classList.add("zichtbaar"); }
    mandVeer.naar(open ? 1 : 0);
    document.body.style.overflow = open ? "hidden" : "";
  }

  /* De bundel voorstellen die de losse producten in de mand bevat — met wat
     erin zit en wat het los kost, allebei uit inhoud.py. Geen korting die
     niet bestaat. */
  function bundelVoorstel() {
    if (!upsellEl) return;
    var beste = null;
    bd.bundels.forEach(function (b) {
      if (mand[b.id]) return;
      var erin = b.bevat.filter(function (id) { return mand[id]; });
      if (erin.length < Math.min(2, b.bevat.length)) return;
      if (!beste || erin.length > beste.erin.length ||
          (erin.length === beste.erin.length && b.cent < beste.b.cent)) beste = { b: b, erin: erin };
    });
    if (!beste) { upsellEl.hidden = true; upsellEl.innerHTML = ""; return; }
    var b = beste.b;
    var los = b.bevat.reduce(function (s, id) { return s + bd.producten[id].cent; }, 0);
    var namen = b.bevat.map(function (id) { return bd.producten[id].naam; });
    if (b.extra) namen.push(b.extra);
    var lijstTekst = namen.length > 1
      ? namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1] : namen[0];
    var verschil = los - b.cent;
    var vergelijk = "Los " + (b.extra ? "kost de fles " : "kosten ze ") + euro(los) + "; " +
      (verschil > 0 ? "de bundel is " + euro(verschil) + " minder."
                    : "de bundel is " + euro(-verschil) + " meer.");
    upsellEl.innerHTML =
      '<p class="label">Ook als bundel</p>' +
      "<b>" + esc(b.naam) + " &mdash; " + euro(b.cent) + "</b>" +
      '<p class="meta">Bevat ' + esc(lijstTekst) + ". " + vergelijk + "</p>" +
      '<button class="optie" type="button" data-bundel="' + esc(b.id) + '">Wissel om voor de bundel</button>';
    upsellEl.hidden = false;
  }

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
        '<img src="' + esc(r.beeld) + '" alt="" width="56" height="70">' +
        "<div><b>" + esc(r.naam) + '</b><span class="meta">' + euro(r.prijs) + "</span></div>" +
        '<div class="stepper" data-id="' + esc(id) + '">' +
          '<button type="button" data-stap="-1" aria-label="Eén minder">−</button>' +
          "<span>" + r.aantal + "</span>" +
          '<button type="button" data-stap="1" aria-label="Eén meer">+</button>' +
        "</div>";
      lijst.appendChild(li);
    });
    if (!regels.length) {
      lijst.innerHTML = '<li class="leeg">Je mand is nog leeg.</li>';
    }
    if (totaalEl) totaalEl.textContent = euro(totaal);
    tellerEls.forEach(function (t) { t.textContent = String(stuks); t.hidden = stuks === 0; });
    bundelVoorstel();
  }

  function leg(id, naam, prijs, beeld, aantal) {
    if (!mand[id]) mand[id] = { naam: naam, prijs: prijs, beeld: beeld, aantal: 0 };
    mand[id].aantal += aantal || 1;
  }

  /* De mand springt alleen de EERSTE keer open. Daarna onderbreekt hij het
     winkelen: je wilt drie flessen achter elkaar kunnen toevoegen zonder hem
     steeds weg te klikken. Vanaf dan bevestigt de knop zelf even, en tikt de
     teller in de balk. */
  var mandGetoond = false;
  qsa('form[action="/cart/add"]').forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var qEl = f.querySelector('[name="quantity"]');
      var q = qEl ? Math.max(1, Math.min(99, parseInt(qEl.value, 10) || 1)) : 1;
      leg(f.querySelector('[name="id"]').value, f.dataset.naam,
          parseInt(f.dataset.prijs, 10), f.dataset.beeld, q);
      if (qEl) qEl.value = "1";
      teken();
      if (!mandGetoond) { mandGetoond = true; openMand(true); return; }
      var knop = f.querySelector('button[name="add"]');
      if (!knop || knop.dataset.bezig) return;
      // innerHTML, niet textContent: de mandknop draagt een icoon dat terug moet.
      var was = knop.innerHTML;
      knop.dataset.bezig = "1";
      knop.innerHTML = '<svg class="ico" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4L16 6"/></svg><span>Toegevoegd</span>';
      setTimeout(function () { knop.innerHTML = was; delete knop.dataset.bezig; }, 1400);
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
  if (upsellEl) {
    upsellEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-bundel]");
      if (!b) return;
      var bundel = bd.bundels.filter(function (x) { return x.id === b.dataset.bundel; })[0];
      if (!bundel) return;
      // één van elk los product eruit, de bundel erin
      bundel.bevat.forEach(function (id) {
        if (!mand[id]) return;
        mand[id].aantal -= 1;
        if (mand[id].aantal < 1) delete mand[id];
      });
      leg(bundel.id, bundel.naam, bundel.cent, "assets/beeld/product-" + bundel.foto + "-500.webp");
      teken();
    });
  }
  qsa(".mand-knop").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); openMand(true); });
  });
  qsa("[data-mand-sluit]").forEach(function (b) {
    b.addEventListener("click", function () { openMand(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer && drawer.classList.contains("zichtbaar")) openMand(false);
  });
  teken();

  /* ---- 5. draaitafel -----------------------------------------------------
     Zeven standen. Tijdens het slepen volgt de stand 1-op-1 de vinger (met
     rubberband voorbij de uiteinden). Bij loslaten: momentum projecteren
     zoals iOS dat doet, naar het dichtstbijzijnde frame veren met de
     losvelocity als beginsnelheid. Alleen dán mag hij doorschieten. */
  var tafel = document.getElementById("draaitafel");
  if (tafel) {
    var beelden = qsa("img", tafel);
    var loper = document.querySelector(".draaitafel-schaal b");
    var N = beelden.length, huidig = -1;
    var sleep = false, startX = 0, startStand = 0, spoor = [];

    var teken2 = function (x) {
      var i = Math.max(0, Math.min(N - 1, Math.round(x)));
      if (i !== huidig) {
        huidig = i;
        beelden.forEach(function (b, n) { b.classList.toggle("aan", n === i); });
      }
      if (loper) loper.style.setProperty("--stand", Math.max(0, Math.min(N - 1, x)).toFixed(3));
    };
    var stand = new Veer(3, teken2, { respons: 0.35, eps: 0.002 });
    var perStap = function () { return tafel.offsetWidth / (N + 1); };
    // Voorbij de rand volgt hij steeds minder — echte dingen remmen af
    // voordat ze stoppen. d = de hele schaal, c = 0,55.
    var band = function (over) { var d = N - 1, c = 0.55; return (over * d * c) / (d + c * over); };
    var project = function (v) { return (v / 1000) * 0.998 / (1 - 0.998); };

    tafel.addEventListener("pointerdown", function (e) {
      stand.grijp();                       // grijp hem waar hij nu is
      sleep = true; startX = e.clientX; startStand = stand.x;
      spoor = [[performance.now(), e.clientX]];
      tafel.classList.add("gebruikt");
      tafel.setPointerCapture(e.pointerId);
    });
    tafel.addEventListener("pointermove", function (e) {
      if (!sleep) return;
      var ruw = startStand + (e.clientX - startX) / perStap();
      if (ruw < 0) ruw = -band(-ruw);
      else if (ruw > N - 1) ruw = (N - 1) + band(ruw - (N - 1));
      stand.x = stand.doel = ruw; teken2(ruw);
      var t = performance.now();
      spoor.push([t, e.clientX]);
      while (spoor.length > 2 && t - spoor[0][0] > 100) spoor.shift();
    });
    var los = function () {
      if (!sleep) return;
      sleep = false;
      // Een vinger die stilhield vóór het loslaten heeft geen momentum. Alleen
      // samples uit de laatste 100 ms tellen; is het jongste sample ouder dan
      // dat, dan is de snelheid nul en veert hij gewoon naar het dichtstbij.
      var vpx = 0, nu = performance.now();
      var vers = spoor.filter(function (s) { return nu - s[0] <= 100; });
      if (vers.length > 1) {
        var a = vers[0], b = vers[vers.length - 1], dt = (b[0] - a[0]) / 1000;
        if (dt > 0) vpx = (b[1] - a[1]) / dt;
      }
      var vf = vpx / perStap();            // frames per seconde
      var doel = Math.round(stand.x + project(vpx) / perStap());
      doel = Math.max(0, Math.min(N - 1, doel));
      // doorschieten alleen na een beweging die zelf momentum had
      stand.naar(doel, { snelheid: vf, demping: Math.abs(vf) > 1.5 ? 0.8 : 1 });
    };
    ["pointerup", "pointercancel"].forEach(function (t) { tafel.addEventListener(t, los); });
    tafel.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      tafel.classList.add("gebruikt");
      stand.naar(Math.max(0, Math.min(N - 1, Math.round(stand.doel) + d)));
    });
    tafel.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }

  /* ---- 6. behandelingskiezer --------------------------------------------
     Drie antwoorden -> één sleutel -> één pakket uit de tabel die bouw.py
     uit inhoud.py heeft gerekend. Hier staat geen enkele prijs. */
  var kiezerData = document.getElementById("kiezer-data");
  var uitkomst = document.getElementById("kiezer-uitkomst");
  if (kiezerData && uitkomst) {
    var kd = JSON.parse(kiezerData.textContent);
    var antwoord = {}, upsellGekozen = false;
    var uitVeer = new Veer(1, prop(uitkomst, "--in"), { respons: 0.4 });

    var waLink = function (k, waar) {
      var tekst = kd.whatsapp
        .replace("{pakket}", k.dienstnaam + " " + k.pakket)
        .replace("{prijs}", k.prijs_toon)
        .replace("{waar}", waar === "locatie" ? ", op locatie" : "");
      return kd.wa + "&text=" + encodeURIComponent(tekst);
    };
    var toonUitkomst = function () {
      var klaar = ["wat", "grondig", "waar"].every(function (k) { return antwoord[k]; });
      if (!klaar) {
        uitkomst.innerHTML = '<p class="label">Aanbevolen</p>' +
          '<p class="meta" style="margin-top:10px">Beantwoord de drie vragen; het pakket verschijnt hier.</p>';
        return;
      }
      var basis = kd.tabel[antwoord.wat + "|" + antwoord.grondig + "|" + antwoord.waar];
      if (!basis) return;
      var k = upsellGekozen && basis.upsell ? basis.upsell : basis;
      var u = basis.upsell;
      var html =
        '<p class="label">Aanbevolen</p>' +
        '<h3 class="kop-3">' + esc(k.dienstnaam) + " &middot; " + esc(k.pakket) + "</h3>" +
        '<p class="uitkomst-prijs">' +
          (k.prijs.charAt(0) >= "0" && k.prijs.charAt(0) <= "9"
            ? '<span class="label">Vanaf</span> <b class="cijfer">' + esc(k.prijs_toon) + "</b>"
            : "<b>" + esc(k.prijs_toon) + "</b>") +
        "</p>" +
        (basis.noot ? '<p class="meta uitkomst-noot">' + esc(basis.noot) + "</p>" : "") +
        '<a class="uitkomst-link" href="diensten.html#' + esc(k.dienst) + '">Bekijk wat erin zit</a>';
      if (u) {
        html += '<div class="upsell">' +
          '<p class="label">' + (upsellGekozen ? "Gekozen in plaats van " + esc(basis.pakket) : "Ook mogelijk") + "</p>" +
          "<b>" + esc(u.dienstnaam) + " &middot; " + esc(u.pakket) + " &mdash; " + esc(u.verschil) + " meer</b>" +
          '<p class="meta">' + esc(u.tekst) + "</p>" +
          '<button class="optie" type="button" data-upsell aria-pressed="' + upsellGekozen + '">' +
            (upsellGekozen ? "Terug naar " + esc(basis.pakket) : "Kies deze") + "</button></div>";
      }
      html += '<a class="knop" href="' + esc(waLink(k, antwoord.waar)) + '" rel="noopener">Afspraak via WhatsApp</a>';
      uitkomst.innerHTML = html;
      // Nieuwe inhoud materialiseert opnieuw, maar vanaf de HUIDIGE stand: is
      // de vorige nog onderweg, dan pikt hij die op in plaats van weg te
      // knipperen. Alleen een uitkomst die al stilstond begint opnieuw.
      if (uitVeer.rust) uitVeer.zet(0.4);
      uitVeer.naar(1);
    };

    qsa(".optie[data-vraag]").forEach(function (b) {
      b.addEventListener("click", function () {
        qsa('.optie[data-vraag="' + b.dataset.vraag + '"]').forEach(function (x) {
          x.setAttribute("aria-pressed", String(x === b));
        });
        antwoord[b.dataset.vraag] = b.dataset.waarde;
        upsellGekozen = false;
        toonUitkomst();
      });
    });
    uitkomst.addEventListener("click", function (e) {
      if (!e.target.closest("[data-upsell]")) return;
      upsellGekozen = !upsellGekozen;
      toonUitkomst();
    });
    toonUitkomst();
  }

  /* ---- 7. vragen: het antwoord komt binnen, niet aan ---------------------- */
  qsa(".vraag").forEach(function (d) {
    var p = d.querySelector("p"), v = null;
    if (!p) return;
    d.addEventListener("toggle", function () {
      if (!d.open) return;
      if (!v) v = new Veer(0, prop(p, "--in2"), { respons: 0.4 });
      v.zet(0); v.naar(1);
    });
  });

  /* ---- 7b. productpagina: aantal en galerij ------------------------------
     De stepper in het koopformulier schrijft in input[name=quantity]; de mand
     leest dat veld bij het toevoegen. De galerij wisselt alleen het hoofdbeeld
     (src, geen srcset) en de soort (sfeer of wit), zodat CSS de grond en de
     pasvorm afleidt. Zonder JS blijft het eerste beeld gewoon staan. */
  qsa(".koop-rij .stepper").forEach(function (st) {
    var inp = st.querySelector("input");
    st.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-stap]");
      if (!b || !inp) return;
      var n = (parseInt(inp.value, 10) || 1) + parseInt(b.dataset.stap, 10);
      inp.value = String(Math.max(1, Math.min(99, n)));
    });
  });
  qsa(".galerij").forEach(function (g) {
    var hoofd = g.querySelector(".galerij-hoofd"), img = hoofd && hoofd.querySelector("img");
    if (!img) return;
    qsa(".galerij-thumb", g).forEach(function (t) {
      t.addEventListener("click", function () {
        qsa(".galerij-thumb", g).forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
        img.removeAttribute("srcset"); img.removeAttribute("sizes");
        img.src = t.dataset.src;
        hoofd.dataset.soort = t.dataset.soort;
      });
    });
  });

  /* ---- 7c. werkfilters en voor/na ----------------------------------------
     Filter: knoppen met data-filter; een kaart die tevoorschijn komt krijgt
     --in meteen op 1, anders blijft hij op de 0 staan die de reveal hem gaf
     voordat hij ooit in beeld was. Voor/na: een native range-input ligt over
     de foto (toetsenbord, vinger en muis gratis); zijn waarde wordt --x. */
  var kaarten = qsa(".werk-kaart");
  qsa("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      qsa("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var f = b.dataset.filter;
      kaarten.forEach(function (k) {
        var toon = !f || k.dataset.soort === f;
        k.hidden = !toon;
        if (toon) k.style.setProperty("--in", "1");
      });
    });
  });
  qsa(".voorna").forEach(function (v) {
    var r = v.querySelector('input[type="range"]');
    if (!r) return;
    var zet = function () { v.style.setProperty("--x", r.value + "%"); };
    r.addEventListener("input", zet);
    zet();
  });

  /* ---- 8. reveal ---------------------------------------------------------
     Faalrichting: zonder JS of zonder IntersectionObserver blijft alles
     zichtbaar, want CSS valt terug op --in: 1. Kort en één richting: 18px
     omhoog met opacity, kritisch gedempt. In een rij komen de kinderen
     45ms na elkaar. */
  var doelen = qsa(".reveal").concat(qsa(".reveal-rij > *"));
  if (!doelen.length || !("IntersectionObserver" in window)) return;
  if (minder) { doelen.forEach(function (el) { el.style.setProperty("--in", "1"); }); return; }
  doelen.forEach(function (el) { el.style.setProperty("--in", "0"); });
  var kijker = new IntersectionObserver(function (rijen) {
    rijen.forEach(function (r) {
      if (!r.isIntersecting) return;
      var el = r.target;
      kijker.unobserve(el);
      // Wie snel scrolt is al voorbij het element voordat de veer klaar is; dan
      // hoort er niets meer te onthullen. Staat het bij het vuren al met zijn
      // bovenkant boven de vouw, dan is het gewoon meteen zichtbaar.
      if (r.boundingClientRect.top < window.innerHeight * 0.45) {
        el.style.setProperty("--in", "1");
        return;
      }
      var n = 0;
      if (el.parentElement && el.parentElement.classList.contains("reveal-rij")) {
        n = Array.prototype.indexOf.call(el.parentElement.children, el);
      }
      setTimeout(function () {
        new Veer(0, prop(el, "--in"), { respons: 0.34 }).naar(1);
      }, Math.min(n, 5) * 35);
    });
  }, {
    // Onderkant 420px UITGEBREID, niet ingekrompen: een element begint te
    // onthullen terwijl het nog onder de vouw zit, zodat het bij normaal
    // scrolltempo al klaar is als je het ziet. Met de oude marge (-8%, dus pas
    // als het al in beeld stond) zag je bij snel scrollen hele secties nog op
    // opacity 0,1 -- dat is wat Job als "het glitcht even helemaal" meldde.
    rootMargin: "0px 0px 420px 0px", threshold: 0
  });
  doelen.forEach(function (el) { kijker.observe(el); });
})();
