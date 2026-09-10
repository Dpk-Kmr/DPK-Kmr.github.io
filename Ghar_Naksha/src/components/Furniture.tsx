import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react';
import { RoundedBox } from '@react-three/drei';
import { Box3, Color, Group, Matrix4, Mesh, Vector3 } from 'three';
import type { HomeElement, Material } from '../types';

type Vec3 = [number, number, number];
interface PartProps {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: Vec3;
  round?: number;
  metal?: boolean;
  opacity?: number;
  roughness?: number;
}

const WOOD = '#816047';
const DARK_WOOD = '#5a4133';
const METAL = '#414848';
const LINEN = '#ece6d8';
const FinishContext = createContext<{ color: string; material: Material }>({
  color: '',
  material: 'fabric',
});
const FINISH_ROUGHNESS: Record<Material, number> = {
  fabric: 0.98,
  wood: 0.73,
  stone: 0.57,
  ceramic: 0.26,
  metal: 0.3,
  plaster: 0.93,
  glass: 0.1,
};

function Part({
  position,
  size,
  color,
  rotation,
  round = 0,
  metal = false,
  opacity = 1,
  roughness,
}: PartProps) {
  const finish = useContext(FinishContext);
  const primary = color === finish.color;
  const alpha =
    primary && finish.material === 'glass' ? Math.min(opacity, 0.3) : opacity;
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={
        roughness ?? (primary ? FINISH_ROUGHNESS[finish.material] : 0.8)
      }
      metalness={metal || (primary && finish.material === 'metal') ? 0.65 : 0}
      transparent={alpha < 1}
      opacity={alpha}
      depthWrite={alpha === 1}
    />
  );
  if (round > 0) {
    return (
      <RoundedBox
        position={position}
        rotation={rotation}
        args={size}
        radius={Math.min(round, ...size.map((v) => v * 0.45))}
        smoothness={2}
        bevelSegments={2}
        castShadow
        receiveShadow
      >
        {material}
      </RoundedBox>
    );
  }
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      {material}
    </mesh>
  );
}

function Cylinder({
  position,
  radius,
  height,
  color,
  topRadius,
  rotation,
  scale,
  metal = false,
}: {
  position: Vec3;
  radius: number;
  height: number;
  color: string;
  topRadius?: number;
  rotation?: Vec3;
  scale?: Vec3;
  metal?: boolean;
}) {
  const finish = useContext(FinishContext);
  const primary = color === finish.color;
  const glass = primary && finish.material === 'glass';
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[topRadius ?? radius, radius, height, 20]} />
      <meshStandardMaterial
        color={color}
        roughness={
          primary ? FINISH_ROUGHNESS[finish.material] : metal ? 0.35 : 0.78
        }
        metalness={metal || (primary && finish.material === 'metal') ? 0.65 : 0}
        transparent={glass}
        opacity={glass ? 0.3 : 1}
        depthWrite={!glass}
      />
    </mesh>
  );
}

function Ellipsoid({
  position,
  scale,
  color,
  rotation,
}: {
  position: Vec3;
  scale: Vec3;
  color: string;
  rotation?: Vec3;
}) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial color={color} roughness={0.86} />
    </mesh>
  );
}

function Ring({
  position,
  radius,
  tube,
  color,
  scale = [1, 1, 1],
  rotation = [-Math.PI / 2, 0, 0],
  arc = Math.PI * 2,
  metal = false,
}: {
  position: Vec3;
  radius: number;
  tube: number;
  color: string;
  scale?: Vec3;
  rotation?: Vec3;
  arc?: number;
  metal?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    >
      <torusGeometry args={[radius, tube, 8, 28, arc]} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.3 : 0.7}
        metalness={metal ? 0.7 : 0}
      />
    </mesh>
  );
}

function Feet({
  height = 0.2,
  x = 0.38,
  z = 0.36,
  size = 0.055,
  color = DARK_WOOD,
}: {
  height?: number;
  x?: number;
  z?: number;
  size?: number;
  color?: string;
}) {
  return (
    <>
      {[-x, x].flatMap((px) =>
        [-z, z].map((pz) => (
          <Part
            key={`${px}-${pz}`}
            position={[px, height / 2, pz]}
            size={[size, height, size]}
            color={color}
            round={0.012}
          />
        )),
      )}
    </>
  );
}

