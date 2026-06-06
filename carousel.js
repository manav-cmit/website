/* ============================================================
   DORSAN — auto-scroll carousels from numbered images
   ------------------------------------------------------------
   Drop images named 1.jpg, 2.jpg, 3.jpg ... into each product folder:
       images/syringe-filters/1.jpg, 2.jpg, ...
       images/filter-papers/1.jpg, ...
   The code probes 1..N, shows every image that exists, and auto-scrolls.
   No server folder-listing needed; missing numbers simply stop the probe.

   Powers BOTH:
   - per-product mini-carousels on the homepage cards (class="dz-carousel")
   - the big enquiry-form carousel (cycles all products)
   ============================================================ */
(function () {
  "use strict";

  // Product folders + nice labels. Add/rename here if your products change.
  var PRODUCTS = [
    { slug: "syringe-filters",      title: "Syringe Filters",        label: "Sample Preparation" },
    { slug: "filter-papers",        title: "Filter Papers",          label: "Laboratory" },
    { slug: "extraction-cartridges",title: "Extraction Cartridges",  label: "Soxhlet" },
    { slug: "cartridge-housings",   title: "Cartridge Housings",     label: "Industrial" },
    { slug: "membrane-filters",     title: "Membrane Disc Filters",  label: "Chromatography" },
    { slug: "capsule-filters",      title: "Capsule Filters",        label: "Process" }
  ];

  var MAX_PROBE = 12;            // tries 1.jpg .. 12.jpg per folder
  var EXTS = ["jpg", "jpeg", "png", "webp"];
  var SLIDE_MS = 3000;           // time each image is shown

  // base path so it works from root pages and /blog/ pages
  var BASE = (location.pathname.indexOf("/blog/") !== -1) ? "../images/" : "images/";

  // Try to load images/<slug>/<n>.<ext> for n=1..MAX until one fails.
  function discover(slug, done) {
    var found = [];
    var n = 1;
    function tryNum() {
      if (n > MAX_PROBE) return done(found);
      tryExt(0);
      function tryExt(ei) {
        if (ei >= EXTS.length) return done(found); // this number missing in all exts -> stop
        var src = BASE + slug + "/" + n + "." + EXTS[ei];
        var img = new Image();
        img.onload = function () { found.push(src); n++; tryNum(); };
        img.onerror = function () { tryExt(ei + 1); };
        img.src = src;
      }
    }
    tryNum();
  }

  // Build an auto-scrolling carousel inside `mount` from a list of image srcs.
  function buildCarousel(mount, slides, opts) {
    opts = opts || {};
    mount.innerHTML = "";
    if (!slides.length) {
      mount.classList.add("dzc-empty");
      mount.setAttribute("data-empty", opts.emptyText || "image coming soon");
      return;
    }
    mount.classList.remove("dzc-empty");
    var track = document.createElement("div");
    track.className = "dzc-track";
    slides.forEach(function (s) {
      var sl = document.createElement("div");
      sl.className = "dzc-slide";
      var im = document.createElement("img");
      im.src = s.src; im.alt = s.alt || ""; im.loading = "lazy";
      sl.appendChild(im);
      if (s.caption) {
        var cap = document.createElement("div");
        cap.className = "dzc-cap";
        cap.innerHTML = (s.label ? "<span>" + s.label + "</span>" : "") + "<h3>" + s.caption + "</h3>";
        sl.appendChild(cap);
      }
      track.appendChild(sl);
    });
    mount.appendChild(track);

    if (slides.length === 1) return; // nothing to scroll

    // JS-driven slide (reliable for any count), pause on hover
    var i = 0, timer = null, paused = false;
    function go() {
      i = (i + 1) % slides.length;
      track.style.transform = "translateX(" + (-i * 100) + "%)";
    }
    function start() { timer = setInterval(function () { if (!paused) go(); }, opts.interval || SLIDE_MS); }
    mount.addEventListener("mouseenter", function () { paused = true; });
    mount.addEventListener("mouseleave", function () { paused = false; });

    // dots
    if (opts.dots) {
      var dots = document.createElement("div");
      dots.className = "dzc-dots";
      slides.forEach(function () { dots.appendChild(document.createElement("i")); });
      mount.appendChild(dots);
      var orig = go;
      go = function () { orig(); [].forEach.call(dots.children, function (d, k) { d.classList.toggle("on", k === i); }); };
      dots.children[0].classList.add("on");
    }
    start();
  }

  // ---- 1) Homepage product cards: <div class="dz-carousel" data-product="syringe-filters"></div>
  function initCardCarousels() {
    var mounts = document.querySelectorAll(".dz-carousel[data-product]");
    [].forEach.call(mounts, function (mount) {
      var slug = mount.getAttribute("data-product");
      var prod = PRODUCTS.filter(function (p) { return p.slug === slug; })[0];
      discover(slug, function (srcs) {
        var slides = srcs.map(function (src) { return { src: src, alt: (prod ? prod.title : slug) }; });
        buildCarousel(mount, slides, { interval: 2800 });
      });
    });
  }

  // ---- 2) Enquiry form carousel: <div class="dz-carousel-all" id="enqAll"></div>
  function initFormCarousel() {
    var mount = document.getElementById("enqAll");
    if (!mount) return;
    var all = [];
    var pending = PRODUCTS.length;
    PRODUCTS.forEach(function (p, idx) {
      discover(p.slug, function (srcs) {
        srcs.forEach(function (src, k) {
          all.push({ order: idx * 100 + k, src: src, alt: p.title, caption: p.title, label: p.label });
        });
        if (--pending === 0) {
          all.sort(function (a, b) { return a.order - b.order; });
          buildCarousel(mount, all, { interval: 3500, dots: true, emptyText: "Product images coming soon" });
        }
      });
    });
  }

  function init() { initCardCarousels(); initFormCarousel(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();