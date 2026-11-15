// The officer passcode, kept on this device after one sign-in so every officer page opens without asking again
// (demo access: one shared passcode, OFFICER_CODE on the officer service). "Sign out" clears it.
const KEY = "mizan-officer-code";

export function getOfficerCode(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setOfficerCode(code: string | null) {
  try { if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch { /* storage blocked: sign in again on each page */ }
}
