import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { HangingGarment } from "./hanging-garment";
import { PhotoSurface } from "./photo-surface";
import {
  entryPosition, rackOffset, racks, railHeight,
  type ProductView, type Selection, type ShowroomRacks, type Vector, type WallId,
} from "./showroom-layout";
import {
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Material,
  type Texture,
} from "three";

const roomWidth = 17.6;
const roomDepth = 15.1;
const roomHeight = 6.65;

export function CameraTurn({ heading, closeup, motion }: {
  heading: RefObject<number>;
  closeup: RefObject<ProductView | null>;
  motion: RefObject<boolean>;
}) {
  const velocities = useRef([0, 0, 0, 0, 0]);

  useFrame(({ camera, size, invalidate }, delta) => {
    const view = closeup.current;
    const startingAfterIdle = delta > 0.05 && velocities.current.every((velocity) => velocity === 0);
    const frameTime = startingAfterIdle ? 1 / 60 : MathUtils.clamp(delta, 1 / 120, 1 / 15);
    const response = 12;
    const decay = Math.exp(-response * frameTime);
    let moving = false;

    function move(current: number, target: number, axis: number) {
      const offset = current - target;
      const step = (velocities.current[axis] + response * offset) * frameTime;
      const remaining = (offset + step) * decay;
      const velocity = (velocities.current[axis] - response * step) * decay;
      const settled = !motion.current || offset * remaining <= 0 ||
        (Math.abs(remaining) < 0.0003 && Math.abs(velocity) < 0.004);
      velocities.current[axis] = settled ? 0 : velocity;
      moving ||= !settled;
      return settled ? target : target + remaining;
    }

    const [x, y, z] = view?.position ?? entryPosition;
    camera.position.set(move(camera.position.x, x, 0), move(camera.position.y, y, 1), move(camera.position.z, z, 2));
    camera.rotation.set(
      move(camera.rotation.x, view?.pitch ?? 0.118, 3),
      move(camera.rotation.y, view?.yaw ?? MathUtils.degToRad(heading.current), 4),
      0,
      "YXZ",
    );

    if (camera instanceof PerspectiveCamera) {
      const fieldOfView = MathUtils.clamp(73 - (size.width / size.height) * 17, 44, 64);
      if (Math.abs(fieldOfView - camera.fov) > 0.01) {
        camera.fov = fieldOfView;
        camera.updateProjectionMatrix();
      }
    }

    if (moving) invalidate();
  });

  return null;
}

