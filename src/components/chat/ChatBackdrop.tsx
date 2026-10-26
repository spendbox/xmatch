"use client";

import { memo, useEffect, useState } from "react";
import clsx from "clsx";
import type { ChatBgId } from "@/lib/chatBackgrounds";

/** A steady pseudo-random list, so a scene looks the same every time */
function seeded(n: number, seed: number) {
  let x = seed * 9301 + 49297;
  return Array.from({ length: n }, () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  });
}

/** A wave strip twice as wide as the screen: sliding it half its width loops without a seam */
function wavePath(amp: number, periods: number) {
  const w = 1600;
  const step = w / (periods * 2);
  let d = `M0 ${50}`;
  for (let i = 0; i < periods * 2; i++) d += ` Q${step * i + step / 2} ${i % 2 ? 50 + amp : 50 - amp} ${step * (i + 1)} 50`;
  return `${d} V100 H0 Z`;
}

function Wave({ fill, top, height, dur, amp = 14, periods = 4, opacity = 1, reverse }: { fill: string; top: string; height: string; dur: number; amp?: number; periods?: number; opacity?: number; reverse?: boolean }) {
  return (
    <div style={{ left: 0, top, height, width: "200%", opacity, animation: `cbg-slide ${dur}s linear infinite${reverse ? " reverse" : ""}` }}>
      <svg viewBox="0 0 1600 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", position: "relative" }}>
        <path d={wavePath(amp, periods)} fill={fill} />
      </svg>
    </div>
  );
}

/** Things that fall (snow, rain) or rise (bubbles, hearts) in lanes across the screen */
function Lanes({ n, seed, dir, child, min = 6, max = 14 }: { n: number; seed: number; dir: "fall" | "rise"; child: (i: number, r: number) => React.ReactNode; min?: number; max?: number }) {
  const r = seeded(n * 3, seed);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const dur = min + r[i * 3] * (max - min);
        return (
          <div
            key={i}
            className="cbg-lane"
            style={{ left: `${(i + r[i * 3 + 1]) * (100 / n)}%`, animation: `cbg-${dir} ${dur}s linear ${-r[i * 3 + 2] * dur}s infinite` }}
          >
            {child(i, r[i * 3 + 1])}
          </div>
        );
      })}
    </>
  );
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const PATTERNS: Partial<Record<ChatBgId, React.CSSProperties>> = {
  classic: { background: "#faf7f2" },
  dots: { backgroundColor: "#faf7f2", backgroundImage: "radial-gradient(#d9d0e8 1.2px, transparent 1.3px)", backgroundSize: "18px 18px" },
  lilac: { background: "linear-gradient(170deg, #f1ecff 0%, #e6dcff 55%, #f8e8f6 100%)" },
  peach: { background: "linear-gradient(165deg, #fff1e6 0%, #ffd9c7 50%, #ffc9d6 100%)" },
  mint: {
    backgroundColor: "#eefaf4",
    backgroundImage: "linear-gradient(#d3efe1 1px, transparent 1px), linear-gradient(90deg, #d3efe1 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  },
  ankara: {
    backgroundColor: "#fbf3e6",
    backgroundImage: svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke-width="2.2" opacity="0.32"><path d="M0 32 L16 16 L32 32 L16 48 Z" stroke="#e0782a"/><path d="M32 32 L48 16 L64 32 L48 48 Z" stroke="#2f8f6b"/><circle cx="16" cy="32" r="4" fill="#d1495b" stroke="none"/><circle cx="48" cy="32" r="4" fill="#5b3fd9" stroke="none"/><path d="M0 0 L8 8 M24 0 L32 8 L40 0 M56 0 L64 8 M0 64 L8 56 M24 64 L32 56 L40 64 M56 64 L64 56" stroke="#8a5a2b"/></g></svg>`,
    ),
    backgroundSize: "64px 64px",
  },
  doodles: {
    backgroundColor: "#f7f4fb",
    backgroundImage: svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><g fill="none" stroke="#c9bde6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20c-3-4-9-2-8 3 1 4 8 8 8 8s7-4 8-8c1-5-5-7-8-3z"/><path d="M84 14l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/><path d="M28 78v-14l12-3v14"/><circle cx="25" cy="78" r="3"/><circle cx="37" cy="75" r="3"/><rect x="74" y="70" width="26" height="16" rx="7"/><path d="M81 76v4M79 78h4"/><circle cx="93" cy="77" r="1"/><path d="M58 46a8 8 0 1 0 8 8"/><path d="M100 104l6-6M103 104l3-3"/><path d="M8 108q6-6 12 0t12 0"/></g></svg>`,
    ),
    backgroundSize: "120px 120px",
  },
  paper: {
    backgroundColor: "#fdf9ef",
    backgroundImage: "linear-gradient(90deg, transparent 38px, #f4b6b6 38px, #f4b6b6 39.5px, transparent 39.5px), linear-gradient(#e5dcc7 1px, transparent 1px)",
    backgroundSize: "100% 100%, 100% 28px",
  },
  bubblegum: {
    backgroundColor: "#ffe8f1",
    backgroundImage:
      "radial-gradient(circle at 20% 30%, #ffb3cf 0 3px, transparent 3.5px), radial-gradient(circle at 70% 60%, #b9a4ff 0 2.5px, transparent 3px), radial-gradient(circle at 45% 85%, #ffd27a 0 2.5px, transparent 3px), radial-gradient(circle at 85% 15%, #7fd6c2 0 2px, transparent 2.5px)",
    backgroundSize: "90px 90px",
  },
  midnight: { background: "radial-gradient(120% 70% at 80% 0%, #2d2463 0%, #151233 50%, #0c0a1f 100%)" },
};

