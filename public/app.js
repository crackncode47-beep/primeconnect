import { plans, quote } from "/pricing.mjs";
const app = document.querySelector("#app");
const provinces = {
  BC: "British Columbia",
  AB: "Alberta",
  MB: "Manitoba",
  SK: "Saskatchewan",
  ON: "Ontario",
};
let state = {
  address: null,
  speed: null,
  tv: "none",
  phone: false,
  autopay: true,
};
try {
  state = {
    ...state,
    ...JSON.parse(sessionStorage.getItem("prime-plan") || "{}"),
  };
} catch {}
const save = () => sessionStorage.setItem("prime-plan", JSON.stringify(state));
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const speedLabel = (n) => (n >= 1000 ? `${n / 1000} Gig` : `${n} Mbps`);
const go = (path) => {
  history.pushState({}, "", path);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
};
const benefits =
  '<div class="benefits"><span>✓ Free installation</span><span>✓ No hidden fees</span><span>✓ $0 to sign up</span></div>';
const icons = {
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="20" r=".5"/>',
  heart: '<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z"/>',
  home: '<path d="m3 10 9-8 9 8M5 9v12h14V9M9 21v-8h6v8"/>',
  tag: '<path d="M3 3h9l10 10-9 9L3 12V3Z"/><circle cx="8" cy="8" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  tv: '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8M12 18v4"/>',
  phone:
    '<path d="m5 3 4 1 1 5-3 2c2 3 3 4 6 6l2-3 5 1 1 4c-3 6-10 0-13-3S-1 6 5 3Z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.bolt}</svg>`;
let stopHome = () => {};
let stopMotion = () => {};
async function enrichHome() {
  stopMotion();
  // ── SECTION DEFAULTS ──
  const DEFAULTS = {
    'hero-board':        [{position:'large-left',image_path:'/assets/speed.jpg',alt_text:'WebSaver x Rogers',destination_url:'#address',open_in_new_tab:0},{position:'top-right',image_path:'/assets/canada-leader.jpg',alt_text:'Rogers',destination_url:'#address',open_in_new_tab:0},{position:'bottom-right',image_path:'/assets/switch-rogers.jpg',alt_text:'Switch to Rogers',destination_url:'#address',open_in_new_tab:0}],
    'slideshow':         [{image_path:'/assets/speed.jpg',alt_text:'WebSaver × Rogers. Built for speed.'},{image_path:'/assets/switch-rogers.jpg',alt_text:'Stop thinking, switch to Rogers.'},{image_path:'/assets/canada-leader.jpg',alt_text:"Rogers — Canada's leading telecom brand."},{image_path:'/assets/building-canada.jpg',alt_text:"Rogers — we're always building Canada."}],
    'service-cards':     [{image_path:'/assets/internet.png',alt_text:'Rogers internet service illustration'},{image_path:'/assets/tv.jpg',alt_text:'Rogers TV package illustration'},{image_path:'/assets/building-canada.jpg',alt_text:'Rogers — always building Canada'}],
    'savings-collage':   [{image_path:'/assets/savings.jpg',alt_text:'WebSaver helped Canadians save a lot'},{image_path:'/assets/back-to-school.jpg',alt_text:'Rogers authorized dealer back-to-school offer'}],
    'dealer-portrait':   [{image_path:'/assets/canada-space.jpg',alt_text:'Rogers astronaut dog with a Canadian flag'}],
    'switch-story':      [{image_path:'/assets/switch-save.jpg',alt_text:'WebSaver and Rogers — switch for faster and cheaper internet'}],
    'community-gallery': [{image_path:'/assets/savings.jpg',alt_text:'WebSaver helped Canadians save a lot.'},{image_path:'/assets/canada-space.jpg',alt_text:'Rogers astronaut dog in front of a Canadian flag.'},{image_path:'/assets/back-to-school.jpg',alt_text:'Rogers authorized dealer back-to-school offer.'},{image_path:'/assets/two-moods.jpg',alt_text:'Two moods — a happy connection with Rogers.'},{image_path:'/assets/switch-save.jpg',alt_text:'Switch to Rogers with WebSaver.'}],
  };
  function sectionImgs(allData, key) {
    const rows = (allData[key]||[]).filter(i=>i.is_active);
    return rows.length ? rows : DEFAULTS[key];
  }

  document.querySelector(".campaign-section").innerHTML =
    `<div class="campaign-editorial"><div class="campaign-intro"><span class="eyebrow">WebSaver × ROGERS</span><span class="handwritten">A little faster. A lot happier.</span></div><div class="campaign-frame"><div class="campaign-slides"></div><div class="campaign-controls"><div class="campaign-label"><span class="live-dot"></span> WebSaver × ROGERS</div><div class="slide-dots" role="group" aria-label="Choose campaign"></div><div class="slide-buttons"><button id="slide-pause" aria-label="Pause slideshow">Ⅱ</button><button id="slide-prev" aria-label="Previous campaign">←</button><button id="slide-next" aria-label="Next campaign">→</button></div></div></div></div>`;



  const SECTIONS = ['hero-board','slideshow','service-cards','savings-collage','dealer-portrait','switch-story','community-gallery'];
  const allData = {};
  await Promise.all(SECTIONS.map(s =>
    fetch('/api/featured-images?section='+s).then(r=>r.json()).then(d=>{ allData[s]=d.images||[]; }).catch(()=>{ allData[s]=[]; })
  ));



  // ── HERO BOARD ──
  const heroImgs = sectionImgs(allData, 'hero-board');
  const byPos = {}; heroImgs.forEach(i=>{ byPos[i.position]=i; });
  const large=byPos['large-left']||DEFAULTS['hero-board'][0];
  const top=byPos['top-right']||DEFAULTS['hero-board'][1];
  const bottom=byPos['bottom-right']||DEFAULTS['hero-board'][2];
  const wrapLink=(img,inner)=>img.destination_url?'<a href="'+img.destination_url+'"'+(img.open_in_new_tab?' target="_blank" rel="noopener noreferrer"':'')+'>'+inner+'</a>':inner;

  // Structural fix: place #featured-board as a sibling AFTER .campaign-section
  (function() {
    var cs = document.querySelector('.campaign-section');
    var fs = document.getElementById('featured-board-section');
    if (!fs) { fs = document.createElement('section'); fs.id = 'featured-board-section'; cs.after(fs); }
    fs.innerHTML = '<div id="featured-board"><div class="featured-skeleton"><div class="skel skel-large"></div><div class="featured-side-skel"><div class="skel skel-small"></div><div class="skel skel-small"></div></div></div></div>';
  })();

  const board = document.querySelector('#featured-board');
  if (board) board.innerHTML =
    '<div class="featured-gallery">'+
      '<div class="featured-gallery__left">'+
        '<div class="featured-gallery__main-media">'+wrapLink(large,'<img src="'+large.image_path+'" alt="'+large.alt_text+'" fetchpriority="high">')+'</div>'+
        '<span class="campaign-link">Find your connection <b>&#x2197;</b></span>'+
      '</div>'+
      '<div class="featured-gallery__right">'+
        '<div class="featured-gallery__side-media">'+wrapLink(top,'<img src="'+top.image_path+'" alt="'+top.alt_text+'" loading="lazy">')+'</div>'+
        '<div class="featured-gallery__side-media">'+wrapLink(bottom,'<img src="'+bottom.image_path+'" alt="'+bottom.alt_text+'" loading="lazy">')+'</div>'+
      '</div>'+
    '</div>';

  // ── SLIDESHOW ──
  const slideImgs = sectionImgs(allData, 'slideshow');
  const slidesEl = document.querySelector('.campaign-slides');
  if (slidesEl) slidesEl.innerHTML = slideImgs.map((img,i)=>
    `<div class="campaign-slide ${i===0?'is-current':''}" ${i===0?'':'hidden'}><img src="${img.image_path}" alt="${img.alt_text}" ${i===0?'fetchpriority="high"':'loading="lazy"'}></div>`
  ).join('');
  const dotGroup = document.querySelector('.slide-dots');
  if (dotGroup) dotGroup.innerHTML = slideImgs.map((_,i)=>`<button class="slide-dot ${i===0?'active':''}" data-slide="${i}" aria-label="Show campaign ${i+1}" aria-pressed="${i===0}"></button>`).join('');
  // ── COMMUNITY GALLERY ──
  const cgImgs = sectionImgs(allData, 'community-gallery');
  const galleryEl = document.querySelector('.campaign-gallery');
  if (galleryEl) {
    galleryEl.innerHTML = cgImgs.map(img =>
      `<a class="gallery-card" href="#address"><img src="${img.image_path}" alt="${img.alt_text}" loading="lazy"><span>Find your home's offer <b>↗</b></span></a>`
    ).join('');
    galleryEl.classList.add('campaign-mosaic');
    galleryEl.removeAttribute('tabindex');
  }
  document.querySelector('.gallery-arrows')?.remove();

  document
    .querySelector(".community-heading")
    .insertAdjacentHTML(
      "beforeend",
      '<span class="handwritten gallery-note">Good deals.<br>Great company.</span>',
    );
  const hero = document.querySelector(".home-hero");
  hero.querySelector(".dealer-pill").outerHTML =
    '<div class="hero-dealer-logo"><img src="/assets/rogers-dealer.png" alt="Rogers Authorized Dealer" width="245" height="50"></div>';
  hero
    .querySelector(".hero-intro")
    .insertAdjacentHTML(
      "afterend",
      '<h1 class="payment-promise handwritten">No Payment Today.<br> Use First. Pay After 30 Days.</h1> <br>',
    );
  hero.querySelector("h1").innerHTML =
    'Better Internet. Better Price.<br>Rogers Home Internet. <span class="handwritten hero-hand">For you.</span>';
  hero.querySelector(".hero-intro").innerHTML =
    "Get more from your home internet with WebSaver, your authorized Rogers dealer. Explore our best offers, build your bundle, and let our team handle the next steps.";
  document.querySelector("#search-status").innerHTML =
    icon("tag") + " Check your address for our best Rogers offers";
  document.querySelector(".connection-copy .eyebrow").textContent =
    "ROGERS PLANS. WebSaver SERVICE.";
  document.querySelector(".connection-copy>p").textContent =
    "Get the Rogers network you know, with an authorized dealer dedicated to finding the right offer for your home. We’ll help you compare speeds, make sense of your bundle, and get connected.";
  document.querySelector(".connection-copy .button").innerHTML =
    "Get my best Rogers offer <span>→</span>";
  document.querySelector(".services-section .center-title p").textContent =
    "Your authorized dealer for Rogers internet, TV, and home phone. Let us put the right bundle together for you.";
  document.querySelector(".why-section .center-title h2").innerHTML =
    "The network you trust.<br><em>The dealer on your side.</em>";
  document.querySelector(".why-section .center-title p").innerHTML =
    "WebSaver is your authorized Rogers dealer.<br>Come to us for our best prices and personal help from start to finish.";
  document.querySelector(".community-heading .eyebrow").textContent =
    "MORE REASONS TO MAKE THE SWITCH";
  document.querySelector(".community-heading h2").innerHTML =
    "Big Rogers energy.<br><em>WebSaver value.</em>";
  document.querySelector(".community-heading p").textContent =
    "Your next great offer starts with your authorized dealer.";
  document
    .querySelectorAll(".gallery-card>span")
    .forEach((el) => (el.innerHTML = "Get my best Rogers offer <b>↗</b>"));
  document.querySelector(".closing h2").innerHTML =
    "Great Rogers plans.<br><span>Even better with us.</span>";
  document.querySelector(".closing p").textContent =
    "Your authorized dealer. Our best offers. Let’s get you connected.";
  document.querySelector(".closing .button").innerHTML =
    "Find my best offer <span>↗</span>";
  document.querySelector(".proof-strip").insertAdjacentHTML(
    "afterend",
    `
    <section class="deal-story section-wrap" aria-labelledby="deal-story-title">
      <div class="deal-story-copy"><div class="eyebrow">YOUR SAVINGS START WITH US</div>
        <h2 id="deal-story-title">Same Rogers network.<br><em>A smarter way to sign up.</em></h2>
        <p>Why figure it all out yourself? WebSaver helps you find our best available Rogers offer for your province — and a plan that fits the way you live.</p>
        <div class="deal-points"><span>${icon("tag")} Our best prices, upfront</span><span>${icon("shield")} Authorized Rogers Dealer</span><span>${icon("heart")} Personal help with your switch</span></div>
        <a class="button" href="#address">Show me the savings <span>↗</span></a>
        <img class="story-dealer" src="/assets/rogers-dealer.png" alt="Rogers Authorized Dealer" loading="lazy">
      </div>
      <div class="savings-collage"><figure class="savings-main"><img src="${(()=>{const _s=sectionImgs(allData,'savings-collage');return _s[0]?.image_path||'/assets/savings.jpg';})()}" alt="${(()=>{const _s=sectionImgs(allData,'savings-collage');return _s[0]?.alt_text||'WebSaver savings';})()}" loading="lazy"></figure><a class="school-inset" href="#address"><img src="${(()=>{const _s=sectionImgs(allData,'savings-collage');return _s[1]?.image_path||'/assets/back-to-school.jpg';})()}" alt="${(()=>{const _s=sectionImgs(allData,'savings-collage');return _s[1]?.alt_text||'Back to school offer';})()}" loading="lazy"></a><span class="collage-caption">A better connection. A better deal. ${icon("bolt")}</span></div>
    </section>`,
  );
  const cards = document.querySelectorAll(".service-card");
  const scImgs = sectionImgs(allData, 'service-cards');
  cards.forEach((card, i) => {
    const img = scImgs[i] || DEFAULTS['service-cards'][i];
    card.insertAdjacentHTML("afterbegin", `<div class="service-photo service-photo-${i}"><img src="${img.image_path}" alt="${img.alt_text}" loading="lazy"></div>`);
  });
  const grid = document.querySelector(".why-grid");
  const body = document.createElement("div");
  body.className = "dealer-showcase";
  grid.before(body);
  const dpImg = sectionImgs(allData,'dealer-portrait')[0]||DEFAULTS['dealer-portrait'][0];
  body.innerHTML = `<figure class="dealer-portrait"><img src="${dpImg.image_path}" alt="${dpImg.alt_text}" loading="lazy"><figcaption><span>PROUD TO CONNECT CANADIAN HOMES</span><strong>Your next connection.<br>Handled by WebSaver.</strong></figcaption></figure>`;
  body.append(grid);
  const swImg = sectionImgs(allData,'switch-story')[0]||DEFAULTS['switch-story'][0];
  document
    .querySelector(".how-section")
    .insertAdjacentHTML(
      "beforebegin",
      `<section class="switch-story section-wrap"><div class="switch-poster"><img src="${swImg.image_path}" alt="${swImg.alt_text}" loading="lazy"></div><div class="switch-story-copy"><div class="eyebrow">YOUR BILL COULD USE A BETTER PLAN</div><h2>Love your internet.<br><em>Feel better about the price.</em></h2><p>Tell us where you live. We’ll show you our Rogers offers, make your monthly costs clear, and help you choose with confidence.</p><a class="button" href="#address">Find my Rogers offer <span>→</span></a><div class="switch-note">${icon("check")} Free installation &nbsp; ${icon("check")} $0 to sign up</div></div></section>`,
    );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches || !("IntersectionObserver" in window)) return;
  const targets = [
    ...document.querySelectorAll(
      ".campaign-feature,.campaign-side,.gallery-card,.deal-story-copy,.savings-collage,.connection-copy,.connection-image,.center-title,.service-card,.dealer-portrait,.why-grid article,.community-heading,.switch-poster,.switch-story-copy,.steps-grid article,.faq>div,.closing h2,.closing p,.closing .button",
    ),
  ];
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.08, rootMargin: "0px 0px -35px 0px" },
  );
  targets.forEach((el) => {
    el.classList.add("scroll-reveal");
    observer.observe(el);
  });
  const focusReveal = (e) =>
    e.target.closest(".scroll-reveal")?.classList.add("is-revealed");
  app.addEventListener("focusin", focusReveal);
  const floaters = [
    document.querySelector(".school-inset"),
    document.querySelector(".collage-caption"),
    document.querySelector(".glass-speed"),
  ];
  const animations = floaters.map((el) =>
    el.animate(
      [{ transform: "translateY(12px)" }, { transform: "translateY(-12px)" }],
      { duration: 1000, fill: "both" },
    ),
  );
  animations.forEach((a) => a.pause());
  let frame = 0;
  const update = () => {
    frame = 0;
    floaters.forEach((el, i) => {
      const rect = el.parentElement.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, (innerHeight - rect.top) / (innerHeight + rect.height)),
      );
      animations[i].currentTime = progress * 1000;
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  schedule();
  stopMotion = () => {
    observer.disconnect();
    targets.forEach((el) => el.classList.remove("scroll-reveal"));
    app.removeEventListener("focusin", focusReveal);
    removeEventListener("scroll", schedule);
    removeEventListener("resize", schedule);
    cancelAnimationFrame(frame);
    animations.forEach((a) => a.cancel());
    reduced.removeEventListener("change", onPreference);
  };
  const onPreference = () => {
    if (reduced.matches) stopMotion();
  };
  reduced.addEventListener("change", onPreference);
}
function bindFaq() {
  const faq = document.querySelector(".faq");
  if (!faq) return;
  requestAnimationFrame(() => faq.classList.add("faq-loaded"));
  faq.querySelectorAll("details").forEach((item) => {
    const summary = item.querySelector("summary");
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      if (item.open) {
        item.classList.add("is-closing");
        window.setTimeout(() => {
          item.open = false;
          item.classList.remove("is-closing");
        }, 280);
        return;
      }
      faq.querySelectorAll("details[open]").forEach((openItem) => {
        openItem.classList.add("is-closing");
        window.setTimeout(() => {
          openItem.open = false;
          openItem.classList.remove("is-closing");
        }, 280);
      });
      item.open = true;
    });
  });
}
async function home() {
  app.innerHTML = `
  <section class="home-hero" id="address"><div class="hero-glow glow-left"></div><div class="hero-glow glow-right"></div><div class="dealer-pill">${icon("shield")} Authorized Rogers Dealer <span class="pill-dot"></span></div><h1>Built for speed.<br><em>Powered to connect.</em></h1><p class="hero-intro">Life moves fast. Your internet should too.<br>Get a better plan, a better price, and people who put you first.</p>
<div class="hero-address"><label class="sr-only" for="address-input">Your home address</label><div class="address-bar">${icon("pin")}<input id="address-input" autocomplete="off" placeholder="Enter your home address to see plans…" aria-expanded="false" aria-controls="suggestions"><button id="address-search" type="button" aria-label="Search address">${icon("search")}<span>Search</span></button></div><div id="suggestions" class="suggestions"></div><p class="search-status" id="search-status" role="status">${icon("bolt")} Find the Rogers offers available in your province</p><button class="text-button" id="manual-toggle" aria-expanded="false">Enter address manually →</button><form id="manual-form" hidden><h3>Let’s find your home.</h3><div class="fields"><label class="wide">Street address<input name="line1" required autocomplete="address-line1" maxlength="200" placeholder="123 Main Street, unit 4"></label><label>City<input name="city" required autocomplete="address-level2" maxlength="100"></label><label>Province<select name="province" required aria-label="Province"><option value="">Select province</option>${Object.entries(
    provinces,
  )
    .map(([c, n]) => `<option value="${c}">${n}</option>`)
    .join(
      "",
    )}<option value="OTHER">Another province</option></select></label><label class="wide">Postal code<input name="postalCode" required autocomplete="postal-code" pattern="[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]" placeholder="V6B 1A1"></label></div><button class="button full" type="submit">Show my offers <span>→</span></button></form></div>
<div class="hero-promises"><span>${icon("tag")} Our lowest prices</span><span>${icon("shield")} No hidden fees</span><span>${icon("home")} Free installation</span></div></section>
<section class="campaign-section" aria-label="WebSaver and Rogers campaigns"><div class="campaign-frame"><div class="campaign-slides">${[
    [
      "speed.jpg",
      "WebSaver × Rogers. Built for speed. Powered to connect.",
    ],
    [
      "switch-rogers.jpg",
      "Stop thinking, switch to Rogers. High-speed internet.",
    ],
    ["canada-leader.jpg", "Rogers — Canada’s leading telecom brand."],
    ["building-canada.jpg", "Rogers — we’re always building Canada."],
  ]
    .map(
      ([src, alt], i) =>
        `<div class="campaign-slide ${i === 0 ? "is-current" : ""}" ${i === 0 ? "" : "hidden"}><img src="/assets/${src}" alt="${alt}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`,
    )
    .join(
      "",
    )}</div><div class="campaign-controls"><div class="campaign-label"><span class="live-dot"></span> WebSaver × ROGERS</div><div class="slide-dots" role="group" aria-label="Choose campaign">${[0, 1, 2, 3].map((i) => `<button class="slide-dot ${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="Show campaign ${i + 1}" aria-pressed="${i === 0}"></button>`).join("")}</div><div class="slide-buttons"><button id="slide-pause" aria-label="Pause slideshow">Ⅱ</button><button id="slide-prev" aria-label="Previous campaign">←</button><button id="slide-next" aria-label="Next campaign">→</button></div></div></div></section>
