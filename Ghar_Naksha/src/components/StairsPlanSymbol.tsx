import { useMemo } from 'react';
import type { HomeElement } from '../types';
import { buildStairGeometry } from '../lib/stairs';

export function StairsPlanSymbol({ element }: { element: HomeElement }) {
  const geometry = useMemo(
    () => buildStairGeometry(element),
    [element.dimensions, element.stairs],
  );
  const path = geometry.path;
  const tip = path[path.length - 1];
  const prev = path[path.length - 2];
  const angle =
    tip && prev ? Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) : -Math.PI / 2;
  const arrow = Math.min(0.18, geometry.effectiveWidth * 0.2);
  return (
    <g className="stairs-plan-symbol" strokeLinejoin="round">
      {geometry.treads.map((tread, i) => (
        <polygon
          key={i}
          points={tread.polygon.map((p) => p.join(',')).join(' ')}
          fill={element.color}
          fillOpacity={
            tread.landing ? 0.55 : 0.37 + (0.3 * i) / geometry.treads.length
          }
          stroke="currentColor"
          strokeWidth={0.018}
        />
      ))}
      {geometry.poleRadius > 0 && (
        <circle r={geometry.poleRadius} fill="#55644d" stroke="none" />
      )}
      {path.length > 1 && (
        <>
          <polyline
            points={path.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke="#315f45"
            strokeWidth={0.032}
          />
          <polyline
            points={[
              [
                tip[0] - arrow * Math.cos(angle - 0.5),
                tip[1] - arrow * Math.sin(angle - 0.5),
              ],
              tip,
              [
                tip[0] - arrow * Math.cos(angle + 0.5),
                tip[1] - arrow * Math.sin(angle + 0.5),
              ],
            ]
              .map((p) => p.join(','))
              .join(' ')}
            fill="none"
            stroke="#315f45"
            strokeWidth={0.045}
          />
          <text
            x={path[0][0] + 0.08}
            y={path[0][1]}
            fontSize={Math.min(0.14, geometry.effectiveWidth * 0.15)}
            fill="#315f45"
            stroke="none"
            fontWeight="700"
          >
            UP
          </text>
        </>
      )}
    </g>
  );
}
