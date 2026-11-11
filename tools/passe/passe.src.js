// Hero «Le passe»: sbarra inox della passe con i bon di comanda appesi. Sorgente di site/assets/passe.js (vedi build.sh).
// I testi dei bon si leggono dagli <a class="bon"> della pagina; gli stessi <a> diventano le zone cliccabili sopra il canvas.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, Mesh, Group, Vector3,
  BoxGeometry, PlaneGeometry, CylinderGeometry, CircleGeometry, ExtrudeGeometry, Shape,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, SpotLight, HemisphereLight,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap,
  PMREMGenerator, BackSide, DoubleSide,
} from 'three';

const root = document.querySelector('.passe');
const stage = root && root.querySelector('.passe-stage');
const box = root && root.querySelector('.passe-scene');
const text = root && root.querySelector('.passe-text');
const links = root ? [...root.querySelectorAll('.bon')] : [];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const W = 0.95, H = 1.3, GAP = 2.15, RAIL_Y = 1.95, RAIL_Z = 0.55;

function streaks(w, h, base, spread) { // texture "spazzolata": righe orizzontali casuali
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < h * 6; i++) {
    const v = base + (Math.random() - .5) * spread;
    g.fillStyle = `rgba(${v},${v},${v},.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * w * .6, 1);
  }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; return t;
}

function wrap(g, s, maxW) {
  const out = []; let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  return line ? out.concat(line) : out;
}

function ticketTexture(i, title, desc, aniso) {
  const cw = 760, ch = 1040, c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'), mono = 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace';
  const grd = g.createLinearGradient(0, 0, 0, ch);
  grd.addColorStop(0, '#d9d0bf'); grd.addColorStop(.08, '#f0eadf'); grd.addColorStop(1, '#ece5d7');
  g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
  for (let k = 0; k < 2200; k++) { // fibre della carta
    g.fillStyle = `rgba(90,70,40,${Math.random() * .05})`;
    g.fillRect(Math.random() * cw, Math.random() * ch, 1 + Math.random() * 3, 1);
  }
  const m = 56, dash = (y) => { g.fillStyle = 'rgba(30,25,20,.55)'; for (let x = m; x < cw - m; x += 18) g.fillRect(x, y, 10, 3); };
  g.fillStyle = '#25211c'; g.font = `500 30px ${mono}`;
  g.fillText('SERAFINO RÉSOUT', m, 96);
  g.textAlign = 'right'; if (i === 0) g.fillStyle = '#A33B1A'; // il primo bon (Entreprise) risalta appena
  g.fillText('BON ' + String(i + 1).padStart(2, '0'), cw - m, 96); g.textAlign = 'left';
  g.font = `400 26px ${mono}`; g.fillStyle = '#5a5249'; g.fillText('PASSE · GENÈVE', m, 140);
  dash(170);
  g.fillStyle = '#16130f';
  let y = 290;
  g.font = '500 92px Barlow, system-ui, sans-serif';
  const tl = wrap(g, title.toUpperCase(), cw - 2 * m - 70);
  g.font = `500 44px ${mono}`; g.fillText('1×', m, y - 8);
  g.font = '500 92px Barlow, system-ui, sans-serif';
  for (const l of tl) { g.fillText(l, m + 70, y); y += 88; }
  y += 20; g.font = `400 31px ${mono}`; g.fillStyle = '#3d3731';
  for (const l of wrap(g, desc, cw - 2 * m - 70)) { g.fillText(l, m + 70, y); y += 44; }
  dash(ch - 150);
  g.fillStyle = '#A33B1A'; g.font = `500 36px ${mono}`; g.fillText('→ OUVRIR', m, ch - 86);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; return t;
}

function paper(seed) { // foglio con piega, arricciatura in basso e piccole grinze; perno sul bordo alto
  const geo = new PlaneGeometry(W, H, 24, 32); geo.translate(0, -H / 2, 0);
  const p = geo.attributes.position, r = (k) => Math.sin(seed * 12.9898 + k * 78.233) * .5 + .5;
  const tw = (r(1) - .5) * .09, fold = .38 + r(2) * .2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), v = -y / H, u = x / W + .5, grip = Math.min(1, v / .06);
    let z = .05 * Math.pow(v, 2.4) + tw * (u - .5) * v
      + grip * (.005 * Math.sin(x * 21 + r(3) * 9) * Math.sin(y * 15 + r(4) * 9) + .003 * Math.sin(x * 47 + y * 33 + r(5) * 9))
      + .01 * Math.exp(-Math.pow(v - fold, 2) / .0016) * (r(6) > .5 ? 1 : -1);
    p.setZ(i, z * grip);
  }
  geo.computeVertexNormals(); return geo;
}

function envMap(renderer) { // stanza buia con tre lampade calde: riflessi credibili sull'inox senza scaricare HDR
  const s = new Scene();
  s.add(new Mesh(new BoxGeometry(30, 14, 30), new MeshBasicMaterial({ color: 0x0b0a09, side: BackSide })));
  for (const x of [-6, 0, 6]) {
    const l = new Mesh(new PlaneGeometry(3.4, .7), new MeshBasicMaterial({ color: new Color(6, 3.1, 1.2), side: DoubleSide }));
    l.position.set(x, 6.5, 2); l.rotation.x = Math.PI / 2; s.add(l);
  }
  const f = new Mesh(new PlaneGeometry(16, 5), new MeshBasicMaterial({ color: new Color(.35, .38, .42) }));
  f.position.set(0, 2, 14.5); f.rotation.y = Math.PI; s.add(f);
  const pm = new PMREMGenerator(renderer), t = pm.fromScene(s, .03).texture; pm.dispose(); return t;
}

async function main() {
  if (!root || !links.length) return;
  let renderer;
  try { renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
  const gl = renderer.getContext(), info = gl && gl.getExtension('WEBGL_debug_renderer_info');
  // Rendering software (SwiftShader/llvmpipe): la scena blocca la pagina, resta la versione HTML. ?3d=1 la forza (prove headless).
  if (!gl || (info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) && !/[?&]3d=1/.test(location.search))) { renderer.dispose(); return; }
  try { await document.fonts.load('500 92px Barlow'); } catch (e) { /* senza Barlow si usa system-ui */ }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene(), bg = new Color(0x0d0c0b);
  scene.background = bg; scene.fog = new Fog(bg, 9, 22);
  scene.environment = envMap(renderer); scene.environmentIntensity = .55;
  const cam = new PerspectiveCamera(30, 1, .1, 60);

  const brushed = streaks(1024, 128, 120, 120); brushed.repeat.set(3, 1);
  const steel = new MeshPhysicalMaterial({ color: 0xc9ccd0, metalness: 1, roughness: .42, roughnessMap: brushed, anisotropy: .7, clearcoat: .15, clearcoatRoughness: .4 });
  const steelDark = steel.clone(); steelDark.color.set(0x7d8085); steelDark.roughness = .55;
  const n = links.length, span = (n - 1) * GAP, len = span + 3.6;

  // Banco della passe (piano inox), mensola delle lampade, sbarra porta-bon a profilo a C.
  const counter = new Mesh(new BoxGeometry(len + 6, .12, 3), steel); counter.position.set(0, .2, -.6); counter.receiveShadow = true; scene.add(counter);
  const lip = new Mesh(new BoxGeometry(len + 6, .32, .05), steelDark); lip.position.set(0, .06, .9); scene.add(lip);
  const shelf = new Mesh(new BoxGeometry(len + 6, .07, 1.9), steel); shelf.position.set(0, 2.38, .1); shelf.castShadow = shelf.receiveShadow = true; scene.add(shelf);
  const prof = new Shape();
  prof.moveTo(-.07, -.05); prof.lineTo(-.012, -.05); prof.lineTo(-.012, -.025); prof.lineTo(-.045, -.025); prof.lineTo(-.045, .03);
  prof.lineTo(.045, .03); prof.lineTo(.045, -.025); prof.lineTo(.012, -.025); prof.lineTo(.012, -.05); prof.lineTo(.07, -.05);
  prof.lineTo(.07, .06); prof.lineTo(-.07, .06); prof.closePath();
  const railGeo = new ExtrudeGeometry(prof, { depth: len, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 4 });
  railGeo.rotateY(Math.PI / 2); railGeo.translate(-len / 2, 0, 0);
  const rail = new Mesh(railGeo, steel); rail.position.set(0, RAIL_Y + .05, RAIL_Z); rail.castShadow = true; scene.add(rail);
  for (const x of [-len / 2 + .3, 0, len / 2 - .3]) {
    const b = new Mesh(new BoxGeometry(.06, .3, .1), steelDark); b.position.set(x, RAIL_Y + .25, RAIL_Z); scene.add(b);
  }
  const wall = new Mesh(new PlaneGeometry(60, 20), new MeshStandardMaterial({ color: 0x1b1916, roughness: .85 }));
  wall.position.set(0, 4, -2.4); wall.receiveShadow = true; scene.add(wall);

  // Lampade riscaldanti: cappe inox con il vetro acceso e una luce spot calda, radente sul fronte dei bon.
  const hoodMat = steel.clone(); hoodMat.side = DoubleSide; hoodMat.roughnessMap = null; hoodMat.anisotropy = 0;
  const lampXs = [];
  for (let x = -span / 2 - .2; x <= span / 2 + .3; x += Math.max(GAP * 1.5, span / 2)) lampXs.push(x);
  lampXs.forEach((x, k) => {
    const g = new Group(); g.position.set(x, 2.3, 1.15);
    const hood = new Mesh(new CylinderGeometry(.16, .3, .22, 48, 1, true), hoodMat); hood.position.y = -.11;
    const glow = new Mesh(new CircleGeometry(.2, 40), new MeshBasicMaterial({ color: new Color(5, 2.2, .7) }));
    glow.rotation.x = Math.PI / 2; glow.position.y = -.12;
    g.add(hood, glow); scene.add(g);
    const s = new SpotLight(0xffa860, 16, 7, .7, 1, 1.6); // pozza calda sul banco, davanti ai bon
    s.position.set(x, 2.15, 1.25); s.target.position.set(x, .2, 1.1);
    scene.add(s, s.target);
  });
  scene.add(new HemisphereLight(0x9fb2c8, 0x1a120a, .35));
  // Luce principale: calda, alta e davanti, radente sulla carta; ombre dei bon sul banco e sulla mensola.
  const key = new SpotLight(0xffc28a, 140, 0, .55, 1, 2); key.position.set(0, 6.2, 4.6); key.target.position.set(0, 1.2, .4);
  key.castShadow = true; key.shadow.mapSize.set(2048, 1024); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new SpotLight(0xdfe6ee, 20, 18, .5, 1, 1.4); fill.position.set(0, 1.4, 9); fill.target.position.set(0, 1.4, 0); scene.add(fill, fill.target);

  // I bon: carta con stampa, ciascuno con la sua molla (dondolio laterale az, avanti/indietro ax).
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const bons = links.map((a, i) => {
    const map = ticketTexture(i, a.querySelector('strong').textContent, a.querySelector('.bon-desc').textContent, aniso);
    const mesh = new Mesh(paper(i + 1), new MeshStandardMaterial({ map, roughness: .92, metalness: 0, side: DoubleSide }));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(-span / 2 + i * GAP, RAIL_Y, RAIL_Z + .02);
    scene.add(mesh);
    const b = { a, mesh, az: 0, vz: 0, ax: 0, vx: 0, hot: 0, rest: (i % 2 ? 1 : -1) * .018 };
    const on = () => { b.hot = 1; b.vz += (Math.random() - .5) * 1.2; }, off = () => { b.hot = 0; };
    a.addEventListener('pointerenter', on); a.addEventListener('focus', on);
    a.addEventListener('pointerleave', off); a.addEventListener('blur', off);
    return b;
  });

  box.appendChild(renderer.domElement);
  root.classList.add('on'); if (!still) root.classList.add('dolly');

  let vw = 1, vh = 1;
  const resize = () => {
    vw = box.clientWidth; vh = box.clientHeight;
    renderer.setSize(vw, vh, false); cam.aspect = vw / vh; cam.updateProjectionMatrix(); draw(0);
  };

  // Regia: p=0 inquadratura larga sotto il titolo; scorrendo la camera si avvicina e scivola lungo la sbarra.
  const pos = new Vector3(), look = new Vector3(), tp = new Vector3(), tl = new Vector3();
  const shot = (p, P, L) => {
    const fit = Math.max(1, (span + 2.4) / (2 * Math.tan(15 * Math.PI / 180) * cam.aspect) / 8.4);
    const q = Math.min(1, p / .22), e = q * q * (3 - 2 * q), d = Math.max(0, (p - .12) / .88);
    P.set(-span / 2 * e + span * d * e - .4 * e, .85 + .5 * e, 8.4 * fit * (1 - e) + 4.3 * e);
    L.set(P.x * (1 - e) + (P.x + .9) * e, 2.15 - .55 * e, RAIL_Z);
  };
  const progress = () => {
    if (still) return 0;
    const r = root.getBoundingClientRect(), h = r.height - innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, -r.top / h)) : 0;
  };
  let mx = 0, lastX = null, push = 0;
  addEventListener('pointermove', (e) => {
    if (lastX !== null) push += (e.clientX - lastX) / innerWidth;
    lastX = e.clientX; mx = e.clientX;
  }, { passive: true });

  const v = new Vector3(), corners = [[-W / 2, 0], [W / 2, 0], [-W / 2, -H], [W / 2, -H]];
  function place(b) { // proietta il bon sullo schermo e ci appoggia sopra il suo <a>
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy] of corners) {
      v.set(cx, cy, 0); b.mesh.localToWorld(v); v.project(cam);
      const sx = (v.x * .5 + .5) * vw, sy = (-v.y * .5 + .5) * vh;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const s = b.a.style;
    s.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`; s.width = (x1 - x0).toFixed(1) + 'px'; s.height = (y1 - y0).toFixed(1) + 'px';
  }

  let t = 0, first = true;
  function draw(dt) {
    const p = progress();
    shot(p, tp, tl);
    const k = first || still ? 1 : 1 - Math.exp(-dt * 5);
    pos.lerp(tp, k); look.lerp(tl, k); first = false;
    cam.position.copy(pos); cam.lookAt(look);
    text.style.transform = `translateY(${(-p * 60).toFixed(2)}vh)`;
    text.style.opacity = Math.max(0, 1 - p * 7).toFixed(3);
    t += dt;
    for (const [i, b] of bons.entries()) {
      if (!still) {
        const sx = ((b.mesh.position.x - pos.x) / 3) * innerWidth / 2 + innerWidth / 2, near = Math.exp(-Math.pow((mx - sx) / 260, 2));
        b.vz += push * near * 9;
        const breeze = Math.sin(t * .7 + i * 1.7) * .006;
        b.vz += (-26 * (b.az - b.rest - breeze) - 2.6 * b.vz) * dt; b.az += b.vz * dt;
        const ax0 = -.16 * b.hot;
        b.vx += (-22 * (b.ax - ax0) - 3 * b.vx) * dt; b.ax += b.vx * dt;
      } else b.az = b.rest;
      b.mesh.rotation.set(b.ax, 0, b.az);
      b.mesh.updateMatrixWorld();
      place(b);
    }
    push = 0;
    renderer.render(scene, cam);
  }

  pos.set(0, 0, 0); resize();
  renderer.domElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: still ? 0 : 900, easing: 'ease-out' });
  new ResizeObserver(resize).observe(box);
  if (still) return;
  let run = false, prev = 0;
  const loop = (now) => { if (!run) return; draw(Math.min(.05, (now - prev) / 1000)); prev = now; requestAnimationFrame(loop); };
  new IntersectionObserver((e) => {
    const vis = e[0].isIntersecting;
    if (vis && !run) { run = true; prev = performance.now(); requestAnimationFrame(loop); }
    run = vis;
  }).observe(stage);
}

main();
