// === ICONS === inline SVG (lucide-style, currentColor)
// NOTE: rename the stroke-width prop away from "stroke" so it can't collide with
// the SVG stroke attribute via prop spreading. Also: no {...rest} spread on the
// <svg> element — every consumer-supplied attribute would need explicit handling
// and the only ones we actually use are size/strokeWidth/className.
const Icon = ({ d, size = 16, sw = 1.75, className = '', children, ...rest }) => {
  // `stroke` from legacy callers maps onto `sw`
  if (rest.stroke != null) { sw = rest.stroke; }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
};

// ——— Brand mark (calendar + heartbeat = validade + monitoramento ativo) ———
let _aeLogoSeed = 0;
const LogoMark = ({ size = 28, animated = false, className = '' }) => {
  const uid = React.useMemo(() => `ae-${++_aeLogoSeed}`, []);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="AvisaEstoque"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#18A55F"/>
          <stop offset="1" stopColor="#0B6B3E"/>
        </linearGradient>
        <linearGradient id={`${uid}-hl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"   stopColor="#fff" stopOpacity="0.28"/>
          <stop offset="0.5" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z" fill={`url(#${uid}-bg)`}/>
      <path d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z" fill={`url(#${uid}-hl)`}/>
      <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="26" y="30" width="44" height="40" rx="7"/>
        <path d="M 26 43 L 70 43"/>
        <path d="M 37 24 L 37 33"/>
        <path d="M 59 24 L 59 33"/>
        <path
          d="M 33 58 L 41 58 L 45 50 L 51 64 L 55 58 L 63 58"
          strokeWidth="5"
          className={animated ? 'ae-heartbeat' : ''}
        />
      </g>
    </svg>
  );
};

// ——— Logo with optional wordmark + tagline ———
const Logo = ({ size = 28, withWordmark = false, withTagline = false, animated = false, className = '' }) => {
  if (!withWordmark) return <LogoMark size={size} animated={animated} className={className}/>;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} animated={animated} />
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight" style={{ color: 'var(--fg)', fontSize: Math.max(13, size * 0.5) }}>
          AvisaEstoque
        </span>
        {withTagline && (
          <span className="block text-[11px]" style={{ color: 'var(--muted)' }}>
            Alertas de validade para PMEs
          </span>
        )}
      </span>
    </span>
  );
};

const I = {
  Logo: LogoMark,
  Bell:   (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Icon>,
  Home:   (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></Icon>,
  Box:    (p) => <Icon {...p}><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></Icon>,
  Plus:   (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  Settings:(p)=> <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  Edit:   (p) => <Icon {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></Icon>,
  Trash:  (p) => <Icon {...p}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></Icon>,
  Check:  (p) => <Icon {...p} d="M20 6 9 17l-5-5"/>,
  X:      (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />,
  ArrowUp:(p) => <Icon {...p} d="M12 19V5M5 12l7-7 7 7"/>,
  ArrowDown:(p)=> <Icon {...p} d="M12 5v14M5 12l7 7 7-7"/>,
  ArrowRight:(p)=> <Icon {...p} d="M5 12h14M13 5l7 7-7 7"/>,
  ArrowLeft:(p)=> <Icon {...p} d="M19 12H5M11 19l-7-7 7-7"/>,
  Clock:  (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  Alert:  (p) => <Icon {...p}><path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.1 14a2 2 0 0 1-1.7 3H3.9a2 2 0 0 1-1.7-3l8.1-14Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Icon>,
  AlertTri:(p)=> <Icon {...p}><path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.1 14a2 2 0 0 1-1.7 3H3.9a2 2 0 0 1-1.7-3l8.1-14Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Icon>,
  Shield: (p) => <Icon {...p}><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z"/></Icon>,
  ShieldCheck:(p)=> <Icon {...p}><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></Icon>,
  XCircle:(p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></Icon>,
  Send:   (p) => <Icon {...p}><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></Icon>,
  Chat:   (p) => <Icon {...p}><path d="M21 12a8 8 0 1 1-3.4-6.5L21 4l-1 4.5A8 8 0 0 1 21 12Z"/></Icon>,
  Eye:    (p) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></Icon>,
  EyeOff: (p) => <Icon {...p}><path d="M17.94 17.94A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.5 10.5 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/></Icon>,
  Sparkle:(p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></Icon>,
  Building:(p)=> <Icon {...p}><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 7h.01M13 7h.01M9 11h.01M13 11h.01M9 15h.01M13 15h.01"/></Icon>,
  Phone:  (p) => <Icon {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2Z"/></Icon>,
  Filter: (p) => <Icon {...p}><path d="M3 4h18l-7 9v6l-4 2v-8L3 4Z"/></Icon>,
  Inbox:  (p) => <Icon {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></Icon>,
  Logout: (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></Icon>,
  Dot:    (p) => <Icon {...p}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></Icon>,
  Command:(p) => <Icon {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3Z"/></Icon>,
  Calendar:(p)=> <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>,
};

window.I = I;
window.Icon = Icon;
window.Logo = Logo;
window.LogoMark = LogoMark;