function Sofa({
  color,
  accent,
  single = false,
}: {
  color: string;
  accent: string;
  single?: boolean;
}) {
  const seats = single ? 1 : 3;
  return (
    <>
      <Feet height={0.16} x={0.4} z={0.33} size={0.04} />
      <Part
        position={[0, 0.31, 0]}
        size={[0.98, 0.29, 0.91]}
        color={accent}
        round={0.06}
      />
      <Part
        position={[0, 0.76, -0.34]}
        size={[0.96, 0.48, 0.28]}
        color={color}
        round={0.07}
      />
      {Array.from({ length: seats }, (_, i) => {
        const w = 0.76 / seats;
        const x = -0.38 + w * (i + 0.5);
        return (
          <group key={i}>
            <Part
              position={[x, 0.51, 0.09]}
              size={[w - 0.018, 0.18, 0.65]}
              color={color}
              round={0.045}
            />
            <Part
              position={[x, 0.79, -0.23]}
              size={[w - 0.022, 0.35, 0.19]}
              color={color}
              rotation={[-0.13, 0, 0]}
              round={0.04}
            />
          </group>
        );
      })}
      {[-0.44, 0.44].map((x) => (
        <Part
          key={x}
          position={[x, 0.54, 0.03]}
          size={[0.12, 0.48, 0.86]}
          color={color}
          round={0.045}
        />
      ))}
      <Part
        position={[-0.25, 0.72, -0.05]}
        size={[single ? 0.33 : 0.17, 0.28, 0.12]}
        color="#c2af8f"
        rotation={[-0.18, 0.1, -0.17]}
        round={0.04}
      />
      {!single && (
        <Part
          position={[0.26, 0.73, -0.07]}
          size={[0.18, 0.28, 0.12]}
          color="#e5ded0"
          rotation={[-0.18, -0.1, 0.2]}
          round={0.04}
        />
      )}
    </>
  );
}

function CoffeeTable({ color }: { color: string }) {
  return (
    <>
      <Part
        position={[0, 0.88, 0]}
        size={[1, 0.24, 1]}
        color={color}
        round={0.12}
      />
      <Part
        position={[-0.32, 0.4, 0]}
        size={[0.105, 0.8, 0.61]}
        color={DARK_WOOD}
        round={0.025}
      />
      <Part
        position={[0.32, 0.4, 0]}
        size={[0.105, 0.8, 0.61]}
        color={DARK_WOOD}
        round={0.025}
      />
      <Part
        position={[-0.14, 1.023, 0.06]}
        size={[0.27, 0.025, 0.31]}
        color="#c7b79d"
        rotation={[0, -0.13, 0]}
      />
      <Part
        position={[-0.13, 1.042, 0.065]}
        size={[0.235, 0.016, 0.3]}
        color="#eee7d8"
        rotation={[0, -0.13, 0]}
      />
      <Cylinder
        position={[0.21, 1.03, -0.09]}
        radius={0.09}
        height={0.06}
        color="#e3dccc"
      />
      <Cylinder
        position={[0.21, 1.064, -0.09]}
        radius={0.073}
        height={0.004}
        color="#756047"
      />
    </>
  );
}

function DiningTable({ color }: { color: string }) {
  return (
    <>
      <Feet height={0.91} x={0.29} z={0.29} size={0.067} color={color} />
      <Cylinder
        position={[0, 0.83, 0]}
        radius={0.43}
        height={0.12}
        color={DARK_WOOD}
      />
      <Cylinder
        position={[0, 0.95, 0]}
        radius={0.5}
        height={0.1}
        color={color}
      />
      <Part
        position={[0, 1.005, 0]}
        size={[0.2, 0.008, 0.88]}
        color="#d8cdb8"
      />
      <Cylinder
        position={[0, 1.016, 0]}
        radius={0.08}
        height={0.014}
        color="#d7d3c4"
      />
      <Ring
        position={[0, 1.024, 0]}
        radius={0.065}
        tube={0.005}
        color="#e4e0d2"
      />
    </>
  );
}

