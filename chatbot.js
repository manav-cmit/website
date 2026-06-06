/* ============================================================
   DORSAN FILTRATION — chatbot widget (reads knowledge.json, NO server)
   ------------------------------------------------------------
   Works on plain static hosting. No Ollama, no API key, no cost.
   Add ONE line before </body>:
       <script src="chatbot.js"></script>      (root pages)
       <script src="../chatbot.js"></script>   (pages inside /blog/)

   It loads knowledge.json (place it in the SITE ROOT) and answers by
   smart matching: synonyms, partial words and typo tolerance.

   NOTE: like any no-AI bot this matches keywords/intent, not free
   understanding. It covers the JSON well; unknowns go to your contact.
   Serve over http/https (a host or `python -m http.server`), not file://.
   ============================================================ */
(function () {
  "use strict";

  var JSON_PATHS = ["/knowledge.json", "knowledge.json", "../knowledge.json"];
  var KB = null;          // parsed knowledge.json
  var INDEX = [];         // built list of {keywords:[], answer:""}
  var CONTACT_LINE = "For help, email info@dorsanfiltration.com or use the Request a Quote button.";

  var SUGGESTIONS = ["Which membrane for LC-MS?", "G Series vs T Series?", "Syringe filter sizes?", "Request a quote"];

  /* ---------- light typo tolerance: normalise a word ---------- */
  function norm(w) {
    return w.toLowerCase()
      .replace(/[^a-z0-9µ]/g, "")
      .replace(/(.)\1+/g, "$1");   // collapse repeats: "filltter" -> "filter"
  }
  // map common misspellings/synonyms -> canonical token
  var SYN = {
    mebran: "membrane", membran: "membrane", membrane: "membrane", membranes: "membrane",
    siringe: "syringe", syringe: "syringe", syring: "syringe",
    cartrige: "cartridge", catridge: "cartridge", cartridge: "cartridge",
    filteration: "filtration", filtraton: "filtration",
    micron: "pore", microns: "pore", um: "pore", "µm": "pore", poresize: "pore", pore: "pore",
    lcms: "lc-ms", uhplc: "uhplc", hplc: "hplc",
    prize: "price", cost: "price", rate: "price", buy: "price",
    quotation: "quote", enquiry: "quote", inquiry: "quote",
    contct: "contact", number: "contact", phone: "contact", mobile: "contact", whatsapp: "contact",
    addres: "address", location: "address", office: "address",
    diameter: "size", dia: "size", sizes: "size",
    paper: "paper", papers: "paper",
    thimble: "thimble", thimbles: "thimble", soxhlet: "thimble",
    chromatography: "chromatography", column: "chromatography",
    air: "air", pollution: "air", pm25: "air", pm10: "air", tsp: "air",
    sample: "sample", samples: "sample", free: "sample"
  };
  function tokens(text) {
    var t = text.toLowerCase().replace(/pm\s*2\.?5/g, " pm25 ").replace(/pm\s*10/g, " pm10 ");
    var raw = t.replace(/[^a-z0-9µ\s-]/g, " ").split(/\s+/).filter(Boolean);
    var out = [];
    raw.forEach(function (w) {
      var n = norm(w);
      out.push(SYN[n] || n);
      // keep hyphenated originals too (lc-ms)
      if (w.indexOf("-") !== -1) out.push(w);
    });
    return out;
  }

  /* ---------- build a searchable index from the JSON ---------- */
  function buildIndex(kb) {
    var idx = [];
    function add(keywords, answer) { idx.push({ k: keywords.map(norm).map(function (x) { return SYN[x] || x; }), a: answer }); }

    // greeting / company
    add(["hello", "hi", "hey", "namaste"], "Hello! Welcome to " + kb.company.name + " - \"" + kb.company.motto + "\". I can help with syringe filters, membranes, cartridges, filter papers, thimbles, air-monitoring filters, chromatography, specs, samples and quotes. What do you need?");
    add(["about", "company", "who", "dorsan", "history", "since"], kb.company.description + " Operating since " + kb.company.since + ", serving " + kb.company.countries_served + "+ countries, with production in " + kb.company.manufacturing_locations.join(", ") + ".");
    add(["where", "factory", "plant", "production", "manufacture", "made"], kb.company.name + " has production facilities in " + kb.company.manufacturing_locations.join(", ") + ", serving " + kb.company.countries_served + "+ countries.");

    // contact
    var india = kb.contact.offices.find(function (o) { return /India/i.test(o.country); });
    if (india) {
      CONTACT_LINE = "Contact " + india.country + ": " + india.company + ", " + india.address + ". Phone " + india.phone + ", email " + india.email + ".";
      add(["contact", "address", "india", "ahmedabad", "gujarat", "changodar"], CONTACT_LINE);
    }
    add(["spain", "headquarters", "barcelona"], (function () { var s = kb.contact.offices.find(function (o) { return /Spain/i.test(o.country); }); return s ? "Dorsan Spain (HQ): " + s.address + ". Phone " + s.phone + ", " + s.email : CONTACT_LINE; })());
    add(["offices", "countries", "international", "global"], "Dorsan has offices in: " + kb.contact.offices.map(function (o) { return o.country.replace(/\s*\(.*\)/, ""); }).join(", ") + ". Website " + kb.contact.website + ".");
    add(["quote", "price", "buy", "order", "purchase", "distributor", "dealer"], kb.contact.quote_note);
    add(["sample", "trial", "test"], "Samples are available where possible. Share your membrane, pore size, format and volume via Request a Quote or email " + (india ? india.email : kb.contact.general_email) + ".");

    // membranes (each material)
    kb.membrane_materials.forEach(function (m) {
      add([m.code, m.name], m.name + " (" + m.code + "): " + m.use);
    });
    add(["membrane", "material", "materials", "which membrane"], "Dorsan membranes: " + kb.membrane_materials.map(function (m) { return m.name + " (" + m.code + ")"; }).join(", ") + ". Tell me your solvent or sample and I'll suggest one.");
    add(["compatibility", "compatible", "solvent", "acid", "chemical"], "Membrane guide - Nylon: general HPLC, broad solvents. Hydrophilic PVDF: LC-MS, low extractables. PTFE: aggressive/non-aqueous solvents. PES/CN: aqueous buffers, low adsorption. Tell me your exact solvent for a precise pick.");

    // products (each)
    kb.products.forEach(function (p) {
      var parts = [p.name + " (" + p.category + "): " + p.description];
      if (p.available_membranes) parts.push("Membranes: " + p.available_membranes.join(", ") + ".");
      if (p.diameters) parts.push("Diameters: " + p.diameters.join(", ") + ".");
      if (p.pore_sizes) parts.push("Pore sizes: " + p.pore_sizes.join(", ") + ".");
      if (p.note) parts.push(p.note);
      var kws = p.name.split(/\s+/).concat(p.category.split(/\s+/));
      add(kws, parts.join(" "));
    });
    // helpful product-group shortcuts
    add(["syringe", "syringe filter"], "Dorsan syringe filters: G Series (outer ring, high pressure) and T Series (PP prefilter, dirty/viscous samples). Membranes CA, MCE, Nylon, PES, PP, PTFE, PVDF. Diameters 4/13/25/30 mm (35 mm soon). Pore sizes 0.22 and 0.45 µm. Medical-grade PP housing.");
    add(["g series", "outer ring", "high pressure"], "G Series syringe filters have a reinforcing outer ring for high pressure or dense liquids - high filtration speed, low protein binding, uniform porosity.");
    add(["t series", "prefilter", "viscous", "dirty"], "T Series syringe filters add a polypropylene prefilter to extend filtration volume - ideal for dirty or viscous samples.");
    add(["cartridge", "cartridges"], "Dorsan industrial cartridges: String Wound, Meltblown, Pleated PP, PES, PTFE, PVDF, Glass Microfiber, Activated Carbon, PET, Stainless Steel, High Flow/Maxpleat/Delta Flow, and DUTC capsules. Tell me your fluid, micron rating and flow rate.");
    add(["paper", "filter paper"], "Filter papers: Qualitative, Quantitative (ash-free), Folded (2-50 µm), Microglass Fiber and Cytocentrifuge. Smooth or creped; disks or sheets.");
    add(["thimble", "extraction", "soxhlet"], "Extraction thimbles: cellulose (low-med temp), glass microfiber (to 500C), quartz microfiber (to 1000C). First digit = inner diameter, second = outer length (mm).");
    add(["press", "filter press", "plate"], "Filter presses: Fortiplates, Bebinox, Pilot 200M, Labinox, Farminox and Mininox - stainless steel, for food & beverage and chem-pharma.");

    // pore size / diameter
    add(["pore", "size", "0.22", "0.45", "0.1"], "Pore sizes: 0.45 µm for general clarification/routine HPLC; 0.22 µm sterilising-grade (removes bacteria) for UHPLC/LC-MS; 0.1 µm for the most demanding samples. Syringe diameters: 4, 13, 25, 30 mm (35 mm soon). Membrane discs: 25, 47, 90, 142, 293 mm.");

    // chromatography
    var rec = kb.chromatography.recommended_membranes;
    add(["chromatography", "hplc", "uhplc", "lc-ms", "lcms"], "For chromatography, filtration protects your column. Recommended membranes - " + Object.keys(rec).map(function (k) { return k + ": " + rec[k]; }).join("; ") + ". Use a syringe filter for samples and a membrane disc for mobile phase.");

    // air
    add(["air", "pollution", "monitoring", "pm", "tsp", "particulate", "emission"], "Air-monitoring products: " + kb.air_monitoring.products.join(", ") + ". Applications: " + kb.air_monitoring.applications.join(", ") + ". Standards: " + kb.air_monitoring.standards.join(", ") + ".");

    // quality / reuse
    add(["quality", "standards", "certification", "fda", "iso", "gmp"], "Quality standards: " + kb.quality.standards.join("; ") + ".");
    add(["reuse", "reusable", "single"], "Syringe filters and most cartridges are single-use to avoid carry-over. Only Stainless Steel cartridges are cleanable and reusable.");

    // FAQs from JSON
    kb.faq.forEach(function (f) {
      add(f.question.replace(/[?]/g, "").split(/\s+/), f.answer);
    });

    return idx;
  }

  /* ---------- matcher: score by shared tokens ---------- */
  function answer(text) {
    if (!INDEX.length) return CONTACT_LINE;
    var qt = tokens(text);
    if (!qt.length) return "Please type a question.";
    var best = null, bestScore = 0;
    for (var i = 0; i < INDEX.length; i++) {
      var entry = INDEX[i], score = 0;
      for (var j = 0; j < entry.k.length; j++) {
        var kw = entry.k[j];
        for (var q = 0; q < qt.length; q++) {
          if (qt[q] === kw) { score += 2; break; }                  // exact token
          if (kw.length > 4 && (qt[q].indexOf(kw) !== -1 || kw.indexOf(qt[q]) !== -1)) { score += 1; break; } // partial
        }
      }
      // normalise so long keyword lists don't unfairly win
      var s = score / Math.sqrt(entry.k.length);
      if (s > bestScore) { bestScore = s; best = entry; }
    }
    if (bestScore < 1) {
      return "I'm not fully sure about that. " + CONTACT_LINE + " You can also ask about membranes, pore size, syringe filters, cartridges, filter papers, thimbles, air monitoring or chromatography.";
    }
    return best.a;
  }

  function loadKB(done) {
    var i = 0;
    (function next() {
      if (i >= JSON_PATHS.length) { console.warn("[Dorsan bot] knowledge.json not found (serve over http, not file://)."); done(null); return; }
      fetch(JSON_PATHS[i], { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { console.log("[Dorsan bot] knowledge.json loaded."); done(j); })
        .catch(function () { i++; next(); });
    })();
  }

  /* ---------- UI ---------- */
  var css = ''
    + '#dz-btn{position:fixed;bottom:22px;right:22px;z-index:9999;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:#0c8f93;box-shadow:0 12px 30px -10px rgba(12,28,36,.55);display:grid;place-items:center;transition:transform .25s}'
    + '#dz-btn:hover{transform:scale(1.06)}#dz-btn svg{width:28px;height:28px}'
    + '#dz-panel{position:fixed;bottom:94px;right:22px;z-index:9999;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 130px);background:#f6f7f4;border:1px solid #d8ddd6;border-radius:18px;box-shadow:0 24px 60px -24px rgba(12,28,36,.5);display:none;flex-direction:column;overflow:hidden;font-family:Manrope,system-ui,sans-serif}'
    + '#dz-panel.open{display:flex}'
    + '#dz-head{background:#0c1c24;color:#f6f7f4;padding:16px 18px;display:flex;align-items:center;gap:10px}'
    + '#dz-head b{font-size:1rem}#dz-head small{color:#9fb0b5;display:block;font-size:.74rem;font-weight:500}'
    + '#dz-head .dz-dot{width:9px;height:9px;border-radius:50%;background:#18c3c9;margin-left:auto}'
    + '#dz-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}'
    + '.dz-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:.92rem;line-height:1.5;white-space:pre-wrap}'
    + '.dz-bot{background:#fff;border:1px solid #d8ddd6;align-self:flex-start;border-bottom-left-radius:4px;color:#1b2a31}'
    + '.dz-user{background:#0c8f93;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}'
    + '.dz-bot a{color:#0a6f72;font-weight:700}'
    + '#dz-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px}'
    + '.dz-chip{font-size:.78rem;font-weight:600;color:#0a6f72;background:#eef1ec;border:1px solid #d8ddd6;border-radius:999px;padding:6px 11px;cursor:pointer;transition:background .2s}'
    + '.dz-chip:hover{background:#fff}'
    + '#dz-input{display:flex;gap:8px;padding:12px;border-top:1px solid #d8ddd6;background:#fff}'
    + '#dz-input input{flex:1;border:1px solid #d8ddd6;border-radius:999px;padding:11px 15px;font-size:.92rem;outline:none;font-family:inherit}'
    + '#dz-input input:focus{border-color:#0c8f93}'
    + '#dz-input button{border:none;background:#0c1c24;color:#fff;border-radius:50%;width:42px;height:42px;cursor:pointer;display:grid;place-items:center;flex:none}'
    + '#dz-input button:hover{background:#0c8f93}';

  function linkify(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>')
      .replace(/(\+?\d[\d\s-]{7,}\d)/g, function (m) { return '<a href="tel:' + m.replace(/\s/g, "") + '">' + m + '</a>'; });
  }

  function init() {
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    var btn = document.createElement('button'); btn.id = 'dz-btn'; btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.7-.85L3 21l1.85-5.8A8.5 8.5 0 1 1 21 11.5z"/></svg>';
    var panel = document.createElement('div'); panel.id = 'dz-panel';
    panel.innerHTML =
        '<div id="dz-head"><svg width="22" height="22" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="21" stroke="#18c3c9" stroke-width="3"/><path d="M14 18h20M16 24h16M19 30h10" stroke="#18c3c9" stroke-width="3" stroke-linecap="round"/></svg>'
      + '<div><b>Dorsan Assistant</b><small>Filtration help</small></div><span class="dz-dot"></span></div>'
      + '<div id="dz-log"></div><div id="dz-chips"></div>'
      + '<div id="dz-input"><input type="text" placeholder="Ask about filters, membranes..." aria-label="Message"/>'
      + '<button aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>';
    document.body.appendChild(btn); document.body.appendChild(panel);

    var log = panel.querySelector('#dz-log'), input = panel.querySelector('input'),
        sendBtn = panel.querySelector('#dz-input button'), chips = panel.querySelector('#dz-chips');

    function add(text, who) {
      var m = document.createElement('div'); m.className = 'dz-msg ' + (who === 'user' ? 'dz-user' : 'dz-bot');
      m.innerHTML = who === 'bot' ? linkify(text) : text.replace(/</g, "&lt;");
      log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    function send(text) {
      text = (text || input.value).trim(); if (!text) return;
      add(text, 'user'); input.value = '';
      setTimeout(function () { add(answer(text), 'bot'); }, 250);
    }
    SUGGESTIONS.forEach(function (s) { var c = document.createElement('span'); c.className = 'dz-chip'; c.textContent = s; c.onclick = function () { send(s); }; chips.appendChild(c); });
    sendBtn.onclick = function () { send(); };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

    var greeted = false;
    btn.onclick = function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open') && !greeted) {
        greeted = true;
        add("Hello! I'm the Dorsan Filtration assistant. Ask me about our syringe filters, membranes, cartridges, filter papers, thimbles, air monitoring or chromatography.", 'bot');
        input.focus();
      }
    };

    loadKB(function (kb) { if (kb) { KB = kb; INDEX = buildIndex(kb); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();