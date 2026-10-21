"use client";

import { useState } from "react";
import clsx from "clsx";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { IconInput } from "@/components/ui/Field";

function score(p: string) {
  if (!p) return 0;
  let s = p.length >= 8 ? 1 : 0;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, Math.max(p.length >= 8 ? 1 : 0, s));
}
const LABELS = ["Too short", "Okay", "Good", "Strong", "Very strong"];
const COLORS = ["bg-chili", "bg-gold", "bg-gold", "bg-mint", "bg-mint"];

export function PasswordField({
  id = "password",
  autoComplete,
  placeholder,
  meter,
  autoFocus,
}: {
  autoFocus?: boolean;
  id?: string;
  autoComplete: string;
  placeholder: string;
  meter?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const s = score(value);
  return (
    <div>
      <IconInput
        id={id}
        name="password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        minLength={meter ? 8 : undefined}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        icon={<LockKeyhole size={19} strokeWidth={1.75} />}
        right={
          <button type="button" onClick={() => setShow((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        }
      />
      {meter && value && (
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={clsx("h-1.5 flex-1 rounded-full transition-colors duration-300", n <= s ? COLORS[s] : "bg-line")} />
            ))}
          </div>
          <span className="w-20 text-right text-[12px] font-semibold text-muted">{LABELS[s]}</span>
        </div>
      )}
    </div>
  );
}