function Chair({ color }: { color: string }) {
  return (
    <>
      <Feet height={0.5} x={0.34} z={0.34} size={0.07} color={WOOD} />
      <Part
        position={[0, 0.52, 0.03]}
        size={[0.86, 0.14, 0.84]}
        color={color}
        round={0.06}
      />
      {[-0.34, 0.34].map((x) => (
        <Part
          key={x}
          position={[x, 0.7, -0.34]}
          size={[0.07, 0.6, 0.07]}
          color={WOOD}
          rotation={[-0.08, 0, 0]}
        />
      ))}
      <Part
        position={[0, 0.88, -0.37]}
        size={[0.89, 0.23, 0.14]}
        color={color}
        round={0.06}
        rotation={[-0.08, 0, 0]}
      />
    </>
  );
}

function Bed({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Feet height={0.15} x={0.41} z={0.39} size={0.055} />
      <Part
        position={[0, 0.25, 0.02]}
        size={[0.98, 0.27, 0.95]}
        color={WOOD}
        round={0.02}
      />
      <Part
        position={[0, 0.69, -0.455]}
        size={[1, 0.62, 0.09]}
        color={accent}
        round={0.03}
      />
      <Part
        position={[0, 0.46, 0.03]}
        size={[0.94, 0.21, 0.89]}
        color={LINEN}
        round={0.045}
      />
      <Part
        position={[0, 0.565, 0.14]}
        size={[0.96, 0.085, 0.69]}
        color={color}
        round={0.025}
      />
      <Part
        position={[0, 0.612, 0.33]}
        size={[0.965, 0.038, 0.22]}
        color="#b8a98c"
        round={0.009}
      />
      {[-0.235, 0.235].map((x) => (
        <Part
          key={x}
          position={[x, 0.61, -0.265]}
          size={[0.39, 0.12, 0.215]}
          color="#f3efe5"
          round={0.05}
          rotation={[-0.08, 0, x > 0 ? -0.015 : 0.015]}
        />
      ))}
      <Part
        position={[0, 0.613, -0.14]}
        size={[0.93, 0.05, 0.1]}
        color={color}
        round={0.012}
      />
      {[-0.22, 0, 0.22].map((x) => (
        <Part
          key={x}
          position={[x, 0.61, 0.045]}
          size={[0.003, 0.002, 0.29]}
          color={accent}
        />
      ))}
    </>
  );
}

function Nightstand({ color }: { color: string }) {
  return (
    <>
      <Feet height={0.19} x={0.35} z={0.35} size={0.09} />
      <Part
        position={[0, 0.59, 0]}
        size={[0.96, 0.78, 0.94]}
        color={color}
        round={0.035}
      />
      <Part
        position={[0, 0.97, 0]}
        size={[1, 0.06, 1]}
        color={color}
        round={0.025}
      />
      {[0.41, 0.77].map((y) => (
        <group key={y}>
          <Part
            position={[0, y, 0.474]}
            size={[0.85, 0.32, 0.027]}
            color={color}
            round={0.006}
          />
          <Part
            position={[0, y + 0.09, 0.504]}
            size={[0.24, 0.025, 0.025]}
            color={METAL}
            round={0.006}
            metal
          />
        </group>
      ))}
    </>
  );
}

function Wardrobe({ color }: { color: string }) {
  return (
    <>
      <Part position={[0, 0.5, 0]} size={[0.98, 1, 0.92]} color={color} />
      <Part
        position={[0, 0.033, 0.02]}
        size={[0.93, 0.065, 0.88]}
        color={DARK_WOOD}
      />
      {[-0.25, 0.25].map((x) => (
        <group key={x}>
          <Part
            position={[x, 0.53, 0.477]}
            size={[0.485, 0.94, 0.045]}
            color={color}
            round={0.008}
          />
          <Part
            position={[x > 0 ? 0.043 : -0.043, 0.51, 0.512]}
            size={[0.012, 0.2, 0.03]}
            color={METAL}
            metal
            round={0.006}
          />
        </group>
      ))}
    </>
  );
}

