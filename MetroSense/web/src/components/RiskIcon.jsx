// Shape per risk band so status never relies on colour alone.
export function RiskIcon({ level, color, size = 14 }) {
  const s = size;
  const common = { fill: color, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 1 };
  let shape;
  switch (level.shape) {
    case 'triangle':
      shape = <polygon points={`${s / 2},1 ${s - 1},${s - 1} 1,${s - 1}`} {...common} />;
      break;
    case 'diamond':
      shape = <polygon points={`${s / 2},0.5 ${s - 0.5},${s / 2} ${s / 2},${s - 0.5} 0.5,${s / 2}`} {...common} />;
      break;
    case 'octagon': {
      const a = s * 0.29, b = s - a;
      shape = (
        <>
          <polygon points={`${a},0.5 ${b},0.5 ${s - 0.5},${a} ${s - 0.5},${b} ${b},${s - 0.5} ${a},${s - 0.5} 0.5,${b} 0.5,${a}`} {...common} />
          <rect x={s / 2 - s * 0.08} y={s * 0.2} width={s * 0.16} height={s * 0.38} fill="#fff" />
          <rect x={s / 2 - s * 0.08} y={s * 0.67} width={s * 0.16} height={s * 0.14} fill="#fff" />
        </>
      );
      break;
    }
    case 'ring': // beyond forecast range: hollow, so it never reads as healthy
      shape = <circle cx={s / 2} cy={s / 2} r={s / 2 - 1.5} fill="none" stroke={color} strokeWidth={2} strokeDasharray="2 1.5" />;
      break;
    default:
      shape = <circle cx={s / 2} cy={s / 2} r={s / 2 - 1} {...common} />;
  }
  return (
    <svg className="risk-icon" width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      {shape}
    </svg>
  );
}

export function RiskBadge({ level, color, value }) {
  return (
    <span className={`risk-badge risk-${level.key}`} style={{ '--risk': color }}>
      <RiskIcon level={level} color={color} size={12} />
      {level.label}
      {value != null && <span className="risk-badge-value">{value}</span>}
    </span>
  );
}
