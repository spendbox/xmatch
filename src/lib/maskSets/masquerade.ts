// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Masquerades and carved masks from Nigeria and across Africa: Lagbaja, the Eyo groups,
 * Gelede, Mmanwu, Ekpo and Ekpe, the Benin ivory and bronze heads, Nok, and classic carved masks
 * (Dan, Punu, Fang, Baule, Chokwe, Kota, Bwa, Dogon, Senufo, Kuba, Songye and more).
 * Every outline covers the whole face; eyes are painted, carved or covered with dark mesh.
 */

export function masqueradeSet(k) {
  const { OUT, ink, gem, trimLine, mirror, both, glossy, scallops } = k;

  // ---------- Shared pieces ----------
  // A cloth hood that covers the whole head
  const HOOD = "M100 24 C152 24 172 68 170 112 C168 152 150 182 100 188 C50 182 32 152 30 112 C28 68 48 24 100 24Z";
  const TALL = "M100 30 C142 30 160 64 158 104 C156 140 140 178 100 184 C60 178 44 140 42 104 C40 64 58 30 100 30Z";
  const HEAD = "M100 46 C140 46 158 76 156 108 C154 144 134 176 100 180 C66 176 46 144 44 108 C42 76 60 46 100 46Z";
  const LONG = "M100 44 C134 44 154 72 152 104 C150 140 130 186 100 194 C70 186 50 140 48 104 C46 72 66 44 100 44Z";

  const wood = (p, id = "wood") => `<linearGradient id="${id}" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="0.45" stop-color="${p.base}"/><stop offset="1" stop-color="${p.deep}"/></linearGradient>`;
  const grain = (p) => Array.from({ length: 14 }, (_, i) => `<path d="M${38 + i * 9} 30 C${34 + i * 9} 90 ${44 + i * 9} 140 ${38 + i * 9} 196" fill="none" stroke="${p.deep}" stroke-opacity="0.13" stroke-width="1.2"/>`).join("");
  // Dark gauze over the eyes (you can't see through it in the photo)
  const mesh = (d, c = "#120c18") => `<path d="${d}" fill="${c}"/><path d="${d}" fill="url(#mesh)"/>`;
  const meshDef = `<pattern id="mesh" patternUnits="userSpaceOnUse" width="3" height="3"><path d="M0 0 L3 3 M3 0 L0 3" stroke="#fff" stroke-opacity="0.13" stroke-width="0.4"/></pattern>`;
  const cowrie = (x, y, r = 4, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.4}" fill="url(#shell)" stroke="#a88c6a" stroke-width="0.5"/><path d="M${x} ${y - r} C${x - r * 0.35} ${y - r * 0.4} ${x - r * 0.35} ${y + r * 0.4} ${x} ${y + r}" stroke="#7a5a3a" stroke-width="1" fill="none"/></g>`;
  const beads = (pts, r, cols) => pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${cols[i % cols.length]}"/><circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" r="${r * 0.3}" fill="#fff" opacity="0.6"/>`).join("");
  const arc = (cx, cy, rx, ry, a0, a1, n) => Array.from({ length: n }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const scars = (c, w = 2) => ink(both("M58 120 L60 136 M64 118 L66 134 M70 120 L72 136"), c, w);
  const paintedEye = (d, white = "#f4eee4", pupil = "#1c1828") => `<path d="${d}" fill="${white}"/><path d="${d}" fill="none" stroke="#1c1828" stroke-width="1.6"/><circle cx="78" cy="104" r="4.6" fill="${pupil}"/><circle cx="122" cy="104" r="4.6" fill="${pupil}"/>`;
  const out = [];
  const add = (m) => out.push({ cat: "masquerade", ...m });

  // ---------- Lagbaja: a cloth head covering, no face, the person is "nobody in particular" ----------
  const LAG = [
    ["lagbaja", "Lagbaja", "#c2122a", (p) => [p.alt, "#1c1828", "#f4eee4", p.base, "#ffc61a", "#1c1828", p.alt2]],
    ["lagbaja-adire", "Lagbaja Adire", "#253a8f", null, "adire"],
    ["lagbaja-kente", "Lagbaja Kente", "#e8b143", null, "kente"],
    ["lagbaja-asooke", "Lagbaja Aso-oke", "#7a1430", (p) => [p.base, p.light, "#e8b143", p.base, p.deep, "#e8b143"]],
    ["lagbaja-ankara", "Lagbaja Ankara", "#f2741f", null, "ankara"],
    ["lagbaja-black", "Lagbaja Night", "#1d1a26", (p) => ["#1d1a26", "#f4eee4", "#1d1a26", "#3a3448", "#1d1a26", "#f4eee4"]],
    ["lagbaja-patch", "Lagbaja Patchwork", "#1f9d6b", null, "patch"],
    ["lagbaja-zigzag", "Lagbaja Zigzag", "#5b3fd9", null, "zigzag"],
  ];
  for (const [id, name, color, stripes, kind] of LAG) {
    add({
      id, name, color, shape: HOOD, rim: "soft",
      back: (p) => meshDef + `<path d="M58 168 L56 200 M66 172 L65 204 M74 176 L74 206 M82 178 L83 208 M90 180 L91 208 M100 180 L100 210 M110 180 L109 208 M118 178 L117 208 M126 176 L126 206 M134 172 L135 204 M142 168 L144 200" stroke="${p.deep}" stroke-width="5" stroke-linecap="round"/><path d="M92 26 C90 14 96 4 100 0 C104 4 110 14 108 26Z" fill="${p.dark}"/>`,
      pattern: (p) => {
        let s = "";
        if (kind === "adire") {
          s += `<rect x="20" y="20" width="160" height="180" fill="#1b2a6b"/>` + Array.from({ length: 30 }, (_, i) => { const x = 36 + (i % 6) * 26 + (Math.floor(i / 6) % 2) * 13, y = 40 + Math.floor(i / 6) * 30; return `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#dfe8ff" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="${x}" cy="${y}" r="2.6" fill="#dfe8ff"/>`; }).join("");
        } else if (kind === "kente") {
          for (let y = 20; y < 200; y += 16) for (let x = 20; x < 180; x += 16) { const c = ((x + y) / 16) % 4; s += `<rect x="${x}" y="${y}" width="16" height="16" fill="${["#e8b143", "#1f7a3a", "#c2122a", "#1c1828"][c]}"/>${c % 2 ? `<path d="M${x} ${y + 4} L${x + 16} ${y + 4} M${x} ${y + 8} L${x + 16} ${y + 8} M${x} ${y + 12} L${x + 16} ${y + 12}" stroke="#e8b143" stroke-width="1.2"/>` : `<path d="M${x + 4} ${y} L${x + 4} ${y + 16} M${x + 8} ${y} L${x + 8} ${y + 16} M${x + 12} ${y} L${x + 12} ${y + 16}" stroke="#1c1828" stroke-opacity="0.5" stroke-width="1.2"/>`}`; }
        } else if (kind === "ankara") {
          s += `<rect x="20" y="20" width="160" height="180" fill="${p.base}"/>` + [[52, 50], [100, 60], [148, 50], [64, 110], [136, 110], [100, 150], [52, 170], [148, 170]].map(([x, y], i) => [18, 13, 8, 4].map((r, j) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${[p.alt, "#1c1828", p.pale, p.deep, "#ffc61a"][(i + j) % 5]}"/>`).join("")).join("");
        } else if (kind === "patch") {
          const cols = [p.base, "#c2122a", "#ffc61a", "#1c1828", "#f4eee4", p.alt, "#253a8f", p.deep];
          for (let y = 20; y < 200; y += 26) for (let x = 20; x < 180; x += 26) s += `<rect x="${x}" y="${y}" width="26" height="26" fill="${cols[(x * 3 + y * 7) % cols.length]}"/><rect x="${x + 1.5}" y="${y + 1.5}" width="23" height="23" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="0.8" stroke-dasharray="2 2"/>`;
        } else if (kind === "zigzag") {
          for (let y = 20, i = 0; y < 200; y += 12, i++) s += `<path d="M20 ${y} ${Array.from({ length: 17 }, (_, j) => `L${20 + j * 10} ${y + (j % 2 ? 10 : 0)}`).join(" ")} L180 ${y + 12} L20 ${y + 12}Z" fill="${[p.base, "#1c1828", "#f4eee4", p.alt][i % 4]}"/>`;
        } else {
          const cols = stripes(p);
          for (let x = 20, i = 0; x < 180; i++) { const w = [12, 6, 4, 10, 4, 8, 14][i % 7]; s += `<rect x="${x}" y="20" width="${w}" height="180" fill="${cols[i % cols.length]}"/>`; x += w; }
        }
        // The weave of the cloth and a seam down the middle
        s += `<rect x="20" y="20" width="160" height="180" fill="url(#weave)"/><path d="M100 24 L100 188" stroke="#000" stroke-opacity="0.25" stroke-width="1.4" stroke-dasharray="3 2"/>`;
        return `<pattern id="weave" patternUnits="userSpaceOnUse" width="4" height="4"><path d="M0 1 L4 1 M0 3 L4 3" stroke="#000" stroke-opacity="0.1" stroke-width="0.6"/></pattern>` + s;
      },
      eyes: () => mesh(both("M64 100 C70 96 86 96 92 100 L92 106 C86 109 70 109 64 106Z")),
      front: (p) => `<path d="M100 118 C96 126 94 134 100 140 C106 134 104 126 100 118Z" fill="#000" opacity="0.12"/>`,
    });
  }

  // ---------- Eyo (Adamu Orisha play, Lagos): all in white, the face veiled, a wide hat in the group's colour ----------
  const EYO = [
    ["eyo-adimu", "Eyo Adimu", "#1d1a26"],
    ["eyo-laba", "Eyo Laba", "#d92f3a"],
    ["eyo-oniko", "Eyo Oniko", "#f5c518"],
    ["eyo-ologede", "Eyo Ologede", "#1f9d4a"],
    ["eyo-agere", "Eyo Agere", "#6b2fbf"],
  ];
  for (const [id, name, color] of EYO) {
    add({
      id, name, color, shape: HOOD, rim: "soft", face: () => "url(#ivory)",
      back: (p) => meshDef + `<path d="M24 120 C30 160 40 196 60 214 L140 214 C160 196 170 160 176 120Z" fill="#f7f5f0"/>${ink("M50 150 C54 176 58 196 66 212 M150 150 C146 176 142 196 134 212 M100 190 L100 214", "#d8d2c6", 1.6)}`,
      pattern: () => ink("M50 120 C70 128 130 128 150 120 M44 140 C70 150 130 150 156 140 M48 160 C72 170 128 170 152 160", "#d8d2c6", 1.4) + mesh("M58 92 C74 88 126 88 142 92 L140 112 C124 116 76 116 60 112Z", "#2a2630"),
      eyes: () => "",
      top: (p) => `<ellipse cx="100" cy="58" rx="80" ry="18" fill="${p.dark}"/><ellipse cx="100" cy="54" rx="80" ry="16" fill="${p.base}"/><path d="M62 54 C62 22 80 8 100 8 C120 8 138 22 138 54Z" fill="${p.base}"/><path d="M62 54 C62 22 80 8 100 8 C120 8 138 22 138 54Z" fill="url(#under)"/><path d="M64 44 C88 50 112 50 136 44 L137 52 C112 58 88 58 63 52Z" fill="${p.deep}" opacity="0.6"/>${glossy(84, 24, 12, 5, -20, 0.35)}${ink("M100 8 L100 -6", p.deep, 2.4)}<circle cx="100" cy="-8" r="4" fill="${p.light}"/>`,
    });
  }

  // ---------- Gelede (Yoruba): a calm carved face, with a grand headdress ----------
  const GEL = [
    ["gelede", "Gelede", "#b0713a", "gele"],
    ["gelede-birds", "Gelede Birds", "#9a5a2c", "birds"],
    ["gelede-crown", "Gelede Crown", "#c08048", "crown"],
    ["gelede-snake", "Gelede Serpent", "#8a4e22", "snake"],
    ["gelede-braids", "Gelede Braids", "#a8663a", "braids"],
  ];
  for (const [id, name, color, head] of GEL) {
    add({
      id, name, color, shape: HEAD, rim: "soft", face: () => "url(#wood)",
      back: (p) => wood(p) + ({
        gele: `<path d="M34 92 C20 60 40 18 100 14 C160 18 180 60 166 92 C150 70 130 62 100 62 C70 62 50 70 34 92Z" fill="${p.alt}"/><path d="M40 78 C60 40 140 40 160 78 M48 62 C70 30 130 30 152 62" fill="none" stroke="${p.alt2}" stroke-width="5"/><path d="M150 40 C176 22 190 40 172 56 C168 46 160 42 150 46Z" fill="${p.alt}"/>`,
        birds: `<path d="M40 74 C40 40 70 26 100 26 C130 26 160 40 160 74Z" fill="${p.dark}"/>` + [[66, 18, -1], [100, 6, 1], [134, 18, 1]].map(([x, y, s]) => `<path d="M${x - 14} ${y + 10} C${x - 8} ${y - 6} ${x + 8} ${y - 6} ${x + 12} ${y + 2} L${x + 22 * s} ${y - 2} L${x + 12} ${y + 8} C${x + 6} ${y + 16} ${x - 8} ${y + 16} ${x - 14} ${y + 10}Z" fill="url(#wood)" stroke="${p.deep}" stroke-width="0.8"/><circle cx="${x + 6}" cy="${y + 2}" r="1.6" fill="#1c1828"/>`).join(""),
        crown: `<path d="M42 72 L44 30 L62 46 L78 18 L92 40 L100 8 L108 40 L122 18 L138 46 L156 30 L158 72Z" fill="url(#metal)"/>` + beads(arc(100, 64, 58, 8, 200, 340, 14), 3, ["#d92f3a", "#1f9d6b", "#f4eee4"]),
        snake: `<path d="M40 74 C40 40 70 26 100 26 C130 26 160 40 160 74Z" fill="${p.dark}"/><path d="M36 64 C50 30 80 50 100 26 C120 4 150 22 166 46 C172 56 160 62 156 54 C146 34 126 26 112 42 C96 62 66 48 50 70Z" fill="#3c6b2a" stroke="#1f3a14" stroke-width="1"/>${ink("M44 62 C60 46 84 54 100 34 C116 16 142 26 156 46", "#a6d39a", 1, 'stroke-dasharray="3 3"')}<circle cx="160" cy="52" r="2" fill="#ffc61a"/>`,
        braids: Array.from({ length: 9 }, (_, i) => { const x = 52 + i * 12; return `<path d="M${x} 66 C${x - 4} 40 ${x + 2} 20 ${x} ${6 + Math.abs(i - 4) * 4}" stroke="#1c1828" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M${x} 66 C${x - 4} 40 ${x + 2} 20 ${x} ${6 + Math.abs(i - 4) * 4}" stroke="#3a3448" stroke-width="3" stroke-dasharray="3 3" fill="none"/>`; }).join("") + `<path d="M44 74 C44 50 70 40 100 40 C130 40 156 50 156 74Z" fill="#1c1828"/>`,
      })[head],
      pattern: (p) => grain(p) + `<path d="M48 70 C70 56 130 56 152 70 L152 78 C130 66 70 66 48 78Z" fill="${p.deep}" opacity="0.5"/>` + scars(p.deep, 2.2) + ink(both("M60 90 C70 84 86 84 94 90"), p.deep, 2.4),
      eyes: (p) => paintedEye(both("M62 104 C68 96 88 96 94 104 C88 110 68 110 62 104Z")) + ink(both("M60 104 C68 92 88 92 96 104"), p.deep, 2.6),
      front: (p) => `<path d="M96 104 L92 132 C96 136 104 136 108 132 L104 104Z" fill="${p.dark}" opacity="0.35"/><path d="M84 148 C92 144 108 144 116 148 C108 156 92 156 84 148Z" fill="${p.deep}"/>${ink("M84 148 L116 148", "#1c1828", 1.4)}`,
    });
  }

  // ---------- Mmanwu (Igbo): the maiden spirit and others ----------
  add({
    id: "mmanwu-maiden", name: "Agbogho Mmuo", color: "#1c1828", shape: HEAD, rim: "soft", face: () => "url(#ivory)",
    back: (p) => `<path d="M44 80 C40 30 70 6 100 6 C130 6 160 30 156 80Z" fill="#1c1828"/>` + [[70, 4], [100, -10], [130, 4]].map(([x, y]) => `<path d="M${x - 14} ${y + 30} C${x - 14} ${y} ${x + 14} ${y} ${x + 14} ${y + 30}Z" fill="#1c1828"/><circle cx="${x}" cy="${y + 8}" r="5" fill="url(#chrome)"/>`).join("") + [[56, 40], [144, 40]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 10}" width="12" height="20" rx="3" fill="#d92f3a"/>`).join(""),
    pattern: (p) => ink("M56 84 C64 70 88 72 94 82 M144 84 C136 70 112 72 106 82", "#1c1828", 2.4) + ink(both("M54 124 C60 130 66 130 72 124 M56 138 C62 144 68 144 74 138"), "#1c1828", 1.6) + `<path d="M98 70 L100 60 L102 70Z" fill="#1c1828"/>`,
    eyes: () => `<path d="${both("M64 106 C70 100 86 100 92 106 C86 110 70 110 64 106Z")}" fill="#1c1828"/>`,
    front: () => `<path d="M100 104 L96 128 L104 128Z" fill="#000" opacity="0.15"/><path d="M90 148 C96 145 104 145 110 148 C104 152 96 152 90 148Z" fill="#c2122a"/>`,
  });
  add({
    id: "mmanwu", name: "Mmanwu", color: "#d92f3a", shape: HOOD, rim: "soft",
    back: (p) => `<path d="M44 60 L30 -6 L70 40Z M156 60 L170 -6 L130 40Z" fill="${p.dark}"/><path d="M14 120 C20 170 40 200 70 214 L130 214 C160 200 180 170 186 120Z" fill="#c9a24a"/>` + Array.from({ length: 30 }, (_, i) => `<path d="M${16 + i * 6} 130 L${18 + i * 6} 214" stroke="#8a6a2a" stroke-width="1.2"/>`).join(""),
    face: (p) => p.base,
    pattern: (p) => `<path d="M30 70 L170 70 L170 90 L30 90Z" fill="#1c1828"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${30 + i * 10} 70 L${35 + i * 10} 90 L${40 + i * 10} 70" fill="#f4eee4"/>`).join("")}<path d="M44 140 L156 140 L156 152 L44 152Z" fill="#1c1828"/>`,
    eyes: () => `<circle cx="78" cy="110" r="12" fill="#f4eee4"/><circle cx="122" cy="110" r="12" fill="#f4eee4"/><circle cx="78" cy="110" r="6" fill="#1c1828"/><circle cx="122" cy="110" r="6" fill="#1c1828"/>`,
    front: () => `<path d="M80 160 L120 160 L116 172 L84 172Z" fill="#1c1828"/>${[86, 94, 102, 110].map((x) => `<path d="M${x} 160 L${x + 3} 168 L${x + 6} 160Z" fill="#f4eee4"/>`).join("")}`,
  });
  add({
    id: "ijele", name: "Ijele", color: "#e8b143", shape: HOOD, rim: "metal",
    back: (p) => `<path d="M10 70 C10 10 60 -20 100 -20 C140 -20 190 10 190 70Z" fill="${p.alt2}"/>` + Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.1 + i * 0.1); const x = 100 - Math.cos(a) * 76, y = 54 - Math.sin(a) * 58; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="url(#chrome)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="none" stroke="${[p.base, "#d92f3a", "#1f9d6b"][i % 3]}" stroke-width="3"/>`; }).join("") + `<path d="M10 70 L190 70 L184 84 L16 84Z" fill="#d92f3a"/>`,
    pattern: (p) => { let s = ""; for (let y = 40; y < 190; y += 14) for (let x = 30; x < 172; x += 14) s += `<path d="M${x} ${y - 7} L${x + 7} ${y} L${x} ${y + 7} L${x - 7} ${y}Z" fill="${[p.base, "#d92f3a", "#1f9d6b", "#1c1828", "#f4eee4"][((x + y) / 14) % 5]}"/>`; return s; },
    eyes: () => mesh(both("M62 102 C70 96 88 96 94 102 L94 110 C86 114 70 114 62 110Z")),
  });

  // ---------- Ekpo and Ekpe (Ibibio, Efik): a dark carved face, and the raffia leopard spirit ----------
  for (const [id, name, color] of [["ekpo", "Ekpo", "#3a2a1e"], ["ekpo-red", "Ekpo Red", "#6a2418"]]) {
    add({
      id, name, color, shape: HEAD, rim: "soft", face: () => "url(#wood)",
      back: (p) => wood(p) + `<path d="M44 150 C40 180 60 206 100 214 C140 206 160 180 156 150 C140 170 60 170 44 150Z" fill="#c9a24a"/>` + Array.from({ length: 20 }, (_, i) => ink(`M${50 + i * 5} 160 L${48 + i * 5.2} ${200 + (i % 3) * 4}`, "#8a6a2a", 1.2)).join("") + `<path d="M50 70 C40 40 60 20 80 30 C70 40 66 54 70 70Z M150 70 C160 40 140 20 120 30 C130 40 134 54 130 70Z" fill="${p.deep}"/>`,
      pattern: (p) => grain(p) + ink(both("M56 88 C66 78 86 78 94 88"), "#000", 3.4),
      eyes: () => `<path d="${both("M60 104 C66 96 88 96 94 104 C88 112 66 112 60 104Z")}" fill="#0b0608"/>`,
      front: (p) => `<path d="M94 108 L88 132 C94 138 106 138 112 132 L106 108Z" fill="${p.deep}" opacity="0.6"/><path d="M76 146 C88 140 112 140 124 146 L120 164 C108 170 92 170 80 164Z" fill="#1c0a0e"/>${[84, 92, 100, 108, 116].map((x) => `<path d="M${x - 3} 146 L${x} 156 L${x + 3} 146Z" fill="#f4eee4"/>`).join("")}`,
    });
  }
  for (const [id, name, color] of [["ekpe", "Ekpe", "#d92f3a"], ["ekpe-blue", "Ekpe Indigo", "#253a8f"]]) {
    add({
      id, name, color, shape: HOOD, rim: "soft",
      back: (p) => `<path d="M100 -24 L70 40 L130 40Z" fill="${p.base}"/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${84 - i * 2} ${-2 + i * 7} L${116 + i * 2} ${-2 + i * 7}" stroke="#1c1828" stroke-width="2.6"/>`).join("") + `<circle cx="100" cy="-26" r="6" fill="#1c1828"/>` + Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2; return `<path d="M${100 + Math.cos(a) * 66} ${120 + Math.sin(a) * 72} L${100 + Math.cos(a) * 90} ${120 + Math.sin(a) * 96}" stroke="${["#c9a24a", "#8a6a2a", "#e0c070"][i % 3]}" stroke-width="5" stroke-linecap="round"/>`; }).join(""),
      face: (p) => p.base,
      pattern: (p) => { let s = ""; for (let y = 24; y < 190; y += 8) s += `<path d="M20 ${y} L180 ${y}" stroke="${y % 16 ? "#1c1828" : p.pale}" stroke-opacity="0.5" stroke-width="3"/>`; for (let y = 28; y < 190; y += 16) for (let x = 24; x < 180; x += 16) s += `<path d="M${x} ${y} L${x + 8} ${y + 8}" stroke="#1c1828" stroke-opacity="0.35" stroke-width="2"/>`; return s; },
      eyes: () => `<circle cx="78" cy="104" r="11" fill="#f4eee4"/><circle cx="122" cy="104" r="11" fill="#f4eee4"/><circle cx="78" cy="104" r="5" fill="#1c1828"/><circle cx="122" cy="104" r="5" fill="#1c1828"/>`,
    });
  }

  // ---------- Benin: the Queen Idia ivory mask, a bronze head, and coral ----------
  const benin = (id, name, color, bronze) => add({
    id, name, color, shape: HEAD, rim: "soft", face: () => (bronze ? "url(#bronze)" : "url(#ivory)"),
    back: (p) => `<linearGradient id="bronze" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#e2a35c"/><stop offset="0.5" stop-color="#9a5a22"/><stop offset="1" stop-color="#4a2a0e"/></linearGradient>` +
      (bronze
        ? `<path d="M48 84 C44 30 70 6 100 6 C130 6 156 30 152 84Z" fill="#c2412a"/>` + Array.from({ length: 7 }, (_, r) => beads(arc(100, 84, 54 - r * 3, 66 - r * 9, 190, 350, 16 - r), 3.2, ["#d9452a", "#a8301e"])).join("")
        : Array.from({ length: 9 }, (_, i) => { const x = 52 + i * 12, y = 42 - Math.sin((i / 8) * Math.PI) * 24; return `<g><ellipse cx="${x}" cy="${y}" rx="6" ry="7.6" fill="url(#ivory)" stroke="#a8977e" stroke-width="0.6"/><circle cx="${x - 2}" cy="${y - 1}" r="1" fill="#3a2a1e"/><circle cx="${x + 2}" cy="${y - 1}" r="1" fill="#3a2a1e"/><path d="M${x - 6} ${y + 6} L${x + 6} ${y + 6}" stroke="#a8977e" stroke-width="1.6"/></g>`; }).join("") + `<path d="M46 70 C60 50 140 50 154 70 L154 80 C140 62 60 62 46 80Z" fill="#c2412a"/>`),
    pattern: (p) => (bronze ? "" : ink("M90 66 L100 84 L110 66 M86 70 L100 92 L114 70", "#3a2a1e", 2)) + ink(both("M62 92 C70 86 86 86 94 92"), bronze ? "#3a2a1e" : "#6a5a44", 1.6),
    eyes: () => `<path d="${both("M62 104 C68 96 88 96 94 104 C88 110 68 110 62 104Z")}" fill="#f4eee4" stroke="#3a2a1e" stroke-width="1.2"/><circle cx="78" cy="104" r="4.6" fill="#1c1828"/><circle cx="122" cy="104" r="4.6" fill="#1c1828"/>`,
    front: (p) => `<path d="M96 106 L92 132 C96 136 104 136 108 132 L104 106Z" fill="#000" opacity="0.12"/><path d="M86 150 C94 146 106 146 114 150 C106 157 94 157 86 150Z" fill="${bronze ? "#5a2e10" : "#a8735a"}"/>` + Array.from({ length: 3 }, (_, r) => beads(arc(100, 160, 46 - r * 2, 22 - r * 2, 20, 160, 15), 3, ["#d9452a", "#a8301e", "#e8b143"])).join(""),
  });
  benin("benin-ivory", "Queen Idia", "#f4eee4", false);
  benin("benin-bronze", "Benin Bronze", "#9a5a22", true);
  benin("benin-coral", "Benin Coral", "#c2412a", true);

  // ---------- Nok terracotta ----------
  for (const [id, name, color] of [["nok", "Nok", "#c06a3a"], ["nok-dark", "Nok Ancient", "#8a4a2a"]]) {
    add({
      id, name, color, shape: HEAD, rim: "soft", face: () => "url(#wood)",
      back: (p) => wood(p) + [[66, 28], [100, 18], [134, 28], [52, 52], [148, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="url(#wood)" stroke="${p.deep}" stroke-width="1"/>${ink(`M${x - 10} ${y} C${x - 4} ${y - 6} ${x + 4} ${y - 6} ${x + 10} ${y}`, p.deep, 1.2)}`).join(""),
      pattern: (p) => `<filter id="clayf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.15  0 0 0 0 0.05  0 0 0 -1.6 1.1"/></filter><rect x="20" y="20" width="160" height="190" filter="url(#clayf)" opacity="0.4"/>` + ink(both("M58 86 C68 76 88 78 96 88"), p.deep, 2.2),
      eyes: (p) => `<path d="${both("M60 110 C66 94 92 94 96 110Z")}" fill="#2a160a"/><circle cx="78" cy="104" r="2.6" fill="#000"/><circle cx="122" cy="104" r="2.6" fill="#000"/>`,
      front: (p) => `<path d="M94 110 L90 132 C96 138 104 138 110 132 L106 110Z" fill="${p.deep}" opacity="0.4"/><circle cx="95" cy="133" r="2" fill="#2a160a"/><circle cx="105" cy="133" r="2" fill="#2a160a"/><path d="M84 152 C92 146 108 146 116 152 C108 160 92 160 84 152Z" fill="${p.deep}"/>${ink("M84 152 L116 152", "#2a160a", 1.6)}`,
    });
  }

  // ---------- Carved masks from across Africa ----------
  // Dan (Côte d'Ivoire, Liberia): smooth, dark and polished
  add({ id: "dan", name: "Dan", color: "#2a1a12", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p),
    pattern: (p) => `<ellipse cx="78" cy="70" rx="32" ry="14" fill="#fff" opacity="0.08" transform="rotate(-20 78 70)"/>` + ink("M100 58 L100 98", "#000", 1.4, 'stroke-opacity="0.4"'),
    eyes: () => `<ellipse cx="78" cy="104" rx="11" ry="6" fill="#0b0608"/><ellipse cx="122" cy="104" rx="11" ry="6" fill="#0b0608"/>`,
    front: (p) => `<path d="M88 150 C94 142 106 142 112 150 C106 158 94 158 88 150Z" fill="#7a2418"/><path d="M96 108 L94 130 C98 134 102 134 106 130 L104 108Z" fill="#000" opacity="0.25"/>` });
  // Punu (Gabon): white kaolin face, arched brows, a tall crested coiffure
  for (const [id, name, color] of [["punu", "Punu", "#f4eee4"], ["punu-ochre", "Punu Ochre", "#e8c88a"]]) add({ id, name, color, shape: HEAD, rim: "soft", face: () => "url(#face)",
    back: () => `<path d="M48 80 C40 40 70 14 100 12 C130 14 160 40 152 80Z" fill="#1c1828"/><path d="M84 12 C84 -10 116 -10 116 12Z" fill="#1c1828"/><path d="M40 92 C30 70 40 56 52 62 L58 92Z M160 92 C170 70 160 56 148 62 L142 92Z" fill="#1c1828"/>`,
    pattern: (p) => ink(both("M58 92 C68 78 88 80 96 92"), "#1c1828", 2.6) + `<path d="M100 66 L106 74 L100 82 L94 74Z" fill="#c2412a"/>` + `<g fill="#c2412a">${[[60, 124], [66, 124], [63, 129], [140, 124], [134, 124], [137, 129]].map(([x, y]) => `<path d="M${x} ${y - 3} L${x + 2} ${y} L${x} ${y + 3} L${x - 2} ${y}Z"/>`).join("")}</g>`,
    eyes: () => `<path d="${both("M64 106 C70 100 88 100 94 106 C88 108 70 108 64 106Z")}" fill="#1c1828"/>`,
    front: () => `<path d="M88 150 C94 146 106 146 112 150 C106 156 94 156 88 150Z" fill="#c2412a"/>` });
  // Fang (Gabon): long, heart-shaped and white
  add({ id: "fang", name: "Fang", color: "#f4eee4", shape: LONG, rim: "soft", face: () => "url(#face)",
    pattern: (p) => `<path d="M60 76 C70 64 92 64 100 82 C108 64 130 64 140 76 C134 100 118 120 100 160 C82 120 66 100 60 76Z" fill="#000" opacity="0.08"/>` + ink("M60 76 C70 64 92 64 100 82 C108 64 130 64 140 76", "#1c1828", 2.6) + ink("M100 82 L100 150", "#000", 1.2, 'stroke-opacity="0.3"'),
    eyes: () => `<path d="${both("M68 104 C74 100 88 100 94 104 C88 108 74 108 68 104Z")}" fill="#1c1828"/>`,
    front: () => `<ellipse cx="100" cy="168" rx="7" ry="4" fill="#1c1828"/>` });
  // Baule (Côte d'Ivoire): a refined portrait with braided coiffure
  for (const [id, name, color] of [["baule", "Baule", "#6a3a1e"], ["baule-gold", "Baule Gold", "#c58a2a"]]) add({ id, name, color, shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<path d="M46 82 C40 30 160 30 154 82Z" fill="${p.deep}"/>` + [60, 80, 100, 120, 140].map((x) => `<path d="M${x} 72 C${x - 6} 40 ${x + 6} 26 ${x} 14" stroke="${p.deep}" stroke-width="9" stroke-linecap="round" fill="none"/>${ink(`M${x} 72 C${x - 6} 40 ${x + 6} 26 ${x} 14`, p.dark, 3, 'stroke-dasharray="2 3"')}`).join(""),
    pattern: (p) => grain(p) + ink(both("M60 92 C70 84 88 84 96 92"), p.deep, 2.2) + scars(p.deep, 1.6),
    eyes: (p) => `<path d="${both("M64 106 C70 100 88 100 94 106 C88 109 70 109 64 106Z")}" fill="#120a06"/>` + ink(both("M62 106 C70 96 88 96 96 106"), p.deep, 2.2),
    front: (p) => `<path d="M97 106 L94 136 C97 139 103 139 106 136 L103 106Z" fill="${p.deep}" opacity="0.5"/><ellipse cx="100" cy="152" rx="6" ry="4" fill="${p.deep}"/>` });
  // Chokwe Mwana Pwo (Angola): the young woman, scarification and tears
  add({ id: "chokwe", name: "Mwana Pwo", color: "#8a4e22", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<path d="M40 90 C30 40 60 14 100 12 C140 14 170 40 160 90 C150 70 130 62 100 62 C70 62 50 70 40 90Z" fill="#c9a24a"/>` + Array.from({ length: 22 }, (_, i) => ink(`M${42 + i * 5.5} 66 L${40 + i * 5.6} ${30 - Math.sin((i / 21) * Math.PI) * 16}`, "#8a6a2a", 1.6)).join("") + beads(arc(100, 70, 56, 10, 190, 350, 16), 2.6, ["#d92f3a", "#f4eee4", "#1c1828"]),
    pattern: (p) => grain(p) + `<path d="M100 70 L108 80 L100 90 L92 80Z" fill="none" stroke="${p.deep}" stroke-width="2"/>` + ink(both("M62 116 C64 128 66 136 64 144"), p.deep, 2.2) + `<g fill="${p.deep}">${[0, 1, 2].map((i) => `<path d="M${60 + i * 4} ${130 + i * 5} l2 4 l-2 4 l-2 -4z M${140 - i * 4} ${130 + i * 5} l2 4 l-2 4 l-2 -4z"/>`).join("")}</g>`,
    eyes: () => `<path d="${both("M62 102 C68 96 90 96 94 104 C88 108 68 108 62 102Z")}" fill="#120a06"/>`,
    front: (p) => `<path d="M80 148 C90 154 110 154 120 148 C110 160 90 160 80 148Z" fill="${p.deep}"/>${[86, 94, 100, 106, 114].map((x) => `<rect x="${x - 2}" y="149" width="4" height="5" fill="#f4eee4"/>`).join("")}` });
  // Kota (Gabon): a reliquary guardian in brass and copper sheets
  for (const [id, name, color] of [["kota", "Kota", "#c58a2a"], ["kota-copper", "Kota Copper", "#c0623a"]]) add({ id, name, color, shape: HEAD, rim: "metal", face: () => "url(#metal)",
    back: (p) => `<path d="M30 70 C30 10 170 10 170 70 C150 40 50 40 30 70Z" fill="url(#metal)" stroke="${p.deep}" stroke-width="1.2"/><path d="M24 120 C10 116 10 92 30 86 L36 120Z M176 120 C190 116 190 92 170 86 L164 120Z" fill="url(#metal)"/>`,
    pattern: (p) => Array.from({ length: 20 }, (_, i) => `<path d="M${30 + i * 8} 30 L${30 + i * 8} 200" stroke="${p.deep}" stroke-opacity="0.28" stroke-width="2"/>`).join("") + `<path d="M98 60 L102 60 L104 150 L96 150Z" fill="url(#metal)" stroke="${p.deep}" stroke-width="0.8"/>`,
    eyes: () => `<circle cx="78" cy="106" r="10" fill="url(#metal)" stroke="#5a3a10" stroke-width="2"/><circle cx="122" cy="106" r="10" fill="url(#metal)" stroke="#5a3a10" stroke-width="2"/><circle cx="78" cy="106" r="3.6" fill="#1c1828"/><circle cx="122" cy="106" r="3.6" fill="#1c1828"/>` });
  // Bwa plank mask (Burkina Faso): bold geometric paint, round eyes, a tall plank above
  for (const [id, name, color] of [["bwa", "Bwa", "#c2412a"], ["bwa-black", "Bwa Night", "#1c1828"]]) add({ id, name, color, shape: HEAD, rim: "soft", face: () => "#f4eee4",
    back: (p) => `<rect x="76" y="-40" width="48" height="96" fill="#f4eee4" stroke="#1c1828" stroke-width="1.4"/>` + Array.from({ length: 5 }, (_, i) => `<path d="M76 ${-36 + i * 18} L100 ${-24 + i * 18} L124 ${-36 + i * 18}" fill="none" stroke="${i % 2 ? p.base : "#1c1828"}" stroke-width="5"/>`).join("") + `<circle cx="100" cy="-34" r="10" fill="none" stroke="#1c1828" stroke-width="3"/>`,
    pattern: (p) => { let s = ""; for (let i = 0; i < 10; i++) s += `<path d="M${40 + i * 12} 140 L${46 + i * 12} 128 L${52 + i * 12} 140Z" fill="${i % 2 ? p.base : "#1c1828"}"/>`; return s + `<path d="M40 150 L160 150 L160 160 L40 160Z" fill="${p.base}"/><path d="M40 168 L160 168 L160 176 L40 176Z" fill="#1c1828"/><path d="M96 70 L104 70 L104 128 L96 128Z" fill="${p.base}"/>`; },
    eyes: (p) => [78, 122].map((x) => [16, 11, 6].map((r, i) => `<circle cx="${x}" cy="104" r="${r}" fill="${["#1c1828", "#f4eee4", "#1c1828"][i]}"/>`).join("")).join("") });
  // Dogon Kanaga (Mali): a box face with deep eye troughs and the cross above
  add({ id: "kanaga", name: "Dogon Kanaga", color: "#8a5a2c", shape: "M52 40 L148 40 C156 40 160 46 160 54 L158 170 C158 180 152 186 142 186 L58 186 C48 186 42 180 42 170 L40 54 C40 46 44 40 52 40Z", rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<rect x="96" y="-40" width="8" height="84" fill="url(#wood)"/><rect x="40" y="-24" width="120" height="8" fill="url(#wood)"/><rect x="50" y="10" width="100" height="8" fill="url(#wood)"/><rect x="40" y="-24" width="8" height="22" fill="url(#wood)"/><rect x="152" y="-24" width="8" height="22" fill="url(#wood)"/><rect x="50" y="18" width="8" height="18" fill="url(#wood)"/><rect x="142" y="18" width="8" height="18" fill="url(#wood)"/>`,
    pattern: (p) => grain(p) + `<path d="M90 60 L110 60 L106 150 L94 150Z" fill="${p.deep}" opacity="0.5"/><path d="M48 60 L84 60 L84 150 L48 150Z M116 60 L152 60 L152 150 L116 150Z" fill="${p.deep}" opacity="0.35"/>`,
    eyes: () => `<path d="M58 92 L80 92 L76 116 L62 116Z M120 92 L142 92 L138 116 L124 116Z" fill="#120a06"/>`,
    front: (p) => `<path d="M70 158 L130 158 L128 172 L72 172Z" fill="${p.deep}"/>` + [80, 92, 104, 116].map((x) => `<path d="M${x} 158 L${x + 4} 172" stroke="#f4eee4" stroke-width="1.4"/>`).join("") });
  // Senufo Kpelie (Côte d'Ivoire, Mali): a delicate face with side flanges and a crest
  add({ id: "senufo", name: "Senufo Kpelie", color: "#5a3a1e", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<path d="M36 110 C20 120 16 140 24 156 L38 150 C34 140 36 128 44 120Z M164 110 C180 120 184 140 176 156 L162 150 C166 140 164 128 156 120Z M30 150 L16 172 L26 176 L38 156Z M170 150 L184 172 L174 176 L162 156Z" fill="url(#wood)"/><path d="M62 52 C50 20 70 0 80 4 C76 20 80 36 90 48Z M138 52 C150 20 130 0 120 4 C124 20 120 36 110 48Z M90 46 L100 10 L110 46Z" fill="url(#wood)" stroke="${p.deep}" stroke-width="0.8"/>`,
    pattern: (p) => grain(p) + ink(both("M60 90 C70 84 88 84 94 92"), p.deep, 2) + ink(both("M62 126 L70 122 M62 132 L70 128 M62 138 L70 134"), p.deep, 1.6),
    eyes: () => `<path d="${both("M64 106 C70 100 88 100 94 106 C88 108 70 108 64 106Z")}" fill="#0b0608"/>`,
    front: (p) => `<path d="M90 156 C94 150 106 150 110 156 L106 166 L94 166Z" fill="${p.deep}"/>` });
  // Kuba Mwaash aMbooy (DR Congo): beads, cowries and bright triangles
  for (const [id, name, color] of [["kuba", "Kuba", "#1f3a8f"], ["kuba-red", "Kuba Red", "#c2412a"]]) add({ id, name, color, shape: HEAD, rim: "soft", face: () => "#7a4a22",
    back: (p) => `<path d="M40 86 C30 30 70 6 100 6 C130 6 170 30 160 86Z" fill="${p.base}"/>` + Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (_, i) => cowrie(54 + i * 13 + (r % 2) * 6, 20 + r * 11, 3.2, 90)).join("")).join("") + `<path d="M84 6 C84 -14 116 -14 116 6Z" fill="${p.base}"/>`,
    pattern: (p) => { let s = `<path d="M44 76 L156 76 L156 90 L44 90Z" fill="${p.base}"/>`; for (let i = 0; i < 14; i++) s += `<path d="M${44 + i * 8} 76 L${48 + i * 8} 90 L${52 + i * 8} 76Z" fill="${i % 2 ? "#f4eee4" : "#1c1828"}"/>`; s += `<path d="M44 128 L156 128 L156 174 L44 174Z" fill="url(#kubaTri)"/>`; return `<pattern id="kubaTri" patternUnits="userSpaceOnUse" width="12" height="12"><rect width="12" height="12" fill="${p.base}"/><path d="M0 12 L6 0 L12 12Z" fill="#f4eee4"/><path d="M3 12 L6 6 L9 12Z" fill="#1c1828"/></pattern>` + s + ink("M100 92 L100 124", "#f4eee4", 3); },
    eyes: () => `<path d="${both("M62 106 C68 98 90 98 94 106 C90 112 68 112 62 106Z")}" fill="#120a06"/>` + beads(arc(78, 106, 20, 13, 180, 360, 9).concat(arc(122, 106, 20, 13, 180, 360, 9)), 2.2, ["#f4eee4", "#1c1828"]),
    front: () => `<path d="M88 182 C94 176 106 176 112 182" fill="#c2412a"/>` });
  // Songye Kifwebe (DR Congo): white striations, a jutting mouth, a crest
  for (const [id, name, color] of [["kifwebe", "Kifwebe", "#f4eee4"], ["kifwebe-red", "Kifwebe Red", "#c2412a"]]) add({ id, name, color, shape: HEAD, rim: "soft", face: () => "#2a1a12",
    back: () => `<path d="M90 50 L96 0 L104 0 L110 50Z" fill="#2a1a12"/>`,
    pattern: (p) => Array.from({ length: 20 }, (_, i) => `<path d="M${30 + i * 8} 40 C${36 + i * 8} 100 ${26 + i * 8} 140 ${32 + i * 8} 190" fill="none" stroke="${p.base}" stroke-width="3.6"/>`).join(""),
    eyes: () => `<path d="${both("M60 104 C66 92 90 92 94 104 C90 112 66 112 60 104Z")}" fill="#2a1a12" stroke="#000" stroke-width="2"/>${ink(both("M62 104 L92 104"), "#000", 2)}`,
    front: () => `<path d="M78 146 L122 146 L114 168 L86 168Z" fill="#2a1a12" stroke="#000" stroke-width="1.4"/><path d="M86 156 L114 156" stroke="#c2412a" stroke-width="3"/><path d="M96 104 L92 134 L108 134 L104 104Z" fill="#2a1a12"/>` });
  // Teke (Congo): a flat disc split by colour and line
  add({ id: "teke", name: "Teke", color: "#f4eee4", shape: OUT.round, rim: "soft", face: () => "#f4eee4",
    pattern: () => `<path d="M38 112 L162 112 L162 120 L38 120Z" fill="#1c1828"/><path d="M100 50 C70 70 70 100 100 112Z M100 174 C130 154 130 128 100 120Z" fill="#c2412a"/><path d="M100 50 C130 70 130 100 100 112Z M100 174 C70 154 70 128 100 120Z" fill="#1c1828"/>` + ink("M44 80 L70 92 M156 80 L130 92 M44 150 L70 140 M156 150 L130 140", "#1c1828", 2),
    eyes: () => `<path d="${both("M60 100 L94 100 L92 106 L62 106Z")}" fill="#120a06"/>`,
    front: () => `<rect x="90" y="140" width="20" height="5" fill="#120a06"/>` });
  // Bamileke elephant (Cameroon): beaded panels, big round ears and a long trunk
  for (const [id, name, color] of [["bamileke", "Bamileke Elephant", "#253a8f"], ["bamileke-red", "Bamileke Red", "#c2122a"]]) add({ id, name, color, shape: HOOD, rim: "soft",
    back: (p) => [[20, 70], [180, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="${p.base}"/><circle cx="${x}" cy="${y}" r="34" fill="url(#bead)"/>`).join("") + `<pattern id="bead" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="3" cy="3" r="2" fill="#fff" fill-opacity="0.25"/></pattern>`,
    face: (p) => p.base,
    pattern: (p) => `<rect x="20" y="20" width="160" height="190" fill="url(#bead)"/>` + Array.from({ length: 8 }, (_, i) => `<path d="M${36 + i * 18} 40 L${45 + i * 18} 56 L${54 + i * 18} 40Z" fill="#f4eee4"/>`).join("") + `<path d="M82 120 L118 120 L112 214 L88 214Z" fill="${p.dark}"/><path d="M82 120 L118 120 L112 214 L88 214Z" fill="url(#bead)"/>` + Array.from({ length: 8 }, (_, i) => `<path d="M${86 + (i % 2) * 2} ${128 + i * 11} L${114 - (i % 2) * 2} ${128 + i * 11}" stroke="${["#f4eee4", "#d92f3a", "#ffc61a"][i % 3]}" stroke-width="3"/>`).join(""),
    eyes: () => `<circle cx="72" cy="100" r="13" fill="#f4eee4"/><circle cx="128" cy="100" r="13" fill="#f4eee4"/><circle cx="72" cy="100" r="7" fill="#1c1828"/><circle cx="128" cy="100" r="7" fill="#1c1828"/>` });
  // Akan gold (Ghana): a gold portrait mask
  add({ id: "akan", name: "Akan Gold", color: "#e8b143", shape: HEAD, rim: "metal", face: () => "url(#metal)",
    pattern: (p) => ink(both("M58 90 C68 80 88 80 96 90"), p.deep, 2) + ink(both("M54 130 C60 134 66 134 70 130"), p.deep, 1.4) + Array.from({ length: 16 }, (_, i) => `<circle cx="${44 + i * 7.5}" cy="64" r="2.4" fill="none" stroke="${p.deep}" stroke-width="1.2"/>`).join("") + ink("M44 168 C70 180 130 180 156 168", p.deep, 1.6, 'stroke-dasharray="2 3"'),
    eyes: () => `<path d="${both("M62 104 C68 98 88 98 94 104 C88 110 68 110 62 104Z")}" fill="#3a2a10"/>`,
    front: (p) => `<path d="M96 106 L92 134 C96 138 104 138 108 134 L104 106Z" fill="${p.deep}" opacity="0.3"/><path d="M86 152 C94 148 106 148 114 152 C106 158 94 158 86 152Z" fill="${p.deep}" opacity="0.7"/>` });
  // Makonde (Tanzania, Mozambique): a lifelike face with raised scars and a lip plug
  add({ id: "makonde", name: "Makonde", color: "#6a3a1e", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<path d="M46 80 C40 30 160 30 154 80Z" fill="#1c1828"/>`,
    pattern: (p) => grain(p) + `<g fill="${p.deep}">${Array.from({ length: 6 }, (_, i) => `<path d="M${88 + i * 4} 62 l2 6 l-2 6 l-2 -6z"/>`).join("")}${[0, 1, 2, 3].map((i) => `<path d="M${54 + i * 4} ${118 + i * 4} l3 3 l-3 3 l-3 -3z M${146 - i * 4} ${118 + i * 4} l3 3 l-3 3 l-3 -3z"/>`).join("")}</g>` + ink(both("M60 92 C70 84 88 84 96 92"), p.deep, 2),
    eyes: () => `<path d="${both("M62 104 C68 98 88 98 94 104 C88 109 68 109 62 104Z")}" fill="#f4eee4"/><circle cx="78" cy="104" r="4" fill="#1c1828"/><circle cx="122" cy="104" r="4" fill="#1c1828"/>`,
    front: (p) => `<path d="M94 106 L90 132 C96 136 104 136 110 132 L106 106Z" fill="${p.deep}" opacity="0.4"/><ellipse cx="100" cy="152" rx="13" ry="7" fill="#c9a87a" stroke="${p.deep}" stroke-width="1.2"/><path d="M86 148 C94 144 106 144 114 148" stroke="${p.deep}" stroke-width="2" fill="none"/>` });
  // Grebo (Liberia): stacked tube eyes in a flat painted face
  add({ id: "grebo", name: "Grebo", color: "#f4eee4", shape: "M54 40 L146 40 C156 40 160 46 160 56 L158 172 C158 180 152 186 144 186 L56 186 C48 186 42 180 42 172 L40 56 C40 46 44 40 54 40Z", rim: "soft", face: () => "#2a1a12",
    pattern: (p) => `<path d="M90 50 L110 50 L104 150 L96 150Z" fill="${p.base}" opacity="0.8"/>` + [52, 64, 136, 148].map((x) => ink(`M${x} 50 L${x} 80`, p.base, 2)).join(""),
    eyes: (p) => [[66, 92], [134, 92], [66, 124], [134, 124]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#f4eee4"/><circle cx="${x}" cy="${y}" r="8" fill="#c2412a"/><circle cx="${x}" cy="${y}" r="4" fill="#1c1828"/>`).join(""),
    front: () => `<rect x="80" y="160" width="40" height="12" rx="2" fill="#f4eee4"/><path d="M84 160 L84 172 M92 160 L92 172 M100 160 L100 172 M108 160 L108 172 M116 160 L116 172" stroke="#2a1a12" stroke-width="1.4"/>` });
  // Lwalwa (Angola, DR Congo): angular, with a long beak-like nose
  add({ id: "lwalwa", name: "Lwalwa", color: "#7a3a1e", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p),
    pattern: (p) => grain(p) + `<path d="M48 90 L100 70 L152 90 L152 96 L100 78 L48 96Z" fill="${p.deep}"/>`,
    eyes: () => `<path d="${both("M62 106 L94 100 L94 108Z")}" fill="#0b0608"/>`,
    front: (p) => `<path d="M100 76 L114 140 L100 146 L86 140Z" fill="url(#wood)" stroke="${p.deep}" stroke-width="1.4"/><path d="M84 160 L116 160 L112 166 L88 166Z" fill="${p.deep}"/>` });
  // Maasai: beaded bands of red, blue, white and orange
  add({ id: "maasai", name: "Maasai Beads", color: "#c2122a", shape: OUT.egg, rim: "soft", face: () => "#5a2e18",
    back: (p) => Array.from({ length: 5 }, (_, r) => beads(arc(100, 112, 62 + r * 6, 70 + r * 6, 200, 340, 22 + r * 2), 3, [["#c2122a", "#f4eee4"], ["#1f5fbf", "#ffc61a"], ["#f2741f", "#1c1828"], ["#1f9d6b", "#f4eee4"], ["#c2122a", "#1f5fbf"]][r])).join(""),
    pattern: (p) => [64, 152].map((y) => beads(Array.from({ length: 24 }, (_, i) => [34 + i * 6, y]), 2.8, [p.base, "#f4eee4", "#1f5fbf", "#ffc61a"])).join("") + `<path d="M100 74 L100 140" stroke="#f4eee4" stroke-width="3" stroke-dasharray="3 3"/>`,
    eyes: () => `<path d="${both("M62 104 C68 96 88 96 94 104 C88 110 68 110 62 104Z")}" fill="#f4eee4"/><circle cx="78" cy="104" r="4.6" fill="#1c1828"/><circle cx="122" cy="104" r="4.6" fill="#1c1828"/>` });
  // Zulu shield: cowhide pattern with crossed spears behind
  add({ id: "zulu", name: "Zulu Shield", color: "#f4eee4", shape: "M100 30 C138 40 156 80 156 112 C156 146 138 184 100 194 C62 184 44 146 44 112 C44 80 62 40 100 30Z", rim: "soft",
    back: () => ink("M40 10 L160 214 M160 10 L40 214", "#6a3a1e", 4) + `<path d="M34 0 L46 4 L40 20Z M166 0 L154 4 L160 20Z" fill="url(#chrome)"/>`,
    pattern: () => [[64, 64, 18], [138, 90, 22], [70, 160, 20], [134, 162, 14]].map(([x, y, r]) => `<path d="M${x - r} ${y} C${x - r} ${y - r} ${x + r * 0.6} ${y - r * 1.1} ${x + r} ${y - r * 0.2} C${x + r * 1.2} ${y + r * 0.8} ${x - r * 0.2} ${y + r * 1.1} ${x - r} ${y}Z" fill="#2a1a12"/>`).join("") + `<rect x="94" y="30" width="12" height="164" fill="#6a3a1e"/>` + Array.from({ length: 8 }, (_, i) => `<path d="M94 ${44 + i * 18} L106 ${52 + i * 18} M106 ${44 + i * 18} L94 ${52 + i * 18}" stroke="#f4eee4" stroke-width="2"/>`).join(""),
    eyes: () => `<path d="${both("M60 104 C66 96 86 96 92 104 C86 110 66 110 60 104Z")}" fill="#120a06"/>` });
  // Yoruba Epa helmet: a carved head with a figure on top
  add({ id: "epa", name: "Epa", color: "#9a5a2c", shape: HEAD, rim: "soft", face: () => "url(#wood)",
    back: (p) => wood(p) + `<path d="M76 46 L72 20 C72 4 86 -6 100 -6 C114 -6 128 4 128 20 L124 46Z" fill="url(#wood)" stroke="${p.deep}" stroke-width="1"/><circle cx="100" cy="-18" r="14" fill="url(#wood)" stroke="${p.deep}" stroke-width="1"/><path d="M84 -30 C90 -44 110 -44 116 -30Z" fill="#1c1828"/>${ink("M92 -18 L96 -18 M104 -18 L108 -18", "#1c1828", 1.6)}` + beads(arc(100, 46, 26, 6, 180, 360, 9), 2.4, ["#d92f3a", "#f4eee4"]),
    pattern: (p) => grain(p) + `<path d="M44 70 L156 70 L156 80 L44 80Z" fill="#f4eee4" opacity="0.7"/>` + scars(p.deep, 2),
    eyes: (p) => paintedEye(both("M60 104 C66 94 90 94 94 104 C90 112 66 112 60 104Z")),
    front: (p) => `<path d="M96 108 L92 134 C96 138 104 138 108 134 L104 108Z" fill="${p.deep}" opacity="0.4"/><path d="M80 150 C90 144 110 144 120 150 C110 160 90 160 80 150Z" fill="${p.deep}"/>` });
  // Igbo Mmwo (white spirit) with mirrors
  add({ id: "mmwo", name: "Mmwo Spirit", color: "#f4eee4", shape: HEAD, rim: "soft", face: () => "url(#face)",
    back: () => `<path d="M40 86 C36 20 164 20 160 86Z" fill="#1c1828"/>` + [[56, 40], [100, 22], [144, 40], [78, 26], [122, 26]].map(([x, y]) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="2" fill="url(#chrome)" stroke="#c2122a" stroke-width="1.6"/>`).join(""),
    pattern: () => ink(both("M58 90 C66 80 88 80 94 90"), "#1c1828", 2) + ink(both("M60 122 C64 128 70 130 74 126 M62 136 C66 142 72 144 76 140"), "#1c1828", 1.6) + ink("M100 66 L100 74 M96 70 L104 70", "#1c1828", 1.6),
    eyes: () => `<path d="${both("M64 106 C70 100 86 100 92 106 C86 109 70 109 64 106Z")}" fill="#1c1828"/>`,
    front: () => `<path d="M90 150 C96 146 104 146 110 150 C104 154 96 154 90 150Z" fill="#c2122a"/>` });

  return out;
}