<section class="proof-strip"><div><strong>2 <span>Gbps</span></strong><span>Speed for your whole world</span></div><div><strong>$0</strong><span>To sign up. Zero stress.</span></div><div><strong>5 <span>provinces</span></strong><span>More homes. Better connected.</span></div><div class="proof-dealer"><img src="/assets/rogers-dealer.png" alt="Rogers Authorized Dealer"></div></section>
<section class="connection-section section-wrap" id="plans"><div class="connection-copy"><div class="eyebrow">THE UPGRADE YOUR HOME DESERVES</div><h2>Unlimited possibilities.<br><em>One powerful connection.</em></h2><p>From one more episode to one more win. Get a plan that keeps up with everything you love — with WebSaver by your side.</p><div class="connection-features">${[
    [
      "bolt",
      "Speed that keeps up",
      "Up to 2 Gbps for your streams, games, and workdays.",
    ],
    [
      "wifi",
      "Everyone online. All at once.",
      "A connection for the devices and people you love.",
    ],
    [
      "heart",
      "A real person in your corner",
      "Friendly help, from choosing your plan to getting set up.",
    ],
  ]
    .map(
      ([i, h, p]) =>
        `<div><span class="round-icon">${icon(i)}</span><div><h3>${h}</h3><p>${p}</p></div></div>`,
    )
    .join(
      "",
    )}</div><a href="#address" class="button">Find my perfect plan <span>→</span></a></div><div class="connection-image"><img src="/assets/internet.png" alt="Rogers internet service illustration" loading="lazy"><div class="glass-speed"><div><strong>Made for your everyday.</strong><span>Work. Play. Stream. Repeat.</span></div><span class="red-icon">${icon("wifi")}</span></div></div></section>