function KitchenCounter({
  color,
  storage,
}: {
  color: string;
  storage: boolean;
}) {
  return (
    <>
      <Part position={[0, 0.44, 0]} size={[0.96, 0.84, 0.94]} color={color} />
      <Part
        position={[0, 0.075, 0.01]}
        size={[0.92, 0.15, 0.88]}
        color={DARK_WOOD}
      />
      <Part
        position={[0, 0.94, 0]}
        size={[1, 0.12, 1]}
        color="#dfdbd1"
        round={0.012}
      />
      {[-0.33, 0, 0.33].map((x, i) => (
        <group key={x}>
          <Part
            position={[x, 0.4, 0.48]}
            size={[0.314, 0.52, 0.035]}
            color={color}
            round={0.009}
          />
          <Part
            position={[x, 0.77, 0.48]}
            size={[0.314, 0.19, 0.035]}
            color={color}
            round={0.009}
          />
          <Part
            position={[x, 0.78, 0.505]}
            size={[0.13, 0.019, 0.025]}
            color={METAL}
            metal
          />
          <Part
            position={[x + 0.11, 0.53, 0.505]}
            size={[0.012, 0.12, 0.025]}
            color={METAL}
            metal
          />
          {i === 0 && !storage && (
            <Part
              position={[x, 0.408, 0.505]}
              size={[0.27, 0.36, 0.006]}
              color="#343a38"
              round={0.01}
            />
          )}
        </group>
      ))}
      {!storage && (
        <>
          <Part
            position={[-0.26, 1.006, 0]}
            size={[0.37, 0.013, 0.7]}
            color="#303635"
            round={0.025}
          />
          {[-0.355, -0.17].flatMap((x) =>
            [-0.17, 0.17].map((z) => (
              <Ring
                key={`${x}-${z}`}
                position={[x, 1.016, z]}
                radius={0.052}
                tube={0.004}
                scale={[1, 1.4, 1]}
                color="#818b85"
              />
            )),
          )}
          <Part
            position={[0.3, 1.025, 0.1]}
            size={[0.2, 0.035, 0.43]}
            color={WOOD}
            round={0.025}
            rotation={[0, -0.06, 0]}
          />
        </>
      )}
    </>
  );
}

function Sink({ color }: { color: string }) {
  return (
    <>
      <Part
        position={[0, 0.41, 0]}
        size={[0.92, 0.82, 0.9]}
        color={color}
        round={0.018}
      />
      <Part
        position={[0, 0.84, 0]}
        size={[1, 0.08, 1]}
        color="#e7e4da"
        round={0.02}
      />
      {[-0.233, 0.233].map((x) => (
        <group key={x}>
          <Part
            position={[x, 0.43, 0.455]}
            size={[0.44, 0.68, 0.025]}
            color={color}
            round={0.012}
          />
          <Part
            position={[x, 0.65, 0.48]}
            size={[0.2, 0.021, 0.02]}
            color={METAL}
            metal
          />
        </group>
      ))}
      <Part
        position={[0, 0.885, 0.045]}
        size={[0.75, 0.025, 0.69]}
        color="#aeb4ad"
        round={0.08}
        metal
      />
      <Part
        position={[0, 0.9, 0.045]}
        size={[0.61, 0.012, 0.56]}
        color="#788780"
        round={0.075}
        metal
      />
      <Part
        position={[0, 0.904, 0.05]}
        size={[0.48, 0.006, 0.44]}
        color="#9daaa2"
        round={0.07}
        metal
      />
      <Cylinder
        position={[0, 0.91, 0.05]}
        radius={0.045}
        height={0.008}
        color="#65716c"
        metal
      />
      <Cylinder
        position={[0, 0.945, -0.34]}
        radius={0.022}
        height={0.15}
        color="#b6beb7"
        metal
      />
      <Ring
        position={[0, 1.016, -0.27]}
        radius={0.075}
        tube={0.019}
        color="#bbc4bc"
        rotation={[0, Math.PI / 2, 0]}
        arc={Math.PI}
        metal
      />
      <Cylinder
        position={[0.15, 0.915, -0.34]}
        radius={0.028}
        height={0.07}
        color="#b6beb7"
        metal
      />
    </>
  );
}

