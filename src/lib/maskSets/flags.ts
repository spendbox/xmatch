// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Flag masks: the flag painted over the whole face, like a fan at a match, with soft eye holes.
 * Flags are drawn simply (stripes, crosses, stars and discs) in their real colours.
 */

export function flagSet(k) {
  const { OUT, holes, ALMOND, star5 } = k;
  // The painted area: x 30–170, y 40–190
  const X0 = 30, X1 = 170, Y0 = 40, Y1 = 190, W = X1 - X0, H = Y1 - Y0;
  const hs = (bands) => { const tot = bands.reduce((n, b) => n + (Array.isArray(b) ? b[1] : 1), 0); let y = Y0; return bands.map((b) => { const [c, w] = Array.isArray(b) ? b : [b, 1]; const h = (H * w) / tot; const s = `<rect x="${X0}" y="${y.toFixed(1)}" width="${W}" height="${(h + 0.4).toFixed(1)}" fill="${c}"/>`; y += h; return s; }).join(""); };
  const vs = (bands) => { const tot = bands.reduce((n, b) => n + (Array.isArray(b) ? b[1] : 1), 0); let x = X0; return bands.map((b) => { const [c, w] = Array.isArray(b) ? b : [b, 1]; const wd = (W * w) / tot; const s = `<rect x="${x.toFixed(1)}" y="${Y0}" width="${(wd + 0.4).toFixed(1)}" height="${H}" fill="${c}"/>`; x += wd; return s; }).join(""); };
  const st = (x, y, r, c) => star5(x, y, r, c);
  const disc = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const crescent = (x, y, r, c, bg) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x + r * 0.25}" cy="${y}" r="${r * 0.8}" fill="${bg}"/>`;
  const nordic = (bg, cross, inner) => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="${bg}"/><rect x="70" y="${Y0}" width="${inner ? 26 : 20}" height="${H}" fill="${cross}"/><rect x="${X0}" y="${102}" width="${W}" height="${inner ? 26 : 20}" fill="${cross}"/>` + (inner ? `<rect x="77" y="${Y0}" width="12" height="${H}" fill="${inner}"/><rect x="${X0}" y="109" width="${W}" height="12" fill="${inner}"/>` : "");
  const tri = (c, w = 60) => `<path d="M${X0} ${Y0} L${X0 + w} ${(Y0 + Y1) / 2} L${X0} ${Y1}Z" fill="${c}"/>`;

  const FLAGS = [
    ["nigeria", "Nigeria", () => vs(["#008751", "#ffffff", "#008751"])],
    ["ghana", "Ghana", () => hs(["#ce1126", "#fcd116", "#006b3f"]) + st(100, 115, 16, "#000")],
    ["cameroon", "Cameroon", () => vs(["#007a5e", "#ce1126", "#fcd116"]) + st(100, 115, 13, "#fcd116")],
    ["senegal", "Senegal", () => vs(["#00853f", "#fdef42", "#e31b23"]) + st(100, 115, 13, "#00853f")],
    ["mali", "Mali", () => vs(["#14b53a", "#fcd116", "#ce1126"])],
    ["guinea", "Guinea", () => vs(["#ce1126", "#fcd116", "#009460"])],
    ["ivorycoast", "Côte d'Ivoire", () => vs(["#f77f00", "#ffffff", "#009e60"])],
    ["chad", "Chad", () => vs(["#002664", "#fecb00", "#c60c30"])],
    ["benin", "Benin", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H / 2}" fill="#fcd116"/><rect x="${X0}" y="${Y0 + H / 2}" width="${W}" height="${H / 2}" fill="#e8112d"/><rect x="${X0}" y="${Y0}" width="${W * 0.4}" height="${H}" fill="#008751"/>`],
    ["gabon", "Gabon", () => hs(["#009e60", "#fcd116", "#3a75c4"])],
    ["sierraleone", "Sierra Leone", () => hs(["#1eb53a", "#ffffff", "#0072c6"])],
    ["botswana", "Botswana", () => hs([["#75aadb", 9], ["#ffffff", 1], ["#000000", 4], ["#ffffff", 1], ["#75aadb", 9]])],
    ["ethiopia", "Ethiopia", () => hs(["#078930", "#fcdd09", "#da121a"]) + disc(100, 115, 26, "#0f47af") + st(100, 115, 18, "#fcdd09")],
    ["egypt", "Egypt", () => hs(["#ce1126", "#ffffff", "#000000"]) + `<path d="M100 104 L112 112 L108 128 L92 128 L88 112Z" fill="#c09300"/>`],
    ["morocco", "Morocco", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#c1272d"/>` + `<path d="M100 92 L106 110 L125 110 L110 121 L116 139 L100 128 L84 139 L90 121 L75 110 L94 110Z" fill="none" stroke="#006233" stroke-width="3.4"/>`],
    ["tunisia", "Tunisia", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#e70013"/>` + disc(100, 115, 30, "#fff") + crescent(98, 115, 20, "#e70013", "#fff") + st(106, 115, 9, "#e70013")],
    ["uganda", "Uganda", () => hs(["#000", "#fcdc04", "#d90000", "#000", "#fcdc04", "#d90000"]) + disc(100, 115, 22, "#fff")],
    ["kenya", "Kenya", () => hs([["#000", 6], ["#fff", 1], ["#bb0000", 6], ["#fff", 1], ["#006600", 6]]) + `<ellipse cx="100" cy="115" rx="16" ry="36" fill="#bb0000" stroke="#000" stroke-width="3"/><ellipse cx="100" cy="115" rx="5" ry="12" fill="#fff"/>`],
    ["tanzania", "Tanzania", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#1eb53a"/><path d="M${X1} ${Y0} L${X1} ${Y1} L${X0} ${Y1}Z" fill="#00a3dd"/><path d="M${X0} ${Y1 - 20} L${X1 - 26} ${Y0} L${X1} ${Y0} L${X1} ${Y0 + 20} L${X0 + 26} ${Y1} L${X0} ${Y1}Z" fill="#fcd116"/><path d="M${X0} ${Y1 - 10} L${X1 - 14} ${Y0} L${X1} ${Y0} L${X1} ${Y0 + 10} L${X0 + 14} ${Y1} L${X0} ${Y1}Z" fill="#000"/>`],
    ["southafrica", "South Africa", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H / 2}" fill="#e03c31"/><rect x="${X0}" y="${Y0 + H / 2}" width="${W}" height="${H / 2}" fill="#001489"/><path d="M${X0} ${Y0} L${X0 + 50} ${Y0} L100 ${Y0 + H / 2 - 18} L${X1} ${Y0 + H / 2 - 18} L${X1} ${Y0 + H / 2 + 18} L100 ${Y0 + H / 2 + 18} L${X0 + 50} ${Y1} L${X0} ${Y1}Z" fill="#fff"/><path d="M${X0} ${Y0 + 10} L${X0 + 30} ${Y0} L${X0 + 42} ${Y0} L104 ${Y0 + H / 2 - 10} L${X1} ${Y0 + H / 2 - 10} L${X1} ${Y0 + H / 2 + 10} L104 ${Y0 + H / 2 + 10} L${X0 + 42} ${Y1} L${X0 + 30} ${Y1} L${X0} ${Y1 - 10}Z" fill="#007749"/><path d="M${X0} ${Y0 + 24} L${X0 + 62} ${Y0 + H / 2} L${X0} ${Y1 - 24}Z" fill="#ffb81c"/><path d="M${X0} ${Y0 + 32} L${X0 + 50} ${Y0 + H / 2} L${X0} ${Y1 - 32}Z" fill="#000"/>`],
    ["rwanda", "Rwanda", () => hs([["#00a1de", 2], ["#fad201", 1], ["#20603d", 1]]) + disc(140, 72, 10, "#fad201")],
    ["liberia", "Liberia", () => hs(Array.from({ length: 11 }, (_, i) => (i % 2 ? "#fff" : "#bf0a30"))) + `<rect x="${X0}" y="${Y0}" width="60" height="60" fill="#002868"/>` + st(60, 70, 14, "#fff")],
    ["jamaica", "Jamaica", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#009b3a"/><path d="M${X0} ${Y0} L100 115 L${X0} ${Y1}Z M${X1} ${Y0} L100 115 L${X1} ${Y1}Z" fill="#000"/><path d="M${X0} ${Y0} L${X0 + 18} ${Y0} L${X1} ${Y1 - 14} L${X1} ${Y1} L${X1 - 18} ${Y1} L${X0} ${Y0 + 14}Z M${X1} ${Y0} L${X1 - 18} ${Y0} L${X0} ${Y1 - 14} L${X0} ${Y1} L${X0 + 18} ${Y1} L${X1} ${Y0 + 14}Z" fill="#fed100"/>`],
    ["brazil", "Brazil", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#009c3b"/><path d="M100 50 L164 115 L100 180 L36 115Z" fill="#ffdf00"/>` + disc(100, 115, 30, "#002776") + `<path d="M72 108 C90 102 112 104 128 116" stroke="#fff" stroke-width="5" fill="none"/>`],
    ["argentina", "Argentina", () => hs(["#74acdf", "#ffffff", "#74acdf"]) + disc(100, 115, 11, "#f6b40e") + Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return `<path d="M${100 + Math.cos(t) * 11} ${115 + Math.sin(t) * 11} L${100 + Math.cos(t) * 18} ${115 + Math.sin(t) * 18}" stroke="#f6b40e" stroke-width="2.4"/>`; }).join("")],
    ["colombia", "Colombia", () => hs([["#fcd116", 2], ["#003893", 1], ["#ce1126", 1]])],
    ["mexico", "Mexico", () => vs(["#006847", "#ffffff", "#ce1126"]) + `<ellipse cx="100" cy="118" rx="12" ry="14" fill="#8c5a2b"/><path d="M90 130 C96 136 104 136 110 130" stroke="#006847" stroke-width="2.4" fill="none"/>`],
    ["usa", "United States", () => hs(Array.from({ length: 13 }, (_, i) => (i % 2 ? "#fff" : "#b22234"))) + `<rect x="${X0}" y="${Y0}" width="70" height="80" fill="#3c3b6e"/>` + Array.from({ length: 20 }, (_, i) => `<circle cx="${38 + (i % 5) * 13 + (Math.floor(i / 5) % 2) * 6}" cy="${50 + Math.floor(i / 5) * 18}" r="2.4" fill="#fff"/>`).join("")],
    ["canada", "Canada", () => vs([["#d80621", 1], ["#ffffff", 2], ["#d80621", 1]]) + `<path d="M100 82 L106 96 L116 92 L112 110 L124 104 L120 116 L128 120 L112 126 L114 136 L102 132 L102 150 L98 150 L98 132 L86 136 L88 126 L72 120 L80 116 L76 104 L88 110 L84 92 L94 96Z" fill="#d80621"/>`],
    ["uk", "United Kingdom", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#012169"/><path d="M${X0} ${Y0} L${X1} ${Y1} M${X1} ${Y0} L${X0} ${Y1}" stroke="#fff" stroke-width="26"/><path d="M${X0} ${Y0} L${X1} ${Y1} M${X1} ${Y0} L${X0} ${Y1}" stroke="#c8102e" stroke-width="9"/><path d="M100 ${Y0} L100 ${Y1} M${X0} 115 L${X1} 115" stroke="#fff" stroke-width="40"/><path d="M100 ${Y0} L100 ${Y1} M${X0} 115 L${X1} 115" stroke="#c8102e" stroke-width="24"/>`],
    ["ireland", "Ireland", () => vs(["#169b62", "#ffffff", "#ff883e"])],
    ["france", "France", () => vs(["#0055a4", "#ffffff", "#ef4135"])],
    ["italy", "Italy", () => vs(["#009246", "#ffffff", "#ce2b37"])],
    ["germany", "Germany", () => hs(["#000000", "#dd0000", "#ffce00"])],
    ["belgium", "Belgium", () => vs(["#000000", "#fdda24", "#ef3340"])],
    ["netherlands", "Netherlands", () => hs(["#ae1c28", "#ffffff", "#21468b"])],
    ["spain", "Spain", () => hs([["#aa151b", 1], ["#f1bf00", 2], ["#aa151b", 1]])],
    ["portugal", "Portugal", () => vs([["#006600", 2], ["#ff0000", 3]]) + disc(86, 115, 20, "#ffcc00") + `<path d="M76 104 L96 104 L96 120 C96 128 76 128 76 120Z" fill="#fff" stroke="#ff0000" stroke-width="2"/>`],
    ["russia", "Russia", () => hs(["#ffffff", "#0039a6", "#d52b1e"])],
    ["ukraine", "Ukraine", () => hs(["#0057b7", "#ffd700"])],
    ["poland", "Poland", () => hs(["#ffffff", "#dc143c"])],
    ["sweden", "Sweden", () => nordic("#006aa7", "#fecc00")],
    ["norway", "Norway", () => nordic("#ba0c2f", "#ffffff", "#00205b")],
    ["denmark", "Denmark", () => nordic("#c60c30", "#ffffff")],
    ["finland", "Finland", () => nordic("#ffffff", "#003580")],
    ["switzerland", "Switzerland", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#da291c"/><path d="M90 84 L110 84 L110 105 L131 105 L131 125 L110 125 L110 146 L90 146 L90 125 L69 125 L69 105 L90 105Z" fill="#fff"/>`],
    ["japan", "Japan", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#ffffff"/>` + disc(100, 115, 34, "#bc002d")],
    ["china", "China", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#de2910"/>` + st(62, 76, 18, "#ffde00") + [[92, 56], [104, 70], [104, 88], [92, 100]].map(([x, y]) => st(x, y, 5, "#ffde00")).join("")],
    ["india", "India", () => hs(["#ff9933", "#ffffff", "#138808"]) + `<circle cx="100" cy="115" r="16" fill="none" stroke="#000080" stroke-width="2.4"/>` + Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return `<path d="M100 115 L${100 + Math.cos(t) * 16} ${115 + Math.sin(t) * 16}" stroke="#000080" stroke-width="1.2"/>`; }).join("")],
    ["pakistan", "Pakistan", () => vs([["#ffffff", 1], ["#01411c", 3]]) + crescent(112, 115, 26, "#fff", "#01411c") + st(126, 104, 9, "#fff")],
    ["bangladesh", "Bangladesh", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#006a4e"/>` + disc(94, 115, 32, "#f42a41")],
    ["turkey", "Türkiye", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#e30a17"/>` + crescent(92, 115, 30, "#fff", "#e30a17") + st(124, 115, 12, "#fff")],
    ["greece", "Greece", () => hs(Array.from({ length: 9 }, (_, i) => (i % 2 ? "#fff" : "#0d5eaf"))) + `<rect x="${X0}" y="${Y0}" width="70" height="66" fill="#0d5eaf"/><rect x="${X0}" y="${Y0 + 26}" width="70" height="14" fill="#fff"/><rect x="${X0 + 28}" y="${Y0}" width="14" height="66" fill="#fff"/>`],
    ["austria", "Austria", () => hs(["#ed2939", "#ffffff", "#ed2939"])],
    ["hungary", "Hungary", () => hs(["#ce2939", "#ffffff", "#477050"])],
    ["czechia", "Czechia", () => hs(["#ffffff", "#d7141a"]) + tri("#11457e", 76)],
    ["chile", "Chile", () => hs(["#ffffff", "#d52b1e"]) + `<rect x="${X0}" y="${Y0}" width="54" height="${H / 2}" fill="#0039a6"/>` + st(57, 77, 14, "#fff")],
    ["peru", "Peru", () => vs(["#d91023", "#ffffff", "#d91023"])],
    ["cuba", "Cuba", () => hs(["#002a8f", "#fff", "#002a8f", "#fff", "#002a8f"]) + tri("#cf142b", 80) + st(58, 115, 14, "#fff")],
    ["philippines", "Philippines", () => hs(["#0038a8", "#ce1126"]) + tri("#ffffff", 80) + disc(62, 115, 12, "#fcd116")],
    ["indonesia", "Indonesia", () => hs(["#ce1126", "#ffffff"])],
    ["uae", "UAE", () => hs(["#00732f", "#ffffff", "#000000"]) + `<rect x="${X0}" y="${Y0}" width="38" height="${H}" fill="#ff0000"/>`],
    ["haiti", "Haiti", () => hs(["#00209f", "#d21034"]) + `<rect x="84" y="100" width="32" height="30" fill="#fff"/>`],
    ["trinidad", "Trinidad & Tobago", () => `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#ce1126"/><path d="M${X0} ${Y0} L${X0 + 40} ${Y0} L${X1} ${Y1 - 40} L${X1} ${Y1} L${X1 - 40} ${Y1} L${X0} ${Y0 + 40}Z" fill="#fff"/><path d="M${X0 + 14} ${Y0} L${X0 + 30} ${Y0} L${X1} ${Y1 - 30} L${X1} ${Y1 - 14} L${X1 - 30} ${Y1} L${X1 - 14 - 16} ${Y1} L${X0} ${Y0 + 30} L${X0} ${Y0 + 14}Z" fill="#000"/>`],
  ];

  return FLAGS.map(([id, name, draw]) => ({
    id: `flag-${id}`,
    name,
    cat: "flags",
    color: "#f7f4ee",
    shape: OUT.egg,
    rim: "soft",
    face: () => "#ffffff",
    // Painted on: the flag, then soft brush texture and the face's own shading on top
    pattern: () => draw() + `<rect x="30" y="40" width="140" height="150" fill="url(#brush)"/><pattern id="brush" patternUnits="userSpaceOnUse" width="16" height="7"><path d="M0 3 C5 1 11 5 16 3" stroke="#fff" stroke-opacity="0.12" stroke-width="1.4" fill="none"/></pattern>`,
    eyes: () => holes(ALMOND, "soft"),
  }));
}
