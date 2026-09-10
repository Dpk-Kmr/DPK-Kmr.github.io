import type { ElementKind } from '../types';

export default function ElementThumbnail({
  kind,
  color = '#b8b09a',
  large = false,
}: {
  kind: ElementKind;
  color?: string;
  large?: boolean;
}) {
  const stroke = '#656b59';
  const common = { stroke, strokeWidth: 1.3, strokeLinejoin: 'round' as const };
  let shape;
  switch (kind) {
    case 'stairs':
      shape = (
        <>
          <ellipse cx="60" cy="72" rx="43" ry="5" fill="#000" opacity=".05" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path
                d={`M ${22 + i * 12} ${62 - i * 9} l 23 -10 14 8 -23 10 Z`}
                fill={color}
                {...common}
              />
              <path
                d={`M ${22 + i * 12} ${62 - i * 9} v 9 l 14 8 v -9 Z`}
                fill="#ad9572"
                {...common}
              />
              <path
                d={`M ${36 + i * 12} ${70 - i * 9} l 23 -10 v 9 l -23 10 Z`}
                fill={color}
                {...common}
              />
            </g>
          ))}
          <path
            d="M 30 58 V 35 L 80 4 V 21 M 53 45 V 21 M 66 35 V 13"
            fill="none"
            stroke="#7b8569"
            strokeWidth="1.5"
          />
        </>
      );
      break;
    case 'sofa':
    case 'armchair':
      shape = (
        <>
          <ellipse cx="60" cy="65" rx="43" ry="6" fill="#000" opacity=".055" />
          <path d="M25 48v15m51-7v10m22-20v13" {...common} />
          <path
            d="m22 35 26-14 50 14v21L74 69 22 52Z"
            fill={color}
            {...common}
          />
          <path d="m27 35 22-11 44 12-21 12Z" fill="#f0eee5" {...common} />
          <path
            d="m29 35 18 5v-13m1 13 24 7 18-10v11L72 60 29 47Z"
            fill={color}
            {...common}
          />
          <path
            d="m21 36 8-4 7 3v15l-7 4-8-3Zm48 13 8-5 8 3v14l-9 5-7-3Z"
            fill={color}
            {...common}
          />
          <path
            d="m40 29 12 4-1 10-12-4Zm18 5 12 4-1 9-12-4Z"
            fill="#b7bca0"
            stroke={stroke}
            strokeWidth=".7"
          />
        </>
      );
      break;
    case 'bed':
      shape = (
        <>
          <ellipse cx="61" cy="67" rx="40" ry="5" fill="#000" opacity=".055" />
          <path
            d="m28 25 36-16 29 14v28L54 72 27 58Z"
            fill={color}
            {...common}
          />
          <path d="m29 35 34-15 28 14-35 19Z" fill="#f3f1e9" {...common} />
          <path d="m31 47 34-16 27 12-36 20Z" fill={color} {...common} />
          <path
            d="m34 32 11-5 9 4-11 6Zm17-8 11-5 9 4-11 6Z"
            fill="#fdfcf6"
            {...common}
          />
          <path
            d="m29 48 27 13 36-18v10L56 72 29 59Z"
            fill={color}
            {...common}
          />
        </>
      );
      break;
    case 'plant':
      shape = (
        <>
          <ellipse cx="61" cy="69" rx="21" ry="5" fill="#000" opacity=".055" />
          <path d="m45 48 5 20q10 8 21 0l5-20Z" fill="#cdc4b0" {...common} />
          <ellipse cx="60" cy="48" rx="15" ry="6" fill="#807d65" {...common} />
          <path
            d="M60 50V15m0 24L43 24m17 8 16-15"
            fill="none"
            stroke="#686c49"
            strokeWidth="2"
          />
          {[
            [44, 23, -40],
            [56, 18, 20],
            [70, 20, 45],
            [47, 35, -40],
            [69, 35, 40],
            [60, 9, 0],
          ].map(([x, y, r], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="6"
              ry="12"
              transform={`rotate(${r} ${x} ${y})`}
              fill={i % 2 ? '#6f865b' : color}
            />
          ))}
        </>
      );
      break;
    case 'dining-table':
    case 'coffee-table':
    case 'nightstand':
      shape = (
        <>
          <ellipse cx="60" cy="69" rx="33" ry="5" fill="#000" opacity=".055" />
          <path d="M36 39v25m48-25v25M59 45v26" {...common} strokeWidth="4" />
          <ellipse cx="60" cy="36" rx="36" ry="18" fill={color} {...common} />
          <path d="M24 36v4c0 24 72 24 72 0v-4" fill={color} {...common} />
          <ellipse cx="60" cy="35" rx="36" ry="17" fill={color} {...common} />
          <path d="m37 35 35-10m-26 21 34-11" stroke="#f7f1dd" opacity=".3" />
        </>
      );
      break;
    case 'chair':
      shape = (
        <>
          <path
            d="m37 43-2 25m43-31 3 24M57 52v20M38 22v24m38-36v28"
            {...common}
            strokeWidth="3"
          />
          <path
            d="m35 23 25-12 20 2v14L57 39 35 35Z"
            fill={color}
            {...common}
          />
          <path d="m36 44 22-11 23 10-24 13Z" fill="#d9d0b3" {...common} />
          <path d="m35 24 23 8 22-11" fill="none" {...common} />
        </>
      );
      break;
    case 'rug':
      shape = (
        <>
          <path d="m13 40 52-24 44 25-53 28Z" fill={color} {...common} />
          <path d="m23 40 42-18 34 19-43 22Z" fill="none" stroke="#a3997d" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`m${20 + i * 7} ${44 + i * 4} -5 3m${53 + i * 7} ${20 + i * 4} 5-3`}
              stroke="#a3997d"
            />
          ))}
        </>
      );
      break;
    case 'lamp':
    case 'light':
      shape = (
        <>
          <ellipse cx="61" cy="68" rx="18" ry="5" fill={color} {...common} />
          <path d="M61 65V26" stroke={stroke} strokeWidth="2" />
          <path d="m44 16-8 22q24 13 48 0l-8-22Z" fill={color} {...common} />
          <ellipse cx="60" cy="16" rx="16" ry="5" fill="#eae3d1" {...common} />
        </>
      );
      break;
    case 'window':
    case 'door':
    case 'wall':
    case 'wardrobe':
      shape = (
        <>
          <path
            d="m33 20 45-11 9 7v45L42 76l-9-7Z"
            fill={kind === 'window' ? '#c7dcd6' : color}
            {...common}
          />
          <path d="m42 26 45-10M42 26v50m20-56v49" fill="none" {...common} />
          {kind === 'window' && <path d="m42 49 45-13" {...common} />}
          <path d="M57 45v8m9-11v8" stroke={stroke} strokeWidth="2" />
        </>
      );
      break;
    case 'tv':
      shape = (
        <>
          <path
            d="m24 50 58-17 14 10v14L40 73 24 63Z"
            fill={color}
            {...common}
          />
          <path d="m30 17 54-12v38L30 59Z" fill="#474f46" {...common} />
          <path d="m35 21 43-10v27L35 51Z" fill="#7b8d81" />
          <path d="m43 56 22-6" stroke="#ded3ba" />
        </>
      );
      break;
    case 'sink':
    case 'kitchen-counter':
      shape = (
        <>
          <path
            d="m22 33 54-17 24 16v28L47 78 22 61Z"
            fill={color}
            {...common}
          />
          <path d="m22 33 25 16 53-17-24-16Z" fill="#e9e6da" {...common} />
          <path d="M47 49v29m25-37v28" {...common} />
          <path d="m53 55 12-4m13-4 12-4" stroke={stroke} strokeWidth="2" />
          {kind === 'sink' && (
            <>
              <ellipse
                cx="61"
                cy="33"
                rx="13"
                ry="6"
                fill="#a8b8b1"
                {...common}
              />
              <path
                d="M72 30V17q-8-7-9 2"
                fill="none"
                stroke={stroke}
                strokeWidth="2"
              />
            </>
          )}
        </>
      );
      break;
    case 'shower':
      shape = (
        <>
          <path
            d="m30 25 37-13 22 13v41L51 80 30 66Z"
            fill="#bfd5cf"
            fillOpacity=".45"
            {...common}
          />
          <path
            d="m30 66 37-14 22 14-38 14ZM51 39v41L30 66V25l21 14 38-14"
            fill="none"
            {...common}
          />
          <path d="M67 49V20h-7" fill="none" {...common} />
        </>
      );
      break;
    case 'toilet':
      shape = (
        <>
          <path d="m43 22 23-8 12 9v26L55 62 43 52Z" fill={color} {...common} />
          <path
            d="m49 44 27-8 12 12v13L62 77 47 65Z"
            fill={color}
            {...common}
          />
          <ellipse cx="66" cy="51" rx="20" ry="12" fill="#f3f3ec" {...common} />
          <ellipse cx="66" cy="50" rx="12" ry="7" fill="#cbd8d2" {...common} />
        </>
      );
      break;
    default:
      shape = (
        <>
          <path
            d="m36 24 33-11 16 11v36L52 74 36 62Z"
            fill={color}
            {...common}
          />
          <path d="m52 35 33-11M52 35v39" fill="none" {...common} />
          {kind === 'water-port' ? (
            <path
              d="m61 54 12-4v-9m-15 4 20-6"
              stroke="#499ccb"
              strokeWidth="4"
              fill="none"
            />
          ) : (
            <>
              <circle cx="62" cy="46" r="2" fill={stroke} />
              <circle cx="75" cy="42" r="2" fill={stroke} />
              <path d="m65 56 7-2" stroke={stroke} strokeWidth="2" />
            </>
          )}
        </>
      );
  }
  return (
    <svg
      viewBox="0 0 120 88"
      fill="none"
      aria-hidden="true"
      className={large ? 'element-thumbnail large' : 'element-thumbnail'}
    >
      {shape}
    </svg>
  );
}
