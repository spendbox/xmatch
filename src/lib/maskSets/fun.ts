// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Fun masks: monsters, robots, aliens, cute food, space, sports balls and spooky characters.
 * Every outline covers the whole face.
 */

export function funSet(k) {
  const { OUT, ink, mirror, both, glossy, cuteEyes, cuteEye, blush, star, star5, heart, holes, ALMOND, trimLine, pair2 } = k;
  const out = [];
  const add = (m) => out.push({ cat: "fun", rim: "cartoon", ...m });
  const kawaii = (y = 112, r = 7.5) => cuteEyes(y - 6, r, "#1c1828", 22) + ink(`M90 ${y + 20} Q100 ${y + 28} 110 ${y + 20}`, "#3a1a0c", 2.6) + blush(y + 16, "#ff6b8a", 0.45, 34, 8);

  // ---------- Monsters ----------
  const MON = [
    ["mon-fuzzy", "Fuzzy monster", "#4f86f7", 2, "none", "fangs", 1], ["mon-cyclops", "Cyclops", "#7ad34c", 1, "small", "teeth", 0], ["mon-triclops", "Three eyes", "#b44cff", 3, "curly", "zigzag", 1],
    ["mon-blob", "Blob", "#ff7eb6", 2, "none", "grin", 0], ["mon-horned", "Horned monster", "#e5484d", 2, "small", "fangs", 1], ["mon-goofy", "Goofy monster", "#ffc61a", 1, "curly", "grin", 1],
    ["mon-yeti", "Yeti", "#e9edf3", 2, "small", "fangs", 1], ["mon-swamp", "Swamp thing", "#3c8a4a", 2, "none", "zigzag", 0], ["mon-grumpy", "Grumpy monster", "#8a5a3c", 1, "small", "teeth", 1],
    ["mon-sweet", "Sweet monster", "#2ec4b6", 2, "curly", "grin", 1], ["mon-night", "Night monster", "#3a3448", 3, "small", "fangs", 1], ["mon-lava", "Lava monster", "#f2741f", 1, "curly", "zigzag", 0],
  ];
  for (const [id, name, color, eyes, horns, mouth, fur] of MON) add({
    id, name, color, shape: fur ? OUT.furry : "M100 48 C140 48 160 80 160 112 C160 150 150 174 136 176 C130 186 122 176 116 182 C110 190 104 178 100 184 C96 178 90 190 84 182 C78 176 70 186 64 176 C50 174 40 150 40 112 C40 80 60 48 100 48Z",
    back: (p) => horns === "small" ? `<path d="M64 62 C56 48 58 32 66 22 C70 36 76 46 84 54Z" fill="url(#ivory)"/><path d="${mirror("M64 62 C56 48 58 32 66 22 C70 36 76 46 84 54Z")}" fill="url(#ivory)"/>` : horns === "curly" ? ink(both("M70 56 C56 40 62 20 78 22 C88 24 86 36 78 36"), p.deep, 6) : "",
    pattern: (p) => Array.from({ length: 10 }, (_, i) => `<circle cx="${50 + ((i * 37) % 100)}" cy="${60 + ((i * 53) % 100)}" r="${3 + (i % 3) * 2}" fill="${p.light}" opacity="0.4"/>`).join(""),
    eyes: (p) => eyes === 1 ? cuteEye(100, 96, 20, "#1c1828") : eyes === 3 ? cuteEye(72, 104, 9) + cuteEye(128, 104, 9) + cuteEye(100, 84, 8) : cuteEyes(102, 11, "#1c1828", 24),
    front: (p) => ({
      fangs: `<path d="M70 138 C82 158 118 158 130 138 C118 144 82 144 70 138Z" fill="#3a0d16"/><path d="M80 141 L85 152 L90 142Z M120 141 L115 152 L110 142Z" fill="#fff"/>`,
      teeth: `<path d="M68 136 L132 136 C130 160 70 160 68 136Z" fill="#3a0d16"/>${[76, 88, 100, 112, 124].map((x) => `<rect x="${x - 5}" y="136" width="10" height="9" rx="2" fill="#fff"/>`).join("")}`,
      zigzag: `<path d="M66 138 C80 164 120 164 134 138Z" fill="#3a0d16"/><path d="M66 138 L74 148 L82 139 L90 149 L98 139 L106 149 L114 139 L122 149 L134 138Z" fill="#fff"/>`,
      grin: `<path d="M66 134 Q100 176 134 134 Z" fill="#3a0d16"/><path d="M82 156 Q100 170 118 156 Q100 150 82 156Z" fill="#ef5d78"/>`,
    })[mouth],
  });

  // ---------- Robots ----------
  const BOT = [["bot-chrome", "Chrome bot", "#3df2ff", "visor"], ["bot-red", "Red bot", "#ff4a3a", "lights"], ["bot-gold", "Gold bot", "#ffc61a", "camera"], ["bot-mint", "Mint bot", "#2ee6a8", "lights"],
    ["bot-retro", "Retro bot", "#ff7a45", "dials"], ["bot-violet", "Violet bot", "#b44cff", "visor"], ["bot-blue", "Blue bot", "#4f86f7", "camera"], ["bot-pink", "Pink bot", "#ff5fa2", "hearts"]];
  for (const [id, name, color, eye] of BOT) add({
    id, name, color, shape: OUT.robot, rim: "metal", face: () => "url(#chrome)",
    back: (p) => `${trimLine("M100 48 L100 22", 2.4)}<circle cx="100" cy="18" r="6" fill="${p.base}" filter="url(#glow)"/><rect x="28" y="96" width="14" height="30" rx="5" fill="url(#chrome)"/><rect x="158" y="96" width="14" height="30" rx="5" fill="url(#chrome)"/>`,
    pattern: () => [[52, 58], [148, 58], [52, 166], [148, 166]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="url(#metal)"/>`).join(""),
    eyes: (p) => ({
      visor: `<rect x="52" y="90" width="96" height="28" rx="14" fill="#0b0f1e"/><g filter="url(#glow)"><rect x="60" y="100" width="80" height="6" rx="3" fill="${p.base}"/></g>`,
      lights: `<rect x="60" y="92" width="80" height="26" rx="13" fill="#0b0f1e"/><g filter="url(#glow)"><circle cx="80" cy="105" r="7" fill="${p.base}"/><circle cx="120" cy="105" r="7" fill="${p.base}"/></g>`,
      camera: `<circle cx="100" cy="102" r="22" fill="#0b0f1e" stroke="url(#metal)" stroke-width="4"/><g filter="url(#glow)"><circle cx="100" cy="102" r="9" fill="${p.base}"/></g>${glossy(94, 96, 4, 2.4)}`,
      dials: `<circle cx="78" cy="102" r="14" fill="#0b0f1e" stroke="url(#metal)" stroke-width="3"/><circle cx="122" cy="102" r="14" fill="#0b0f1e" stroke="url(#metal)" stroke-width="3"/>${ink("M78 102 L86 94 M122 102 L114 94", p.base, 2.4)}`,
      hearts: `<rect x="56" y="88" width="88" height="32" rx="16" fill="#0b0f1e"/><g filter="url(#glow)"><path d="${heart(80, 104, 8)}" fill="${p.base}"/><path d="${heart(120, 104, 8)}" fill="${p.base}"/></g>`,
    })[eye],
    front: (p) => `<rect x="70" y="138" width="60" height="18" rx="6" fill="#0b0f1e"/><g filter="url(#glow)">${[78, 88, 98, 108, 118].map((x, i) => `<rect x="${x}" y="${144 - (i % 2) * 2}" width="5" height="${6 + (i % 2) * 4}" rx="1.5" fill="${p.base}"/>`).join("")}</g>`,
  });

  // ---------- Aliens ----------
  for (const [id, name, color] of [["alien-grey", "Grey alien", "#a8b0bc"], ["alien-green", "Little green", "#7ad34c"], ["alien-violet", "Space visitor", "#b44cff"], ["alien-teal", "Star traveller", "#2ec4b6"]]) add({
    id, name, color, shape: "M100 40 C148 40 166 76 160 110 C154 142 126 176 100 180 C74 176 46 142 40 110 C34 76 52 40 100 40Z", rim: "metal",
    back: () => trimLine(both("M86 44 C80 26 74 16 66 10"), 1.4) + `<circle cx="66" cy="10" r="4" fill="url(#gem)"/><circle cx="134" cy="10" r="4" fill="url(#gem)"/>`,
    eyes: () => `<path d="${both("M50 96 C54 78 88 82 96 108 C88 124 54 118 50 96Z")}" fill="url(#lens)"/>${glossy(64, 94, 7, 3.6, -25, 0.45)}${glossy(136, 94, 7, 3.6, 25, 0.45)}`,
    front: (p) => ink("M92 148 Q100 152 108 148", p.deep, 2),
  });

  // ---------- Cute food ----------
  const dots = (c, n = 24, o = 0.5) => Array.from({ length: n }, (_, i) => `<ellipse cx="${46 + ((i * 37) % 108)}" cy="${60 + ((i * 53) % 110)}" rx="1.6" ry="2.4" fill="${c}" opacity="${o}"/>`).join("");
  const FOOD = [
    ["food-orange", "Orange", "#ff9a1f", OUT.round, () => dots("#c25a00", 40, 0.35), () => `<path d="M100 50 C96 40 100 34 104 32" stroke="#5a3a1e" stroke-width="3" fill="none"/><path d="M104 40 C116 30 130 36 128 44 C118 48 110 46 104 40Z" fill="#3c8a2a"/>`],
    ["food-lemon", "Lemon", "#ffe14d", "M100 52 C140 52 164 82 166 112 C168 146 140 174 100 174 C60 174 32 146 34 112 C36 82 60 52 100 52Z", () => dots("#c9a800", 30, 0.35), () => `<path d="M100 52 C106 44 116 42 118 48 C112 52 106 52 100 52Z" fill="#7ad34c"/>`],
    ["food-apple", "Apple", "#e5242c", "M100 54 C120 40 162 50 162 98 C162 148 132 180 112 176 C106 174 102 172 100 172 C98 172 94 174 88 176 C68 180 38 148 38 98 C38 50 80 40 100 54Z", () => `<ellipse cx="72" cy="80" rx="16" ry="9" fill="#fff" opacity="0.35" transform="rotate(-30 72 80)"/>`, () => `<path d="M100 54 C98 44 102 34 108 28" stroke="#5a3a1e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M106 40 C120 26 140 32 138 42 C126 48 114 46 106 40Z" fill="#3c8a2a"/>`],
    ["food-strawberry", "Strawberry", "#e5243c", "M100 54 C140 46 168 74 162 110 C156 146 124 182 100 190 C76 182 44 146 38 110 C32 74 60 46 100 54Z", () => Array.from({ length: 26 }, (_, i) => `<ellipse cx="${50 + ((i * 37) % 100)}" cy="${78 + ((i * 53) % 96)}" rx="1.6" ry="2.6" fill="#ffe14d"/>`).join(""), () => `<path d="M64 62 L76 44 L86 58 L100 38 L114 58 L124 44 L136 62 C120 70 80 70 64 62Z" fill="#3c8a2a"/>`],
    ["food-pineapple", "Pineapple", "#f5c518", OUT.egg, (p) => { let s = ""; for (let i = -6; i < 14; i++) s += ink(`M${30 + i * 14} 40 L${130 + i * 14} 190`, p.deep, 1.4) + ink(`M${170 - i * 14} 40 L${70 - i * 14} 190`, p.deep, 1.4); return s; }, () => `<path d="M66 60 L74 18 L88 48 L100 4 L112 48 L126 18 L134 60 C116 66 84 66 66 60Z" fill="#3c8a2a"/>`],
    ["food-avocado", "Avocado", "#a8d36a", "M100 40 C126 40 140 70 150 100 C160 136 140 180 100 182 C60 180 40 136 50 100 C60 70 74 40 100 40Z", () => `<ellipse cx="100" cy="138" rx="24" ry="26" fill="#8a5a2c"/><ellipse cx="94" cy="130" rx="7" ry="5" fill="#fff" opacity="0.3"/>`, () => ""],
    ["food-cookie", "Cookie", "#d9a066", OUT.round, () => [[64, 72], [130, 70], [140, 132], [70, 150], [104, 162], [52, 112], [146, 100]].map(([x, y]) => `<path d="M${x} ${y - 6} L${x + 6} ${y + 3} L${x - 5} ${y + 5}Z" fill="#4a2a12"/>`).join(""), () => ""],
    ["food-pizza", "Pizza", "#ffcf5a", OUT.round, () => `<circle cx="100" cy="112" r="56" fill="#f2b33d"/>` + [[70, 80], [130, 84], [64, 140], [134, 144], [100, 164], [100, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#c2122a"/><circle cx="${x - 2}" cy="${y - 2}" r="3" fill="#e5484d"/>`).join(""), () => ""],
    ["food-burger", "Burger", "#e0a050", "M100 46 C150 46 166 86 166 104 L166 150 C166 166 150 176 134 176 L66 176 C50 176 34 166 34 150 L34 104 C34 86 50 46 100 46Z", () => `<rect x="30" y="118" width="140" height="10" fill="#3c8a2a"/><rect x="30" y="128" width="140" height="16" fill="#6a3418"/><rect x="30" y="144" width="140" height="6" fill="#ffc61a"/>` + Array.from({ length: 10 }, (_, i) => `<ellipse cx="${56 + ((i * 29) % 90)}" cy="${62 + ((i * 17) % 24)}" rx="2" ry="3.4" fill="#fff6d6"/>`).join(""), () => ""],
    ["food-egg", "Fried egg", "#fff8ec", "M100 44 C140 40 170 70 162 104 C176 130 160 172 120 176 C100 186 70 182 56 164 C30 160 30 120 42 104 C34 70 64 46 100 44Z", () => `<circle cx="100" cy="112" r="34" fill="#ffc61a"/><circle cx="90" cy="100" r="9" fill="#fff" opacity="0.5"/>`, () => ""],
    ["food-kiwi", "Kiwi", "#8fd14f", OUT.round, () => `<circle cx="100" cy="112" r="62" fill="#8a6a3a"/><circle cx="100" cy="112" r="56" fill="#8fd14f"/><circle cx="100" cy="112" r="18" fill="#f2f8d8"/>` + Array.from({ length: 16 }, (_, i) => { const t = (i / 16) * Math.PI * 2; return `<ellipse cx="${100 + Math.cos(t) * 26}" cy="${112 + Math.sin(t) * 26}" rx="2" ry="3.4" fill="#1c1828" transform="rotate(${(t * 180) / Math.PI + 90} ${100 + Math.cos(t) * 26} ${112 + Math.sin(t) * 26})"/>`; }).join(""), () => ""],
    ["food-cupcake", "Cupcake", "#ff8ab0", "M100 40 C146 40 164 76 158 102 L146 176 L54 176 L42 102 C36 76 54 40 100 40Z", () => `<path d="M42 122 L158 122 L146 176 L54 176Z" fill="#f2b33d"/>` + [60, 76, 92, 108, 124, 140].map((x) => ink(`M${x} 124 L${x + 2} 174`, "#c9822a", 2)).join("") + Array.from({ length: 12 }, (_, i) => `<rect x="${52 + ((i * 31) % 96)}" y="${56 + ((i * 19) % 50)}" width="6" height="2.4" rx="1.2" fill="${["#4f86f7", "#ffc61a", "#7ad34c", "#fff"][i % 4]}" transform="rotate(${i * 40} ${52 + ((i * 31) % 96)} ${56 + ((i * 19) % 50)})"/>`).join(""), () => `<circle cx="100" cy="36" r="9" fill="#e5242c"/>`],
  ];
  for (const [id, name, color, shape, pat, top] of FOOD) add({ id, name, color, shape, pattern: pat, eyes: () => kawaii(112), front: (p) => "", top });

  // ---------- Space ----------
  add({ id: "space-moon", name: "Moon", color: "#d8dde6", shape: OUT.round, pattern: () => [[70, 76, 10], [126, 70, 7], [140, 130, 12], [66, 140, 8], [104, 160, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#a8b0bc" opacity="0.6"/>`).join(""), eyes: () => kawaii(112) });
  add({ id: "space-sun", name: "Sunshine", color: "#ffc61a", shape: OUT.round, back: (p) => Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return `<path d="M${100 + Math.cos(t - 0.2) * 60} ${112 + Math.sin(t - 0.2) * 60} L${100 + Math.cos(t) * 92} ${112 + Math.sin(t) * 92} L${100 + Math.cos(t + 0.2) * 60} ${112 + Math.sin(t + 0.2) * 60}Z" fill="${p.alt}"/>`; }).join(""), eyes: () => kawaii(112) });
  add({ id: "space-earth", name: "Earth", color: "#3a8ee6", shape: OUT.round, pattern: () => `<path d="M60 70 C80 60 96 72 92 90 C88 104 70 104 66 120 C60 136 44 128 42 110 C42 92 48 78 60 70Z M120 120 C134 112 152 118 156 134 C156 150 140 164 124 160 C114 150 112 130 120 120Z M118 62 C130 58 144 66 140 78 C130 82 120 76 118 62Z" fill="#4fbf5a"/>`, eyes: () => kawaii(112) });
  add({ id: "space-saturn", name: "Saturn", color: "#f2c46a", shape: OUT.round, pattern: (p) => [70, 92, 132, 152].map((y) => `<path d="M30 ${y} L170 ${y}" stroke="${p.dark}" stroke-opacity="0.35" stroke-width="5"/>`).join(""), eyes: () => kawaii(112), top: (p) => `<ellipse cx="100" cy="124" rx="96" ry="18" fill="none" stroke="${p.alt}" stroke-width="8" transform="rotate(-12 100 124)"/>` });
  add({ id: "space-star", name: "Little star", color: "#ffe14d", shape: OUT.round, back: (p) => star5(100, 112, 92, p.base, `stroke="${p.dark}" stroke-width="2"`), eyes: () => kawaii(112) });
  add({ id: "space-astronaut", name: "Astronaut", color: "#f4f4f6", shape: OUT.round, rim: "soft", face: () => "url(#ivory)",
    back: () => `<rect x="24" y="92" width="18" height="40" rx="6" fill="#c9ced8"/><rect x="158" y="92" width="18" height="40" rx="6" fill="#c9ced8"/>`,
    pattern: () => `<path d="M48 92 C48 66 72 56 100 56 C128 56 152 66 152 92 L152 132 C152 158 128 166 100 166 C72 166 48 158 48 132Z" fill="url(#glass)"/><path d="M60 80 C70 66 90 62 104 64 C90 70 76 80 68 96Z" fill="#fff" opacity="0.35"/>`,
    eyes: () => "" });

  // ---------- Sports balls ----------
  add({ id: "ball-soccer", name: "Football", color: "#f7f7f7", shape: OUT.round, rim: "soft", pattern: () => `<path d="M100 92 L118 104 L112 126 L88 126 L82 104Z" fill="#1c1828"/>` + [[100, 54], [150, 92], [136, 156], [64, 156], [50, 92]].map(([x, y]) => `<path d="M${x} ${y - 12} L${x + 12} ${y - 3} L${x + 8} ${y + 11} L${x - 8} ${y + 11} L${x - 12} ${y - 3}Z" fill="#1c1828"/>`).join("") + ink("M100 92 L100 66 M118 104 L140 96 M112 126 L128 146 M88 126 L72 146 M82 104 L60 96", "#1c1828", 1.4), eyes: () => holes(ALMOND, "soft") });
  add({ id: "ball-basket", name: "Basketball", color: "#f2741f", shape: OUT.round, rim: "soft", pattern: () => ink("M38 112 L162 112 M100 50 L100 174 M54 66 C80 90 80 134 54 158 M146 66 C120 90 120 134 146 158", "#1c1828", 2.6), eyes: () => holes(ALMOND, "soft") });
  add({ id: "ball-tennis", name: "Tennis ball", color: "#d8f04a", shape: OUT.round, rim: "soft", pattern: () => ink("M44 76 C80 100 80 124 44 148 M156 76 C120 100 120 124 156 148", "#fff", 4), eyes: () => holes(ALMOND, "soft") });
  add({ id: "ball-base", name: "Baseball", color: "#f7f4ee", shape: OUT.round, rim: "soft", pattern: () => ink("M52 70 C74 96 74 128 52 154 M148 70 C126 96 126 128 148 154", "#d92f3a", 2) + Array.from({ length: 8 }, (_, i) => ink(`M${58 + Math.sin(i / 2.3) * 6} ${76 + i * 10} l6 -3 M${142 - Math.sin(i / 2.3) * 6} ${76 + i * 10} l-6 -3`, "#d92f3a", 1.4)).join(""), eyes: () => holes(ALMOND, "soft") });
  add({ id: "ball-volley", name: "Volleyball", color: "#f7f7f7", shape: OUT.round, rim: "soft", pattern: () => `<path d="M100 112 C80 90 74 66 80 52 C60 60 46 78 42 96 C60 92 82 98 100 112Z" fill="#1f5fbf"/><path d="M100 112 C126 104 146 112 158 122 C160 100 150 78 136 66 C130 84 116 100 100 112Z" fill="#ffc61a"/>` + ink("M100 112 L96 174", "#1c1828", 1.2), eyes: () => holes(ALMOND, "soft") });

  // ---------- Spooky and seasonal characters ----------
  add({ id: "char-snowman", name: "Snowman", color: "#f7fbff", shape: OUT.round, rim: "soft", face: () => "url(#ivory)",
    back: () => `<rect x="62" y="6" width="76" height="46" rx="4" fill="#1c1828"/><rect x="48" y="48" width="104" height="10" rx="4" fill="#1c1828"/><rect x="62" y="36" width="76" height="8" fill="#c2122a"/>`,
    eyes: () => `<circle cx="80" cy="102" r="6" fill="#1c1828"/><circle cx="120" cy="102" r="6" fill="#1c1828"/>`,
    front: () => `<path d="M96 116 L138 128 L96 128Z" fill="#f2741f"/>` + [80, 90, 100, 110, 120].map((x, i) => `<circle cx="${x}" cy="${148 + Math.abs(i - 2) * -2}" r="3" fill="#1c1828"/>`).join("") });
  add({ id: "char-gingerbread", name: "Gingerbread", color: "#b8732e", shape: OUT.round, rim: "soft",
    pattern: () => ink("M42 80 Q50 72 58 80 T74 80 M126 80 Q134 72 142 80 T158 80", "#fff", 3),
    eyes: () => `<circle cx="80" cy="104" r="6" fill="#fff"/><circle cx="120" cy="104" r="6" fill="#fff"/>`,
    front: () => ink("M80 140 Q100 158 120 140", "#fff", 4) + blush(130, "#e5484d", 0.6, 36, 7) });
  add({ id: "char-mummy", name: "Mummy", color: "#efe6d2", shape: OUT.egg, rim: "soft",
    pattern: () => Array.from({ length: 12 }, (_, i) => `<path d="M30 ${50 + i * 12} C70 ${44 + i * 12 + (i % 2) * 8} 130 ${56 + i * 12 - (i % 2) * 8} 170 ${48 + i * 12}" fill="none" stroke="#c9bca0" stroke-width="5"/>`).join(""),
    eyes: () => `<path d="M58 96 L144 96 L144 112 L58 112Z" fill="#1c1828"/><circle cx="80" cy="104" r="5" fill="#e5242c"/><circle cx="120" cy="104" r="5" fill="#e5242c"/>` });
  add({ id: "char-zombie", name: "Zombie", color: "#8fbf6a", shape: OUT.egg,
    pattern: (p) => `<path d="M60 70 L72 80 L66 88 L78 96" stroke="${p.deep}" stroke-width="2" fill="none"/>` + [62, 68, 74].map((x) => ink(`M${x} 74 L${x + 4} 82`, p.deep, 1.4)).join(""),
    eyes: () => `<circle cx="78" cy="104" r="11" fill="#f4f0d8"/><circle cx="122" cy="106" r="8" fill="#f4f0d8"/><circle cx="80" cy="106" r="3.6" fill="#1c1828"/><circle cx="120" cy="108" r="2.6" fill="#1c1828"/>`,
    front: () => `<path d="M76 146 L124 142 L122 156 L78 158Z" fill="#3a0d16"/>${[84, 96, 108, 118].map((x) => `<rect x="${x}" y="143" width="6" height="7" fill="#f4f0d8"/>`).join("")}` });
  add({ id: "char-vampire", name: "Vampire", color: "#f0ece6", shape: OUT.egg,
    back: () => `<path d="M10 60 C40 80 50 120 46 180 L30 210 L20 140 C14 110 10 80 10 60Z M190 60 C160 80 150 120 154 180 L170 210 L180 140 C186 110 190 80 190 60Z" fill="#c2122a"/>`,
    pattern: () => `<path d="M48 90 C50 60 70 46 100 46 C130 46 150 60 152 90 C136 74 118 70 100 82 C82 70 64 74 48 90Z" fill="#1c1828"/>`,
    eyes: () => `<path d="${both("M64 106 C70 100 86 100 92 106 C86 110 70 110 64 106Z")}" fill="#c2122a"/>` + ink(both("M60 96 L92 100"), "#1c1828", 3),
    front: () => `<path d="M82 146 Q100 154 118 146" stroke="#7a1018" stroke-width="3" fill="none"/><path d="M88 148 L92 160 L95 149Z M112 148 L108 160 L105 149Z" fill="#fff"/>` });
  add({ id: "char-frank", name: "Monster bolts", color: "#7ab86a", shape: "M50 48 L150 48 C158 48 160 54 160 62 L160 150 C160 170 140 182 100 182 C60 182 40 170 40 150 L40 62 C40 54 42 48 50 48Z",
    back: () => `<rect x="20" y="130" width="22" height="10" rx="2" fill="url(#chrome)"/><rect x="158" y="130" width="22" height="10" rx="2" fill="url(#chrome)"/>`,
    pattern: () => `<path d="M40 48 L160 48 L160 70 L148 64 L136 72 L122 64 L108 72 L94 64 L80 72 L66 64 L52 72 L40 66Z" fill="#1c1828"/>` + ink("M70 84 L90 86 M76 80 L76 90 M84 80 L84 90", "#1c1828", 1.6),
    eyes: () => `<path d="${both("M62 106 L94 106 C92 98 66 96 62 106Z")}" fill="#f4f0d8"/><circle cx="78" cy="104" r="3.4" fill="#1c1828"/><circle cx="122" cy="104" r="3.4" fill="#1c1828"/>`,
    front: () => ink("M76 152 L124 152", "#1c1828", 3) });
  add({ id: "char-witch", name: "Witch", color: "#8fbf6a", shape: OUT.egg,
    back: () => `<path d="M100 -30 L52 60 L148 60Z" fill="#2a1d3a"/><ellipse cx="100" cy="60" rx="80" ry="12" fill="#1c1828"/><rect x="62" y="44" width="76" height="8" fill="#9b5de5"/>`,
    eyes: () => cuteEyes(104, 8, "#1c1828", 22),
    front: () => `<path d="M96 108 C104 120 112 134 104 140 C100 142 96 138 98 134Z" fill="#6a9a50"/><circle cx="110" cy="128" r="2.4" fill="#4a6a3a"/>` + ink("M82 152 Q100 160 118 150", "#1c1828", 2.4) });
  add({ id: "char-scarecrow", name: "Scarecrow", color: "#d9b878", shape: OUT.egg, rim: "soft",
    back: () => `<path d="M40 70 C40 40 70 20 100 20 C130 20 160 40 160 70Z" fill="#8a5a2c"/><ellipse cx="100" cy="70" rx="78" ry="12" fill="#6a4220"/>` + Array.from({ length: 10 }, (_, i) => ink(`M${40 + i * 13} 78 L${36 + i * 13} ${92 + (i % 3) * 4}`, "#e8c050", 2.4)).join(""),
    pattern: () => ink("M50 130 L60 128 M140 130 L150 128 M74 160 C90 166 110 166 126 160", "#6a4220", 1.4, 'stroke-dasharray="3 3"'),
    eyes: () => `<path d="M68 96 L88 96 L78 112Z M112 96 L132 96 L122 112Z" fill="#1c1828"/>`,
    front: () => ink("M74 148 L82 154 L90 148 L98 154 L106 148 L114 154 L122 148 L128 152", "#1c1828", 2.2) });
  add({ id: "char-pirate", name: "Captain", color: "#e8c4a0", shape: OUT.egg,
    back: () => `<path d="M20 70 C40 40 70 30 100 34 C130 30 160 40 180 70 C150 60 130 64 100 64 C70 64 50 60 20 70Z" fill="#1c1828"/><path d="M90 44 L110 44 L100 60Z" fill="#fff"/>`,
    eyes: () => `<path d="M60 100 C60 88 92 88 92 100 C92 114 60 114 60 100Z" fill="#1c1828"/>${ink("M48 76 L152 128", "#1c1828", 2)}` + cuteEye(122, 103, 9),
    front: () => `<path d="M100 132 C92 124 76 124 70 134 C66 140 58 140 56 134 C56 146 70 150 80 144 C88 140 96 138 100 138 C104 138 112 140 120 144 C130 150 144 146 144 134 C142 140 134 140 130 134 C124 124 108 124 100 132Z" fill="#4a2a12"/>` });
  add({ id: "char-clown2", name: "Circus clown", color: "#f7f4ee", shape: OUT.round, rim: "soft", face: () => "url(#ivory)",
    back: () => [[38, 70, "#ff5fa2"], [30, 100, "#4f86f7"], [162, 70, "#7ad34c"], [170, 100, "#ffc61a"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="20" fill="${c}"/>`).join(""),
    pattern: () => `<path d="${both("M64 88 L78 80 L92 88 L78 118Z")}" fill="#4f86f7" opacity="0.8"/>`,
    eyes: () => cuteEyes(102, 7, "#1c1828", 22),
    front: () => `<path d="M64 134 C80 168 120 168 136 134 C120 146 80 146 64 134Z" fill="#e5242c"/><circle cx="100" cy="122" r="11" fill="url(#red)"/>${glossy(96, 117, 4, 2.6)}` });
  add({ id: "char-ghost2", name: "Boo", color: "#f2f4ff", shape: OUT.ghost ?? OUT.round, rim: "cartoon", face: () => "url(#face)",
    eyes: () => `<ellipse cx="80" cy="104" rx="9" ry="13" fill="#1c1828"/><ellipse cx="120" cy="104" rx="9" ry="13" fill="#1c1828"/>`,
    front: () => `<path d="M80 138 Q100 160 120 138 Q100 150 80 138Z" fill="#1c1828"/><path d="M92 146 Q100 158 108 146Z" fill="#ef5d78"/>` });

  return out;
}
