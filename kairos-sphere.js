/* KAIROS · globul de sticlă cu clepsidra de cerneală, randat în WebGL.
   Un glob de sticlă subțire, luminat din spate de o rază diagonală, cu arcuri de lumină pe margine.
   Înăuntru, o clepsidră prin care cerneala albastră se scurge încet; jos, cerneala se desface în fum
   (ca logogramele din Arrival). Când sus nu mai e nimic, clepsidra se întoarce și o ia de la capăt.
   Un singur context WebGL pentru toate globurile din pagină; rezultatul se copiază în fiecare
   <canvas data-kairos-orb>. Fără WebGL, rămâne sfera 2D din kairos-orb.js. */
(() => {
  "use strict";

  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `precision highp float;
uniform vec2 R;uniform float T;uniform float US;uniform float SMALL;
const float PI=3.14159265;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
// cerneală în apă: câmp deformat de două ori, cu fire subțiri (ridged)
float ink(vec2 p,float t){
 vec2 w=vec2(fbm(p*1.4+vec2(0.,t*.18)),fbm(p*1.4+vec2(5.2,1.3)-vec2(t*.12,0.)));
 vec2 w2=vec2(fbm(p*2.1+w*2.2+vec2(1.7,-t*.2)),fbm(p*2.1+w*2.2+vec2(8.3,2.8)));
 float f=fbm(p*2.6+w2*2.8);
 float r=1.-abs(fbm(p*3.3+w2*3.4-vec2(0.,t*.25))*2.-1.);
 return clamp(f*.75+pow(r,3.)*.55,0.,1.);}
// clepsidra, în unități de rază a globului
const float H=.64;const float NECK=.028;const float X=.30;
float hw(float y){float u=clamp(abs(y)/H,0.,1.);return NECK+.34*pow(sin(u*1.62),1.25);}
// ciclul: 0.9 s cade cerneala (după întoarcere), 10 s se scurge, 1.5 s așteaptă, 1.6 s se întoarce
const float CY=14.;
void cyc(float t,out float v,out float a,out float ang,out float flow){
 float c=mod(t,CY);v=0.;a=0.;ang=0.;flow=0.;
 if(c<.9){float k=c/.9;v=1.;a=mix(H-X,0.,k*k);}
 else if(c<10.9){float k=(c-.9)/10.;v=1.-k;flow=smoothstep(0.,.03,k)*(1.-smoothstep(.97,1.,k));}
 else if(c<12.4){v=0.;}
 else{float k=(c-12.4)/1.6;k=k<.5?4.*k*k*k:1.-pow(-2.*k+2.,3.)/2.;ang=PI*k;}
}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*R)/R.y*US;
 const float R0=.34;
 vec2 s=uv/R0;float r=length(s);
 vec3 col=vec3(0.);float A=0.;
 // raza de lumină din spate, pe diagonală, stinsă spre marginile canvas-ului
 vec2 bd=normalize(vec2(1.,.46));float along=dot(uv,bd),perp=dot(uv,vec2(-bd.y,bd.x))+.035;
 float fade=smoothstep(.5,.08,abs(along))*(1.-SMALL);
 float beam=(exp(-perp*perp/.00035)*.9+exp(-perp*perp/.006)*.28)*fade;
 vec3 beamC=vec3(.45,.62,1.);
 // halou în jurul globului
 float halo=exp(-pow(max(r-1.,0.),2.)/.0025)*step(1.,r)*.22;
 col+=beamC*beam+vec3(.55,.7,1.)*halo;
 A=clamp(max(beam*.85,halo),0.,1.);
 if(r<1.){
  float nz=sqrt(max(1.-r*r,0.)),cosi=nz;
  float fr=.04+.96*pow(1.-cosi,5.);
  // lentila: centrul se mărește, marginea se strânge
  vec2 q=s*mix(.80,1.,r*r)*1.02;
  float v,a,ang,flow;cyc(T,v,a,ang,flow);
  float cs=cos(ang),sn=sin(ang);q=vec2(cs*q.x+sn*q.y,-sn*q.x+cs*q.y);
  float w=hw(q.y);
  float inside=step(abs(q.x),w-.012)*step(abs(q.y),H-.012);
  float tt=T*.55;
  float sm=ink(q*2.2,tt);
  // sus: cerneala care stă pe gâtul clepsidrei și scade
  float topS=a+X*v+.006*sin(q.x*26.+T*1.7)*v;
  float dTop=smoothstep(0.,.014,topS-q.y)*smoothstep(-.004,.01,q.y-a)*step(.001,v);
  // pâlnia de deasupra gâtului cât curge
  dTop=max(dTop,flow*smoothstep(.06,0.,length((q-vec2(0.,.012))*vec2(1.,.6)))*step(0.,q.y)*step(.0005,v));
  // jos: lichidul care se strânge
  float botS=-H+X*(1.-v)+.005*sin(q.x*22.-T*1.3)*(1.-v);
  float dBot=smoothstep(0.,.014,botS-q.y)*step(.0005,1.-v);
  // firul care cade prin gât
  float xo=.0045*sin(q.y*38.+T*9.)+.002*sin(q.y*91.-T*14.);
  float dS=flow*smoothstep(.0075,.0025,abs(q.x-xo))*step(q.y,.01)*step(botS-.01,q.y);
  // fumul de cerneală care se ridică de unde lovește firul (Arrival)
  vec2 pc=q-vec2(0.,botS+.07);
  float plume=flow*smoothstep(.34,.0,length(pc*vec2(.75,1.1)))*smoothstep(.28,.8,ink(q*3.0+vec2(0.,-T*.12),tt*1.3))*step(botS-.02,q.y);
  // ceața de cerneală care rămâne suspendată în bula de jos
  float haze=smoothstep(.62,.97,ink(q*2.6+vec2(3.1,-T*.06),tt*.8))*.28*(1.-v)*smoothstep(-.02,-.25,q.y)*step(botS,q.y);
  // urma de fum care rămâne în partea de sus când lichidul coboară
  float trail=smoothstep(.0,.12,q.y-topS)*smoothstep(.22,.0,q.y-topS)*smoothstep(.45,.85,sm)*.35*v*step(0.,q.y);
  float dens=max(max(dTop,dBot)*(.5+.55*sm),max(dS,max(plume*.95,max(trail,haze))));
  dens=clamp(dens,0.,1.)*inside;
  vec3 deep=vec3(.02,.05,.24),mid=vec3(.09,.27,.92),lite=vec3(.55,.72,1.);
  vec3 inkC=mix(deep,mid,smoothstep(.25,.85,sm));
  inkC=mix(inkC,lite,.45*smoothstep(.78,1.,sm));
  inkC+=lite*.6*exp(-pow((topS-q.y)/.012,2.))*dTop;           // luciu pe suprafața de sus
  inkC+=lite*.45*exp(-pow((botS-q.y)/.012,2.))*dBot;
  float inkA=dens*(.55+.42*sm);
  // sticla clepsidrei: un contur fin și capacele
  float dl=abs(abs(q.x)-w);
  float frame=exp(-dl*dl/.00002)*step(abs(q.y),H)*.55;
  float capY=abs(abs(q.y)-H);float capW=hw(H)+.05;
  frame+=exp(-capY*capY/.00003)*step(abs(q.x),capW)*.9;
  frame*=.6+.4*smoothstep(-1.,1.,q.x+q.y);
  vec3 frameC=vec3(.78,.86,1.);
  // globul: margine, arcuri de lumină care se rotesc, reflexii
  float th=atan(s.y,s.x);
  float rim=pow(1.-cosi,7.)*.55+exp(-pow((r-.988)/.007,2.))*.75;
  float wob=n2(vec2(th*1.5,T*.25))*1.4;
  float band=exp(-pow((r-.93)/.035,2.));
  float arc1=pow(.5+.5*sin(th*1.+T*.45+wob),10.)*band;
  float arc2=pow(.5+.5*sin(th*2.-T*.32+wob*.7+1.3),16.)*exp(-pow((r-.86)/.03,2.));
  float warm=pow(.5+.5*sin(th*1.+T*.45+wob-.55),18.)*band;
  vec2 hl=s-vec2(-.42,.47);
  float spec=exp(-dot(hl,hl)/.02)*.22+exp(-dot(hl,hl)/.0018)*.8;
  float low=exp(-pow(length(s-vec2(.38,-.55))-.12,2.)/.004)*smoothstep(.5,.95,r)*.35;
  vec3 glass=vec3(.62,.76,1.)*rim+vec3(.92,.96,1.)*arc1*1.1+vec3(.45,.62,1.)*arc2*.7+vec3(1.,.6,.3)*warm*.7+vec3(1.)*spec+vec3(.7,.82,1.)*low;
  glass+=beamC*beam*.35;                                   // raza se vede și prin sticlă
  glass+=frameC*frame;
  glass*=1.+.25*fr;
  float gl=clamp(max(max(glass.r,glass.g),glass.b),0.,1.);
  vec3 inside3=inkC*inkA+glass+vec3(.01,.02,.05)*(1.-inkA)*.6;
  float ia=1.-(1.-inkA)*(1.-gl)*(1.-.06);
  float edge=smoothstep(1.,.985,r);
  col=mix(col,inside3,edge);A=mix(A,ia,edge);
 }
 col=max(col,0.);col=col*1.12/(1.+col*.5);col=pow(col,vec3(1./2.2));
 A=clamp(A,0.,1.);
 gl_FragColor=vec4(min(col,vec3(A)),A);}
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
    const U = {}; ["R", "T", "US", "SMALL"].forEach((k) => (U[k] = gl.getUniformLocation(P, k)));
    return U;
  }
  let U;
  try { U = build(); } catch (e) { console.warn("Globul WebGL n-a pornit; rămâne varianta 2D.", e); return; }

  // preluăm canvas-urile înaintea sferei 2D, ca ea să nu le mai deseneze
  const orbs = targets.map((el) => {
    el.__orb = { webgl: true };
    const small = el.dataset.detail === "low" || (el.clientWidth || 0) < 80;
    return { el, ctx: el.getContext("2d"), small, visible: true, last: 0 };
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
    gl.uniform1f(U.US, o.small ? .74 : 1.0); gl.uniform1f(U.SMALL, o.small ? 1 : 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    o.ctx.clearRect(0, 0, o.el.width, o.el.height);
    o.ctx.drawImage(glc, 0, 0, o.el.width, o.el.height);
  }
  let paused = false;
  window.__kairosGlobe = { render: (t) => { paused = true; orbs.forEach((o) => render(o, t)); } };   // pentru capturi

  const t0 = performance.now();
  let slow = 0;
  function loop(now) {
    if (!document.hidden && !paused) {
      for (const o of orbs) {
        if (!o.visible) continue;
        const fps = o.small ? 20 : 30;
        if (now - o.last < 1000 / fps - 2) continue;
        o.last = now;
        const a = performance.now();
        render(o, 2 + (now - t0) / 1000);
        if (!o.small) {                                // buget de pixeli adaptiv pe globul mare
          const ms = performance.now() - a;
          slow = ms > 22 ? slow + 1 : Math.max(0, slow - 1);
          if (slow > 6 && budget > 0.5) { budget *= 0.8; slow = 0; }
        }
      }
    }
    if (!reduce) requestAnimationFrame(loop);
  }
  orbs.forEach((o) => render(o, 5));
  if (!reduce) requestAnimationFrame(loop);

  glc.addEventListener("webglcontextlost", (e) => e.preventDefault());
  glc.addEventListener("webglcontextrestored", () => { try { U = build(); } catch (e) { console.warn(e); } });
})();