function Toilet({ color }: { color: string }) {
  return (
    <>
      <Part
        position={[0, 0.17, -0.03]}
        size={[0.45, 0.34, 0.56]}
        color={color}
        round={0.14}
      />
      <Ellipsoid
        position={[0, 0.43, 0.08]}
        scale={[0.43, 0.25, 0.41]}
        color={color}
      />
      <Cylinder
        position={[0, 0.582, 0.09]}
        radius={0.32}
        height={0.035}
        color="#87958e"
        scale={[0.82, 1, 1.1]}
      />
      <Ring
        position={[0, 0.604, 0.09]}
        radius={0.32}
        tube={0.057}
        color={color}
        scale={[0.98, 1.13, 0.5]}
      />
      <Part
        position={[0, 0.73, -0.325]}
        size={[0.7, 0.52, 0.32]}
        color={color}
        round={0.06}
      />
      <Part
        position={[0, 0.985, -0.325]}
        size={[0.73, 0.03, 0.34]}
        color={color}
        round={0.035}
      />
      <Cylinder
        position={[0.12, 1.005, -0.325]}
        radius={0.055}
        height={0.01}
        color="#a1aaa4"
        metal
      />
    </>
  );
}

function Shower({ color }: { color: string }) {
  return (
    <>
      <Part
        position={[0, 0.025, 0]}
        size={[1, 0.05, 1]}
        color="#e8e6de"
        round={0.01}
      />
      <Part
        position={[0, 0.502, -0.48]}
        size={[1, 0.95, 0.035]}
        color={color}
        opacity={0.19}
        roughness={0.12}
      />
      <Part
        position={[-0.48, 0.502, 0]}
        size={[0.035, 0.95, 1]}
        color={color}
        opacity={0.17}
        roughness={0.12}
      />
      {[-0.49, 0.49].map((x) => (
        <Part
          key={x}
          position={[x, 0.51, -0.485]}
          size={[0.016, 0.98, 0.016]}
          color={METAL}
          metal
        />
      ))}
      <Part
        position={[-0.485, 0.51, 0.485]}
        size={[0.016, 0.98, 0.016]}
        color={METAL}
        metal
      />
      <Part
        position={[0, 0.99, -0.485]}
        size={[1, 0.015, 0.015]}
        color={METAL}
        metal
      />
      <Part
        position={[-0.485, 0.99, 0]}
        size={[0.015, 0.015, 1]}
        color={METAL}
        metal
      />
      <Cylinder
        position={[0, 0.62, -0.44]}
        radius={0.011}
        height={0.6}
        color={METAL}
        metal
      />
      <Cylinder
        position={[0, 0.917, -0.305]}
        radius={0.012}
        height={0.27}
        color={METAL}
        rotation={[Math.PI / 2, 0, 0]}
        metal
      />
      <Cylinder
        position={[0, 0.911, -0.19]}
        radius={0.135}
        height={0.02}
        color={METAL}
        scale={[1, 1, 0.85]}
        metal
      />
      <Part
        position={[0, 0.49, -0.43]}
        size={[0.22, 0.025, 0.06]}
        color={METAL}
        round={0.01}
        metal
      />
      <Part
        position={[0, 0.053, 0.28]}
        size={[0.28, 0.005, 0.05]}
        color="#838b84"
      />
    </>
  );
}

