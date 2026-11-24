// The recorder that runs inside the page (injected before the app's own scripts).
// While on, every frame it notes: the frame time, every new animation or transition
// (what, which properties, how long, which curve), and where each watched element is
// (box, opacity through its parents, colour, shadow, attached, visible). It also notes
// the person's input (pointer, touch, keys), inline style changes to layout properties,
// View Transitions, and the elements a step is waiting for as soon as they appear.
// Everything stays in window.__feel; try.mjs reads it back.
export const RECORDER = String.raw`(function(){
if (window.__feel) return;
var LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|max-height|max-width|min-height|min-width|flex-basis|grid-template-rows|grid-template-columns|font-size|line-height|letter-spacing|border-width)/;
var F = window.__feel = { on:false, t0:0, frames:[], anims:[], styles:[], input:[], watch:[], vt:[], want:null, wantName:'', seen:new WeakSet(), reveal:null };
function desc(el){ if(!el||!el.tagName) return ''; var t=(el.getAttribute&&(el.getAttribute('aria-label')||''))||((el.innerText||'').replace(/\s+/g,' ').trim().slice(0,28)); var cls=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''; return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+cls.slice(0,40)+(t?' "'+t+'"':''); }
function props(a){ try{ if(a.transitionProperty) return [a.transitionProperty]; var k=a.effect&&a.effect.getKeyframes?a.effect.getKeyframes():[]; var s={}; k.forEach(function(f){Object.keys(f).forEach(function(p){ if(!/^(offset|easing|composite|computedOffset)$/.test(p)) s[p]=1; });}); return Object.keys(s);}catch(e){return [];} }
// A View Transition's pseudo-elements: their first and last keyframes, resolved (where the old and
// new page, and each shared element's group, start and end), so try.mjs can tell the direction.
function vtKeys(a){ try{ var k=a.effect.getKeyframes(); if(!k.length) return null; var pick=function(f){ return {translate:f.translate||'', transform:f.transform||'', opacity:f.opacity==null?'':String(f.opacity), width:f.width||'', height:f.height||''}; }; return [pick(k[0]), pick(k[k.length-1])]; }catch(e){ return null; } }
// Construct Design components (window.__feelLib, from .feel/map.json): their own hand-tuned motion
// is not the app's, so it is never taken for the app's sheet, toast or page arrival.
function inLib(el){ var sel=window.__feelLib; if(!sel||!el||!el.closest) return false; try{ return !!el.closest(sel); }catch(e){ return false; } }
// A page's arrival: the root, <main>, data-feel="page", or the routed view straight inside one of them.
var PAGE='html,body,main,[role=main],[data-feel~=page]';
function isPage(el){ try{ return el.matches(PAGE) || !!(el.parentElement && el.parentElement.matches('main,[role=main],[data-feel~=page]')); }catch(e){ return false; } }
F.inLib = inLib;
function opacityOf(el){ var o=1; for(var e=el;e&&e.nodeType===1;e=e.parentElement){ var v=parseFloat(getComputedStyle(e).opacity); if(!isNaN(v)) o*=v; } return o; }
function snap(el){ if(!el.isConnected) return {c:false}; var r=el.getBoundingClientRect(), cs=getComputedStyle(el); return {c:true, x:r.x, y:r.y, w:r.width, h:r.height, o:opacityOf(el), bg:cs.backgroundColor, sh:cs.boxShadow, v: cs.visibility!=='hidden' && cs.display!=='none' && r.width>0 && r.height>0}; }
function tick(now){
  if(!F.on) return;
  F.frames.push(now);
  var all = document.getAnimations ? document.getAnimations() : [];
  for (var i=0;i<all.length;i++){ var a=all[i]; if(F.seen.has(a)) continue; F.seen.add(a);
    var ef=a.effect||{}, tg=ef.target, tm=ef.getComputedTiming?ef.getComputedTiming():{}, ti=ef.getTiming?ef.getTiming():{};
    var trig = !!(tg && window.__feelTrigger && tg.nodeType===1 && (window.__feelTrigger.contains(tg)||tg.contains(window.__feelTrigger))) || !!(tg && window.__feelLast && tg.nodeType===1 && (window.__feelLast===tg||window.__feelLast.contains(tg)));
    var pe=ef.pseudoElement||'';
    var lib = !!(tg && tg.nodeType===1 && inLib(tg));
    F.anims.push({trig:trig, lib:lib, page:!!(tg && tg.nodeType===1 && !lib && isPage(tg)), t:now, kind:(a.constructor&&a.constructor.name)||'Animation', name:a.animationName||a.transitionProperty||a.id||'', target:tg?desc(tg):'', pseudo:pe, props:props(a), dur:+tm.duration||0, delay:+(ti.delay||0), easing:ti.easing||'', iter: tm.iterations, kf: /view-transition/.test(pe)?vtKeys(a):null});
  }
  for (var j=0;j<F.watch.length;j++){ var w=F.watch[j]; var s=snap(w.el); s.t=now; w.rows.push(s); }
  requestAnimationFrame(tick);
}
F.start = function(){ F.on=true; F.t0=performance.now(); F.frames=[]; F.anims=[]; F.styles=[]; F.input=[]; F.vt=[];
  (document.getAnimations?document.getAnimations():[]).forEach(function(a){ F.seen.add(a); });
  F.watch.forEach(function(w){ w.rows=[]; });
  requestAnimationFrame(tick); };
F.stop = function(){ F.on=false; };
F.track = function(el, name){ if(!el) return false; for (var i=0;i<F.watch.length;i++) if(F.watch[i].el===el) return true; var s=snap(el); s.t=performance.now(); F.watch.push({name:name, el:el, rows:F.on?[s]:[], at:performance.now()}); return true; };
function laidOut(el){ var r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden'; }
function isShown(el){ return laidOut(el) && parseFloat(getComputedStyle(el).opacity)>0; }
// What is already on screen is not "new"; a closed <dialog>, popover or toast host that opens later is.
F.expect = function(selector, name, skipLib){ F.want=selector; F.wantName=name||'found'; F.skipLib=!!skipLib; F.before = new Set([].slice.call(document.querySelectorAll(selector)).filter(isShown)); };
function consider(el){ if(!F.want||!el||el.nodeType!==1) return; var hits=[]; try{ if(el.matches(F.want)) hits.push(el); hits=hits.concat([].slice.call(el.querySelectorAll(F.want))); }catch(e){ return; }
  for (var i=0;i<hits.length;i++){ var h=hits[i]; if(F.before.has(h)) continue; if(F.skipLib && inLib(h)) continue; if(!laidOut(h)){ requestAnimationFrame(function(x){ return function(){ if(laidOut(x)) F.track(x, F.wantName); }; }(h)); continue; } F.track(h, F.wantName); return; } }
var mo = new MutationObserver(function(list){
  for (var i=0;i<list.length;i++){ var m=list[i];
    if (m.type==='childList'){ for (var k=0;k<m.addedNodes.length;k++) consider(m.addedNodes[k]); }
    else if (m.type==='attributes'){
      consider(m.target);
      if (F.on && m.attributeName==='style' && m.target.style){ var st=m.target.style, hit=[]; for (var p=0;p<st.length;p++){ if(LAYOUT.test(st[p])) hit.push(st[p]); }
        var related = (window.__feelLast && (window.__feelLast.contains(m.target)||m.target.contains(window.__feelLast))) || F.watch.some(function(w){ return w.el.contains(m.target) || m.target.contains(w.el); });
        if(hit.length && related){ var key=desc(m.target)+'|'+hit.join(','); var prev=m.target.__feelLayout; var now=hit.map(function(h){return st.getPropertyValue(h)}).join(';'); if(prev!==undefined && prev!==now) F.styles.push({t:performance.now(), target:desc(m.target), props:hit}); m.target.__feelLayout=now; } }
    }
  }
});
function boot(){ mo.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['open','data-state','data-feel-state','hidden','style','class','aria-hidden','role','aria-modal','popover']}); }
if (document.documentElement) boot(); else document.addEventListener('DOMContentLoaded', boot);
['pointerdown','pointermove','pointerup','pointercancel','click','keydown'].forEach(function(type){
  window.addEventListener(type, function(e){ if(!F.on) return; F.input.push({t:e.timeStamp, type:type, x:e.clientX, y:e.clientY, target:desc(e.target), key:e.key}); }, {capture:true, passive:true});
});
function typesOf(v){ try{ return v&&v.types?[].slice.call(v.types):[]; }catch(e){ return []; } }
if (document.startViewTransition){ var svt=document.startViewTransition.bind(document); document.startViewTransition=function(arg){ var rec={t:performance.now(), kind:'same-document', nav:document.documentElement.getAttribute('data-feel-nav')||'', types:(arg&&arg.types)?[].slice.call(arg.types):[]}; F.vt.push(rec); var r=svt.apply(null, arguments); if(!rec.types.length) rec.types=typesOf(r); return r; }; }
window.addEventListener('pagereveal', function(e){ F.reveal={t:performance.now(), vt:!!e.viewTransition, types:typesOf(e.viewTransition), nav:document.documentElement.getAttribute('data-feel-nav')||''}; });
try { if (sessionStorage.getItem('__feelNav')) { sessionStorage.removeItem('__feelNav'); F.start(); } } catch(e){}
})();`;