<section class="services-section section-wrap"><div class="center-title"><div class="eyebrow">YOUR HOME. YOUR WAY.</div><h2>A great plan.<br><em>An even better bundle.</em></h2><p>Choose your internet. Add your favourites. Make it yours.</p></div><div class="service-grid"><a class="service-card" href="#address"><span class="round-icon">${icon("wifi")}</span><span class="service-kicker">HOME INTERNET</span><h3>Fast feels good.</h3><p>Plans built for your home, with speeds up to 2 Gig.</p><div class="service-bottom"><span>Find your internet plan</span><span>↗</span></div></a><a class="service-card featured-service" href="#address"><span class="round-icon">${icon("tv")}</span><span class="service-kicker">TV & STREAMING</span><h3>Stay in.<br> Tune out.</h3><p>Essential, Plus, or Ultimate. Your next favourite night in starts here.</p><div class="streaming-tags"><span>Disney+</span><span>Apple TV</span><span>Netflix</span></div><small>Streaming services vary by TV package.</small><div class="service-bottom"><span>TV from <b>$35</b>/mo</span><span>↗</span></div></a><a class="service-card" href="#address"><span class="round-icon">${icon("phone")}</span><span class="service-kicker">HOME PHONE</span><h3>Closer.<br> With every call.</h3><p>Keep the conversations going with the people who matter most.</p><div class="service-bottom"><span>Add for <b>$25</b>/mo</span><span>↗</span></div></a></div><p class="section-fineprint">Prices before applicable taxes. Availability and offer details confirmed by your advisor.</p></section>
<section class="why-section section-wrap" id="why"><div class="center-title"><div class="dealer-pill">${icon("shield")} The WebSaver difference</div><h2>More than internet.<br><em>A better connection.</em></h2><p>Big-network confidence. A personal touch.<br>That’s what happens when WebSaver meets Rogers.</p></div><div class="why-grid">${[
    [
      "shield",
      "Authorized Rogers Dealer",
      "Genuine Rogers plans, with a team that helps you find the right fit.",
    ],
    [
      "tag",
      "Our lowest prices",
      "Great offers for your province. More speed, more value, more reasons to switch.",
    ],
    [
      "heart",
      "Our best customer service",
      "Helpful people who make choosing a plan and getting connected simple.",
    ],
    [
      "home",
      "Free installation",
      "Start your next chapter with installation included at no extra cost.",
    ],
    [
      "wifi",
      "A plan for your home",
      "From everyday browsing to a full house of streamers, find your kind of fast.",
    ],
    [
      "check",
      "Nothing to pay at signup",
      "No hidden fees. No payment collected when you send your request.",
    ],
  ]
    .map(
      ([i, h, p]) =>
        `<article><span class="round-icon">${icon(i)}</span><h3>${h}</h3><p>${p}</p></article>`,
    )
    .join("")}</div></section>