function Plant({ color }: { color: string }) {
  const leaves: {
    position: Vec3;
    scale: Vec3;
    rotation: Vec3;
    color: string;
  }[] = [
    {
      position: [-0.2, 0.51, 0.08],
      scale: [0.22, 0.09, 0.15],
      rotation: [0.35, 0.35, -0.35],
      color: '#67815a',
    },
    {
      position: [0.22, 0.59, -0.04],
      scale: [0.24, 0.08, 0.13],
      rotation: [-0.25, -0.35, 0.4],
      color: '#718d62',
    },
    {
      position: [0.02, 0.66, 0.22],
      scale: [0.13, 0.08, 0.22],
      rotation: [-0.5, 0.4, 0],
      color: '#58754e',
    },
    {
      position: [-0.19, 0.74, -0.12],
      scale: [0.2, 0.075, 0.125],
      rotation: [0.2, -0.45, -0.45],
      color: '#7e9668',
    },
    {
      position: [0.18, 0.79, 0.07],
      scale: [0.21, 0.065, 0.13],
      rotation: [-0.3, 0.2, 0.5],
      color: '#5d7c51',
    },
    {
      position: [-0.02, 0.86, -0.14],
      scale: [0.12, 0.065, 0.22],
      rotation: [0.6, -0.1, 0.1],
      color: '#799461',
    },
    {
      position: [0.055, 0.92, 0],
      scale: [0.09, 0.085, 0.14],
      rotation: [-0.4, 0.3, 0.4],
      color: '#8ba174',
    },
  ];
  return (
    <>
      <Cylinder
        position={[0, 0.145, 0]}
        radius={0.21}
        topRadius={0.27}
        height={0.29}
        color={color}
      />
      <Cylinder
        position={[0, 0.293, 0]}
        radius={0.243}
        height={0.012}
        color="#574d3b"
      />
      <Ring position={[0, 0.29, 0]} radius={0.254} tube={0.016} color={color} />
      <Cylinder
        position={[0, 0.58, 0]}
        radius={0.015}
        topRadius={0.007}
        height={0.58}
        color="#71674c"
      />
      {leaves.map((leaf, i) => (
        <Ellipsoid key={i} {...leaf} />
      ))}
    </>
  );
}

function Rug({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Part
        position={[0, 0.45, 0]}
        size={[1, 0.9, 1]}
        color={color}
        round={0.003}
      />
      {[-0.45, 0.45].map((x) => (
        <Part
          key={`x${x}`}
          position={[x, 0.91, 0]}
          size={[0.008, 0.035, 0.93]}
          color={accent}
        />
      ))}
      {[-0.46, 0.46].map((z) => (
        <Part
          key={`z${z}`}
          position={[0, 0.91, z]}
          size={[0.9, 0.035, 0.006]}
          color={accent}
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <Part
          key={i}
          position={[-0.37 + i * 0.105, 0.905, 0]}
          size={[0.0018, 0.018, 0.88]}
          color={accent}
          opacity={0.35}
        />
      ))}
    </>
  );
}

function Television({ color }: { color: string }) {
  return (
    <>
      <Feet height={0.09} x={0.42} z={0.32} size={0.028} />
      <Part
        position={[0, 0.23, 0]}
        size={[1, 0.28, 0.94]}
        color={color}
        round={0.025}
      />
      {[-0.325, 0, 0.325].map((x) => (
        <Part
          key={x}
          position={[x, 0.23, 0.476]}
          size={[0.31, 0.245, 0.016]}
          color={color}
          round={0.008}
        />
      ))}
      <Part
        position={[0, 0.43, -0.04]}
        size={[0.033, 0.15, 0.1]}
        color={METAL}
      />
      <Part
        position={[0, 0.376, -0.04]}
        size={[0.3, 0.013, 0.37]}
        color={METAL}
        round={0.02}
      />
      <Part
        position={[0, 0.735, -0.07]}
        size={[0.9, 0.53, 0.07]}
        color="#252e2b"
        round={0.014}
      />
      <Part
        position={[0, 0.738, -0.031]}
        size={[0.866, 0.495, 0.006]}
        color="#3b504b"
        roughness={0.28}
      />
      <Part
        position={[-0.2, 0.777, -0.026]}
        size={[0.31, 0.21, 0.002]}
        color="#415b51"
        round={0.03}
      />
      <Part
        position={[0.1, 0.574, -0.026]}
        size={[0.61, 0.07, 0.002]}
        color="#516252"
        round={0.03}
      />
    </>
  );
}

function Lamp({ color }: { color: string }) {
  return (
    <>
      <Cylinder
        position={[0, 0.018, 0]}
        radius={0.34}
        height={0.035}
        color={METAL}
        metal
      />
      <Cylinder
        position={[0, 0.49, 0]}
        radius={0.023}
        height={0.92}
        color={METAL}
        metal
      />
      <Cylinder
        position={[0, 0.846, 0]}
        radius={0.48}
        topRadius={0.34}
        height={0.3}
        color={color}
      />
      <Cylinder
        position={[0, 0.69, 0]}
        radius={0.45}
        height={0.004}
        color="#ffe7b3"
      />
      <Cylinder
        position={[0, 0.996, 0]}
        radius={0.335}
        height={0.005}
        color="#f0e9db"
      />
    </>
  );
}

