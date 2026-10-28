// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Venetian carnival masks (Volto, Bauta, Gatto, Jolly, Zanni, Moretta, Dama) in many finishes,
 * and masks from around the world: Chinese opera, Kabuki, Noh, Día de Muertos skulls, lucha libre,
 * tiki, Aztec, Inca, Egyptian, Greek, Balinese, Korean, samurai and knights.
 * Every outline covers the whole face.
 */

export function worldSet(k) {
  const { OUT, ink, gem, trimLine, mirror, both, glossy, star, star5, heart, feather, flower, holes, ALMOND, scallops, pair2 } = k;
  const out = [];

  // ---------- Venetian ----------
  const VOLTO = "M100 42 C136 42 154 70 154 104 C154 144 134 178 100 184 C66 178 46 144 46 104 C46 70 64 42 100 42Z";
  const BAUTA = "M100 44 C134 44 154 72 154 102 C154 118 150 130 148 138 L134 188 L66 188 L52 138 C50 130 46 118 46 102 C46 72 66 44 100 44Z";
  const MORETTA = "M100 46 C136 46 156 76 156 110 C156 146 132 176 100 176 C68 176 44 146 44 110 C44 76 64 46 100 46Z";
  // Sculpted features: brow ridge, a nose and closed lips, as soft light and shade
  const sculpt = (p, lips = true) => `<path d="M100 92 C96 112 92 126 95 132 C98 136 102 136 105 132 C108 126 104 112 100 92Z" fill="#000" opacity="0.1"/><path d="M101 94 C103 110 106 122 104 130" stroke="#fff" stroke-opacity="0.35" stroke-width="2.4" fill="none"/>${ink(both("M58 90 C70 80 88 82 96 90"), "#000", 3, 'stroke-opacity="0.12"')}` + (lips ? `<path d="M86 152 C92 148 98 150 100 151 C102 150 108 148 114 152 C108 158 92 158 86 152Z" fill="${p.deep}" opacity="0.55"/>${ink("M86 152 C94 154 106 154 114 152", "#000", 1, 'stroke-opacity="0.35"')}` : "");
  const FIN = {
    gold: { name: "Gold leaf", face: () => "url(#metal)", pat: (p) => crackle(p.deep, 0.25) },
    silver: { name: "Silver", face: () => "url(#chrome)", pat: () => crackle("#4e5562", 0.2) },
    porcelain: { name: "Porcelain", face: () => "url(#ivory)", pat: () => filigree() },
    lacquer: { name: "Black lacquer", face: () => "#15121c", pat: () => `<ellipse cx="78" cy="72" rx="34" ry="14" fill="#fff" opacity="0.18" transform="rotate(-24 78 72)"/>` + filigree(0.8) },
    damask: { name: "Damask", face: (p) => p.base, pat: (p) => damask(p) },
    music: { name: "Music", face: () => "url(#ivory)", pat: () => music() },
    marble: { name: "Marble", face: () => "url(#ivory)", pat: () => marble() },
    mosaic: { name: "Mosaic", face: (p) => p.base, pat: (p) => mosaic(p) },
    stars: { name: "Starry night", face: () => "#141a3a", pat: () => stars() },
    roses: { name: "Roses", face: () => "url(#ivory)", pat: (p) => roses(p) },
    harlequin: { name: "Harlequin", face: (p) => p.base, pat: (p) => diamonds(p) },
    velvet: { name: "Velvet", face: (p) => p.base, pat: (p) => `<path d="${VOLTO}" fill="none" stroke="${p.light}" stroke-opacity="0.35" stroke-width="10" filter="url(#soft)"/>` + filigree(0.9) },
  };
  function crackle(c, o) { let s = ""; for (let i = 0; i < 26; i++) { const x = 40 + ((i * 37) % 120), y = 50 + ((i * 53) % 130); s += `<path d="M${x} ${y} l${(i % 5) * 2 - 4} 6 l${(i % 3) * 3 - 3} 5 l4 4" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="0.8"/>`; } return s; }
  function filigree(o = 1) { return [both("M58 86 C66 74 84 72 94 82"), both("M54 122 C58 136 72 142 82 136 C78 128 70 126 66 132"), both("M64 70 C70 60 82 58 90 64"), "M100 62 C94 70 94 78 100 84 C106 78 106 70 100 62"].map((d) => trimLine(d, 1.4 * o)).join(""); }
  function damask(p) { let s = ""; for (let y = 40; y < 190; y += 24) for (let x = 40 + ((y / 24) % 2) * 12; x < 170; x += 24) s += `<path d="M${x} ${y - 9} C${x + 6} ${y - 4} ${x + 6} ${y + 4} ${x} ${y + 9} C${x - 6} ${y + 4} ${x - 6} ${y - 4} ${x} ${y - 9}Z M${x - 9} ${y} C${x - 4} ${y - 3} ${x + 4} ${y - 3} ${x + 9} ${y} C${x + 4} ${y + 3} ${x - 4} ${y + 3} ${x - 9} ${y}Z" fill="${p.light}" opacity="0.45"/>`; return s + filigree(0.8); }
  function music() { let s = ""; for (let r = 0; r < 5; r++) { const y0 = 54 + r * 26; s += Array.from({ length: 5 }, (_, i) => `<path d="M40 ${y0 + i * 3} L160 ${y0 + i * 3}" stroke="#3a3448" stroke-opacity="0.5" stroke-width="0.6"/>`).join(""); for (let j = 0; j < 6; j++) { const x = 48 + j * 20 + r * 3, y = y0 + ((j * 5 + r) % 4) * 3; s += `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="2" fill="#1c1828" transform="rotate(-20 ${x} ${y})"/><path d="M${x + 2.4} ${y} L${x + 2.4} ${y - 10}" stroke="#1c1828" stroke-width="0.8"/>`; } } return s; }
  function marble() { return Array.from({ length: 9 }, (_, i) => `<path d="M${30 + i * 18} 40 C${50 + i * 14} 80 ${20 + i * 16} 120 ${44 + i * 15} 190" fill="none" stroke="#8a8396" stroke-opacity="${0.15 + (i % 3) * 0.08}" stroke-width="${0.6 + (i % 2)}"/>`).join(""); }
  function mosaic(p) { let s = ""; for (let y = 40; y < 192; y += 8) for (let x = 40; x < 162; x += 8) s += `<rect x="${x + 0.6}" y="${y + 0.6}" width="6.8" height="6.8" fill="${[p.base, p.light, p.alt, "url(#metal)", p.dark, p.pale][(x * 7 + y * 13) % 6]}"/>`; return s; }
  function stars() { return Array.from({ length: 40 }, (_, i) => { const x = 44 + ((i * 41) % 112), y = 48 + ((i * 67) % 134); return i % 7 ? `<circle cx="${x}" cy="${y}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="0.85"/>` : star(x, y, 4, "url(#metal)"); }).join("") + `<path d="M120 60 C108 62 102 74 106 84 C98 76 100 62 112 56 C114 58 118 59 120 60Z" fill="url(#metal)"/>`; }
  function roses(p) { return [[60, 72], [140, 72], [62, 150], [138, 150], [100, 62]].map(([x, y]) => flower(x, y, 9, p.dark, "url(#metal)")).join("") + filigree(0.7); }
  function diamonds(p) { let s = ""; let r = 0; for (let y = 42; y < 192; y += 18) { r++; for (let x = 40 + (r % 2) * 7; x < 164; x += 14) { const c = (Math.round(x / 7) + r) % 3; s += `<path d="M${x} ${y - 9} L${x + 7} ${y} L${x} ${y + 9} L${x - 7} ${y}Z" fill="${c === 0 ? p.base : c === 1 ? "#1c1828" : "#fbf6ee"}" stroke="url(#metal)" stroke-width="0.6"/>`; } } return s; }

  const venetian = (id, name, form, fin, color, extra = {}) => {
    const f = FIN[fin];
    const shapes = { volto: VOLTO, bauta: BAUTA, gatto: VOLTO, jolly: VOLTO, zanni: VOLTO, dama: VOLTO };
    out.push({
      id, name, cat: "venetian", color, shape: shapes[form], rim: "metal", face: f.face,
      back: extra.back,
      pattern: (p) => f.pat(p) + sculpt(p, form !== "bauta"),
      eyes: () => holes(ALMOND, "metal"),
      front: extra.front,
    });
  };
  const VO = [["gold", "#e8b143"], ["silver", "#c3c9d4"], ["porcelain", "#e8b143"], ["lacquer", "#1c1828"], ["damask", "#7a1430"], ["music", "#e8b143"], ["marble", "#e8b143"], ["mosaic", "#0f8a8a"], ["stars", "#253a8f"], ["roses", "#c2306b"], ["harlequin", "#d92f3a"], ["velvet", "#5b3fd9"]];
  for (const [fin, c] of VO) venetian(`volto-${fin}`, `Volto ${FIN[fin].name.toLowerCase()}`, "volto", fin, c);
  for (const [fin, c] of [["gold", "#e8b143"], ["porcelain", "#e8b143"], ["lacquer", "#1c1828"], ["damask", "#253a8f"], ["marble", "#e8b143"]]) venetian(`bauta-${fin}`, `Bauta ${FIN[fin].name.toLowerCase()}`, "bauta", fin, c, { front: () => gem(100, 70, 3.6) });
  const catEars = (p) => pair2("M62 76 L52 22 L92 56Z", "url(#metal)", p.base, "M64 68 L58 34 L84 58Z", p);
  for (const [fin, c] of [["gold", "#e8b143"], ["lacquer", "#1c1828"], ["damask", "#7a1430"], ["stars", "#253a8f"], ["mosaic", "#b44cff"]]) venetian(`gatto-${fin}`, `Gatto ${FIN[fin].name.toLowerCase()}`, "gatto", fin, c, { back: catEars, front: () => ink(both("M64 138 L36 132 M64 144 L36 146 M64 150 L38 158"), "url(#metal)", 1.2) + `<path d="M94 128 L106 128 L100 136Z" fill="#1c1828"/>` });
  const jesterHat = (p) => `<path d="M60 64 C40 40 20 30 0 34 C18 46 30 62 40 82Z" fill="${p.base}"/><path d="M140 64 C160 40 180 30 200 34 C182 46 170 62 160 82Z" fill="#1c1828"/><path d="M78 52 C80 26 92 4 100 -10 C108 4 120 26 122 52Z" fill="${p.alt}"/><path d="M44 66 C60 46 140 46 156 66 L154 78 C140 62 60 62 46 78Z" fill="url(#metal)"/>` + [[0, 34], [200, 34], [100, -12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="url(#metal)"/><path d="M${x - 4} ${y + 2} L${x + 4} ${y + 2}" stroke="#7a4e00" stroke-width="1"/>`).join("");
  for (const [c, nm] of [["#d92f3a", "Jolly"], ["#5b3fd9", "Jolly violet"], ["#1f9d6b", "Jolly emerald"], ["#e8b143", "Jolly gold"]]) out.push({ id: `jolly-${c.slice(1)}`, name: nm, cat: "venetian", color: c, shape: VOLTO, rim: "metal", face: () => "url(#ivory)", back: jesterHat,
    pattern: (p) => `<path d="M100 42 L100 184 L46 184 L46 42Z" fill="${p.base}" opacity="0.85"/>` + sculpt(p) + filigree(0.8),
    eyes: () => holes(ALMOND, "metal"), front: () => ink(both("M60 130 C64 140 72 144 78 140"), "url(#metal)", 1.2) });
  for (const [fin, c] of [["gold", "#e8b143"], ["porcelain", "#e8b143"], ["lacquer", "#1c1828"]]) venetian(`zanni-${fin}`, `Zanni ${FIN[fin].name.toLowerCase()}`, "zanni", fin, c, { front: (p) => `<path d="M94 98 L100 96 L106 98 L118 176 L100 184 L82 176Z" fill="${FIN[fin].face(p)}" stroke="url(#metal)" stroke-width="1.6"/><path d="M100 100 L104 172" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>` });
  for (const [c, nm] of [["#15121c", "Moretta"], ["#3a0d1a", "Moretta wine"]]) out.push({ id: `moretta-${c.slice(1)}`, name: nm, cat: "venetian", color: c, shape: MORETTA, rim: "soft", face: (p) => p.base,
    pattern: (p) => `<path d="${MORETTA}" fill="none" stroke="${p.light}" stroke-opacity="0.3" stroke-width="10" filter="url(#soft)"/><ellipse cx="80" cy="76" rx="26" ry="10" fill="#fff" opacity="0.12" transform="rotate(-24 80 76)"/>`,
    eyes: () => `<ellipse cx="78" cy="104" rx="9" ry="7" fill="url(#hole)"/><ellipse cx="122" cy="104" rx="9" ry="7" fill="url(#hole)"/>` });
  const plumes = (p) => [[-110, 96, 11, "alt"], [-92, 106, 12, "base"], [-74, 100, 11, "alt2"], [-58, 88, 10, "pale"]].map(([a, l, w, c], i) => feather(140, 60, a, l, w, p[c], p.deep, `dm${i}`)).join("");
  for (const [fin, c] of [["gold", "#e8b143"], ["porcelain", "#c2306b"], ["lacquer", "#1c1828"], ["roses", "#c2306b"]]) venetian(`dama-${fin}`, `Dama ${FIN[fin].name.toLowerCase()}`, "dama", fin, c, { back: plumes, front: () => gem(140, 60, 6) + gem(100, 72, 3) });

  // ---------- Chinese opera faces (jingju) ----------
  const OPERA = [
    ["red", "Opera red", "#c8242c", 0], ["black", "Opera black", "#1c1828", 0], ["white", "Opera white", "#f4eee4", 1], ["blue", "Opera blue", "#1f5fbf", 1],
    ["green", "Opera green", "#1f9d4a", 2], ["gold", "Opera gold", "#e8b143", 2], ["purple", "Opera purple", "#6b2fbf", 0], ["pink", "Opera rose", "#e0607e", 1],
    ["redcross", "Opera general", "#c8242c", 2], ["blackcross", "Opera judge", "#1c1828", 2], ["whitered", "Opera schemer", "#f4eee4", 0], ["silver", "Opera silver", "#9aa3b5", 1],
  ];
  for (const [id, name, color, t] of OPERA) out.push({
    id: `opera-${id}`, name, cat: "world", color, shape: OUT.egg, rim: "soft", face: (p) => p.base,
    pattern: (p) => {
      const ink2 = p.base === "#1c1828" || color === "#1c1828" ? "#f4eee4" : "#1c1828";
      let s = "";
      if (t === 0) s += `<path d="${both("M50 92 C58 66 84 60 98 70 C88 76 80 86 78 96 C70 92 58 92 50 100Z")}" fill="${ink2}"/><path d="${both("M60 100 C66 88 90 88 96 104 C90 120 66 122 60 108Z")}" fill="#f4eee4"/>`;
      if (t === 1) s += `<path d="M48 108 C50 80 64 62 80 58 L90 98 C76 98 62 104 48 108Z M152 108 C150 80 136 62 120 58 L110 98 C124 98 138 104 152 108Z" fill="${ink2}" opacity="0.9"/><path d="M90 58 L110 58 L104 120 L96 120Z" fill="#c8242c"/>`;
      if (t === 2) s += `<path d="M92 50 L108 50 L104 136 L96 136Z" fill="${ink2}"/><path d="M50 92 L150 92 L150 104 L50 104Z" fill="${ink2}" opacity="0.85"/><path d="M96 60 C90 68 92 78 100 82 C108 78 110 68 104 60Z" fill="#c8242c"/>`;
      s += ink(both("M54 84 C64 66 84 64 96 74"), ink2, 4) + `<path d="${both("M62 132 C70 146 84 150 92 146 C84 140 74 136 62 132Z")}" fill="${ink2}" opacity="0.7"/>`;
      return s;
    },
    eyes: () => `<path d="${both("M64 104 C70 96 88 96 94 104 C88 110 70 110 64 104Z")}" fill="#120a06"/>`,
    front: (p) => `<path d="M90 150 C96 146 104 146 110 150 C104 156 96 156 90 150Z" fill="#c8242c"/>`,
  });

  // ---------- Kabuki kumadori: white face, bold sweeping lines ----------
  const KUMA = [["mukimi", "Kabuki hero", "#d92f3a", 0], ["sujiguma", "Kabuki warrior", "#c8242c", 1], ["kugeguma", "Kabuki villain", "#1f5fbf", 2], ["saruguma", "Kabuki monkey", "#d92f3a", 3]];
  for (const [id, name, color, t] of KUMA) out.push({
    id: `kabuki-${id}`, name, cat: "world", color, shape: OUT.egg, rim: "soft", face: () => "url(#ivory)",
    pattern: (p) => {
      const c = p.base;
      const L = [
        [both("M56 92 C66 70 86 66 98 78"), both("M60 120 C70 112 82 112 92 118"), both("M56 140 C64 150 74 154 82 152")],
        [both("M52 96 C60 60 86 52 98 66"), both("M48 120 C58 106 76 104 90 112"), both("M50 140 C60 130 76 130 88 136"), both("M60 158 C68 152 80 152 88 156"), "M100 50 L100 70"],
        [both("M52 90 C62 62 88 56 98 70"), both("M48 118 C56 110 70 108 84 116 C70 122 60 130 54 142"), both("M62 70 L50 54")],
        [both("M56 86 C70 72 86 74 96 86"), both("M58 116 C64 130 74 140 88 142"), "M80 60 C90 54 110 54 120 60"],
      ][t];
      return L.map((d) => ink(d, c, 4.4)).join("") + ink(both("M58 84 C70 70 86 70 96 80"), "#1c1828", 3.6);
    },
    eyes: (p) => `<path d="${both("M62 104 C70 94 88 96 96 104 C88 110 70 110 62 104Z")}" fill="#120a06"/>${ink(both("M60 106 L52 100"), p.base, 2.6)}`,
    front: (p) => `<path d="M86 150 C94 146 106 146 114 150 C106 156 94 156 86 150Z" fill="${t === 2 ? "#1c1828" : p.base}"/>`,
  });

  // ---------- Noh ----------
  out.push({ id: "noh-koomote", name: "Noh Ko-omote", cat: "world", color: "#1c1828", shape: OUT.egg, rim: "soft", face: () => "url(#ivory)",
    back: () => `<path d="M48 104 C44 56 70 40 100 40 C130 40 156 56 152 104 C140 72 120 62 100 62 C80 62 60 72 48 104Z" fill="#1c1828"/>`,
    pattern: () => `<ellipse cx="78" cy="74" rx="7" ry="4" fill="#3a3448" opacity="0.7"/><ellipse cx="122" cy="74" rx="7" ry="4" fill="#3a3448" opacity="0.7"/>`,
    eyes: () => `<path d="${both("M66 104 C72 100 88 100 92 104 C88 106 72 106 66 104Z")}" fill="#1c1828"/>`,
    front: () => `<path d="M90 150 C96 146 104 146 110 150 C104 156 96 156 90 150Z" fill="#c2122a"/><path d="M93 150 L107 150" stroke="#1c1828" stroke-width="1.4"/>` });
  out.push({ id: "noh-hannya", name: "Hannya", cat: "world", color: "#e8d8b8", shape: OUT.wide, rim: "soft", face: (p) => p.base,
    back: () => `<path d="M64 66 C52 44 46 20 58 2 C64 24 76 40 88 54Z" fill="url(#metal)"/><path d="${mirror("M64 66 C52 44 46 20 58 2 C64 24 76 40 88 54Z")}" fill="url(#metal)"/><path d="M42 106 C38 60 70 44 100 44 C130 44 162 60 158 106 C144 70 120 62 100 62 C80 62 56 70 42 106Z" fill="#1c1828"/>`,
    pattern: (p) => ink(both("M56 92 C66 80 86 80 96 94"), p.deep, 4) + ink(both("M60 124 C66 132 72 136 80 136"), p.deep, 2),
    eyes: () => `<path d="${both("M62 106 C70 94 88 96 96 106 C88 114 70 114 62 106Z")}" fill="url(#metal)"/><circle cx="80" cy="105" r="4" fill="#1c1828"/><circle cx="120" cy="105" r="4" fill="#1c1828"/>`,
    front: () => `<path d="M60 140 C76 132 124 132 140 140 C134 170 66 170 60 140Z" fill="#7a1018"/><path d="M64 140 L136 140 L132 148 L68 148Z" fill="url(#metal)"/><path d="M70 160 L130 160 L126 166 L74 166Z" fill="url(#metal)"/><path d="M68 140 L64 150 L72 146Z M132 140 L136 150 L128 146Z" fill="#fff"/>` });
  out.push({ id: "noh-okina", name: "Okina", cat: "world", color: "#d8c3a0", shape: OUT.egg, rim: "soft", face: (p) => p.base,
    back: () => Array.from({ length: 12 }, (_, i) => ink(`M${70 + i * 5} 160 C${68 + i * 5} 180 ${66 + i * 5} 196 ${70 + i * 5} 214`, "#f4eee4", 2.6)).join(""),
    pattern: (p) => `<circle cx="74" cy="80" r="7" fill="#f4eee4"/><circle cx="126" cy="80" r="7" fill="#f4eee4"/>` + ink(both("M56 120 C66 128 76 128 84 122 M58 132 C68 140 78 140 86 134"), p.deep, 1.6) + ink("M80 60 C90 56 110 56 120 60", p.deep, 1.4),
    eyes: (p) => ink(both("M64 106 Q78 96 94 106"), "#1c1828", 4),
    front: (p) => `<path d="M80 148 Q100 164 120 148 Q100 156 80 148Z" fill="#1c1828"/>` });
  out.push({ id: "noh-beshimi", name: "Beshimi", cat: "world", color: "#8a4e22", shape: OUT.wide, rim: "soft", face: () => "url(#face)",
    pattern: (p) => ink(both("M54 94 C64 78 86 80 96 96"), p.deep, 5) + ink(both("M62 128 C70 136 80 138 88 134"), p.deep, 2),
    eyes: () => `<circle cx="78" cy="106" r="11" fill="url(#metal)"/><circle cx="122" cy="106" r="11" fill="url(#metal)"/><circle cx="78" cy="106" r="5" fill="#1c1828"/><circle cx="122" cy="106" r="5" fill="#1c1828"/>`,
    front: (p) => `<path d="M72 152 C84 160 116 160 128 152 C116 156 84 156 72 152Z" fill="${p.deep}"/>${ink("M72 152 C84 160 116 160 128 152", "#1c1828", 3)}<path d="M92 112 C88 126 86 134 92 138 L108 138 C114 134 112 126 108 112Z" fill="${p.dark}"/>` });

  // ---------- Día de Muertos skulls ----------
  const SKULL = OUT.skull;
  const CAL = [
    ["rosa", "Calavera rosa", "#ff5fa2", "flowers"], ["azul", "Calavera azul", "#1f9dd9", "hearts"], ["oro", "Calavera de oro", "#e8b143", "web"],
    ["noche", "Calavera noche", "#1c1828", "flowers"], ["verde", "Calavera verde", "#1f9d6b", "swirls"], ["lila", "Calavera lila", "#9b5de5", "stars"],
    ["fuego", "Calavera fuego", "#f2741f", "flames"], ["blanca", "Calavera blanca", "#e5484d", "dots"], ["corazon", "Calavera corazón", "#d92f3a", "hearts"],
    ["catrina", "La Catrina", "#c2306b", "crown"], ["menta", "Calavera menta", "#2ec4b6", "dots"], ["sol", "Calavera sol", "#ffc61a", "swirls"],
    ["mar", "Calavera del mar", "#253a8f", "stars"], ["jardin", "Calavera jardín", "#7ad34c", "flowers"], ["rubi", "Calavera rubí", "#9b1b30", "web"],
  ];
  for (const [id, name, color, motif] of CAL) out.push({
    id: `calavera-${id}`, name, cat: "world", color, shape: SKULL, rim: "soft", face: () => (color === "#1c1828" ? "#1d1a26" : "url(#ivory)"),
    back: (p) => motif === "crown" ? [56, 72, 88, 100, 112, 128, 144].map((x, i) => flower(x, 52 - Math.sin((i / 6) * Math.PI) * 12, 9, p.dark, "url(#metal)")).join("") : "",
    pattern: (p) => {
      const ring = (cx) => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; const x = cx + Math.cos(a) * 21, y = 104 + Math.sin(a) * 19; return motif === "hearts" ? `<path d="${heart(x, y, 3)}" fill="${i % 2 ? p.base : p.alt}"/>` : motif === "stars" ? star(x, y, 3.4, i % 2 ? p.base : p.alt) : `<circle cx="${x}" cy="${y}" r="3" fill="${i % 2 ? p.base : p.alt}"/>`; }).join("");
      let s = ring(78) + ring(122);
      if (motif === "flowers" || motif === "crown") s += flower(100, 66, 11, p.dark, "url(#metal)");
      if (motif === "web") s += Array.from({ length: 6 }, (_, i) => ink(`M100 46 L${70 + i * 12} 80`, p.base, 1)).join("") + [10, 20, 30].map((r) => ink(`M${100 - r * 0.9} ${46 + r * 0.9} Q100 ${50 + r} ${100 + r * 0.9} ${46 + r * 0.9}`, p.base, 1)).join("");
      if (motif === "swirls") s += ink(both("M56 70 C46 80 56 92 64 84 C70 78 62 72 58 78"), p.base, 2) + ink("M88 62 C94 54 106 54 112 62", p.alt, 2.4);
      if (motif === "flames") s += `<path d="M84 80 C80 66 92 60 92 48 C100 58 102 52 104 44 C112 56 120 64 116 80Z" fill="${p.base}"/>`;
      if (motif === "dots") s += Array.from({ length: 9 }, (_, i) => `<circle cx="${70 + i * 7.5}" cy="64" r="2.6" fill="${[p.base, p.alt, p.alt2][i % 3]}"/>`).join("");
      if (motif === "stars") s += star(100, 66, 9, "url(#metal)");
      if (motif === "hearts") s += `<path d="${heart(100, 66, 10)}" fill="${p.base}"/>`;
      s += ink(both("M52 136 C56 126 66 126 68 136 C68 144 58 146 56 138"), p.alt2, 1.8);
      return s;
    },
    eyes: () => `<path d="${both("M62 104 C62 88 94 88 94 106 C92 120 64 120 62 104Z")}" fill="url(#hole)"/>`,
    front: () => `<path d="M100 132 C96 122 88 126 93 134 L100 142 L107 134 C112 126 104 122 100 132Z" fill="#1c1828"/>${ink("M72 158 L128 158", "#1c1828", 1.6)}${[76, 84, 92, 100, 108, 116, 124].map((x) => ink(`M${x} 153 L${x} 163`, "#1c1828", 1.3)).join("")}`,
  });

  // ---------- Lucha libre ----------
  const LUCHA = [
    ["fuego", "El Fuego", "#d92f3a", "flames"], ["rayo", "El Rayo", "#1f5fbf", "bolt"], ["estrella", "La Estrella", "#e8b143", "star"], ["aguila", "El Águila", "#1c1828", "wings"],
    ["tigre", "El Tigre", "#f2741f", "stripes"], ["diablo", "El Diablo", "#9b1b30", "horns"], ["fantasma", "El Fantasma", "#f4eee4", "drops"], ["corona", "El Rey", "#5b3fd9", "crown"],
    ["arana", "La Araña", "#1c1828", "web"], ["calavera", "El Muerto", "#1c1828", "skull"], ["verde", "El Jaguar", "#1f9d6b", "spots"], ["oro", "El Dorado", "#e8b143", "diamond"],
    ["rosa", "La Rosa", "#ff5fa2", "heart"], ["hielo", "El Hielo", "#7fd0ff", "bolt"], ["noche", "La Noche", "#253a8f", "star"], ["volcan", "El Volcán", "#f2741f", "flames"],
    ["cobra", "La Cobra", "#3c6b2a", "scales"], ["toro", "El Toro", "#6a2418", "horns"], ["angel", "El Ángel", "#f4eee4", "wings"], ["sombra", "La Sombra", "#3a3448", "drops"],
    ["sol", "El Sol", "#ffc61a", "sun"], ["luna", "La Luna", "#9aa3b5", "moon"], ["dragon", "El Dragón", "#1f9d4a", "scales"], ["trueno", "El Trueno", "#6b2fbf", "bolt"], ["leon", "El León", "#c58a2a", "crown"],
  ];
  for (const [id, name, color, motif] of LUCHA) out.push({
    id: `lucha-${id}`, name, cat: "world", color, shape: OUT.egg, rim: "metal",
    back: (p) => motif === "horns" ? `<path d="M62 66 C46 52 40 30 48 14 C54 32 66 44 80 54Z" fill="url(#ivory)"/><path d="${mirror("M62 66 C46 52 40 30 48 14 C54 32 66 44 80 54Z")}" fill="url(#ivory)"/>` : motif === "crown" ? `<path d="M60 56 L56 26 L76 42 L100 16 L124 42 L144 26 L140 56Z" fill="url(#metal)" filter="url(#emb)"/>` : "",
    pattern: (p) => {
      const a = p.alt;
      const M = {
        flames: `<path d="${both("M54 118 C46 96 54 78 62 70 C62 82 68 86 72 80 C72 70 80 62 88 58 C84 70 92 76 96 70 L98 96 C86 92 70 100 66 114Z")}" fill="${a}"/>`,
        bolt: `<path d="M108 46 L84 96 L100 96 L88 136 L120 82 L104 82 L116 46Z" fill="${a}"/>`,
        star: star5(100, 70, 18, a) + star5(100, 70, 9, "#fff"),
        wings: `<path d="${both("M98 96 C84 76 64 62 40 66 C54 72 60 78 62 86 C52 86 46 92 44 100 C60 94 76 94 98 104Z")}" fill="${a}"/>`,
        stripes: Array.from({ length: 6 }, (_, i) => `<path d="${both(`M${44 + i * 2} ${70 + i * 14} L${70 + i * 2} ${76 + i * 14} L${46 + i * 2} ${80 + i * 14}Z`)}" fill="#1c1828"/>`).join(""),
        horns: `<path d="${both("M56 96 C62 80 80 74 98 84 C84 86 74 92 70 102Z")}" fill="${a}"/>`,
        drops: `<path d="${both("M60 110 C58 126 64 140 72 146 C70 134 72 122 78 114Z")}" fill="${a}"/>`,
        crown: `<path d="${both("M54 100 C60 84 80 78 98 88 C84 90 74 96 70 104Z")}" fill="${a}"/>`,
        web: Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * Math.PI * 2; return ink(`M100 112 L${100 + Math.cos(t) * 70} ${112 + Math.sin(t) * 76}`, "#f4eee4", 1.2); }).join("") + [18, 34, 50].map((r) => `<circle cx="100" cy="112" r="${r}" fill="none" stroke="#f4eee4" stroke-width="1.2"/>`).join(""),
        skull: `<path d="M100 62 C122 62 132 76 130 90 L122 96 L78 96 L70 90 C68 76 78 62 100 62Z" fill="#f4eee4"/><path d="M90 74 L84 84 L94 84Z M110 74 L116 84 L106 84Z" fill="#1c1828"/>`,
        spots: Array.from({ length: 16 }, (_, i) => `<path d="M${48 + ((i * 29) % 104)} ${60 + ((i * 41) % 110)} m-5 0 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0" fill="none" stroke="#1c1828" stroke-width="2"/>`).join(""),
        diamond: `<path d="M100 54 L124 84 L100 114 L76 84Z" fill="${a}"/><path d="M100 66 L114 84 L100 102 L86 84Z" fill="#fff" opacity="0.5"/>`,
        heart: `<path d="${heart(100, 74, 16)}" fill="${a}"/>`,
        scales: Array.from({ length: 30 }, (_, i) => { const x = 46 + (i % 10) * 12 + (Math.floor(i / 10) % 2) * 6, y = 60 + Math.floor(i / 10) * 10; return `<path d="M${x - 6} ${y} Q${x} ${y + 8} ${x + 6} ${y}" fill="none" stroke="${a}" stroke-width="1.6"/>`; }).join(""),
        sun: `<circle cx="100" cy="72" r="12" fill="${a}"/>` + Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return ink(`M${100 + Math.cos(t) * 15} ${72 + Math.sin(t) * 15} L${100 + Math.cos(t) * 22} ${72 + Math.sin(t) * 22}`, a, 2.4); }).join(""),
        moon: `<path d="M110 52 C92 54 84 74 92 90 C78 82 76 60 92 52 C98 50 104 50 110 52Z" fill="${a}"/>`,
      };
      return M[motif] + `<path d="${both("M50 100 C54 82 76 76 96 90 C86 90 78 96 78 104 C68 102 60 108 54 116Z")}" fill="#fff" opacity="0.92"/><path d="M54 148 C74 140 88 146 100 156 C112 146 126 140 146 148 L146 184 L54 184Z" fill="${a}" opacity="0.9"/>`;
    },
    eyes: () => holes(both("M64 104 Q78 92 96 102 Q82 112 64 104Z"), "metal"),
    front: (p) => `<path d="M84 154 C94 162 106 162 116 154 C106 158 94 158 84 154Z" fill="${p.deep}"/>` + trimLine(both("M50 100 C54 82 76 76 96 90"), 1.2) + [0, 1, 2, 3].map((i) => ink(`M92 ${166 + i * 4} L108 ${168 + i * 4} M106 ${166 + i * 4} L94 ${168 + i * 4}`, "url(#metal)", 1)).join(""),
  });

  // ---------- More of the world ----------
  for (const [id, name, color] of [["tiki", "Tiki", "#8a5a2c"], ["tiki-dark", "Tiki night", "#4a2a14"], ["tiki-red", "Tiki fire", "#a8401e"]]) out.push({
    id, name, cat: "world", color, shape: "M54 40 L146 40 C156 40 162 48 162 58 L160 172 C160 182 152 190 142 190 L58 190 C48 190 40 182 40 172 L38 58 C38 48 44 40 54 40Z", rim: "soft", face: () => "url(#face)",
    back: (p) => `<path d="M48 44 L40 4 L64 30 L80 0 L94 34 L100 -4 L106 34 L120 0 L136 30 L160 4 L152 44Z" fill="${p.deep}"/>`,
    pattern: (p) => Array.from({ length: 7 }, (_, i) => ink(`M40 ${54 + i * 4} L160 ${54 + i * 4}`, p.deep, 1.4)).join("") + `<path d="M92 82 L108 82 L114 130 L86 130Z" fill="${p.dark}"/>`,
    eyes: () => `<ellipse cx="72" cy="100" rx="17" ry="14" fill="#f4eee4"/><ellipse cx="128" cy="100" rx="17" ry="14" fill="#f4eee4"/><circle cx="72" cy="100" r="7" fill="#1c1828"/><circle cx="128" cy="100" r="7" fill="#1c1828"/>`,
    front: () => `<path d="M58 146 L142 146 L134 176 L66 176Z" fill="#1c1828"/>${[70, 82, 94, 106, 118, 130].map((x) => `<rect x="${x - 4}" y="147" width="8" height="10" fill="#f4eee4"/><rect x="${x - 4}" y="165" width="8" height="10" fill="#f4eee4"/>`).join("")}`,
  });
  for (const [id, name, color] of [["aztec", "Aztec jade", "#1f9d6b"], ["aztec-turq", "Aztec turquoise", "#2ec4b6"]]) out.push({
    id, name, cat: "world", color, shape: OUT.egg, rim: "metal",
    pattern: (p) => { let s = ""; for (let y = 50; y < 180; y += 7) for (let x = 44; x < 158; x += 7) { const h = (x * 13 + y * 7) % 5; s += `<path d="M${x} ${y} l6 ${h % 2} l${-h % 3} 6 l-6 ${-(h % 2)}z" fill="${[p.base, p.light, p.dark, p.alt, "#f4eee4"][h]}" stroke="#1c1828" stroke-opacity="0.35" stroke-width="0.4"/>`; } return s; },
    eyes: () => `<path d="${both("M60 104 C66 94 90 94 94 104 C90 114 66 114 60 104Z")}" fill="#f4eee4" stroke="url(#metal)" stroke-width="2"/><circle cx="78" cy="104" r="5" fill="#1c1828"/><circle cx="122" cy="104" r="5" fill="#1c1828"/>`,
    front: () => `<path d="M80 148 C90 142 110 142 120 148 C110 160 90 160 80 148Z" fill="#f4eee4" stroke="url(#metal)" stroke-width="1.6"/>${[88, 96, 104, 112].map((x) => ink(`M${x} 146 L${x} 154`, "#1c1828", 1)).join("")}`,
  });
  out.push({ id: "inca-sun", name: "Inca sun", cat: "world", color: "#e8b143", shape: OUT.round, rim: "metal", face: () => "url(#metal)",
    back: () => Array.from({ length: 16 }, (_, i) => { const t = (i / 16) * Math.PI * 2; const x = 100 + Math.cos(t) * 62, y = 112 + Math.sin(t) * 62; return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${(100 + Math.cos(t - 0.12) * 84).toFixed(1)} ${(112 + Math.sin(t - 0.12) * 84).toFixed(1)} L${(100 + Math.cos(t) * 96).toFixed(1)} ${(112 + Math.sin(t) * 96).toFixed(1)} L${(100 + Math.cos(t + 0.12) * 84).toFixed(1)} ${(112 + Math.sin(t + 0.12) * 84).toFixed(1)}Z" fill="url(#metal)" filter="url(#emb)"/>`; }).join(""),
    pattern: (p) => `<circle cx="100" cy="112" r="54" fill="none" stroke="${p.deep}" stroke-opacity="0.4" stroke-width="2"/>` + ink(both("M60 92 C70 82 86 82 94 90"), p.deep, 2),
    eyes: () => `<rect x="62" y="98" width="30" height="10" rx="5" fill="#3a2a10"/><rect x="108" y="98" width="30" height="10" rx="5" fill="#3a2a10"/>`,
    front: (p) => `<path d="M94 108 L100 134 L106 108Z" fill="${p.deep}" opacity="0.5"/><rect x="82" y="148" width="36" height="8" rx="4" fill="#3a2a10"/>` });
  for (const [id, name, color, stripe] of [["pharaoh", "Pharaoh", "#e8b143", "#1f3a8f"], ["pharaoh-queen", "Queen of the Nile", "#e8b143", "#0f8a8a"]]) out.push({
    id, name, cat: "world", color, shape: OUT.egg, rim: "metal", face: () => "url(#metal)",
    back: () => `<path d="M24 210 L36 80 C40 40 70 26 100 26 C130 26 160 40 164 80 L176 210 L134 210 L140 90 L60 90 L66 210Z" fill="url(#metal)"/>` + Array.from({ length: 10 }, (_, i) => `<path d="M${30 + i} ${90 + i * 12} L${70 - i * 0.4} ${90 + i * 12} M${170 - i} ${90 + i * 12} L${130 + i * 0.4} ${90 + i * 12}" stroke="${stripe}" stroke-width="6"/>`).join("") + `<path d="M40 70 C60 40 140 40 160 70" stroke="${stripe}" stroke-width="10" fill="none"/>`,
    pattern: () => "",
    eyes: () => `<path d="${both("M62 104 C68 96 88 96 94 104 C88 110 68 110 62 104Z M62 104 L48 108")}" fill="#f4eee4" stroke="#1c1828" stroke-width="2.4"/><circle cx="78" cy="104" r="4.6" fill="#1c1828"/><circle cx="122" cy="104" r="4.6" fill="#1c1828"/>` + ink(both("M60 92 C68 86 88 86 96 92"), "#1c1828", 3),
    front: (p) => `<path d="M88 150 C94 146 106 146 112 150 C106 156 94 156 88 150Z" fill="${p.deep}"/><path d="M94 172 L106 172 L104 200 L96 200Z" fill="${stripe}"/>` + (id === "pharaoh-queen" ? `<path d="M92 50 C92 36 108 36 108 50 L104 62 L96 62Z" fill="url(#metal)"/><circle cx="100" cy="46" r="3" fill="#d92f3a"/>` : `<path d="M96 40 C92 30 100 22 104 30 C108 36 104 44 100 48Z" fill="url(#metal)"/>`),
  });
  for (const [id, name, color] of [["corinthian", "Greek helmet", "#c58a2a"], ["spartan", "Spartan", "#9aa3b5"]]) out.push({
    id, name, cat: "world", color, shape: "M100 30 C146 30 164 66 162 106 C160 140 150 170 132 186 L68 186 C50 170 40 140 38 106 C36 66 54 30 100 30Z", rim: "metal", face: () => "url(#metal)",
    back: (p) => id === "spartan" ? `<path d="M30 40 C60 -16 140 -16 170 40 L160 46 C134 6 66 6 40 46Z" fill="#c2122a"/>` + Array.from({ length: 20 }, (_, i) => ink(`M${40 + i * 6} ${40 - Math.sin((i / 19) * Math.PI) * 40} L${44 + i * 6} ${30 - Math.sin((i / 19) * Math.PI) * 40}`, "#8a0c14", 1.4)).join("") : "",
    pattern: (p) => ink("M40 78 C70 70 130 70 160 78", p.deep, 2) + `<path d="M86 140 L114 140 L118 186 L82 186Z" fill="#0b0608"/><path d="M94 92 L106 92 L106 140 L94 140Z" fill="url(#metal)" stroke="${p.deep}" stroke-width="1"/>`,
    eyes: () => `<path d="M52 92 C64 86 86 88 94 96 L94 108 C80 104 64 106 52 112Z M148 92 C136 86 114 88 106 96 L106 108 C120 104 136 106 148 112Z" fill="#0b0608"/>`,
  });
  out.push({ id: "barong", name: "Barong", cat: "world", color: "#c2122a", shape: OUT.wide, rim: "metal",
    back: () => `<path d="M30 80 C30 20 80 -6 100 -6 C120 -6 170 20 170 80 L150 70 L140 30 L120 50 L100 10 L80 50 L60 30 L50 70Z" fill="url(#metal)"/>` + [60, 100, 140].map((x, i) => `<circle cx="${x}" cy="${[30, 10, 30][i]}" r="5" fill="#ffffff" stroke="#1f9dd9" stroke-width="2"/>`).join(""),
    pattern: (p) => ink(both("M52 84 C64 70 86 70 96 82"), "#1c1828", 4) + `<path d="M86 110 C82 128 84 136 100 138 C116 136 118 128 114 110Z" fill="${p.dark}"/>`,
    eyes: () => `<circle cx="74" cy="100" r="14" fill="#f4eee4"/><circle cx="126" cy="100" r="14" fill="#f4eee4"/><circle cx="74" cy="100" r="8" fill="#1c1828"/><circle cx="126" cy="100" r="8" fill="#1c1828"/>`,
    front: () => `<path d="M64 146 C80 140 120 140 136 146 C130 172 70 172 64 146Z" fill="#1c0a0e"/><path d="M68 146 L76 166 L84 148Z M132 146 L124 166 L116 148Z" fill="#f4eee4"/><path d="M84 148 L116 148 L112 154 L88 154Z" fill="#f4eee4"/>` });
  for (const [id, name, color, smile] of [["hahoe", "Hahoe Yangban", "#c08048", 1], ["hahoe-bune", "Hahoe Bune", "#f0d8b8", 0]]) out.push({
    id, name, cat: "world", color, shape: OUT.egg, rim: "soft", face: () => "url(#face)",
    pattern: (p) => (smile ? ink(both("M56 120 C62 132 74 138 86 136"), p.deep, 1.8) + ink(both("M58 82 C68 72 84 72 94 80"), p.deep, 3) : `<circle cx="66" cy="128" r="8" fill="#e05050" opacity="0.5"/><circle cx="134" cy="128" r="8" fill="#e05050" opacity="0.5"/><circle cx="100" cy="72" r="4" fill="#e05050"/>` + ink(both("M62 86 C70 80 84 80 92 86"), "#1c1828", 2)),
    eyes: () => smile ? ink(both("M62 104 Q78 94 94 104"), "#1c1828", 4) : `<path d="${both("M66 104 C72 100 86 100 92 104 C86 106 72 106 66 104Z")}" fill="#1c1828"/>`,
    front: (p) => smile ? `<path d="M74 148 C88 164 112 164 126 148 C112 154 88 154 74 148Z" fill="#1c1828"/>` : `<path d="M92 150 C96 147 104 147 108 150 C104 154 96 154 92 150Z" fill="#c2122a"/>`,
  });
  for (const [id, name, color] of [["samurai", "Samurai", "#3a3448"], ["samurai-red", "Samurai red", "#9b1b30"]]) out.push({
    id, name, cat: "world", color, shape: OUT.egg, rim: "metal",
    back: (p) => `<path d="M30 96 C24 40 60 14 100 14 C140 14 176 40 170 96 L150 80 C144 50 124 38 100 38 C76 38 56 50 50 80Z" fill="${p.deep}"/><path d="M100 14 C70 -20 40 -30 20 -26 C40 -16 60 0 78 20Z M100 14 C130 -20 160 -30 180 -26 C160 -16 140 0 122 20Z" fill="url(#metal)"/>`,
    pattern: (p) => `<path d="M40 96 L160 96 L160 104 L40 104Z" fill="${p.deep}"/>` + Array.from({ length: 4 }, (_, i) => `<path d="M48 ${170 + i * 6} L152 ${170 + i * 6}" stroke="url(#metal)" stroke-width="2"/>`).join(""),
    eyes: () => `<path d="${both("M60 104 C66 96 88 96 94 104 C88 110 66 110 60 104Z")}" fill="#0b0608"/>`,
    front: () => `<path d="M100 126 C90 128 74 136 64 150 C76 142 88 138 100 140 C112 138 124 142 136 150 C126 136 110 128 100 126Z" fill="#e8e2d8"/><path d="M80 150 L120 150 L114 162 L86 162Z" fill="#1c0a0e"/>${[88, 96, 104, 112].map((x) => `<path d="M${x - 3} 150 L${x} 158 L${x + 3} 150Z" fill="#f4eee4"/>`).join("")}`,
  });
  for (const [id, name, color] of [["knight", "Knight", "#9aa3b5"], ["knight-gold", "Golden knight", "#e8b143"]]) out.push({
    id, name, cat: "world", color, shape: "M56 36 L144 36 C156 36 162 44 162 56 L162 170 C162 182 154 190 142 190 L58 190 C46 190 38 182 38 170 L38 56 C38 44 44 36 56 36Z", rim: "metal", face: () => (color === "#e8b143" ? "url(#metal)" : "url(#chrome)"),
    back: () => `<path d="M100 36 C90 10 96 -12 108 -24 C108 -6 116 10 112 36Z" fill="#c2122a"/>`,
    pattern: () => `<path d="M98 36 L102 36 L102 190 L98 190Z" fill="#000" opacity="0.15"/>` + Array.from({ length: 5 }, (_, i) => `<path d="M${110 + (i % 2) * 6} ${130 + i * 9} L${150 - (i % 2) * 6} ${130 + i * 9}" stroke="#1c1828" stroke-width="3" stroke-linecap="round"/>`).join("") + [52, 148].map((x) => [56, 170].map((y) => `<circle cx="${x}" cy="${y}" r="3" fill="url(#metal)"/>`).join("")).join(""),
    eyes: () => `<rect x="44" y="98" width="112" height="9" rx="2" fill="#0b0608"/>`,
  });
  for (const [id, name, color, pat] of [["kitsune-black", "Kitsune night", "#e8b143", "#1c1828"], ["kitsune-gold", "Kitsune gold", "#d92f3a", "#e8b143"]]) out.push({
    id, name, cat: "world", color, shape: OUT.furry, rim: "metal", face: () => (pat === "#1c1828" ? "#1d1a26" : "url(#metal)"),
    back: (p) => pair2("M60 84 L48 6 L96 60Z", pat === "#1c1828" ? "#1d1a26" : "url(#metal)", p.base, "M64 74 L54 24 L88 60Z", p),
    pattern: (p) => `<path d="M100 58 C94 68 94 80 100 94 C106 80 106 68 100 58Z" fill="${p.base}"/>${ink(both("M58 102 C66 90 84 90 96 98"), p.base, 4)}${[0, 1, 2].map((i) => ink(both(`M${48 + i * 3} ${124 + i * 8} L${70 + i * 2} ${126 + i * 7}`), p.base, 2.8)).join("")}`,
    eyes: () => holes(both("M64 106 C70 96 86 94 96 100 C86 110 72 112 64 106Z"), "metal"),
    front: (p) => `<path d="M95 128 Q100 125 105 128 L100 134Z" fill="${p.base}"/>${ink("M86 150 C94 157 106 157 114 150", p.base, 2.4)}`,
  });
  for (const [id, name, color] of [["oni-blue", "Blue oni", "#1f5fbf"], ["oni-green", "Green oni", "#2a8a3a"]]) out.push({
    id, name, cat: "world", color, shape: OUT.wide, rim: "metal",
    back: () => `<path d="M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58Z" fill="url(#metal)"/><path d="${mirror("M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58Z")}" fill="url(#metal)"/><path d="M44 100 C30 70 46 40 70 44 L60 76Z M156 100 C170 70 154 40 130 44 L140 76Z" fill="#1c1828"/>`,
    pattern: (p) => `<path d="${both("M52 92 C66 78 86 82 98 96 C86 90 70 88 54 100Z")}" fill="${p.deep}"/><path d="M84 122 C92 116 108 116 116 122 C112 130 88 130 84 122Z" fill="${p.deep}"/>`,
    eyes: () => `<circle cx="78" cy="104" r="11" fill="url(#metal)"/><circle cx="122" cy="104" r="11" fill="url(#metal)"/><circle cx="78" cy="104" r="4.6" fill="#1c1828"/><circle cx="122" cy="104" r="4.6" fill="#1c1828"/>`,
    front: () => `<path d="M68 142 C82 164 118 164 132 142 C118 150 82 150 68 142Z" fill="#1c0a0e"/><path d="M78 144 L83 158 L88 146Z M122 144 L117 158 L112 146Z" fill="url(#ivory)"/>`,
  });

  return out;
}