function Beach() {
  const gulls = seeded(6, 3);
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #6cc6f0 0%, #a8e0f7 40%, #d8f3fb 54%)" }}>
      <div style={{ right: "12%", top: "8%", width: 70, height: 70, borderRadius: "50%", background: "radial-gradient(circle, #fff7c2 0 45%, rgba(255,230,120,0.5) 55%, transparent 72%)", animation: "cbg-glow 6s ease-in-out infinite" }} />
      {[0, 1].map((i) => (
        <div key={i} style={{ top: `${14 + i * 8}%`, left: 0, width: "100%", height: 16, animation: `cbg-drift ${70 + i * 30}s linear ${-gulls[i] * 70}s infinite` }}>
          <svg width="22" height="10" viewBox="0 0 22 10" style={{ position: "relative" }}>
            <path d="M1 6q5-5 10 0q5-5 10 0" fill="none" stroke="#3b5a73" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      ))}
      <div style={{ left: 0, right: 0, top: "52%", bottom: 0, background: "linear-gradient(180deg, #1ea6cc 0%, #1590b8 45%, #0f7fa6 100%)" }} />
      <Wave fill="#5cc6e3" top="49%" height="7%" dur={16} amp={10} opacity={0.9} />
      <Wave fill="#2bb0d6" top="55%" height="8%" dur={12} amp={14} reverse />
      <Wave fill="#ffffff" top="62%" height="6%" dur={9} amp={8} opacity={0.35} />
      <Wave fill="#1a9cc4" top="64%" height="8%" dur={11} amp={12} />
      <div style={{ left: 0, right: 0, bottom: 0, height: "24%", background: "linear-gradient(180deg, #f7e2b5 0%, #efcd8f 100%)" }} />
      <div style={{ left: "-5%", right: "-5%", bottom: "22%", height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.85)", animation: "cbg-foam 4s ease-in-out infinite", transformOrigin: "bottom" }} />
      <div style={{ left: -8, bottom: "16%", width: 110, height: 170, transformOrigin: "20% 100%", animation: "cbg-sway 7s ease-in-out infinite" }}>
        <svg viewBox="0 0 110 170" width="110" height="170" style={{ position: "relative" }}>
          <path d="M28 170 C30 120 38 80 52 48" stroke="#6b4a2b" strokeWidth="7" fill="none" strokeLinecap="round" />
          <g fill="#2f7d4f">
            <path d="M52 48 C30 30 10 34 0 46 C18 36 34 38 52 48Z" />
            <path d="M52 48 C46 22 60 4 80 0 C66 12 58 28 52 48Z" />
            <path d="M52 48 C76 30 98 36 110 52 C90 42 72 42 52 48Z" />
            <path d="M52 48 C70 58 82 76 84 96 C74 78 64 64 52 48Z" />
            <path d="M52 48 C34 56 24 74 22 92 C32 74 42 62 52 48Z" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Sunset() {
  const r = seeded(10, 8);
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #2b1a4f 0%, #7a2e6b 30%, #e2605a 50%, #f6a55a 58%)" }}>
      <div style={{ left: "50%", top: "41%", width: 140, height: 140, marginLeft: -70, borderRadius: "50%", background: "radial-gradient(circle, #ffe08a 0 40%, rgba(255,170,90,0.55) 55%, transparent 70%)", animation: "cbg-glow 7s ease-in-out infinite" }} />
      <div style={{ left: 0, right: 0, top: "57%", bottom: 0, background: "linear-gradient(180deg, #4a2050 0%, #261238 60%, #170b26 100%)" }} />
      {r.map((x, i) => (
        <div
          key={i}
          style={{ left: `${50 - (26 - i * 1.6) / 2 + (x - 0.5) * 3}%`, top: `${58.5 + i * 3.4}%`, width: `${26 - i * 1.6}%`, height: 3, borderRadius: 3, background: "#ffc27a", transformOrigin: "center", animation: `cbg-shimmer ${2.4 + x * 2}s ease-in-out ${-x * 3}s infinite` }}
        />
      ))}
      <Wave fill="#3a1946" top="56%" height="5%" dur={22} amp={6} opacity={0.9} />
      <Wave fill="#2a1238" top="74%" height="7%" dur={16} amp={10} reverse opacity={0.8} />
      <Wave fill="#1d0d2b" top="86%" height="8%" dur={12} amp={12} />
    </div>
  );
}

function Stars() {
  const r = seeded(120, 5);
  return (
    <div className="cbg" style={{ background: "radial-gradient(130% 80% at 50% 110%, #2a3f7a 0%, #141a3f 45%, #090b1f 100%)" }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          style={{
            left: `${r[i * 3] * 100}%`,
            top: `${r[i * 3 + 1] * 100}%`,
            width: r[i * 3 + 2] > 0.8 ? 3 : 2,
            height: r[i * 3 + 2] > 0.8 ? 3 : 2,
            borderRadius: "50%",
            background: "#fff",
            animation: `cbg-twinkle ${2 + r[i * 3 + 2] * 4}s ease-in-out ${-r[i * 3] * 5}s infinite`,
          }}
        />
      ))}
      <div style={{ right: "14%", top: "9%", width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #fffbe8 0 55%, #e9e2c4 70%)", boxShadow: "0 0 40px 8px rgba(255,248,220,0.25)" }} />
      <div style={{ right: "10%", top: "18%", width: 90, height: 2, borderRadius: 2, background: "linear-gradient(90deg, #fff, transparent)", animation: "cbg-shoot 9s ease-in 2s infinite" }} />
    </div>
  );
}

function Aurora() {
  const blob = (c: string, l: string, t: string, s: number, d: number) => (
    <div style={{ left: l, top: t, width: s, height: s, borderRadius: "50%", background: `radial-gradient(circle, ${c} 0%, transparent 65%)`, animation: `cbg-float ${d}s ease-in-out infinite` }} />
  );
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #06121f 0%, #0b2233 55%, #0a1a2a 100%)" }}>
      {blob("rgba(56,232,170,0.55)", "-20%", "5%", 380, 22)}
      {blob("rgba(120,90,255,0.45)", "35%", "-5%", 360, 28)}
      {blob("rgba(40,180,255,0.4)", "10%", "30%", 320, 25)}
      {blob("rgba(255,90,170,0.25)", "50%", "40%", 300, 31)}
      <div style={{ left: 0, right: 0, bottom: 0, height: "18%", background: "linear-gradient(180deg, transparent, #050c16)" }} />
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" style={{ left: 0, bottom: 0, width: "100%", height: "12%" }}>
        <path d="M0 60 L0 40 L30 22 L55 36 L90 10 L130 34 L160 20 L200 38 L240 14 L280 32 L320 18 L360 36 L400 24 L400 60Z" fill="#03080f" />
      </svg>
    </div>
  );
}

