type Props = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ICONES = {
  crm: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M3.8 4.5h16.4l-6.3 7.4v6.4l-3.8 2.2v-8.6L3.8 4.5Z" />
    </svg>
  ),
  tauler: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="4.6" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="11.2" width="7" height="9.3" rx="1.4" />
    </svg>
  ),
  vendes: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M3.5 19.5h17" />
      <path d="m5.5 15.2 4-4.4 3.4 2.8 5.6-6.6" />
      <path d="M14.6 6.9h4v4" />
    </svg>
  ),
  clients: (p: Props) => (
    <svg {...base} {...p}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 19.5v-1.2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1.2" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.5a4 4 0 0 1 3 3.8v1.2" />
    </svg>
  ),
  articles: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M12 3.2 4 7.1v9.8l8 3.9 8-3.9V7.1l-8-3.9Z" />
      <path d="m4 7.1 8 3.9 8-3.9M12 11v9.8" />
    </svg>
  ),
  proveidors: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M3 6.5h10v9H3zM13 9.5h3.8l3.2 3.2v2.8H13" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  ),
  comandes: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M8 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v13a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H16" />
      <rect x="8" y="2.8" width="8" height="3.4" rx="1.1" />
      <path d="M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  ),
  albarans: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5M9 13h6M9 16.5h4" />
    </svg>
  ),
  factures: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M6 3h12v18l-2.4-1.6-2.4 1.6-2.4-1.6L8.4 21 6 19.4z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </svg>
  ),
  magatzem: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M3.5 6.2h17v3.6h-17zM5.2 9.8v9.5h13.6V9.8" />
      <path d="M10 13.5h4" />
    </svg>
  ),
  // Els cellers de qui es compra: una ampolla.
  cellers: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M10 2.5h4v3.2c0 .9.3 1.7.9 2.4l.9 1.1c.5.6.7 1.3.7 2v8.3a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-8.3c0-.7.2-1.4.7-2l.9-1.1c.6-.7.9-1.5.9-2.4V2.5Z" />
      <path d="M7.5 13.5h9" />
    </svg>
  ),

  // Vistes del CRM.
  avui: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="m9.5 15 1.8 1.8 3.4-3.6" />
    </svg>
  ),
  planner: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M7.5 13h3M13.5 13h3M7.5 16.5h3" />
    </svg>
  ),
  // Els To-Do: un portapapers amb una marca.
  deures: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M9 5.5H7.2A1.7 1.7 0 0 0 5.5 7.2v11.3a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V7.2a1.7 1.7 0 0 0-1.7-1.7H15" />
      <rect x="9" y="3.5" width="6" height="3.5" rx="1" />
      <path d="m8.8 13.3 2.2 2.2 4.4-4.6" />
    </svg>
  ),
  mapa: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M12 21s-6-5.6-6-10.3a6 6 0 0 1 12 0C18 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  ),
  leads: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M3.8 4.5h16.4l-6.3 7.4v6.4l-3.8 2.2v-8.6L3.8 4.5Z" />
    </svg>
  ),
  comptes: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M4.5 20.5v-15l7.5-2.5 7.5 2.5v15" />
      <path d="M3 20.5h18M9 9.5h1.5M13.5 9.5H15M9 13h1.5M13.5 13H15M10.5 20.5v-3.5h3v3.5" />
    </svg>
  ),
  oportunitats: (p: Props) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  contactes: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.8" />
      <circle cx="9" cy="10" r="2.2" />
      <path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M14.5 9.5h3.5M14.5 13h3.5" />
    </svg>
  ),
  activitats: (p: Props) => (
    <svg {...base} {...p}>
      <path d="m4 7 1.6 1.6L8.5 5.6M4 12.5l1.6 1.6 2.9-3M4 18l1.6 1.6 2.9-3" />
      <path d="M12 7h8.5M12 12.5h8.5M12 18h8.5" />
    </svg>
  ),
  segments: (p: Props) => (
    <svg {...base} {...p}>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16 12 20.5l8.5-4.5" />
    </svg>
  ),
  // El selector de vins: una copa.
  vins: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M7 3.5h10l-.7 6.6a4.3 4.3 0 0 1-8.6 0L7 3.5Z" />
      <path d="M12 14.4v5.6M8.5 20h7" />
    </svg>
  ),
  configuracio: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M4 7.5h10M18 7.5h2M4 16.5h4M12 16.5h8" />
      <circle cx="16" cy="7.5" r="2.1" />
      <circle cx="10" cy="16.5" r="2.1" />
    </svg>
  ),
  usuaris: (p: Props) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19v-.8a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5v.8" />
      <path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 13.8a4.5 4.5 0 0 1 3 4.2v1" />
    </svg>
  ),
  compte: (p: Props) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-1.2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V20" />
    </svg>
  ),
  sortir: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M14 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M17 8.5 20.5 12 17 15.5M20 12h-9" />
    </svg>
  ),
  cerca: (p: Props) => (
    <svg {...base} {...p}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  ),
  enrere: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  ),
  menu: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  tancar: (p: Props) => (
    <svg {...base} {...p}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ),
  avall: (p: Props) => (
    <svg {...base} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  telefon: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M7.2 3.8 9.4 4l1.1 3.3-1.7 1.4a11 11 0 0 0 5.5 5.5l1.4-1.7 3.3 1.1.2 2.2a1.7 1.7 0 0 1-1.8 1.9C10.9 17.2 6.8 13.1 5.3 5.6A1.7 1.7 0 0 1 7.2 3.8Z" />
    </svg>
  ),
  // Una bafarada amb un telèfon a dins: es reconeix com a WhatsApp sense dur-ne el logotip.
  whatsapp: (p: Props) => (
    <svg {...base} {...p}>
      <path d="M5.1 16 4.3 19.7 8 18.9A8 8 0 1 0 5.1 16Z" />
      <path d="M9.6 8.5h1.1l.7 1.8-.8.7a4.6 4.6 0 0 0 2.4 2.4l.7-.8 1.8.7v1.1a.9.9 0 0 1-.9.9 6.9 6.9 0 0 1-5.9-5.9.9.9 0 0 1 .9-.9Z" />
    </svg>
  ),
  correu: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.8" />
      <path d="m4.2 7 7.8 6 7.8-6" />
    </svg>
  ),
  // Barra lateral amb una fletxa: cap a dins per plegar-la, cap a fora per desplegar-la.
  plegar: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
      <path d="M9.5 4.5v15M16.5 9.5 14 12l2.5 2.5" />
    </svg>
  ),
  desplegar: (p: Props) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
      <path d="M9.5 4.5v15M13.5 9.5 16 12l-2.5 2.5" />
    </svg>
  ),
} as const;

export type NomIcona = keyof typeof ICONES;