<section class="community-section"><div class="community-heading section-wrap"><div><div class="eyebrow">GOOD CONNECTIONS. GOOD ENERGY.</div><h2>A little more <em>WebSaver.</em></h2><p>Big savings. Canadian spirit. And a little personality.</p></div><div class="gallery-arrows"><button id="gallery-prev" aria-label="Previous campaign cards">←</button><button id="gallery-next" aria-label="Next campaign cards">→</button></div></div><div class="campaign-gallery" id="campaign-gallery" tabindex="0" aria-label="WebSaver campaign gallery">${[
    ["savings.jpg", "WebSaver helped Canadians save a lot."],
    ["canada-space.jpg", "Rogers astronaut dog in front of a Canadian flag."],
    ["back-to-school.jpg", "Rogers authorized dealer back-to-school offer."],
    ["two-moods.jpg", "Two moods — a happy connection with Rogers."],
    [
      "switch-save.jpg",
      "Switch to Rogers with WebSaver for faster and cheaper internet.",
    ],
  ]
    .map(
      ([src, alt]) =>
        `<a class="gallery-card" href="#address"><img src="/assets/${src}" alt="${alt}" loading="lazy"><span>Find your home’s offer <b>↗</b></span></a>`,
    )
    .join("")}</div></section>
<section class="how-section section-wrap" id="how"><div class="center-title"><div class="eyebrow">LESS EFFORT. MORE INTERNET.</div><h2>Your next connection.<br><em>Three simple steps.</em></h2></div><div class="steps-grid">${[
    [
      "01",
      "Find your home",
      "Enter your address to see the offers for your province.",
    ],
    [
      "02",
      "Make it yours",
      "Choose your speed. Add TV or home phone. See your total.",
    ],
    [
      "03",
      "We’ll take it from here",
      "Send your details. Your advisor will help you get connected.",
    ],
  ]
    .map(
      ([n, h, p]) =>
        `<article><span class="step-number">${n}</span><h3>${h}</h3><p>${p}</p></article>`,
    )
    .join("")}</div></section>
