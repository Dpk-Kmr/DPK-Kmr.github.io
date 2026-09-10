import { memo, useEffect, useMemo } from 'react';
import type {} from '@react-three/fiber';
import { ExtrudeGeometry, Quaternion, Shape, Vector3 } from 'three';
import type { HomeElement } from '../types';
import { buildStairGeometry, sanitizeStairs } from '../lib/stairs';
import type { StairPoint3, StairTread } from '../lib/stairs';
export { StairsPlanSymbol } from './StairsPlanSymbol';

function Tread({
  tread,
  element,
}: {
  tread: StairTread;
  element: HomeElement;
}) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    tread.polygon.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    return new ExtrudeGeometry(shape, {
      depth: tread.thickness,
      bevelEnabled: false,
      steps: 1,
    });
  }, [tread]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const glass = element.material === 'glass';
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, tread.top - tread.thickness, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={element.color}
        roughness={element.material === 'wood' ? 0.63 : glass ? 0.12 : 0.45}
        metalness={element.material === 'metal' ? 0.7 : 0.02}
        transparent={glass}
        opacity={glass ? 0.45 : 1}
        depthWrite={!glass}
      />
    </mesh>
  );
}
function Rod({
  a,
  b,
  radius = 0.015,
  square = false,
}: {
  a: StairPoint3;
  b: StairPoint3;
  radius?: number;
  square?: boolean;
}) {
  const shape = useMemo(() => {
    const start = new Vector3(...a),
      end = new Vector3(...b);
    const direction = end.clone().sub(start);
    return {
      center: start.add(end).multiplyScalar(0.5),
      length: Math.max(0.001, direction.length()),
      rotation: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.normalize(),
      ),
    };
  }, [a, b]);
  return (
    <mesh
      position={shape.center}
      quaternion={shape.rotation}
      castShadow
      receiveShadow
    >
      {square ? (
        <boxGeometry args={[radius * 2, shape.length, radius * 2]} />
      ) : (
        <cylinderGeometry args={[radius, radius, shape.length, 8]} />
      )}
      <meshStandardMaterial
        color={square ? '#596257' : '#46564b'}
        roughness={0.45}
        metalness={0.55}
      />
    </mesh>
  );
}
export const Stairs = memo(function Stairs({
  element,
}: {
  element: HomeElement;
}) {
  const geometry = useMemo(
    () => buildStairGeometry(element),
    [element.dimensions, element.stairs],
  );
  const config = sanitizeStairs(element.stairs);
  const poleHeight =
    element.dimensions.height +
    (config.railing === 'none' ? 0.05 : config.railingHeight);
  return (
    <group>
      {geometry.treads.map((tread, i) => (
        <Tread key={i} tread={tread} element={element} />
      ))}
      {geometry.risers.map((tread, i) => (
        <Tread key={`riser-${i}`} tread={tread} element={element} />
      ))}
      {geometry.rails.map((rail, i) => (
        <group key={`rail-${i}`}>
          {rail.points.map((point, j) => (
            <group key={j}>
              <Rod
                a={[point[0], rail.bases[j], point[2]]}
                b={point}
                radius={0.013}
              />
              {j > 0 && <Rod a={rail.points[j - 1]} b={point} radius={0.024} />}
            </group>
          ))}
        </group>
      ))}
      {geometry.stringers.map((line, i) => (
        <group key={`stringer-${i}`}>
          {line.slice(1).map((point, j) => (
            <Rod
              key={j}
              a={line[j]}
              b={point}
              radius={config.stringer === 'central' ? 0.075 : 0.045}
              square
            />
          ))}
        </group>
      ))}
      {geometry.poleRadius > 0 && (
        <group>
          <mesh position={[0, poleHeight / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[geometry.poleRadius, geometry.poleRadius, poleHeight, 20]}
            />
            <meshStandardMaterial
              color="#536252"
              metalness={0.65}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[
                geometry.poleRadius * 3.5,
                geometry.poleRadius * 3.5,
                0.05,
                20,
              ]}
            />
            <meshStandardMaterial color="#46564b" roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
});