function Door({ color }: { color: string }) {
  return (
    <>
      {[-0.465, 0.465].map((x) => (
        <Part
          key={x}
          position={[x, 0.5, 0]}
          size={[0.07, 1, 1]}
          color="#d4cfbf"
        />
      ))}
      <Part position={[0, 0.97, 0]} size={[1, 0.06, 1]} color="#d4cfbf" />
      <Part
        position={[0, 0.477, 0]}
        size={[0.86, 0.94, 0.36]}
        color={color}
        round={0.006}
      />
      {[0.3, 0.74].map((y) => (
        <Part
          key={y}
          position={[0, y, 0.188]}
          size={[0.65, 0.32, 0.024]}
          color={color}
          round={0.005}
        />
      ))}
      <Part
        position={[0.32, 0.5, 0.29]}
        size={[0.055, 0.11, 0.18]}
        color={METAL}
        metal
        round={0.01}
      />
      <Part
        position={[0.26, 0.52, 0.44]}
        size={[0.15, 0.015, 0.08]}
        color={METAL}
        metal
        round={0.006}
      />
    </>
  );
}

function Window({ color }: { color: string }) {
  return (
    <>
      {[-0.48, 0, 0.48].map((x) => (
        <Part
          key={x}
          position={[x, 0.5, 0]}
          size={[0.04, 1, 0.5]}
          color={color}
        />
      ))}
      {[0.025, 0.975].map((y) => (
        <Part
          key={y}
          position={[0, y, 0]}
          size={[1, 0.05, 0.5]}
          color={color}
        />
      ))}
      <Part
        position={[0, 0.5, 0]}
        size={[0.94, 0.92, 0.035]}
        color="#c3dfdc"
        opacity={0.25}
        roughness={0.1}
      />
      <Part position={[0, 0.028, 0.2]} size={[1, 0.055, 0.6]} color={color} />
    </>
  );
}

function Utility({ element }: { element: HomeElement }) {
  const { kind, color } = element;
  if (kind === 'light')
    return (
      <>
        <Cylinder
          position={[0, 0.5, 0]}
          radius={0.5}
          height={1}
          color={color}
        />
        <Cylinder
          position={[0, 0.018, 0]}
          radius={0.445}
          height={0.03}
          color="#fff3cf"
        />
      </>
    );
  if (kind === 'water-port')
    return (
      <>
        <Cylinder
          position={[0, 0.5, -0.24]}
          radius={0.42}
          height={0.16}
          color="#b8cac9"
          rotation={[Math.PI / 2, 0, 0]}
          metal
        />
        <Cylinder
          position={[0, 0.5, 0.1]}
          radius={0.17}
          height={0.55}
          color="#72a7b9"
          rotation={[Math.PI / 2, 0, 0]}
          metal
        />
        <Part
          position={[0, 0.75, 0.17]}
          size={[0.75, 0.11, 0.16]}
          color="#548bac"
          round={0.04}
          metal
        />
      </>
    );
  if (kind === 'electrical-panel')
    return (
      <>
        <Part
          position={[0, 0.5, 0]}
          size={[1, 1, 1]}
          color={color}
          round={0.035}
        />
        <Part
          position={[0, 0.5, 0.51]}
          size={[0.83, 0.83, 0.03]}
          color="#c7cfca"
          round={0.025}
        />
        {[0.39, 0.65].flatMap((y) =>
          [-0.25, -0.083, 0.083, 0.25].map((x) => (
            <Part
              key={`${x}-${y}`}
              position={[x, y, 0.543]}
              size={[0.11, 0.17, 0.04]}
              color="#4d5954"
              round={0.006}
            />
          )),
        )}
        <Part
          position={[0, 0.2, 0.54]}
          size={[0.6, 0.045, 0.015]}
          color="#e8d59b"
        />
      </>
    );
  return (
    <>
      <Part
        position={[0, 0.5, 0]}
        size={[1, 1, 0.55]}
        color={color}
        round={0.09}
      />
      {kind === 'switch' ? (
        <Part
          position={[0, 0.53, 0.32]}
          size={[0.66, 0.71, 0.25]}
          color="#f0f0e7"
          round={0.045}
          rotation={[-0.08, 0, 0]}
        />
      ) : (
        <>
          <Cylinder
            position={[0, 0.5, 0.3]}
            radius={0.34}
            height={0.09}
            color="#e6e9e0"
            rotation={[Math.PI / 2, 0, 0]}
          />
          {[-0.135, 0.135].map((x) => (
            <Part
              key={x}
              position={[x, 0.54, 0.37]}
              size={[0.063, 0.14, 0.035]}
              color="#47554d"
              round={0.016}
            />
          ))}
          <Part
            position={[0, 0.33, 0.37]}
            size={[0.082, 0.063, 0.035]}
            color="#47554d"
            round={0.016}
          />
        </>
      )}
    </>
  );
}

