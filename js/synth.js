// 合成图绘制：按固定随机种子生成道路场景、事件流、检测框与热力图。
// 若记录中填写了 image_url（例如 "images/xxx.jpg"），则用真实图片替代合成场景，检测框照常叠加。
(function () {
  const HZ = 200; // 地平线（640×480 坐标系）
  const seedOf = (s) => { let h = 7; for (const c of String(s)) h = (h * 131 + c.charCodeAt(0)) >>> 0; return h; };
  const imgCache = {};
  const loadImg = (url) => imgCache[url] || (imgCache[url] = new Promise((ok) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url;
  }));

  function sky(ctx, w, scene) {
    const g = ctx.createLinearGradient(0, 0, 0, HZ);
    if (scene === '夜间低照度') { g.addColorStop(0, '#05070d'); g.addColorStop(1, '#1a1f2c'); }
    else if (scene === '强光对比') { g.addColorStop(0, '#fdfdf6'); g.addColorStop(1, '#e9eef0'); }
    else { g.addColorStop(0, '#8fb4d8'); g.addColorStop(1, '#d4e0ea'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, HZ);
  }
  function buildings(ctx, r, scene) {
    const night = scene === '夜间低照度';
    for (const side of [0, 1]) {
      let x = side ? 420 : 0;
      while (x < (side ? 640 : 220)) {
        const bw = 30 + r() * 50, bh = 50 + r() * 110;
        const v = night ? 18 + r() * 14 : 95 + r() * 60;
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
        ctx.fillRect(x, HZ - bh, bw, bh + 6);
        for (let wy = HZ - bh + 8; wy < HZ - 8; wy += 14) for (let wx = x + 5; wx < x + bw - 8; wx += 11) {
          ctx.fillStyle = night ? (r() < 0.35 ? '#f2c96a' : '#1c2230') : (r() < 0.5 ? '#6f8aa3' : '#a9bccb');
          ctx.fillRect(wx, wy, 6, 8);
        }
        x += bw + 2;
      }
    }
  }
  function road(ctx, w, h, scene) {
    const night = scene === '夜间低照度';
    ctx.fillStyle = night ? '#141518' : scene === '强光对比' ? '#7d7f80' : '#5d6064';
    ctx.fillRect(0, HZ, w, h - HZ);
    ctx.fillStyle = night ? '#1d1e22' : '#4a4d50';
    ctx.beginPath(); ctx.moveTo(300, HZ); ctx.lineTo(340, HZ); ctx.lineTo(760, h); ctx.lineTo(-120, h); ctx.fill();
    ctx.fillStyle = night ? '#23262b' : '#8c8f88'; // 人行道
    ctx.beginPath(); ctx.moveTo(0, HZ + 6); ctx.lineTo(300, HZ); ctx.lineTo(-120, h); ctx.lineTo(0, h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(640, HZ + 6); ctx.lineTo(340, HZ); ctx.lineTo(760, h); ctx.lineTo(640, h); ctx.fill();
    ctx.strokeStyle = night ? '#8a8a70' : '#e8e6d8';
    for (const k of [-0.33, 0.33]) {
      for (let t = 0.05; t < 1; t += 0.12) {
        const y1 = HZ + (h - HZ) * t * t, y2 = HZ + (h - HZ) * Math.min(1, (t + 0.06) * (t + 0.06));
        const x1 = 320 + k * (y1 - HZ) * 2.6, x2 = 320 + k * (y2 - HZ) * 2.6;
        ctx.lineWidth = 1 + 5 * t; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  }
  function car(ctx, b, r, scene) {
    const cols = ['#c9ccd1', '#2b2f36', '#8a1f22', '#1f3f73', '#e7e7e2', '#5b5f63'];
    const c = cols[Math.floor(r() * cols.length)];
    const { x, y, w, h } = b;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 2, y + h - 4, w - 4, 6);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h * 0.42); ctx.lineTo(x + w * 0.28, y + h * 0.05); ctx.lineTo(x + w * 0.72, y + h * 0.05);
    ctx.lineTo(x + w * 0.82, y + h * 0.42); ctx.fill();
    ctx.fillRect(x, y + h * 0.4, w, h * 0.5);
    ctx.fillStyle = '#273544'; ctx.fillRect(x + w * 0.27, y + h * 0.1, w * 0.46, h * 0.28);
    ctx.fillStyle = '#111'; ctx.fillRect(x + w * 0.06, y + h * 0.86, w * 0.16, h * 0.14); ctx.fillRect(x + w * 0.78, y + h * 0.86, w * 0.16, h * 0.14);
    const night = scene === '夜间低照度';
    ctx.fillStyle = night ? '#ff4a3a' : '#c0352c';
    if (night) { ctx.shadowColor = '#ff3020'; ctx.shadowBlur = 14; }
    ctx.fillRect(x + w * 0.04, y + h * 0.5, w * 0.14, h * 0.1); ctx.fillRect(x + w * 0.82, y + h * 0.5, w * 0.14, h * 0.1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8e2c8'; ctx.fillRect(x + w * 0.38, y + h * 0.66, w * 0.24, h * 0.1);
  }
  function ped(ctx, b, r, scene) {
    const { x, y, w, h } = b;
    ctx.fillStyle = scene === '夜间低照度' ? '#3a3632' : ['#2d3e5c', '#5c2d2d', '#3b4a32'][Math.floor(r() * 3)];
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.09, h * 0.08, 0, 7); ctx.fillStyle = '#c9a07a'; ctx.fill();
    ctx.fillStyle = scene === '夜间低照度' ? '#3a3632' : '#2d3e5c';
    ctx.fillRect(x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.4);
    ctx.fillStyle = '#20242b'; ctx.fillRect(x + w * 0.24, y + h * 0.58, w * 0.2, h * 0.42); ctx.fillRect(x + w * 0.56, y + h * 0.58, w * 0.2, h * 0.42);
  }
  // 生成事件点：沿运动物体与道路结构边缘采样，带极性与时间戳 t∈[0,1)
  function events(rec, density = 1) {
    const r = U.rng(seedOf(rec.record_no || rec.seq_name) + 99);
    const pts = [];
    const push = (x, y, n, jit) => { for (let i = 0; i < n; i++) pts.push([x + (r() - 0.5) * jit, y + (r() - 0.5) * jit, r() < 0.52 ? 1 : -1, r()]); };
    const edge = (x1, y1, x2, y2, n, jit) => { for (let i = 0; i < n; i++) { const t = r(); push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1, jit); } };
    const k = density * (rec.scene === '高速运动' ? 1.6 : rec.scene === '夜间低照度' ? 0.7 : 1);
    for (const b of rec.boxes || []) {
      const n = Math.floor((b.w + b.h) * 4 * k);
      edge(b.x, b.y, b.x + b.w, b.y, n / 4, 4); edge(b.x, b.y + b.h, b.x + b.w, b.y + b.h, n / 4, 4);
      edge(b.x, b.y, b.x, b.y + b.h, n / 4, 5); edge(b.x + b.w, b.y, b.x + b.w, b.y + b.h, n / 4, 5);
      for (let i = 0; i < n * 0.6; i++) push(b.x + r() * b.w, b.y + r() * b.h, 1, 2);
    }
    edge(320, HZ, 80, 480, 900 * k, 3); edge(320, HZ, 560, 480, 900 * k, 3);
    edge(300, HZ, -120, 480, 700 * k, 3); edge(340, HZ, 760, 480, 700 * k, 3);
    edge(0, HZ, 640, HZ, 500 * k, 6);
    for (let i = 0; i < 26; i++) { const x = r() * 640; edge(x, HZ - 40 - r() * 100, x, HZ, 60 * k, 3); }
    for (let i = 0; i < 1600 * k; i++) push(r() * 640, r() * 480, 1, 0); // 背景噪声
    return pts;
  }
  function drawEvents(ctx, pts, alpha = 1) {
    for (const [x, y, p] of pts) {
      ctx.fillStyle = p > 0 ? `rgba(255,70,70,${alpha})` : `rgba(70,140,255,${alpha})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  function drawBoxes(ctx, boxes) {
    ctx.font = 'bold 13px Microsoft YaHei, sans-serif';
    for (const b of boxes || []) {
      const c = b.cls === 'car' ? '#3fe0c0' : '#f0a43a';
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
      const t = `${b.cls} ${Number(b.score).toFixed(2)}`;
      const tw = ctx.measureText(t).width + 8;
      ctx.fillStyle = c; ctx.fillRect(b.x - 1, b.y - 17, tw, 17);
      ctx.fillStyle = '#04121c'; ctx.fillText(t, b.x + 3, b.y - 4);
    }
  }
  // 颜色映射 v∈[0,1]
  function jet(v) {
    v = Math.max(0, Math.min(1, v));
    const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3))), g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2))), b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1)));
    return [r * 255, g * 255, b * 255];
  }
  // 把 gw×gh 网格值上采样绘制为平滑热力图
  function heat(ctx, w, h, grid, gw, gh, alpha, cmap = jet, fade = false) {
    const c = document.createElement('canvas'); c.width = gw; c.height = gh;
    const g = c.getContext('2d'); const im = g.createImageData(gw, gh);
    const mx = Math.max(...grid) || 1;
    grid.forEach((v, i) => { const [r, gg, b] = cmap(v / mx); im.data.set([r, gg, b, fade ? Math.min(255, 60 + 330 * v / mx) : 255], i * 4); });
    g.putImageData(im, 0, 0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, w, h); ctx.restore();
  }
  function gridFromPts(pts, gw, gh, w, h) {
    const g = new Array(gw * gh).fill(0);
    for (const [x, y] of pts) { const i = Math.floor(x / w * gw), j = Math.floor(y / h * gh); if (i >= 0 && i < gw && j >= 0 && j < gh) g[j * gw + i]++; }
    return g;
  }
  async function base(ctx, w, h, rec) {
    if (rec.image_url) {
      const im = await loadImg(rec.image_url);
      if (im) { ctx.drawImage(im, 0, 0, w, h); return; }
    }
    const r = U.rng(seedOf(rec.seq_name));
    sky(ctx, w, rec.scene); buildings(ctx, r, rec.scene); road(ctx, w, h, rec.scene);
    const rc = U.rng(seedOf(rec.record_no || rec.seq_name));
    const bs = [...(rec.boxes || [])].sort((a, b) => a.y + a.h - (b.y + b.h));
    for (const b of bs) (b.cls === 'car' ? car : ped)(ctx, b, rc, rec.scene);
    if (rec.scene === '强光对比') {
      const g = ctx.createRadialGradient(520, 70, 10, 520, 70, 260); g.addColorStop(0, 'rgba(255,255,250,.95)'); g.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (rec.scene === '夜间低照度') { ctx.fillStyle = 'rgba(0,0,10,.35)'; ctx.fillRect(0, 0, w, h); }
  }
  const evCache = {};
  const eventsOf = (rec, d = 1) => { const k = (rec.record_no || rec.seq_name) + '|' + d; return evCache[k] || (evCache[k] = events(rec, d)); };
  // SGF：事件节点按 16×12 网格做 Scatter-Mean 聚合（此处以网格内事件活跃度近似语义响应）
  const sgfGrid = (rec) => {
    const g = gridFromPts(eventsOf(rec), 16, 12, 640, 480);
    return g.map((v) => Math.tanh(v / 60));
  };
  // ADG 通道门控权重：w_c = 1 + β(2σ(z)-1)，返回 64 个通道
  const channelGate = (rec, beta = 0.5) => {
    const r = U.rng(seedOf(rec.record_no || rec.seq_name) + 7);
    const act = Math.min(1, eventsOf(rec).length / 9000);
    return Array.from({ length: 64 }, (_, i) => {
      const z = (r() - 0.5) * 4 + (i % 8 < 3 ? act * 1.5 : -act * 0.6);
      return Number((1 + beta * (2 / (1 + Math.exp(-z)) - 1)).toFixed(3));
    });
  };
  const Synth = {
    eventsOf, sgfGrid, channelGate, jet,
    rgb: (rec, showBox = true) => async (ctx, w, h) => { await base(ctx, w, h, rec); if (showBox) drawBoxes(ctx, rec.boxes); },
    event: (rec, showBox = true) => (ctx, w, h) => {
      ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, w, h);
      drawEvents(ctx, eventsOf(rec)); if (showBox) drawBoxes(ctx, rec.boxes);
    },
    eventDark: (rec, dt = 50) => (ctx, w, h) => {
      ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, w, h);
      const pts = eventsOf(rec); const keep = Math.min(1, dt / 50);
      drawEvents(ctx, pts.filter((p) => p[3] < keep));
    },
    fusion: (rec) => async (ctx, w, h) => { await base(ctx, w, h, rec); drawEvents(ctx, eventsOf(rec, 0.8), 0.85); drawBoxes(ctx, rec.boxes); },
    sgf: (rec) => async (ctx, w, h) => {
      await base(ctx, w, h, rec); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, w, h);
      heat(ctx, w, h, sgfGrid(rec), 16, 12, 0.85, jet, true);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
      for (let i = 1; i < 16; i++) { ctx.beginPath(); ctx.moveTo(i * w / 16, 0); ctx.lineTo(i * w / 16, h); ctx.stroke(); }
      for (let j = 1; j < 12; j++) { ctx.beginPath(); ctx.moveTo(0, j * h / 12); ctx.lineTo(w, j * h / 12); ctx.stroke(); }
    },
    adg: (rec) => (ctx, w, h) => {
      // 空间门控 s = σ(Conv(局部事件特征))，用 64×48 网格事件密度近似
      const g = gridFromPts(eventsOf(rec), 64, 48, 640, 480);
      const mx = Math.max(...g) || 1;
      const s = g.map((v) => 1 / (1 + Math.exp(-(v / mx * 10 - 2.2))));
      const viridis = (v) => [68 + 185 * v, 1 + 230 * v * (1.1 - v * 0.2), 84 + 60 * Math.sin(v * 3)];
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      heat(ctx, w, h, s, 64, 48, 1, viridis);
      drawBoxes(ctx, rec.boxes);
    },
    // 时空图：从事件中抽取节点，半径内 k 近邻连边
    graph: (rec, cfg) => (ctx, w, h) => {
      const r = U.rng(seedOf(rec.record_no) + 3);
      const pts = eventsOf(rec).filter(() => r() < 0.09).slice(0, 700);
      const R = (cfg.radius || 0.01) * 640 * 3.2, K = Math.min(cfg.max_neighbors || 16, 8);
      ctx.fillStyle = '#060b16'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(63,224,192,.28)'; ctx.lineWidth = 0.8;
      let edges = 0;
      for (let i = 0; i < pts.length; i++) {
        const nb = [];
        for (let j = 0; j < pts.length; j++) {
          if (i === j) continue;
          const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dt = (pts[i][3] - pts[j][3]) * 40;
          const d = Math.sqrt(dx * dx + dy * dy + dt * dt); if (d < R) nb.push([d, j]);
        }
        nb.sort((a, b) => a[0] - b[0]);
        for (const [, j] of nb.slice(0, K)) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); edges++; }
      }
      for (const [x, y, p] of pts) { ctx.fillStyle = p > 0 ? '#ff5a5a' : '#4d9bff'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
      return { nodes: pts.length, edges };
    },
  };
  window.Synth = Synth;
})();
