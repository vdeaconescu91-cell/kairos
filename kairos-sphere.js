/* KAIROS · sfera de sticlă cu „floarea” de lichid, randată în WebGL.
   Adaptată din sfera Nivo (handoff-sfera.md): un singur fragment shader, sferă de sticlă analitică,
   refracție și raymarch înăuntru pe un SDF din coji concentrice deformate.
   Aici: doar floarea (fără iconițe și morph), fundal transparent, paleta KAIROS.
   Un singur context WebGL pentru toate sferele din pagină; rezultatul se copiază în fiecare
   <canvas data-kairos-orb>. Fără WebGL, rămâne sfera 2D din kairos-orb.js. */
(() => {
  "use strict";

  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `precision highp float;
uniform vec2 R;uniform float T;uniform vec3 C1,C2,C3;uniform float AMP,SPD,US,VS;
float disp(vec3 p){float t=T*SPD;
 vec3 q=p+.38*vec3(sin(p.y*1.7+t),sin(p.z*1.9-t*.8),sin(p.x*1.5+t*1.1));
 float a=sin(q.x*2.3+t*1.2)*sin(q.y*2.1-t)*sin(q.z*2.5+t*.7);
 float b=sin(q.x*4.1-t*.9+q.z*1.7)*sin(q.y*3.7+t*1.3)*.45;
 float pe=pow(abs(sin(q.x*2.6+q.y*1.8+t*.6)*sin(q.y*2.2-q.z*1.5+t*.4)),1.4);
 return a*.75+b+pe*.55-.2;}
vec3 pal(float k){k=clamp(k,0.,1.);return k<.5?mix(C1,C2,k*2.):mix(C2,C3,k*2.-1.);}
float flower(vec3 p){float t=T*SPD*.45;
 vec3 q=p+.16*vec3(sin(p.y*2.3+t),sin(p.z*2.1-t*.8),sin(p.x*1.9+t*1.1));
 float an=atan(q.y,q.x),el=q.z/(length(q)+1e-3);
 float r=length(q*vec3(1.,1.,1.25));
 float ruf=(1.5+AMP)*disp(q*1.05)+.45*disp(q*2.4+vec3(3.1,1.7,.4))+.5*sin(an*3.+el*2.+t*.5)*smoothstep(.2,.9,r);
 float lay=sin(r*8.-t*.6+ruf*2.4);
 float sh=(abs(lay)-.16)/8.*.6;
 return max(sh,r-1.42);}
const float RG=1.16;const float IS=.74;
float sdfI(vec3 p){return flower(p/IS)*IS;}
vec3 nrmI(vec3 p){vec2 e=vec2(.008,0);return normalize(vec3(sdfI(p+e.xyy)-sdfI(p-e.xyy),sdfI(p+e.yxy)-sdfI(p-e.yxy),sdfI(p+e.yyx)-sdfI(p-e.yyx)));}
vec3 sky(vec3 d){float k=d.y*.5+.5;vec3 c=mix(vec3(.008,.012,.03),vec3(.07,.11,.22),k);
 c+=vec3(1.)*pow(max(dot(d,normalize(vec3(-.6,.75,.6))),0.),40.)*3.5;
 c+=vec3(.82,.9,1.)*pow(max(dot(d,normalize(vec3(.9,.25,.5))),0.),24.)*1.3;
 c+=C2*pow(max(dot(d,normalize(vec3(.1,-.8,.4))),0.),6.)*.5;return c;}
vec3 shadeSurf(vec3 p,vec3 n,vec3 rd,vec3 base){
 vec3 L=normalize(vec3(-.6,.7,.8));float dif=max(dot(n,L),0.);
 float fr=pow(1.-max(dot(n,-rd),0.),3.);
 vec3 col=base*(.28+.95*dif);
 col+=base*.35*pow(1.-max(dot(n,-rd),0.),1.5);
 vec3 rf=reflect(rd,n);col=mix(col,sky(rf)*1.2,.15+.7*fr);col+=base*.25*pow(max(dot(n,normalize(vec3(.3,-.4,.8))),0.),2.);
 col+=vec3(1.)*pow(max(dot(rf,normalize(vec3(-.6,.75,.6))),0.),90.)*2.2+vec3(.85,.92,1.)*pow(max(dot(rf,normalize(vec3(.85,.2,.5))),0.),50.)*.9;
 col+=vec3(1.)*pow(max(dot(n,normalize(L-rd)),0.),140.)*2.5;
 return col;}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*R)/R.y*US;
 vec3 ro=vec3(0.,0.,4.2),rd=normalize(vec3(uv*VS,-1.));
 vec3 oc=ro;float b=dot(oc,rd),c=dot(oc,oc)-RG*RG,h=b*b-c;
 vec3 col=vec3(0.);float alpha=0.;
 if(h>0.){
  float sh=sqrt(h),t0=-b-sh;vec3 p0=ro+rd*t0,n0=normalize(p0);
  float cosi=max(dot(-rd,n0),0.),fr=.04+.96*pow(1.-cosi,4.);
  vec3 rr=refract(rd,n0,1./1.12);
  float t=0.,tm=2.*RG*cosi+.05;bool hit=false;vec3 p=p0;
  for(int i=0;i<140;i++){p=p0+rr*t;float d=sdfI(p);if(d<.0015){hit=true;break;}t+=d*.65;if(t>tm)break;}
  vec3 inner=vec3(.01,.014,.03)+C2*.22*smoothstep(-.3,-1.1,n0.y)*cosi;float ia=.5;
  if(hit){vec3 n=nrmI(p);float r=length(p/IS);
   float k=clamp(.55-.45*dot(n,normalize(vec3(-.6,.7,.3))),0.,1.);
   vec3 base=pal(k);float occ=pow(smoothstep(.15,1.4,r),1.6);base*=.35+.65*occ;
   inner=shadeSurf(p,n,rr,base);inner*=.55+.45*smoothstep(-.6,.6,dot(n,-rr));inner+=C1*.45*pow(1.-max(dot(n,-rr),0.),3.)*occ;ia=1.;}
  vec3 rf=reflect(rd,n0);vec3 refl=sky(rf)*1.1;
  vec3 g=mix(inner,refl,fr);
  g+=vec3(1.)*pow(max(dot(rf,normalize(vec3(-.55,.7,.45))),0.),160.)*2.6+vec3(.85,.92,1.)*pow(max(dot(rf,normalize(vec3(.6,-.35,.7))),0.),60.)*.6;
  g+=C2*.55*pow(1.-cosi,6.)*smoothstep(-.1,-1.,n0.y)+vec3(.85,.92,1.)*pow(1.-cosi,12.)*1.6;
  alpha=clamp(max(ia,fr*1.4)*smoothstep(0.,.035,h),0.,1.);
  col=g;
 }
 col=max(col,0.);col=col*1.15/(1.+col*.55);col=pow(col,vec3(1./2.2));
 gl_FragColor=vec4(col*alpha,alpha);}
`;

  const targets = [...document.querySelectorAll("canvas[data-kairos-orb]")];
  if (!targets.length) return;

  const glc = document.createElement("canvas");
  const gl = glc.getContext("webgl", { antialias: false, premultipliedAlpha: true, alpha: true });
  if (!gl) return;                                     // fără WebGL: rămâne sfera 2D

  function build() {
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const P = gl.createProgram();
    gl.attachShader(P, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(P);
    if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P));
    gl.useProgram(P);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(P, "p"); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ["R", "T", "C1", "C2", "C3", "AMP", "SPD", "US", "VS"].forEach((k) => (U[k] = gl.getUniformLocation(P, k)));
    return U;
  }
  let U;
  try { U = build(); } catch (e) { console.warn("Sfera WebGL n-a pornit; rămâne varianta 2D.", e); return; }

  // paleta KAIROS, în spațiu liniar: gheață în lumină, albastrul KAIROS, albastru închis în adâncime
  const lin = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.0));
  const C1 = lin("#8fb0ff"), C2 = lin("#2a5ff0"), C3 = lin("#06175a");

  // preluăm canvas-urile înaintea sferei 2D, ca ea să nu le mai deseneze
  const orbs = targets.map((el) => {
    el.__orb = { webgl: true };
    const small = el.dataset.detail === "low" || (el.clientWidth || 0) < 80;
    return { el, ctx: el.getContext("2d"), small, visible: true, last: 0, px: 0 };
  });
  orbs.forEach((o) => { if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => { o.visible = e.isIntersecting; })).observe(o.el); });

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let budget = 1;                                      // scade dacă GPU-ul nu ține pasul
  function sizeOf(o) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = o.el.clientWidth || 32;
    let px = Math.round(css * dpr * (o.small ? 1 : budget));
    px = Math.max(24, Math.min(px, o.small ? 96 : 900));
    if (o.el.width !== Math.round(css * dpr)) { o.el.width = Math.round(css * dpr); o.el.height = Math.round(css * dpr); }
    return px;
  }

  function render(o, t) {
    const px = sizeOf(o);
    if (glc.width !== px || glc.height !== px) { glc.width = px; glc.height = px; }
    gl.viewport(0, 0, px, px);
    gl.uniform2f(U.R, px, px); gl.uniform1f(U.T, t);
    gl.uniform3f(U.C1, ...C1); gl.uniform3f(U.C2, ...C2); gl.uniform3f(U.C3, ...C3);
    gl.uniform1f(U.AMP, 0.3); gl.uniform1f(U.SPD, 0.45);
    gl.uniform1f(U.US, o.small ? 1.42 : 1.62); gl.uniform1f(U.VS, 0.42);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    o.ctx.clearRect(0, 0, o.el.width, o.el.height);
    o.ctx.drawImage(glc, 0, 0, o.el.width, o.el.height);
  }

  const t0 = performance.now();
  let slow = 0;
  function loop(now) {
    if (!document.hidden) {
      for (const o of orbs) {
        if (!o.visible) continue;
        const fps = o.small ? 20 : 30;
        if (now - o.last < 1000 / fps - 2) continue;
        o.last = now;
        const a = performance.now();
        render(o, (now - t0) / 1000);
        if (!o.small) {                                // buget de pixeli adaptiv pe sfera mare
          const ms = performance.now() - a;
          slow = ms > 22 ? slow + 1 : Math.max(0, slow - 1);
          if (slow > 6 && budget > 0.5) { budget *= 0.8; slow = 0; }
        }
      }
    }
    if (!reduce) requestAnimationFrame(loop);
  }
  orbs.forEach((o) => render(o, 3));
  if (!reduce) requestAnimationFrame(loop);

  glc.addEventListener("webglcontextlost", (e) => e.preventDefault());
  glc.addEventListener("webglcontextrestored", () => { try { U = build(); } catch (e) { console.warn(e); } });
})();