function Rain() {
  const drops = seeded(16, 11);
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #1d2b3d 0%, #26384f 50%, #1a2636 100%)" }}>
      <div style={{ left: "-10%", top: "20%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,190,110,0.22), transparent 65%)" }} />
      <div style={{ right: "-15%", top: "55%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,170,255,0.18), transparent 65%)" }} />
      {drops.map((x, i) => (
        <div key={`d${i}`} style={{ left: `${(i * 37 + x * 30) % 100}%`, top: `${(i * 53 + x * 40) % 100}%`, width: 5 + x * 6, height: 6 + x * 8, borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%", background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 70%)" }} />
      ))}
      <Lanes n={26} seed={4} dir="fall" min={0.8} max={1.5} child={(_, r) => <div style={{ top: 0, left: 0, width: 1.4, height: 18 + r * 14, borderRadius: 2, background: "linear-gradient(180deg, transparent, rgba(200,225,255,0.7))" }} />} />
    </div>
  );
}

function Snow() {
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #cfe3f5 0%, #e9f2fb 60%, #f7fbff 100%)" }}>
      <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ left: 0, bottom: 0, width: "100%", height: "14%" }}>
        <path d="M0 80 L0 46 L50 20 L90 40 L140 8 L200 44 L250 22 L300 40 L350 14 L400 34 L400 80Z" fill="#b9cfe6" />
        <path d="M0 80 L0 60 Q100 40 200 58 T400 52 L400 80Z" fill="#ffffff" />
      </svg>
      <Lanes n={28} seed={7} dir="fall" min={9} max={18} child={(_, r) => <div style={{ top: 0, left: 0, width: 3 + r * 5, height: 3 + r * 5, borderRadius: "50%", background: "#fff", boxShadow: "0 0 4px rgba(150,180,220,0.6)", animation: `cbg-sway ${3 + r * 3}s ease-in-out infinite` }} />} />
    </div>
  );
}