<section class="faq section-wrap" id="faq"><div><div class="eyebrow">A LITTLE CLARITY</div><h2>Good questions.<br><em>Straight answers.</em></h2><p>Getting connected should feel simple.</p></div><div>${[
    [
      "Is WebSaver an authorized Rogers dealer?",
      "Yes. WebSaver is a fully authorized Rogers dealer. We partner with Rogers to help you choose the best Rogers deal on internet, TV, and home phone services for your household.",
    ],
    [
      "How can I find the best Rogers deal?",
      "Enter your address to compare the Rogers offers available for your province. A WebSaver advisor will confirm eligibility, pricing, promotional periods, and contract details before you proceed.",
    ],
    [
      "What happens after I submit my request for a plan?",
      "Getting connected is simple. Once you submit your request, a WebSaver advisor will contact you to confirm your address's service eligibility and verify all offer details before you officially proceed.",
    ],
    [
      "Are there any upfront fees when I sign up?",
      "No. Zero payment is collected when you submit your request online, and standard home installation is completely free.",
    ],
    [
      "Can I save money by setting up auto-pay?",
      "Yes! Your internet plan receives a $5 monthly discount when auto-pay is added. You can toggle this on in our plan builder to instantly see your savings.",
    ],
    [
      "Are there any hidden fees I should know about?",
      "We believe in straight answers. Your advisor will break down your exact monthly bill, including taxes and your promotional savings, before any activation takes place.",
    ],
    [
      "What services can I bundle together?",
      "You can easily build a custom bundle that fits your family's needs by mixing and matching our Home Internet, TV & Streaming, and Home Phone services.",
    ],
    [
      "Do I have to install the services myself?",
      "You don't have to worry about a thing. We offer free professional installation to ensure your home is connected properly and running smoothly from day one.",
    ],
    [
      "How do I get in touch if I need help choosing a plan?",
      'We are always here to help you find your best offer. You can reach out to our support team through the "Let\'s talk" section on our website or connect with us directly on Facebook.',
    ],
  ]
    .map(
      ([q, a]) =>
        `<details><summary>${q}<span>+</span></summary><p>${a}</p></details>`,
    )
    .join("")}</div></section>