export const Furniture = memo(function Furniture({
  element,
}: {
  element: HomeElement;
}) {
  const { kind, color, dimensions } = element;
  const fittedModel = useRef<Group>(null);
  const storage = element.name.toLowerCase().includes('storage');

  // Model decorative details as well as the body inside the inspector's bounds.
  // Measure only when the model changes; resizing applies the outer scale alone.
  useLayoutEffect(() => {
    const model = fittedModel.current;
    if (!model) return;
    model.updateWorldMatrix(true, true);
    const worldToModel = model.matrixWorld.clone().invert();
    const transform = new Matrix4();
    const vertex = new Vector3();
    const bounds = new Box3();
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      if (!positions) return;
      transform.multiplyMatrices(worldToModel, object.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(transform);
        bounds.expandByPoint(vertex);
      }
    });
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const sx = 1 / Math.max(size.x, 0.000001);
    const sy = 1 / Math.max(size.y, 0.000001);
    const sz = 1 / Math.max(size.z, 0.000001);
    model.scale.set(sx, sy, sz);
    model.position.set(-center.x * sx, -bounds.min.y * sy, -center.z * sz);
    model.updateWorldMatrix(false, true);
  }, [kind, storage]);

  const accent = `#${new Color(color).lerp(new Color('#5c5548'), 0.18).getHexString()}`;
  let content;
  switch (kind) {
    case 'sofa':
      content = <Sofa color={color} accent={accent} />;
      break;
    case 'armchair':
      content = <Sofa color={color} accent={accent} single />;
      break;
    case 'coffee-table':
      content = <CoffeeTable color={color} />;
      break;
    case 'dining-table':
      content = <DiningTable color={color} />;
      break;
    case 'chair':
      content = <Chair color={color} />;
      break;
    case 'bed':
      content = <Bed color={color} accent={accent} />;
      break;
    case 'nightstand':
      content = <Nightstand color={color} />;
      break;
    case 'wardrobe':
      content = <Wardrobe color={color} />;
      break;
    case 'kitchen-counter':
      content = <KitchenCounter color={color} storage={storage} />;
      break;
    case 'sink':
      content = <Sink color={color} />;
      break;
    case 'toilet':
      content = <Toilet color={color} />;
      break;
    case 'shower':
      content = <Shower color={color} />;
      break;
    case 'plant':
      content = <Plant color={color} />;
      break;
    case 'rug':
      content = <Rug color={color} accent={accent} />;
      break;
    case 'tv':
      content = <Television color={color} />;
      break;
    case 'lamp':
      content = <Lamp color={color} />;
      break;
    case 'wall':
      content = <Part position={[0, 0.5, 0]} size={[1, 1, 1]} color={color} />;
      break;
    case 'door':
      content = <Door color={color} />;
      break;
    case 'window':
      content = <Window color={color} />;
      break;
    default:
      content = <Utility element={element} />;
  }
  return (
    <FinishContext.Provider value={{ color, material: element.material }}>
      <group scale={[dimensions.width, dimensions.height, dimensions.depth]}>
        <group ref={fittedModel}>{content}</group>
      </group>
    </FinishContext.Provider>
  );
});
