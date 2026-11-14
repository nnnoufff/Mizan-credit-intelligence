// Western digits in both languages for financial figures (MIZAN-OVERRIDES §4).
const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const money = (v: number) => nf.format(Math.round(v));
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const num = (v: number, digits = 1) => v.toFixed(digits);
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
