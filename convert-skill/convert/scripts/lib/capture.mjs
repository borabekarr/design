// Captures one page the way a buyer sees it: full-page screenshots at desktop (1440) and phone
// (390), the first screen at 2x, and page.json (the copy in order, CTAs, images, colours, fonts).
// Shared by capture.mjs and compare.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findBrowser, launch, tmpProfile, sleep } from "./browser.mjs";

export const DEVICES = {
  desktop: { w: 1440, h: 900, scale: 1, mobile: false, maxH: 16000 },
  phone: { w: 390, h: 844, scale: 2, mobile: true, maxH: 16000,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};

export function startBrowser() {
  const p = findBrowser();
  if (!p) { console.error("No Chrome, Edge, Brave or Chromium found. Set CONVERT_BROWSER to one."); process.exit(2); }
  return launch(p, tmpProfile());
}

export function toUrl(target) {
  if (/^(https?|file):/i.test(target)) return target;
  if (fs.existsSync(target)) {
    const st = fs.statSync(target);
    return pathToFileURL(st.isDirectory() ? path.join(target, "index.html") : path.resolve(target)).href;
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(target)) return "https://" + target;
  throw new Error(`Not a URL or a file: ${target}`);
}

async function tab(b, dev) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p, t) => b.send(m, p, sessionId, t);
  let inflight = new Set(), lastNet = Date.now();
  b.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    if (msg.method === "Network.requestWillBeSent") { inflight.add(p.requestId); lastNet = Date.now(); }
    else if (msg.method === "Network.loadingFinished" || msg.method === "Network.loadingFailed") { inflight.delete(p.requestId); lastNet = Date.now(); }
    else if (msg.method === "Page.javascriptDialogOpening") s("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
  });
  await Promise.all([s("Page.enable"), s("Runtime.enable"), s("Network.enable")]);
  await s("Network.setExtraHTTPHeaders", { headers: { "Accept-Language": process.env.CONVERT_LANG || "en-US,en;q=0.9" } });
  await metrics(s, dev, dev.h);
  if (dev.mobile) {
    await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await s("Network.setUserAgentOverride", { userAgent: dev.ua, platform: "iPhone", acceptLanguage: process.env.CONVERT_LANG || "en-US" });
  } else {
    // Some sites block the "HeadlessChrome" user agent; send the plain desktop one.
    const { userAgent } = await b.send("Browser.getVersion");
    await s("Network.setUserAgentOverride", { userAgent: userAgent.replace(/HeadlessChrome/g, "Chrome"), acceptLanguage: process.env.CONVERT_LANG || "en-US" });
  }
  const quiet = async (max = 8000) => {
    const until = Date.now() + max;
    await sleep(150);
    while (Date.now() < until) { if (inflight.size <= 1 && Date.now() - lastNet > 500) return; await sleep(100); }
  };
  const evaluate = async (expr, timeout = 20000) => {
    const r = await s("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, timeout);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  };
  return { s, targetId, quiet, evaluate };
}

const metrics = (s, dev, h) => s("Emulation.setDeviceMetricsOverride", {
  width: dev.w, height: h, deviceScaleFactor: dev.scale, mobile: dev.mobile, screenWidth: dev.w, screenHeight: dev.h,
});

// Cookie and consent banners: press the accept button when one is plain to find, then hide what is
// left of the well-known consent tools. Chat bubbles stay (they are part of the page).
const CONSENT = `(function(){
  var words=/^(accept( all)?( cookies)?|allow( all)?( cookies)?|agree|i agree|got it|ok(ay)?|accetta( tutto| tutti)?|accetto|alle akzeptieren|akzeptieren|aceptar( todo)?|accepter( tout)?|tout accepter|aceitar|accepteren|godkänn alla|zustimmen)$/i;
  var boxes=document.querySelectorAll('[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[id*=gdpr i],[class*=gdpr i],[aria-label*=cookie i],[role=dialog],#onetrust-banner-sdk,#CybotCookiebotDialog,.cc-window,#usercentrics-root,.osano-cm-window,#termly-code-snippet-support');
  var hit=0;
  boxes.forEach(function(box){ box.querySelectorAll('button,a,[role=button]').forEach(function(btn){
    if(hit) return; var t=(btn.innerText||btn.textContent||'').replace(/\\s+/g,' ').trim();
    if(words.test(t)){ try{btn.click();hit=1;}catch(e){} } }); });
  var kill=['#onetrust-consent-sdk','#CybotCookiebotDialog','#CybotCookiebotDialogBodyUnderlay','.cc-window','.cc-banner','#usercentrics-root','.osano-cm-window','#cookie-law-info-bar','.cky-consent-container','#cmplz-cookiebanner-container','.fc-consent-root','#didomi-host','#truste-consent-track','.qc-cmp2-container','#iubenda-cs-banner'];
  kill.forEach(function(q){document.querySelectorAll(q).forEach(function(e){e.style.setProperty('display','none','important')})});
  // Sign-up and promo pop-ups: press their close button; hide any big fixed layer still covering the page.
  document.querySelectorAll('[role=dialog],[aria-modal=true],[class*=modal i],[class*=popup i],[id*=popup i],[class*=klaviyo i],[id*=attentive i],[class*=newsletter i]').forEach(function(d){
    var r=d.getBoundingClientRect(); if(r.width<150||r.height<100) return;
    var c=d.querySelector('[aria-label*=close i],[aria-label*=dismiss i],[class*=close i],button[title*=close i]');
    if(!c){[].slice.call(d.querySelectorAll('button,a')).forEach(function(b){var t=(b.innerText||'').trim();if(!c&&/^(×|✕|x|no,? thanks.*|close|not now|maybe later|chiudi|schließen|cerrar|fermer)$/i.test(t))c=b})}
    if(c){try{c.click();hit=hit||2}catch(e){}}
  });
  [].slice.call(document.querySelectorAll('body *')).forEach(function(e){
    var cs=getComputedStyle(e); if(cs.position!=='fixed') return;
    var r=e.getBoundingClientRect(); var big=r.width*r.height>innerWidth*innerHeight*0.25;
    var bar=r.top<=2&&r.height<220; if(big&&!bar&&!e.querySelector('h1')) e.style.setProperty('display','none','important');
  });
  document.documentElement.style.removeProperty('overflow'); document.body&&document.body.style.removeProperty('overflow');
  if(getComputedStyle(document.body).overflow==='hidden') document.body.style.setProperty('overflow','visible','important');
  if(getComputedStyle(document.documentElement).overflow==='hidden') document.documentElement.style.setProperty('overflow','visible','important');
  return hit;
})()`;

// Walk the page top to bottom so lazy images and scroll reveals load, then come back up.
const WALK = `(async function(){
  document.querySelectorAll('img[loading=lazy]').forEach(function(i){i.loading='eager'});
  var y=0, step=Math.round(innerHeight*0.7), t0=Date.now();
  while(Date.now()-t0<25000){
    var H=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);
    if(y>=H-innerHeight) break;
    y+=step; window.scrollTo(0,y); await new Promise(function(r){setTimeout(r,140)});
  }
  await new Promise(function(r){setTimeout(r,500)});
  window.scrollTo(0,0);
  await new Promise(function(r){setTimeout(r,400)});
  var imgs=[].slice.call(document.images).filter(function(i){return !i.complete});
  await Promise.race([Promise.all(imgs.map(function(i){return i.decode().catch(function(){})})),new Promise(function(r){setTimeout(r,6000)})]);
  if(document.fonts) await Promise.race([document.fonts.ready,new Promise(function(r){setTimeout(r,3000)})]);
  return Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);
})()`;

// The full height of the page. Pages that scroll inside a wrapper (body is 100vh, a div scrolls)
// are measured by that wrapper.
const HEIGHT = `(function(){
  var H=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);
  if(H>innerHeight+50) return H;
  var best=null,bh=0;
  document.querySelectorAll('body *').forEach(function(e){ if(e.scrollHeight>e.clientHeight+50&&e.clientHeight>innerHeight*0.6){var o=getComputedStyle(e).overflowY;if((o=='auto'||o=='scroll')&&e.scrollHeight>bh){bh=e.scrollHeight;best=e}} });
  if(best){ best.style.setProperty('overflow','visible','important'); best.style.setProperty('height','auto','important'); best.style.setProperty('max-height','none','important');
    var p=best.parentElement; while(p){p.style.setProperty('overflow','visible','important');p.style.setProperty('height','auto','important');p=p.parentElement} }
  return Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0,bh);
})()`;

// Heights in vh units would stretch with a tall screen. Measure every element, grow the screen a
// little, and pin each element whose height moved (it is sized by the screen) to what it was.
const MEASURE = `(function(){
  var all=document.querySelectorAll('body *'); window.__cvH=[];
  for(var i=0;i<all.length;i++){var r=all[i].getBoundingClientRect();window.__cvH.push([all[i],r.height,r.top])}
  return all.length;
})()`;
const PIN = `(function(){
  var n=0;
  (window.__cvH||[]).forEach(function(x){var e=x[0],h=x[1];if(!e.isConnected||h<1)return;var r=e.getBoundingClientRect();
    if(Math.abs(r.height-h)>1){e.style.setProperty('height',h+'px','important');e.style.setProperty('min-height',h+'px','important');e.style.setProperty('max-height',h+'px','important');n++}});
  window.__cvH=null; return n;
})()`;

async function shoot(t, file, w, h, scale) {
  const shot = await t.s("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale } }, 90000);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
}

/** Opens `url` on one device and saves <name>.png, <name>-hero.png, and returns what the page says. */
export async function capturePage(b, url, outdir, name, { read = false } = {}) {
  const dev = DEVICES[name];
  const t = await tab(b, dev);
  try {
    const nav = await t.s("Page.navigate", { url }, 45000);
    if (nav.errorText) throw new Error(`Could not open ${url}: ${nav.errorText}`);
    await t.quiet(12000);
    await sleep(800);
    const consent = await t.evaluate(CONSENT).catch(() => 0);
    if (consent) { await t.quiet(3000); await sleep(400); await t.evaluate(CONSENT).catch(() => 0); }
    await t.evaluate(WALK, 60000).catch(() => 0);
    await t.quiet(5000);
    await t.evaluate(CONSENT).catch(() => 0);
    await sleep(1500);
    await t.evaluate(CONSENT).catch(() => 0); // pop-ups that open late (email sign-ups)
    await sleep(500);
    // The first screen, at 2x for desktop (the hero picture), as the buyer lands on it.
    const heroScale = dev.mobile ? dev.scale : 2;
    await metrics(t.s, { ...dev, scale: heroScale }, dev.h);
    await sleep(300);
    await shoot(t, path.join(outdir, `${name}-hero.png`), dev.w, dev.h, 1);
    await metrics(t.s, dev, dev.h);
    let data = null;
    if (read) data = await t.evaluate(READ, 30000).catch((e) => ({ error: e.message }));
    // The whole page at once: pin what is sized by the screen, then make the screen as tall as the
    // page, so every scroll reveal is in view and shows, the way a buyer sees it while scrolling.
    let H = await t.evaluate(HEIGHT).catch(() => dev.h);
    await t.evaluate(MEASURE).catch(() => 0);
    await metrics(t.s, dev, dev.h + 240);
    await sleep(250);
    await t.evaluate(PIN).catch(() => 0);
    await metrics(t.s, dev, dev.h);
    await sleep(150);
    H = await t.evaluate(HEIGHT).catch(() => H);
    const cut = H > dev.maxH;
    H = Math.min(Math.max(H, dev.h), dev.maxH);
    await metrics(t.s, dev, H);
    await sleep(1600);
    await t.evaluate(CONSENT).catch(() => 0);
    const H2 = Math.min(Math.max(await t.evaluate(HEIGHT).catch(() => H), dev.h), dev.maxH);
    if (Math.abs(H2 - H) > 4) { H = H2; await metrics(t.s, dev, H); await sleep(600); }
    // Chrome draws at most ~16k device pixels in one go (taller pictures wrap around): long phone
    // pages are captured a little below 2x so the whole page fits.
    const k = Math.min(1, 16000 / (H * dev.scale));
    if (k < 1) { await metrics(t.s, { ...dev, scale: dev.scale * k }, H); await sleep(500); }
    await shoot(t, path.join(outdir, `${name}.png`), dev.w, H, 1);
    return { height: H, cut, consent: !!consent, data };
  } finally {
    await t.s && b.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
  }
}

// What the page says, in order: the copy, the buttons, the pictures, the colours, the type.
const READ = `(function(){
  var clean=function(s){return (s||'').replace(/\\s+/g,' ').trim()};
  var vis=function(e){var r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>2&&r.height>2&&cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05};
  var top=function(e){return Math.round(e.getBoundingClientRect().top+scrollY)};
  var rgb=function(c){var m=(c||'').match(/rgba?\\(([^)]+)\\)/);if(!m)return null;var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);if(p.length>3&&p[3]<0.5)return null;return '#'+p.slice(0,3).map(function(x){return ('0'+Math.round(x).toString(16)).slice(-2)}).join('')};
  var bgOf=function(e){while(e&&e!==document.documentElement){var c=rgb(getComputedStyle(e).backgroundColor);if(c)return c;e=e.parentElement}return rgb(getComputedStyle(document.documentElement).backgroundColor)||rgb(getComputedStyle(document.body).backgroundColor)||'#ffffff'};
  var fam=function(e){return e?getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g,'').trim():null};
  var meta=function(n){var m=document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]');return m?clean(m.content):null};
  var heads=[].slice.call(document.querySelectorAll('h1,h2,h3,h4')).filter(vis).map(function(h){return {level:+h.tagName[1],text:clean(h.innerText).slice(0,300),y:top(h)}}).filter(function(h){return h.text});
  // Buttons and links that look like buttons (a fill, a border, or a button-ish class).
  var ctas=[],seen={};
  [].slice.call(document.querySelectorAll('a,button,[role=button],input[type=submit]')).filter(vis).forEach(function(e){
    var t=clean(e.innerText||e.value||e.getAttribute('aria-label')); if(!t||t.length>60||/^skip to/i.test(t)||e.getBoundingClientRect().top+scrollY<0) return;
    var cs=getComputedStyle(e), fill=rgb(cs.backgroundColor), border=parseFloat(cs.borderTopWidth)>0&&rgb(cs.borderTopColor);
    var cls=(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'';
    var btn=e.tagName!=='A'||!!fill||!!border||/btn|button|cta/i.test(cls);
    if(!btn) return; var y=top(e), k=t+'|'+(e.getAttribute('href')||'');
    if(seen[k]) return; seen[k]=1;
    ctas.push({text:t,href:e.getAttribute('href')||null,y:y,fill:fill,color:rgb(cs.color),inNav:!!e.closest('nav,header'),firstScreen:y<innerHeight});
  });
  var links=[].slice.call(document.querySelectorAll('nav a, header a')).filter(vis).map(function(a){return {text:clean(a.innerText).slice(0,60),href:a.getAttribute('href')}}).filter(function(l,i,a){return l.text&&a.findIndex(function(m){return m.text===l.text&&m.href===l.href})===i}).slice(0,40);
  // Sections: descend while one child holds nearly the whole page, then each block in order.
  var root=document.body;
  for(var i=0;i<8;i++){var kids=[].slice.call(root.children).filter(vis);var big=kids.filter(function(k){return k.getBoundingClientRect().height>root.getBoundingClientRect().height*0.8});if(kids.length&&big.length===1&&kids.length<=3)root=big[0];else break}
  var blocks=[];
  var take=function(el,depth){[].slice.call(el.children).filter(vis).forEach(function(k){
    var h=k.getBoundingClientRect().height; if(h<40||k.getBoundingClientRect().top+scrollY<0) return;
    var tx=clean(k.innerText); if(!tx&&!k.querySelector('img,video,svg,canvas')) return;
    if(h>innerHeight*2.6&&depth<3&&k.children.length>1){take(k,depth+1);return}
    blocks.push({tag:k.tagName.toLowerCase(),id:k.id||null,y:top(k),height:Math.round(h),text:tx.slice(0,1800),images:k.querySelectorAll('img').length,video:!!k.querySelector('video')});
  })};
  take(root,0);
  if(blocks.length<3){ blocks=[]; var used=[];
    [].slice.call(document.querySelectorAll('h1,h2')).filter(vis).forEach(function(h){
      var el=h; while(el.parentElement&&el.parentElement!==document.body&&el.parentElement.querySelectorAll('h1,h2').length===1&&el.parentElement.getBoundingClientRect().height<innerHeight*2.6) el=el.parentElement;
      if(used.indexOf(el)>=0) return; used.push(el);
      blocks.push({tag:el.tagName.toLowerCase(),id:el.id||null,y:top(el),height:Math.round(el.getBoundingClientRect().height),text:clean(el.innerText).slice(0,1800),images:el.querySelectorAll('img').length,video:!!el.querySelector('video')});
    }); }
  blocks.sort(function(a,b){return a.y-b.y});
  var imgs=[].slice.call(document.images).filter(vis).map(function(i){var r=i.getBoundingClientRect();return {src:i.currentSrc||i.src,alt:i.getAttribute('alt'),w:Math.round(r.width),h:Math.round(r.height),natural:[i.naturalWidth,i.naturalHeight],y:top(i)}}).filter(function(i,k,a){return i.src&&i.w*i.h>900&&a.findIndex(function(j){return j.src===i.src})===k}).slice(0,80);
  var bgImgs=[];[].slice.call(document.querySelectorAll('body *')).forEach(function(e){if(bgImgs.length>30)return;var b=getComputedStyle(e).backgroundImage;var m=b&&b.match(/url\\(["']?([^"')]+)/);if(m&&!/^data:/.test(m[1])){var r=e.getBoundingClientRect();if(r.width*r.height>20000)bgImgs.push({src:m[1],w:Math.round(r.width),h:Math.round(r.height),y:top(e)})}});
  var videos=[].slice.call(document.querySelectorAll('video')).map(function(v){return {src:v.currentSrc||v.src||(v.querySelector('source')||{}).src||null,poster:v.poster||null,y:top(v)}});
  var h1=[].slice.call(document.querySelectorAll('h1,h2')).filter(vis).filter(function(h){return h.getBoundingClientRect().top+scrollY<innerHeight*1.2}).sort(function(a,b){return parseFloat(getComputedStyle(b).fontSize)-parseFloat(getComputedStyle(a).fontSize)})[0]||document.querySelector('h1'), firstCta=ctas.filter(function(c){return c.firstScreen&&c.fill&&!c.inNav})[0]||ctas.filter(function(c){return c.fill})[0];
  // Background colours by the area they cover.
  var area={};[].slice.call(document.querySelectorAll('body,body *')).forEach(function(e){var c=rgb(getComputedStyle(e).backgroundColor);if(!c)return;var r=e.getBoundingClientRect();var a=r.width*r.height;if(a>4000)area[c]=(area[c]||0)+a});
  var palette=Object.keys(area).sort(function(a,b){return area[b]-area[a]}).slice(0,8);
  var fonts={}; if(document.fonts) document.fonts.forEach(function(f){if(f.status==='loaded')fonts[f.family.replace(/["']/g,'')]=1});
  var forms=[].slice.call(document.querySelectorAll('form')).filter(vis).map(function(f){return {fields:[].slice.call(f.querySelectorAll('input,select,textarea')).filter(function(i){return i.type!=='hidden'}).map(function(i){return i.getAttribute('placeholder')||i.name||i.type}),y:top(f)}});
  var logo=document.querySelector('header img, nav img, [class*=logo i] img, img[alt*=logo i], a[href="/"] img, header svg, a[href="/"] svg');
  return {
    url:location.href, title:document.title, headline:h1?clean(h1.innerText).slice(0,300):null, description:meta('description'), ogTitle:meta('og:title'), ogImage:meta('og:image'), lang:document.documentElement.lang||null,
    height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
    headings:heads, ctas:ctas.slice(0,60), nav:links, sections:blocks.slice(0,60), images:imgs, backgroundImages:bgImgs, videos:videos, forms:forms,
    logo:logo?(logo.tagName==='IMG'?{src:logo.currentSrc||logo.src,alt:logo.alt}:{svg:logo.outerHTML.slice(0,6000)}):null,
    colours:{background:bgOf(h1||document.body), text:h1?rgb(getComputedStyle(h1).color):rgb(getComputedStyle(document.body).color), accent:firstCta?firstCta.fill:null, accentText:firstCta?firstCta.color:null, palette:palette},
    fonts:{headings:fam(h1||document.querySelector('h2')), body:fam(document.querySelector('p')||document.body), buttons:fam(document.querySelector('button,a[class*=btn i],a[class*=button i]')), loaded:Object.keys(fonts)},
    words:clean(document.body.innerText).split(' ').length
  };
})()`;