function Hearts() {
  const colors = ["#ff6b9a", "#ff9ec0", "#e8457c", "#ffc2d6", "#c86bff"];
  return (
    <div className="cbg" style={{ background: "linear-gradient(170deg, #fff0f5 0%, #ffe0ec 55%, #fbe6ff 100%)" }}>
      <Lanes
        n={12}
        seed={9}
        dir="rise"
        min={11}
        max={20}
        child={(i, r) => (
          <div style={{ top: 0, left: 0, animation: `cbg-heart-x ${4 + r * 3}s ease-in-out infinite` }}>
            <svg width={14 + r * 16} height={14 + r * 16} viewBox="0 0 24 24" style={{ position: "relative" }}>
              <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.2 1.7-2 3.2-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill={colors[i % colors.length]} opacity="0.7" />
            </svg>
          </div>
        )}
      />
    </div>
  );
}

function Fireflies() {
  const r = seeded(54, 13);
  return (
    <div className="cbg" style={{ background: "radial-gradient(120% 80% at 50% 100%, #1d3b2a 0%, #0f2219 50%, #08130e 100%)" }}>
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={i}
          style={{
            left: `${r[i * 3] * 92}%`,
            top: `${10 + r[i * 3 + 1] * 75}%`,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f4ff9a",
            boxShadow: "0 0 10px 4px rgba(220,255,120,0.55)",
            animation: `cbg-fly ${5 + r[i * 3 + 2] * 6}s ease-in-out ${-r[i * 3] * 8}s infinite`,
          }}
        />
      ))}
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ left: 0, bottom: 0, width: "100%", height: "22%" }}>
        <path d="M0 120 L0 60 L18 30 L30 62 L48 20 L64 64 L80 40 L96 70 L120 26 L140 66 L170 44 L190 72 L220 30 L240 68 L270 40 L290 70 L320 24 L340 64 L370 38 L400 66 L400 120Z" fill="#06100b" />
      </svg>
    </div>
  );
}

