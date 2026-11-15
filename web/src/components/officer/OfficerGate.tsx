"use client";
// One sign-in for the whole officer site. Until the passcode is checked, the page's content is not rendered at all;
// after it, every officer page opens without asking again (the code is kept on this device until "Sign out").
// Styled on its own (no Tailwind, no kit classes), because it wraps both the landing page and the app pages.
import { useEffect, useState } from "react";
import { Loader2, LockKeyhole, Scale } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { getOfficerCode, setOfficerCode } from "@/lib/officer";

type State = "checking" | "locked" | "open";

/** overlay: keep the page in the DOM under the sign-in (for the landing, whose design-kit scripts run once on load). */
export function OfficerGate({ locale, children, overlay = false }: { locale: Locale; children: React.ReactNode; overlay?: boolean }) {
  const d = getDict(locale), G = d.gate;
  const [state, setState] = useState<State>("checking");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = getOfficerCode();
    if (!saved) { setState("locked"); return; }
    api.officerCheck(saved).then(() => setState("open")).catch((x) => {
      // a wrong or changed passcode: ask again; the service being down: still ask, and say so on submit
      if (x instanceof ApiError && x.status === 401) setOfficerCode(null);
      setState("locked");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = code.trim();
    if (!v) { setErr(G.empty); return; }
    setBusy(true); setErr(null);
    try { await api.officerCheck(v); setOfficerCode(v); setState("open"); }
    catch (x) { setErr(x instanceof ApiError && x.status === 401 ? G.wrong : x instanceof ApiError && x.status === 0 ? d.common.apiDown : G.wrong); }
    finally { setBusy(false); }
  }

  const locked = state !== "open";
  const gate = state === "checking"
    ? <div style={S.page} aria-busy="true"><Loader2 size={28} style={{ color: "#4f5d64", animation: "mz-spin 1s linear infinite" }} aria-label={G.checking} /><style>{SPIN}</style></div>
    : state === "locked" ? signIn() : null;
  // overlay: the page stays mounted in the same place before and after sign-in, so nothing re-renders under the kit's scripts
  if (overlay) return (
    <>
      <div inert={locked || undefined} aria-hidden={locked || undefined}>{children}</div>
      {locked && <div style={S.overlay}>{gate}</div>}
    </>
  );
  return locked ? gate : <>{children}</>;

  function signIn() { return (
    <main style={S.page}>
      <style>{SPIN + FOCUS}</style>
      <form onSubmit={submit} noValidate style={S.card} aria-labelledby="gate-h">
        <span style={S.logo}><Scale size={22} strokeWidth={1.8} aria-hidden /></span>
        <h1 id="gate-h" style={S.h1}>{G.title}</h1>
        <p style={S.lead}>{G.lead}</p>
        <label htmlFor="gate-code" style={S.label}>{G.label}</label>
        <input id="gate-code" className="mz-gate-input" type="password" autoComplete="current-password" autoFocus value={code}
          onChange={(e) => { setCode(e.target.value); setErr(null); }}
          aria-invalid={!!err || undefined} aria-describedby={err ? "gate-err" : undefined}
          style={{ ...S.input, borderColor: err ? "#b42318" : "#dbe2e5" }} />
        {err && <p id="gate-err" role="alert" style={S.err}>{err}</p>}
        <button type="submit" className="mz-gate-btn" disabled={busy} style={S.btn}>
          {busy ? <Loader2 size={16} style={{ animation: "mz-spin 1s linear infinite" }} aria-hidden /> : <LockKeyhole size={16} aria-hidden />}
          {busy ? G.checking : G.submit}
        </button>
      </form>
    </main>
  ); }
}

/** For the officer app's sidebar: forget the passcode and go back to the sign-in. */
export function signOutOfficer() {
  setOfficerCode(null);
  window.location.reload();
}

const SPIN = "@keyframes mz-spin{to{transform:rotate(360deg)}}";
const FOCUS = ".mz-gate-input:focus{outline:2px solid #0d7480;outline-offset:1px}.mz-gate-btn:hover:not(:disabled){filter:brightness(1.1)}.mz-gate-btn:active:not(:disabled){transform:scale(.98)}.mz-gate-btn:focus-visible{outline:2px solid #0d7480;outline-offset:3px}";
const S: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 100, overflowY: "auto" },
  page: { minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px))", background: "#f7f9fa", color: "#1f3038", fontFamily: "inherit" },
  card: { width: "100%", maxWidth: 400, background: "#ffffff", border: "1px solid #dbe2e5", borderRadius: 12, padding: 28, boxShadow: "0 1px 2px rgb(31 48 56 / .05), 0 10px 30px rgb(31 48 56 / .08)", display: "flex", flexDirection: "column", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "#e2f0f1", color: "#0d7480" },
  h1: { margin: "4px 0 0", fontSize: 22, fontWeight: 600, lineHeight: 1.3 },
  lead: { margin: 0, fontSize: 14, lineHeight: 1.6, color: "#4f5d64" },
  label: { marginTop: 8, fontSize: 13, fontWeight: 500, color: "#4f5d64" },
  input: { height: 44, borderRadius: 8, border: "1px solid #dbe2e5", padding: "0 12px", fontSize: 16, color: "#1f3038", background: "#ffffff", fontFamily: "inherit" },
  err: { margin: 0, fontSize: 13, color: "#b42318" },
  btn: { marginTop: 8, height: 44, borderRadius: 8, border: 0, background: "#0d7480", color: "#ffffff", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "inherit", transition: "filter .15s, transform .1s" },
};
