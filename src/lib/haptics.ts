"use client";

/**
 * A buzz on the phone. Android uses the vibration motor directly. iPhones don't
 * let websites vibrate, but Safari (iOS 18 and later) gives a light tap of haptic
 * feedback when a switch control is toggled, so we toggle a hidden one.
 */
let iosSwitch: HTMLLabelElement | null = null;

function tapIOS() {
  if (typeof document === "undefined") return;
  if (!iosSwitch) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && navigator.vibrate(pattern)) return;
  } catch {
    /* not supported */
  }
  try {
    // One tap per buzz in the pattern (patterns alternate buzz, pause, buzz…)
    const list = Array.isArray(pattern) ? pattern : [pattern];
    let at = 0;
    list.forEach((ms, k) => {
      if (k % 2 === 0) setTimeout(tapIOS, at);
      at += ms;
    });
  } catch {
    /* not supported */
  }
}