function Block({ position, size, material }: { position: Vector; size: Vector; material: Material }) {
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Tube({ position, length, radius, horizontal, material }: {
  position: Vector;
  length: number;
  radius: number;
  horizontal?: boolean;
  material: Material;
}) {
  return (
    <mesh position={position} rotation={[0, 0, horizontal ? Math.PI / 2 : 0]} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
    </mesh>
  );
}

type RackInteraction = {
  selection: Selection | null;
  detail: boolean;
  motion: RefObject<boolean>;
  onPreview: (item: Selection) => void;
  onLeave: (item: Selection) => void;
  onSelect: (item: Selection) => void;
};

function Rack({ wall, metal, garments, textures, selection, detail, motion, onPreview, onLeave, onSelect }: RackInteraction & {
  wall: WallId;
  metal: Material;
  garments: ShowroomRacks[WallId];
  textures: ReadonlyMap<string, Texture>;
}) {
  const { position, angle, width, spacing } = racks[wall];
  const supportHeight = roomHeight - railHeight - 0.14;
  const selected = selection?.wall === wall ? garments.findIndex((garment) => garment.id === selection.id) : -1;

  return (
    <group position={position} rotation={[0, angle, 0]}>
      <Tube position={[0, 0, 0]} length={width} radius={0.055} horizontal material={metal} />
      {[-1, 1].map((side) => {
        const x = side * (width / 2 - 0.34);

        return (
          <group key={side}>
            <Tube position={[x, supportHeight / 2, 0]} length={supportHeight} radius={0.033} material={metal} />
            <Tube position={[x, supportHeight - 0.015, 0]} length={0.055} radius={0.09} material={metal} />
            <Tube position={[x, 0.055, 0]} length={0.12} radius={0.071} material={metal} />
            <Tube position={[side * (width / 2), 0, 0]} length={0.08} radius={0.061} horizontal material={metal} />
          </group>
        );
      })}
      {garments.map((garment, index) => {
        const item = { wall, id: garment.id };

        return (
          <HangingGarment
            key={garment.id}
            garment={garment}
            slot={rackOffset(wall, index, garments.length)}
            spacing={spacing}
            separation={selected === -1 ? 0 : Math.sign(index - selected) * 0.4}
            active={selected === index}
            followHanger={detail}
            textures={textures}
            metal={metal}
            motion={motion}
            onEnter={(event) => {
              if (event.pointerType === "mouse") onPreview(item);
            }}
            onLeave={(event) => {
              if (event.pointerType === "mouse") onLeave(item);
            }}
            onSelect={(event) => {
              event.stopPropagation();
              onSelect(item);
            }}
          />
        );
      })}
    </group>
  );
}

const ceilingBarsX = [-4.59, -1.53, 1.53, 4.59];
const ceilingBarsZ = [-3.8, 3.1];

export function Room({ displays, stoneTexture, roomPhoto, ...interaction }: RackInteraction & {
  displays: ShowroomRacks;
  stoneTexture: string;
  roomPhoto: string;
}) {
  const [stone, photo] = useLoader(TextureLoader, [stoneTexture, roomPhoto]);
  const sources = useMemo(() => [...new Set(Object.values(displays).flatMap(
    (garments) => garments.flatMap((garment) => [garment.profile.src, garment.front.src]),
  ))], [displays]);
  const loadedTextures = useLoader(TextureLoader, sources);
  const textures = useMemo(() => new Map(loadedTextures.map((texture, index) => {
    const color = texture.clone();
    color.colorSpace = SRGBColorSpace;
    color.anisotropy = 4;
    color.needsUpdate = true;
    return [sources[index], color];
  })), [loadedTextures, sources]);
  const finishes = useMemo(() => {
    const limestone = stone.clone();
    limestone.colorSpace = SRGBColorSpace;
    limestone.wrapS = limestone.wrapT = RepeatWrapping;
    limestone.repeat.set(2.3, 1.25);
    limestone.anisotropy = 4;
    limestone.needsUpdate = true;

    const reference = photo.clone();
    reference.colorSpace = SRGBColorSpace;
    reference.anisotropy = 4;
    reference.needsUpdate = true;

    return {
      limestone,
      reference,
      walls: new MeshStandardMaterial({ color: "#eee7de", map: limestone, roughness: 0.96 }),
      floor: new MeshStandardMaterial({ color: "#e6dfd4", map: limestone, roughness: 0.71 }),
      frame: new MeshStandardMaterial({ color: "#595653", metalness: 0.41, roughness: 0.46 }),
      steel: new MeshStandardMaterial({ color: "#b3bcc0", metalness: 0.62, roughness: 0.37 }),
      roofShadow: new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    };
  }, [photo, stone]);

  useEffect(() => () => { Object.values(finishes).forEach((finish) => finish.dispose()); }, [finishes]);
  useEffect(() => () => { textures.forEach((texture) => texture.dispose()); }, [textures]);

  return (
    <>
      <color attach="background" args={["#c7d9e4"]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#f3f7ff", "#f0e9de", 2]} />
      <directionalLight
        position={[-6, 14, 4.6]}
        color="#fff8ef"
        intensity={1.7}
        castShadow
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.25}
        shadow-camera-far={34}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-autoUpdate={false}
        shadow-needsUpdate
        shadow-radius={4}
        shadow-normalBias={0.025}
        shadow-bias={-0.00013}
      />

      <Block position={[0, -0.095, 0]} size={[roomWidth, 0.19, roomDepth]} material={finishes.floor} />
      <Block position={[0, roomHeight / 2, -roomDepth / 2]} size={[roomWidth, roomHeight, 0.26]} material={finishes.walls} />
      <Block position={[0, roomHeight / 2, roomDepth / 2]} size={[roomWidth, roomHeight, 0.23]} material={finishes.walls} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block position={[side * roomWidth / 2, roomHeight / 2, 0]} size={[0.24, roomHeight, roomDepth]} material={finishes.walls} />
          <Block position={[side * 8.38, roomHeight / 2, -7.24]} size={[0.64, roomHeight, 0.29]} material={finishes.walls} />
          <Block position={[side * 8.24, roomHeight - 0.21, 0]} size={[1.24, 0.42, roomDepth]} material={finishes.walls} />
          <Block position={[0, roomHeight - 0.21, side * 6.99]} size={[roomWidth, 0.42, 1.14]} material={finishes.walls} />
        </group>
      ))}

      <PhotoSurface region="front" texture={finishes.reference} position={[0, roomHeight / 2, -7.416]} size={[roomWidth, roomHeight]} shade={0.17} />
      <PhotoSurface region="left" texture={finishes.reference} position={[-8.676, roomHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} size={[roomDepth, roomHeight]} shade={0.08} />
      <PhotoSurface region="right" texture={finishes.reference} position={[8.676, roomHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} size={[roomDepth, roomHeight]} shade={0.08} />
      <PhotoSurface region="floor" texture={finishes.reference} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} size={[roomWidth, roomDepth]} shade={0.1} />
      <PhotoSurface region="beam" texture={finishes.reference} position={[0, roomHeight - 0.21, -6.415]} size={[roomWidth, 0.42]} />
      <PhotoSurface region="roof" texture={finishes.reference} position={[0, roomHeight + 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} size={[15.3, 12.9]} />

      {[-1, 1].map((side) => (
        <group key={side}>
          <Block position={[0, roomHeight, side * 6.44]} size={[15.32, 0.08, 0.07]} material={finishes.frame} />
          <Block position={[side * 7.65, roomHeight, 0]} size={[0.07, 0.08, 12.9]} material={finishes.frame} />
        </group>
      ))}
      {ceilingBarsX.map((x) => (
        <Block key={x} position={[x, roomHeight, 0]} size={[0.087, 0.17, 13]} material={finishes.roofShadow} />
      ))}
      {ceilingBarsZ.map((z) => (
        <Block key={z} position={[0, roomHeight + 0.03, z]} size={[15.4, 0.1, 0.079]} material={finishes.roofShadow} />
      ))}

      {(["left", "front", "right"] as const).map((wall) => (
        <Rack key={wall} wall={wall} metal={finishes.steel} garments={displays[wall]} textures={textures} {...interaction} />
      ))}
    </>
  );
}
