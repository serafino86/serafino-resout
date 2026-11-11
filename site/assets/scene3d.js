// Scena 3D della home: WebGL2 scritto a mano (raymarching di forme morbide + fisica minima), nessuna libreria.
// La carica motion.js dopo `load`, solo vicino allo schermo. Senza WebGL2 resta il fondo CSS di .scena3d.
(function () {
  var box = document.querySelector('.scena3d');
  if (!box) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  var gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  var small = innerWidth < 700, N = small ? 6 : 10, sc = small ? 0.6 : 1;
  // colori sRGB + lucidità: bianco, grigio freddo, grigio chiaro, inchiostro, arancio (unico accento)
  var COL = { w: [.97, .97, .98, .3], g: [.6, .64, .7, .1], l: [.8, .83, .87, .2], k: [.08, .09, .1, .9], o: [.64, .23, .1, .6] };
  // [tipo, a, b, colore] tipi: 0 sfera (r=a), 1 capsula (h=a, r=b), 2 cubo smussato (lato/2=a, raggio=b), 3 anello (R=a, r=b)
  var SH = [[0, .85, 0, 'o'], [2, .5, .16, 'w'], [1, .45, .38, 'k'], [3, .58, .22, 'g'], [0, .62, 0, 'w'],
    [2, .42, .14, 'k'], [1, .5, .3, 'l'], [3, .5, .19, 'w'], [0, .55, 0, 'g'], [2, .4, .14, 'l']].slice(0, N);

  var FS = '#version 300 es\nprecision highp float;\n#define N ' + N + '\n' +
    'uniform vec2 uR;uniform vec4 uP[N];uniform mat3 uM[N];uniform vec4 uC[N];uniform vec3 uS[N];out vec4 o;' +
    'const vec3 L=vec3(-.447,.716,.537);' +
    'float sd(int i,vec3 p){vec3 s=uS[i];' +
    'if(s.x<.5)return length(p)-s.y;' +
    'if(s.x<1.5){p.y-=clamp(p.y,-s.y,s.y);return length(p)-s.z;}' +
    'if(s.x<2.5){vec3 q=abs(p)-s.y;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-s.z;}' +
    'vec2 q=vec2(length(p.xz)-s.y,p.y);return length(q)-s.z;}' +
    'float map(vec3 p,out int id){float d=p.z+2.6;id=-1;for(int i=0;i<N;i++){vec3 q=p-uP[i].xyz;' +
    'if(length(q)-uP[i].w<d){float e=sd(i,uM[i]*q);if(e<d){d=e;id=i;}}}return d;}' +
    'float map(vec3 p){int i;return map(p,i);}' +
    'vec3 nor(vec3 p){vec2 e=vec2(.001,-.001);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}' +
    'float sha(vec3 p){float r=1.,t=.03;for(int k=0;k<28;k++){float h=map(p+L*t);r=min(r,8.*h/t);t+=clamp(h,.04,.5);if(r<.01||t>7.)break;}return clamp(r,0.,1.);}' +
    'float occ(vec3 p,vec3 n){float a=0.;for(int k=1;k<5;k++){float h=.15*float(k);a+=(h-map(p+n*h))/float(k);}return clamp(1.-1.4*a,0.,1.);}' +
    'void main(){vec2 uv=(2.*gl_FragCoord.xy-uR)/uR.y;vec3 ro=vec3(0,0,10),rd=normalize(vec3(uv*.3,-1));' +
    'float t=0.;int id=-1;for(int k=0;k<90;k++){float d=map(ro+rd*t,id);if(d<.0015*t||t>18.)break;t+=d;}' +
    'vec3 p=ro+rd*t,n=nor(p);float dif=max(dot(n,L),0.)*sha(p+n*.01),ao=occ(p,n);vec3 c;' +
    'if(id<0){c=vec3(.80,.82,.86)*(.62+.38*ao)*(.72+.52*dif);}' +
    'else{vec3 b=pow(uC[id].rgb,vec3(2.2));float g=uC[id].a,hm=.55+.45*n.y;' +
    'vec3 r=reflect(rd,n),env=mix(vec3(.18,.19,.22),vec3(1.05),smoothstep(-.3,.7,r.y));' +
    'float f=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);' +
    'float sp=pow(max(dot(n,normalize(L-rd)),0.),mix(10.,120.,g))*dif*mix(.05,1.6,g);' +
    'c=b*(vec3(.36,.38,.43)*hm*ao+vec3(1.,.97,.92)*1.05*dif)+sp+env*f*g*.7*ao;}' +
    'c*=1.-.06*dot(uv,uv);o=vec4(pow(c,vec3(1./2.2)),1);}';

  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var pr = gl.createProgram();
  gl.attachShader(pr, shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}'));
  gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(pr, 0, 'a');
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  function U(n) { return gl.getUniformLocation(pr, n); }
  var uR = U('uR'), uP = U('uP'), uM = U('uM');
  var P = new Float32Array(4 * N), M = new Float32Array(9 * N), C = [], S = [];

  function unit(q) { var l = Math.hypot(q[0], q[1], q[2], q[3]); return q.map(function (x) { return x / l; }); }
  // oggetti: posizione, velocità, quaternione, velocità angolare, raggio d'ingombro, posto "a casa"
  var O = SH.map(function (s, i) {
    var a = s[1] * sc, b = s[2] * sc, r = [a, a + b, a * 1.732 + b, a + b][s[0]];
    C.push.apply(C, COL[s[3]]); S.push(s[0], a, b);
    return { p: [0, 0, 0], v: [0, 0, 0], q: unit([Math.sin(i), Math.cos(i * 1.7), Math.sin(i * 2.3), 1]), r: r, h: [0, 0, 0],
      w0: [Math.sin(i * 3.1) * .35, Math.cos(i * 1.3) * .35, .15], w: [0, 0, 0] };
  });
  gl.uniform4fv(U('uC'), new Float32Array(C));
  gl.uniform3fv(U('uS'), new Float32Array(S));

  var scale = small ? .6 : .75, asp = 2, X = 6, Y = 2.85, T = 0, sPrev = 0, first = true;
  function size() {
    var w = box.clientWidth, h = box.clientHeight, k = Math.min(devicePixelRatio || 1, 1.5) * scale;
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uR, cv.width, cv.height);
    asp = w / h; X = 3.0 * asp - .3;
    O.forEach(function (o, i) {
      var a = (i + .5) / N * 2 - 1, b = ((i * .618 + .3) % 1) * 2 - 1;
      o.h = asp >= 1 ? [a * X * .82, b * Y * .6, ((i * .37) % 1) * 1.6 - .8] : [b * X * .55, a * Y * .78, ((i * .37) % 1) * 1.2 - .6];
      if (first) o.p = still ? o.h.slice() : [o.h[0], o.h[1] - 2 * Y - 2, o.h[2]];
    });
    first = false;
  }

  var m = { x: 0, y: 0, px: 0, py: 0, on: 0 };
  function point(e) {
    var r = box.getBoundingClientRect();
    m.x = ((e.clientX - r.left) / r.width * 2 - 1) * asp * 3.0;
    m.y = -((e.clientY - r.top) / r.height * 2 - 1) * 3.0;
    if (!m.on) { m.px = m.x; m.py = m.y; }
    m.on = 1;
  }

  function step(dt) {
    T += dt;
    var r = box.getBoundingClientRect(), s = Math.max(-1.2, Math.min(1.2, (r.top + r.height / 2) / innerHeight - .5));
    var ds = s - sPrev; sPrev = s;
    var mvx = m.on ? (m.x - m.px) / dt : 0, mvy = m.on ? (m.y - m.py) / dt : 0;
    m.px = m.x; m.py = m.y;
    mvx = Math.max(-25, Math.min(25, mvx)); mvy = Math.max(-25, Math.min(25, mvy));
    var damp = Math.exp(-1.8 * dt), i, j, k;
    O.forEach(function (o, i) {
      var h = [o.h[0] + Math.sin(T * .3 + i * 1.3) * .3, o.h[1] + Math.cos(T * .27 + i * 2.1) * .3 + s * 1.4 * (1 + o.h[2] * .3), o.h[2]];
      for (k = 0; k < 3; k++) o.v[k] = (o.v[k] + (h[k] - o.p[k]) * 1.3 * dt) * damp;
      if (m.on) { // il puntatore respinge e fa girare
        var dx = o.p[0] - m.x, dy = o.p[1] - m.y, d = Math.hypot(dx, dy) || 1e-3, R = 1.6 + o.r;
        if (d < R) {
          var f = (R - d) / R;
          o.v[0] += (dx / d * 16 * dt + mvx * .04) * f; o.v[1] += (dy / d * 16 * dt + mvy * .04) * f;
          o.w[0] -= mvy * f * .08; o.w[1] += mvx * f * .08;
        }
      }
      o.w[0] -= ds * 8;
      for (k = 0; k < 3; k++) o.w[k] += (o.w0[k] - o.w[k]) * .6 * dt;
    });
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) { // urti morbidi fra sfere d'ingombro
      var a = O[i], b = O[j], n = [a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]], d = Math.hypot(n[0], n[1], n[2]), min = (a.r + b.r) * .9;
      if (d < min && d > 1e-4) {
        var pen = (min - d) * .5, rel = 0;
        for (k = 0; k < 3; k++) { n[k] /= d; a.p[k] += n[k] * pen; b.p[k] -= n[k] * pen; rel += (a.v[k] - b.v[k]) * n[k]; }
        if (rel < 0) for (k = 0; k < 3; k++) { a.v[k] -= n[k] * rel * .8; b.v[k] += n[k] * rel * .8; }
        a.w[2] += rel * .5; b.w[2] -= rel * .5;
      }
    }
    O.forEach(function (o) {
      var lim = [X - o.r, Y + 1, 1.3];
      for (k = 0; k < 3; k++) {
        o.p[k] += o.v[k] * dt;
        var ex = Math.abs(o.p[k]) - lim[k];
        if (ex > 0 && !(k === 1 && o.p[1] < 0 && T < 3)) o.v[k] -= Math.sign(o.p[k]) * ex * 30 * dt;
      }
      if (o.p[2] < -2.4 + o.r) o.p[2] = -2.4 + o.r;
      var q = o.q, w = o.w, h2 = dt * .5;
      var x = q[0] + h2 * (w[0] * q[3] + w[1] * q[2] - w[2] * q[1]), y = q[1] + h2 * (w[1] * q[3] + w[2] * q[0] - w[0] * q[2]),
        z = q[2] + h2 * (w[2] * q[3] + w[0] * q[1] - w[1] * q[0]), ww = q[3] - h2 * (w[0] * q[0] + w[1] * q[1] + w[2] * q[2]);
      var l = Math.hypot(x, y, z, ww); o.q = [x / l, y / l, z / l, ww / l];
    });
  }

  function draw() {
    O.forEach(function (o, i) {
      var x = o.q[0], y = o.q[1], z = o.q[2], w = o.q[3];
      P.set([o.p[0], o.p[1], o.p[2], o.r], i * 4);
      // rotazione scritta per righe: letta come colonne diventa la trasposta (mondo -> locale)
      M.set([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)], i * 9);
    });
    gl.uniform4fv(uP, P); gl.uniformMatrix3fv(uM, false, M);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    box.classList.add('on');
  }

  var vis = true, raf = 0, last = 0, acc = 0, cnt = 0;
  function run() { return vis && !document.hidden && !still; }
  function frame(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    step(dt); draw();
    acc += dt; cnt++;
    if (cnt === 30) { // telefono lento: meno pixel
      if (acc / cnt > .024 && scale > .36) { scale *= .8; size(); }
      acc = cnt = 0;
    }
    if (run()) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && run()) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  box.appendChild(cv);
  size();
  addEventListener('resize', function () { size(); if (still) draw(); });
  if (still) { draw(); return; }
  box.addEventListener('pointermove', point);
  box.addEventListener('pointerdown', point);
  box.addEventListener('pointerleave', function () { m.on = 0; });
  box.addEventListener('pointercancel', function () { m.on = 0; });
  new IntersectionObserver(function (e) { vis = e[0].isIntersecting; kick(); }).observe(box);
  document.addEventListener('visibilitychange', kick);
  kick();
})();