function Ocean() {
  const r = seeded(12, 17);
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #1478a8 0%, #0d4f7c 45%, #082a4a 100%)" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ left: `${8 + i * 24}%`, top: "-10%", width: 46, height: "75%", background: "linear-gradient(180deg, rgba(190,240,255,0.35), transparent)", transformOrigin: "top", animation: `cbg-ray ${7 + i * 2}s ease-in-out ${-i * 2}s infinite` }} />
      ))}
      <Lanes n={14} seed={21} dir="rise" min={7} max={14} child={(_, x) => <div style={{ top: 0, left: 0, width: 5 + x * 9, height: 5 + x * 9, borderRadius: "50%", border: "1.5px solid rgba(220,250,255,0.7)", background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), transparent 60%)", animation: `cbg-sway ${2.5 + x * 2}s ease-in-out infinite` }} />} />
      {r.slice(0, 5).map((x, i) => (
        <div key={i} style={{ bottom: -4, left: `${4 + i * 21}%`, width: 26, height: 70 + x * 50, transformOrigin: "bottom", animation: `cbg-sway ${4 + x * 3}s ease-in-out ${-x * 3}s infinite` }}>
          <svg viewBox="0 0 26 120" preserveAspectRatio="none" style={{ width: "100%", height: "100%", position: "relative" }}>
            <path d="M13 120 C4 96 22 80 12 60 C3 40 20 26 13 0" stroke="#1f9a6b" strokeWidth="5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      ))}
      <div style={{ left: 0, right: 0, bottom: 0, height: "6%", background: "linear-gradient(180deg, transparent, #c9b17a55)" }} />
    </div>
  );
}

function Clouds() {
  const cloud = (top: string, w: number, d: number, delay: number, o: number) => (
    <div style={{ top, left: 0, width: "100%", height: w * 0.5, animation: `cbg-drift ${d}s linear ${delay}s infinite`, opacity: o }}>
      <svg viewBox="0 0 120 60" width={w} height={w * 0.5} style={{ position: "relative" }}>
        <path d="M22 52 C6 52 4 34 18 30 C16 14 38 8 46 20 C52 4 80 4 84 22 C100 16 114 30 104 42 C116 48 110 58 98 52 Z" fill="#fff" />
      </svg>
    </div>
  );
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #5fb4f2 0%, #9fd3f8 55%, #d9effc 100%)" }}>
      {cloud("6%", 150, 60, -10, 0.95)}
      {cloud("22%", 100, 80, -45, 0.8)}
      {cloud("40%", 180, 70, -30, 0.9)}
      {cloud("60%", 120, 95, -70, 0.75)}
      {cloud("78%", 160, 75, -5, 0.85)}
    </div>
  );
}

function Lagos() {
  const r = seeded(160, 23);
  // Buildings: x, width, height (% of the skyline box)
  const towers: [number, number, number][] = [
    [0, 9, 45], [8, 7, 62], [14, 10, 78], [23, 6, 52], [28, 9, 90], [36, 8, 66], [43, 11, 100], [53, 7, 58],
    [59, 9, 84], [67, 8, 70], [74, 10, 95], [83, 7, 60], [89, 11, 76],
  ];
  return (
    <div className="cbg" style={{ background: "linear-gradient(180deg, #120f2e 0%, #2a1f5c 45%, #6b3a7a 72%, #c2607a 100%)" }}>
      {Array.from({ length: 22 }, (_, i) => (
        <div key={i} style={{ left: `${r[i * 2] * 100}%`, top: `${r[i * 2 + 1] * 45}%`, width: 2, height: 2, borderRadius: "50%", background: "#fff", animation: `cbg-twinkle ${3 + r[i] * 4}s ease-in-out ${-r[i * 2] * 4}s infinite` }} />
      ))}
      <div style={{ left: "12%", top: "10%", width: 40, height: 40, borderRadius: "50%", background: "#fff5d6", boxShadow: "0 0 36px 10px rgba(255,236,190,0.3)" }} />
      <div style={{ left: 0, right: 0, bottom: 0, height: "42%" }}>
        {towers.map(([x, w, h], i) => (
          <div key={i} style={{ left: `${x}%`, bottom: 0, width: `${w}%`, height: `${h}%`, background: i % 2 ? "#141030" : "#1b163d", borderRadius: "2px 2px 0 0" }}>
            {Array.from({ length: 6 }, (_, k) => {
              const v = r[(i * 6 + k) % r.length];
              return v > 0.45 ? (
                <div
                  key={k}
                  style={{ left: `${18 + (k % 2) * 42}%`, top: `${10 + Math.floor(k / 2) * 22}%`, width: "22%", height: 5, background: "#ffd27a", borderRadius: 1, animation: v > 0.8 ? `cbg-blink ${4 + v * 6}s ease-in-out ${-v * 6}s infinite` : undefined, opacity: v > 0.8 ? undefined : 0.75 }}
                />
              ) : null;
            })}
          </div>
        ))}
      </div>
      <div style={{ left: 0, right: 0, bottom: 0, height: "6%", background: "linear-gradient(180deg, #0c0a22, #07061a)" }} />
    </div>
  );
}

function Bokeh() {
  const r = seeded(30, 29);
  const colors = ["#ff7eb6", "#7c5cff", "#3fd0c9", "#ffb347", "#5aa9ff", "#ff6b6b"];
  return (
    <div className="cbg" style={{ background: "linear-gradient(160deg, #1a1033 0%, #120c26 50%, #0b0818 100%)" }}>
      {Array.from({ length: 10 }, (_, i) => {
        const s = 60 + r[i * 3] * 120;
        return (
          <div
            key={i}
            style={{
              left: `${r[i * 3 + 1] * 85}%`,
              top: `${r[i * 3 + 2] * 85}%`,
              width: s,
              height: s,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colors[i % colors.length]}66 0%, ${colors[i % colors.length]}22 45%, transparent 70%)`,
              animation: `cbg-float ${16 + r[i * 3] * 14}s ease-in-out ${-r[i * 3 + 1] * 10}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

const SCENES: Partial<Record<ChatBgId, () => React.ReactElement>> = {
  beach: Beach,
  sunset: Sunset,
  stars: Stars,
  aurora: Aurora,
  rain: Rain,
  snow: Snow,
  hearts: Hearts,
  fireflies: Fireflies,
  ocean: Ocean,
  clouds: Clouds,
  lagos: Lagos,
  bokeh: Bokeh,
};

/**
 * The chat background, behind the messages. `still` freezes a scene (used for the small
 * previews); scenes also stop while the app is in the background.
 */
export const ChatBackdrop = memo(function ChatBackdrop({ id, still, className }: { id: ChatBgId; still?: boolean; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  const Scene = SCENES[id];
  if (Scene)
    return (
      <div className={clsx("cbg", (still || hidden) && "cbg-paused", className)} aria-hidden>
        <Scene />
      </div>
    );
  return <div className={clsx("cbg", className)} style={PATTERNS[id] ?? PATTERNS.classic} aria-hidden />;
});