<section class="closing"><div class="closing-ring"></div><div class="eyebrow">YOUR BETTER CONNECTION STARTS HERE</div><h2>Ready for a change<br><span>of speed?</span></h2><p>Great plans. Real people. Zero hassle.</p><a class="button light" href="#address">Check my address <span>↗</span></a><div class="closing-benefits"><span>✓ Free installation</span><span>✓ $0 at signup</span></div></section>`;
  await enrichHome();
  bindCampaigns();
  bindAddress();
  bindFaq();
  stopHome = () => stopMotion();
}
function bindCampaigns() {
  let current = 0,
    paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slides = [...document.querySelectorAll(".campaign-slide")],
    dots = [...document.querySelectorAll("[data-slide]")],
    pause = document.querySelector("#slide-pause");
  const show = (n) => {
    current = (n + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.hidden = i !== current;
      s.classList.toggle("is-current", i === current);
    });
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === current);
      d.setAttribute("aria-pressed", String(i === current));
    });
  };
  const updatePause = () => {
    pause.textContent = paused ? "▷" : "Ⅱ";
    pause.setAttribute(
      "aria-label",
      paused ? "Play slideshow" : "Pause slideshow",
    );
  };
  const manual = (n) => {
    paused = true;
    updatePause();
    show(n);
  };
  dots.forEach((d) => (d.onclick = () => manual(Number(d.dataset.slide))));
  document.querySelector("#slide-next")?.addEventListener("click", () => manual(current + 1));
  document.querySelector("#slide-prev")?.addEventListener("click", () => manual(current - 1));
  pause.onclick = () => {
    paused = !paused;
    updatePause();
  };
  updatePause();
  const frame = document.querySelector(".campaign-frame");
  let hovering = false;
  frame.onpointerenter = () => (hovering = true);
  frame.onpointerleave = () => (hovering = false);
  const interval = setInterval(() => {
    if (
      !paused &&
      !hovering &&
      !document.hidden &&
      !frame.contains(document.activeElement)
    )
      show(current + 1);
  }, 6500);
  const gallery = document.querySelector("#campaign-gallery");
  document.querySelector("#gallery-prev")?.addEventListener("click", () =>
    gallery?.scrollBy({ left: -360, behavior: "smooth" }));
  document.querySelector("#gallery-next")?.addEventListener("click", () =>
    gallery?.scrollBy({ left: 360, behavior: "smooth" }));
  stopHome = () => clearInterval(interval);
}
function acceptAddress(a) {
  state = { address: a, speed: null, tv: "none", phone: false, autopay: true };
  save();
  go("/plans");
}
function bindAddress() {
  const input = document.querySelector("#address-input"),
    list = document.querySelector("#suggestions"),
    status = document.querySelector("#search-status");
  let timer,
    request = 0;
  const clear = () => {
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
  };
  async function search(lastId = "") {
    const token = ++request;
    if (input.value.trim().length < 3) {
      clear();
      return;
    }
    status.textContent = "Finding your address…";
    try {
      const r = await fetch(
        "/api/address/find?" + new URLSearchParams({ q: input.value, lastId }),
      );
      const d = await r.json();
      if (token !== request) return;
      if (!r.ok) throw Error(d.error);
      clear();
      status.textContent = d.items.length
        ? "Select your address below."
        : "No matches yet. Try more of your address or enter it manually.";
      input.setAttribute("aria-expanded", String(d.items.length > 0));
      for (const item of d.items) {
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<b>${esc(item.Text)}</b><small>${esc(item.Description)}</small><span>→</span>`;
        button.onclick = async () => {
          ++request;
          clear();
          acceptAddress(item.address);
        };
        list.append(button);
      }
    } catch (e) {
      if (token === request) {
        clear();
        status.textContent = e.message;
      }
    }
  }
  document.querySelector("#address-search")?.addEventListener("click", () => {
    if (input.value.trim().length < 3) {
      status.textContent = "Enter at least 3 characters to find your address.";
      input.focus();
      return;
    }
    search();
  });
  input.oninput = () => {
    clearTimeout(timer);
    ++request;
    clear();
    timer = setTimeout(() => search(), 350);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list.querySelector("button")?.focus();
    }
    if (e.key === "Escape") clear();
  };
  list.onkeydown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.target.nextElementSibling?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (e.target.previousElementSibling)
        e.target.previousElementSibling.focus();
      else input.focus();
    }
    if (e.key === "Escape") {
      clear();
      input.focus();
    }
  };
  document.querySelector("#manual-toggle").onclick = () => {
    const form = document.querySelector("#manual-form");
    form.hidden = !form.hidden;
    document
      .querySelector("#manual-toggle")
      .setAttribute("aria-expanded", String(!form.hidden));
    clear();
    if (!form.hidden) form.querySelector("input").focus();
  };
  document.querySelector("#manual-form").onsubmit = (e) => {
    e.preventDefault();
    const a = Object.fromEntries(new FormData(e.target));
    a.postalCode = a.postalCode.toUpperCase();
    acceptAddress({ ...a, verified: false });
  };
}
const progress = (n) =>
  `<div class="progress">${["Your address", "Your plan", "Your details"].map((x, i) => `<span class="${i + 1 <= n ? "active" : ""}"><b>${i + 1 < n ? "✓" : i + 1}</b>${x}</span>`).join("<i></i>")}</div>`;
