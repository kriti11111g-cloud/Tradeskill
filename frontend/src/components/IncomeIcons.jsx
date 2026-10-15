/* Solid black income icons — SINGLE SOURCE (Assets + Revenue reuse, user mandate: 100% match) */
export const Ink = ({ children, s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="var(--ink)">{children}</svg>
);

export const IconPeople = ({ s = 28 }) => (
  <Ink s={s}><path d="M0 18v-1.575q0-1.1 1.113-1.763Q2.225 14 4 14q.325 0 .625.012.3.013.575.063-.35.5-.525 1.075-.175.575-.175 1.225V18Zm6 0v-1.625q0-.8.437-1.463.438-.662 1.238-1.162.8-.5 1.912-.75.813-.25 2.113-.25 1.325 0 2.438.25 1.112.25 1.912.75t1.225 1.162q.425.663.425 1.463V18Zm13.5 0v-1.625q0-.65-.163-1.225-.162-.575-.487-1.075.275-.05.563-.063Q19.7 14 20 14q1.775 0 2.888.65Q24 15.3 24 16.425V18ZM4 13q-.825 0-1.412-.588Q2 11.825 2 11t.588-1.413Q3.175 9 4 9t1.412.587Q6 10.175 6 11q0 .825-.588 1.412Q4.825 13 4 13Zm16 0q-.825 0-1.413-.588Q18 11.825 18 11t.587-1.413Q19.175 9 20 9q.825 0 1.413.587Q22 10.175 22 11q0 .825-.587 1.412Q20.825 13 20 13Zm-8-1q-1.25 0-2.125-.875T9 9q0-1.25.875-2.125T12 6q1.25 0 2.125.875T15 9q0 1.25-.875 2.125T12 12Z" /></Ink>
);

export const IconProfit = ({ s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <g fill="var(--ink)">
      <rect x="3" y="15" width="3.4" height="6" rx="1.2" />
      <rect x="8.6" y="11.5" width="3.4" height="9.5" rx="1.2" />
      <rect x="14.2" y="8" width="3.4" height="13" rx="1.2" />
    </g>
    <path d="M4 9C8.5 8.2 12.6 6.4 16 3.9" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    <path d="M20.6 1.4 15 2.3l3.5 3.7z" fill="var(--ink)" />
  </svg>
);

export const IconCoins = ({ s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
    <ellipse cx="9.5" cy="5.6" rx="6" ry="2.4" />
    <path d="M3.5 5.6v3.4c0 1.33 2.69 2.4 6 2.4s6-1.07 6-2.4V5.6" />
    <path d="M3.5 9v3.4c0 1.33 2.69 2.4 6 2.4.53 0 1.05-.03 1.54-.08" />
    <path d="M3.5 12.4v3.2c0 1.33 2.69 2.4 6 2.4.36 0 .72-.01 1.07-.04" />
    <circle cx="16.6" cy="16.4" r="4.4" fill="var(--surface)" />
    <circle cx="16.6" cy="16.4" r="2.4" />
  </svg>
);

export const IconDocPlus = ({ s = 28 }) => (
  <Ink s={s}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5.35a6.5 6.5 0 0 1-1.1-2H6V4h7v5h5v2.03c.7.04 1.37.2 2 .44V8l-6-6zM8 12h6.5c-.66.55-1.22 1.23-1.63 2H8v-2zm0 4h4.1c-.06.33-.1.66-.1 1 0 .34.04.67.1 1H8v-2zm0-8h4v2H8V8z" />
    <path d="M18 13a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm2.7 5.2h-2v2h-1.4v-2h-2v-1.4h2v-2h1.4v2h2v1.4z" />
  </Ink>
);

export const IconDeposit = ({ s = 28 }) => (
  <Ink s={s}><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></Ink>
);

export const IconWithdraw = ({ s = 28 }) => (
  <Ink s={s}><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></Ink>
);

export const IconBars = ({ s = 28 }) => (
  <Ink s={s}><path d="M4 20.5h3v-7H4v7zm5 0h3V9H9v11.5zm5 0h3v-5h-3v5zm5 0h3V4h-3v16.5z" /></Ink>
);

export const IconCoinStack = ({ s = 28 }) => (
  <Ink s={s}><path d="M12 3C7.58 3 4 4.34 4 6s3.58 3 8 3 8-1.34 8-3-3.58-3-8-3zM4 8.5V11c0 1.66 3.58 3 8 3s8-1.34 8-3V8.5c0 1.66-3.58 3-8 3s-8-1.34-8-3zm0 5V16c0 1.66 3.58 3 8 3s8-1.34 8-3v-2.5c0 1.66-3.58 3-8 3s-8-1.34-8-3z" /></Ink>
);

export const IconPersonAdd = ({ s = 28 }) => (
  <Ink s={s}><path d="M10 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h11.35a6.6 6.6 0 0 1-.35-2.5c0-1.18.31-2.28.85-3.24C12.7 14.09 11.3 14 10 14z" /><path d="M17.5 12.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm2.9 5.7h-2.2v2.2h-1.4v-2.2h-2.2v-1.4h2.2v-2.2h1.4v2.2h2.2v1.4z" /></Ink>
);

export const IconCrown = ({ s = 28 }) => (
  <Ink s={s}><path d="M4.5 16 2.6 5.9l5.3 4.4L12 4.2l4.1 6.1 5.3-4.4L19.5 16h-15zm0 2.2h15V20h-15v-1.8z" /></Ink>
);

export const IconPercent = ({ s = 28 }) => (
  <Ink s={s}>
    <path d="M19.07 3.52 20.48 4.93 4.93 20.48 3.52 19.07z" />
    <path d="M7 10.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm0-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    <path d="M17 20.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm0-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  </Ink>
);

export const IconHandDollar = ({ s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <circle cx="12" cy="6.6" r="4.4" fill="var(--ink)" />
    <text x="12" y="9.3" textAnchor="middle" fontSize="7.8" fontWeight="900" fill="var(--surface)" fontFamily="Arial, sans-serif">$</text>
    <path
      fill="var(--ink)"
      d="M22 16.1c-.5-.45-1.28-.45-1.8-.05l-3.05 2.3c-.42.32-.94.5-1.47.5h-3.9a.68.68 0 0 1 0-1.36h2.42c.64 0 1.2-.5 1.2-1.14 0-.66-.54-1.16-1.2-1.16H9.1c-.95 0-1.87.33-2.6.94l-1.53 1.27H2.9c-.5 0-.9.4-.9.9v2.8c0 .5.4.9.9.9h12.2c.83 0 1.63-.28 2.28-.8l4.6-3.62c.62-.5.63-1.44.02-1.98z"
    />
  </svg>
);


export const IconGift = ({ s = 28 }) => (
  <Ink s={s}><path d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-5.5-1.65l-.5.67-.5-.68A3 3 0 0 0 6 5c0 .35.07.69.18 1H4a2 2 0 0 0-2 2v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a2 2 0 0 0-2-2zm-5-2a1 1 0 1 1 0 2h-1V5a1 1 0 0 1 1-1zM9 4a1 1 0 0 1 1 1v1H9a1 1 0 0 1 0-2zM4 13v7a2 2 0 0 0 2 2h5v-9H4zm9 9h5a2 2 0 0 0 2-2v-7h-7v9z" /></Ink>
);
