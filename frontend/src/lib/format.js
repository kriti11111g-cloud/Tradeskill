export const fmtUSD = (n, digits = 2) => {
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const rankName = (v) => {
  if (v == null || v === "") return "V1";
  const m = String(v).match(/(\d+)/);
  return m ? `V${m[1]}` : String(v);
};

export const fmtNum = (n, digits = 4) => {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
};

export const fmtPct = (n, digits = 2) => {
  if (n == null || isNaN(n)) return "0.00%";
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(digits) + "%";
};

export const shortSymbol = (s) => (s || "").replace("USDT", "");

export const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