function planPage() {
  if (!state.address) {
    go("/#address");
    return;
  }
  const a = state.address;
  const provinceNames = {
    "british columbia": "BC",
    alberta: "AB",
    manitoba: "MB",
    saskatchewan: "SK",
    ontario: "ON",
  };
  const normalizedProvince =
    provinceNames[String(a.province || "").toLowerCase()] ||
    String(a.province || "").replace(/^CA-/, "");
  const postalProvince = {
    K: "ON",
    L: "ON",
    M: "ON",
    N: "ON",
    P: "ON",
    R: "MB",
    S: "SK",
    T: "AB",
    V: "BC",
  }[String(a.postalCode || "")[0]?.toUpperCase()];
  const resolvedProvince = plans[normalizedProvince]
    ? normalizedProvince
    : postalProvince || normalizedProvince;
  if (resolvedProvince !== a.province) {
    a.province = resolvedProvince;
    save();
  }
  const available = plans[resolvedProvince];
  if (!available) {
    app.innerHTML = `<section class="empty"><div class="eyebrow">THANKS FOR CHECKING</div><h1>We’re growing<br><em>our connections.</em></h1><p>We don’t have an online offer for this province yet. Our current offers cover BC, Alberta, Manitoba, Saskatchewan, and Ontario.</p><a class="button" href="/#address">Try another address ↗</a></section>`;
    return;
  }
  if (!available.some((p) => p[0] === state.speed))
    state.speed = available.length === 3 ? available[1][0] : available[0][0];
  const promo = ["SK", "ON"].includes(a.province);
  save();
  app.innerHTML = `<section class="plan-page">${progress(2)}<div class="plan-heading"><div><div class="eyebrow">A LITTLE SOMETHING FOR YOUR HOME</div><h1>Meet your <em>next connection.</em></h1><p class="selected-address">⌖ ${esc(a.line1)}, ${esc(a.city)}, ${esc(a.province)} ${esc(a.postalCode)} <a href="/#address">Change</a></p></div><span class="province-badge">${esc(provinces[a.province])} offers</span></div>${promo ? '<div class="promo-banner"><span>✦</span><div><strong>Your first 2 months? On us.</strong><p>Enjoy 2 months free internet — and 2 months free TV when you add it.</p></div><b>HELLO, SAVINGS.</b></div>' : ""}<div class="plan-layout"><div><div class="step-title"><span>01</span><div><h2>Choose your kind of fast.</h2><p>A connection that fits the way you live.</p></div></div><div class="plan-cards">${available.map(([speed, price], i) => `<button class="plan-card ${speed === state.speed ? "selected" : ""}" data-speed="${speed}" aria-pressed="${speed === state.speed}">${i === (available.length === 3 ? 1 : 0) ? '<span class="popular">THE EVERYDAY FAVOURITE</span>' : ""}<div class="radio-dot"></div><small>ROGERS HOME INTERNET</small><h3>${speedLabel(speed)}</h3><p>${speed < 1000 ? "Everyday browsing & streaming" : speed === 1000 ? "Movie nights. Game nights. All at once." : "More devices. More possibilities."}</p><div class="price"><sup>$</sup><strong data-price="${price}">${price - (state.autopay && !promo ? 5 : 0)}</strong><span>/mo</span></div><div class="card-line">Up to ${speed >= 1000 ? speed / 1000 + " Gbps" : speed + " Mbps"} download</div><span class="plan-select">${speed === state.speed ? "Selected" : "Choose this plan"} <span>↗</span></span></button>`).join("")}</div>${!promo ? `<label class="toggle-box"><div><strong>Let your savings run on auto-pay.</strong><span>Save $5/month on your internet when auto-pay is added.</span></div><input type="checkbox" id="autopay" ${state.autopay ? "checked" : ""}><span class="switch"></span></label>` : ""}<div class="step-title"><span>02</span><div><h2>A little TV with that?</h2><p>Your couch. Your shows. Your call.</p></div></div><div class="tv-options">${[
    {
      id: "none",
      title: "Just internet, please",
      detail: "I am happy with Home internet only.",
      price: 0,
      channels: "0 channels",
      tags: [],
      button: "",
    },
    {
      id: "essential",
      title: "Essential TV",
      detail: "Basic TV.",
      price: 35,
      channels: "100+ channels",
      tags: ["Sports", "Movies", "Cooking", "News"],
      button: "View channel list",
    },
    {
      id: "plus",
      title: "Plus TV",
      detail: "Includes Disney+.",
      price: 55,
      channels: "120+ channels",
      tags: ["Sports", "Movies", "Cooking", "News", "Disney+"],
      button: "View channel list",
    },
    {
      id: "ultimate",
      title: "Ultimate TV",
      detail: "Includes Disney+, Apple TV+ & Netflix.",
      price: 95,
      channels: "160+ channels",
      tags: ["Everything", "Apple TV+", "Netflix", "Disney+"],
      button: "View channel list",
    },
  ]
    .map(
      ({ id, title, detail, price, channels, tags, button }) => `
        <label class="tv-option ${state.tv === id ? "selected" : ""}">
          <input type="radio" name="tv" value="${id}" ${state.tv === id ? "checked" : ""}>
          <div class="tv-option-main">
            <div class="tv-option-top">
              <div class="tv-option-label">
                <strong>${title}</strong>
                <span>${detail}</span>
              </div>
              <b>${price ? "+$" + price : "$0"}<small>/mo</small></b>
            </div>
            <div class="tv-option-meta">
              <span class="tv-channel-count">${channels}</span>
              ${button ? `<button type="button" class="tv-channel-button" data-channel-list="${id}">${button}</button>` : ""}
            </div>
            <ul class="tv-feature-list">${tags.map((tag) => `<li>${tag}</li>`).join("")}</ul>
          </div>
        </label>`,
    )
    .join(
      "",
    )}</div>${state.tv !== "none" ? '<p class="tv-equipment-note"><strong>Included Equipment:</strong> Comes with the Rogers Xfinity Voice Remote and an Entertainment Box.</p>' : ""}<div class="step-title"><span>03</span><div><h2>Keep the conversation going.</h2><p>Add a familiar way to stay in touch.</p></div></div><label class="toggle-box phone-box"><div><strong>Home phone <b>+$25<span>/mo</span></b></strong><span>For the calls that make your day.</span></div><input type="checkbox" id="home-phone" ${state.phone ? "checked" : ""}><span class="switch"></span></label></div><aside class="order-summary" id="summary"></aside></div>${benefits}<p class="terms">Monthly prices in CAD before applicable taxes. Offers and speeds are subject to service availability and eligibility. An advisor will confirm all terms, promotional periods, and installation details before activation. No payment is collected here.</p></section>`;
  document.querySelector(".terms").textContent +=
    " Plans require a 2-year contract.";
  document.querySelectorAll("[data-speed]").forEach(
    (b) =>
      (b.onclick = () => {
        state.speed = Number(b.dataset.speed);
        save();
        planPage();
      }),
  );
  document.querySelector("#autopay")?.addEventListener("change", (e) => {
    state.autopay = e.target.checked;
    save();
    document
      .querySelectorAll("[data-price]")
      .forEach(
        (el) =>
          (el.textContent = Number(el.dataset.price) - (state.autopay ? 5 : 0)),
      );
    summary();
  });
  document.querySelector("#home-phone").onchange = (e) => {
    state.phone = e.target.checked;
    save();
    summary();
  };
  document.querySelectorAll("[name=tv]").forEach(
    (el) =>
      (el.onchange = () => {
        state.tv = el.value;
        save();
        document.querySelectorAll(".tv-option").forEach((option) => {
          option.classList.toggle(
            "selected",
            option.querySelector("input")?.value === state.tv,
          );
        });
        summary();
      }),
  );
  document.querySelectorAll("[data-channel-list]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const channelImages = {
        essential: ["Essentials_TV.jpg", "Essential TV channel list"],
        plus: ["Popular_TV.jpg", "Plus TV channel list"],
        ultimate: ["Ultimate_TV.jpg", "Ultimate TV channel list"],
      };
      const [src, alt] = channelImages[button.dataset.channelList];
      const lightbox = document.createElement("div");
      lightbox.className = "channel-lightbox";
      lightbox.setAttribute("role", "dialog");
      lightbox.setAttribute("aria-modal", "true");
      lightbox.setAttribute("aria-label", alt);
      lightbox.innerHTML = `<div class="channel-lightbox-panel"><button type="button" class="channel-lightbox-close" aria-label="Close channel list">×</button><img src="/assets/${src}" alt="${alt}"></div>`;
      const closeLightbox = () => {
        lightbox.remove();
        document.removeEventListener("keydown", onKeydown);
      };
      const onKeydown = (keyEvent) => {
        if (keyEvent.key === "Escape") closeLightbox();
      };
      lightbox.addEventListener("click", (clickEvent) => {
        if (clickEvent.target === lightbox) closeLightbox();
      });
      lightbox.querySelector(".channel-lightbox-close").onclick = closeLightbox;
      document.addEventListener("keydown", onKeydown);
      document.body.append(lightbox);
      lightbox.querySelector(".channel-lightbox-close").focus();
    }),
  );
  const internetEquipment = document.createElement("p");
  internetEquipment.className = "internet-equipment-note";
  internetEquipment.innerHTML =
    "<strong>Included Equipment:</strong> Comes with the Rogers Xfinity Wifi Router.";
  document.querySelector(".plan-cards")?.after(internetEquipment);
  summary();
}
function summary(checkout = false) {
  const p = quote(
    state.address.province,
    state.speed,
    state.tv,
    state.phone,
    state.autopay,
  );
  document.querySelector("#summary").innerHTML =
    `<div class="eyebrow">LOOKING GOOD TOGETHER</div><h3>Your home, connected.</h3><div class="summary-row"><span>${speedLabel(state.speed)} internet</span><b>$${p.internet}</b></div>${p.discount ? '<div class="saving-line">✓ Includes your $5 auto-pay savings</div>' : ""}${state.tv !== "none" ? `<div class="summary-row"><span>${state.tv[0].toUpperCase() + state.tv.slice(1)} TV</span><b>$${p.television}</b></div>` : ""}${state.phone ? '<div class="summary-row"><span>Home phone</span><b>$25</b></div>' : ""}<div class="summary-total"><span>Monthly total</span><div><sup>$</sup><strong>${p.total}</strong><span>/mo</span></div></div><small>Before applicable taxes${p.promo ? " · after 2 free months" : ""}</small>${p.promo ? `<div class="promo-note">✦ Internet${state.tv !== "none" ? " + TV" : ""} free for 2 months${state.phone ? "<br>Home phone remains $25/month." : ""}</div>` : ""}<div class="summary-row due"><span>Due at signup</span><b>$0</b></div>${checkout ? "" : `<button class="button full" id="continue">That’s my plan <span>↗</span></button>`}<div class="summary-foot">✓ Free installation<br>✓ No hidden fees<br>✓ Friendly help, every step</div>`;
  document
    .querySelector("#continue")
    ?.addEventListener("click", () => go("/signup"));
}
function signup() {
  if (!state.address || !state.speed) {
    go("/");
    return;
  }
  app.innerHTML = `<section class="plan-page">${progress(3)}<div class="eyebrow">YOU’RE ALMOST HOME</div><h1>Let’s make <em>the connection.</em></h1><p>Tell us a little about yourself. A WebSaver advisor will help you finish getting set up.</p><div class="plan-layout signup-layout"><form class="customer-form" id="customer-form"><h2>Nice to meet you.</h2><div class="fields"><label>First name<input name="firstName" autocomplete="given-name" required maxlength="80"></label><label>Last name<input name="lastName" autocomplete="family-name" required maxlength="80"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" required pattern="[+0-9() .-]{10,20}" placeholder="(604) 555-0123"></label><label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label><label class="wide">Date of birth<input name="dob" type="date" autocomplete="bday" required min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}"><small>Used to help your advisor prepare your service application.</small></label><label class="wide">Anything we should know? <span>(optional)</span><textarea name="note" rows="4" maxlength="2000" placeholder="Best time to call, move-in date, or any questions…"></textarea></label></div><div class="address-review"><b>⌖ Your service address</b><p>${esc(state.address.line1)}, ${esc(state.address.city)}, ${esc(state.address.province)} ${esc(state.address.postalCode)}</p><a href="/#address">Change address</a></div><label class="consent"><input type="checkbox" name="consent" required><span>I agree that WebSaver may use these details and contact me about this service request. I have read the <a href="/privacy" target="_blank">privacy information</a>.</span></label><p class="form-status" role="status" id="form-status"></p><button type="submit" class="button full">Request my connection <span>↗</span></button><p class="form-note">No payment required. This is a service request, not an activated contract.</p></form><aside class="order-summary" id="summary"></aside></div></section>`;
  document.querySelector(".form-note").textContent =
    "No payment required. This is a service request for a 2-year contract, not an activated contract.";
  summary(true);
  document.querySelector("#customer-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      button = form.querySelector("[type=submit]"),
      status = document.querySelector("#form-status");
    button.disabled = true;
    button.textContent = "Sending your request…";
    try {
      const fields = Object.fromEntries(new FormData(form));
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          consent: true,
          address: state.address,
          selection: {
            speed: state.speed,
            tv: state.tv,
            phone: state.phone,
            autopay: state.autopay,
          },
        }),
      });
      const rawResponse = await response.text();
      let data;
      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw Error(
          response.ok
            ? "The server returned an unexpected response. Please try again."
            : "We could not submit your request right now. Please try again.",
        );
      }
      if (!response.ok) throw Error(data.error);
      sessionStorage.setItem("prime-reference", data.id);
      form.reset();
      go("/thank-you");
    } catch (e) {
      status.textContent = e.message;
      button.disabled = false;
      button.textContent = "Request my connection ↗";
    }
  };
}
function render() {
  stopHome();
  document.title = "WebSaver — Built for speed. Powered to connect.";
  if (location.pathname === "/plans") planPage();
  else if (location.pathname === "/signup") signup();
  else if (location.pathname === "/thank-you") {
    const id = sessionStorage.getItem("prime-reference");
    app.innerHTML = `<section class="empty"><div class="success-mark">✓</div><div class="eyebrow">${id ? "REQUEST SAVED" : "LET’S GET CONNECTED"}</div><h1>${id ? "Thank you for<br><em>connecting with us.</em>" : "A better plan<br><em>starts here.</em>"}</h1><p>${id ? "One of our agents will contact you shortly." : "Start with your address to find your home’s offer."}</p>${id ? `<p class="reference">Reference: ${esc(id)}</p>` : ""}<a class="button" href="/">Back to home ↗</a></section>`;
  } else if (location.pathname === "/privacy") {
    app.innerHTML = `<section class="privacy"><div class="eyebrow">YOUR INFORMATION</div><h1>A little care.<br><em>For your privacy.</em></h1><p>WebSaver collects the contact details, service address, date of birth, notes, and plan selections you submit to prepare and follow up on your service request. No payment details are collected through this website.</p><h2>Address search</h2><p>Text you enter into address search is sent to Canada Post AddressComplete to return address suggestions. You may instead enter your address manually.</p><h2>Your request</h2><p>Requests are stored on the website’s server for WebSaver to review. When email notifications are configured, your request is sent to WebSaver’s designated inbox. Your date of birth is kept out of email notifications. Your details are not displayed publicly.</p><h2>Your choices</h2><p>Submitting the form gives WebSaver permission to contact you about this request. It does not subscribe you to unrelated marketing. To ask about, correct, or delete your request, contact <a href="mailto:raf77c@gmail.com">raf77c@gmail.com</a> and provide your request reference.</p><a class="text-link" href="/">← Back to home</a></section>`;
  } else home();
  document
    .querySelector(".privacy h2 + p")
    ?.replaceChildren(
      document.createTextNode(
        "Text you enter into address search is sent to Mapbox Geocoding to return address suggestions. You may instead enter your address manually.",
      ),
    );
  if (location.hash)
    setTimeout(
      () => document.querySelector(location.hash)?.scrollIntoView(),
      30,
    );
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  const url = new URL(a.href, location.origin);
  if (url.origin === location.origin) {
    e.preventDefault();
    if (url.pathname === location.pathname && url.hash) {
      history.pushState({}, "", url.pathname + url.hash);
      document.querySelector(url.hash)?.scrollIntoView({ behavior: "smooth" });
    } else go(url.pathname + url.hash);
  }
});
window.addEventListener("popstate", render);
render();
