import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { DoubleSide, MathUtils, type Group, type Material, type Mesh, type MeshBasicMaterial, type Texture } from "three";
import { hangerDrop, type GarmentPose, type ShowroomGarment } from "./showroom-layout";

type Contact = (event: ThreeEvent<PointerEvent>) => void;

function GarmentImage({ pose, texture, revealed, pivot, material }: {
  pose: GarmentPose;
  texture: Texture;
  revealed?: boolean;
  pivot: RefObject<Group | null>;
  material: RefObject<MeshBasicMaterial | null>;
}) {
  const image = texture.image as HTMLImageElement;
  const height = pose.width * image.height / image.width;
  const [center, top, depth] = pose.collar;
  const x = (0.5 - center) * pose.width;
  const y = (top + depth * 0.25) * pose.width - height / 2;

  return (
    <group
      ref={pivot}
      position={[0, -hangerDrop, revealed ? 0.075 : 0.065]}
      rotation={[0, revealed ? 0.8 : 0, 0]}
      visible={!revealed}
    >
      <mesh position={[x, y, 0]} castShadow={!revealed}>
        <planeGeometry args={[pose.width, height]} />
        <meshBasicMaterial
          ref={material}
          map={texture}
          side={DoubleSide}
          transparent
          alphaTest={0.12}
          toneMapped={false}
          opacity={revealed ? 0 : 1}
          depthWrite={!revealed}
        />
      </mesh>
    </group>
  );
}

export function HangingGarment({
  garment, slot, spacing, separation, active, followHanger, textures, metal, motion, onEnter, onLeave, onSelect,
}: {
  garment: ShowroomGarment;
  slot: number;
  spacing: number;
  separation: number;
  active: boolean;
  followHanger: boolean;
  textures: ReadonlyMap<string, Texture>;
  metal: Material;
  motion: RefObject<boolean>;
  onEnter: Contact;
  onLeave: Contact;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const hanger = useRef<Group>(null);
  const hitArea = useRef<Mesh>(null);
  const profile = useRef<Group>(null);
  const front = useRef<Group>(null);
  const profileMaterial = useRef<MeshBasicMaterial>(null);
  const frontMaterial = useRef<MeshBasicMaterial>(null);
  const amount = useRef(0);
  const gap = useRef(0);
  const profileTexture = textures.get(garment.profile.src);
  const frontTexture = textures.get(garment.front.src);

  useFrame(({ invalidate }, delta) => {
    const target = Number(active);
    const frameTime = Math.min(delta, 1 / 30);
    const advance = (current: number, next: number) => {
      const value = MathUtils.damp(current, next, 10, frameTime);
      return motion.current && Math.abs(next - value) > 0.001 ? value : next;
    };
    amount.current = advance(amount.current, target);
    gap.current = advance(gap.current, separation);
    const progress = amount.current;

    if (hitArea.current) hitArea.current.position.x = 0.04 + (followHanger ? gap.current : 0);

    if (hanger.current && profile.current && front.current && profileMaterial.current && frontMaterial.current) {
      hanger.current.position.x = gap.current;
      hanger.current.rotation.x = -0.09 * progress;
      profile.current.rotation.y = -0.65 * progress;
      front.current.rotation.y = 0.8 * (1 - progress);
      front.current.scale.setScalar(1 + 0.055 * progress);
      profile.current.visible = progress < 1;
      front.current.visible = progress > 0;
      profileMaterial.current.opacity = 1 - progress;
      frontMaterial.current.opacity = progress;
    }

    if (progress !== target || gap.current !== separation) invalidate();
  });

  if (!profileTexture || !frontTexture) return null;

  return (
    <group position={[slot, 0, 0.045]}>
      <group ref={hanger}>
        <mesh position={[-0.026, 0.013, 0.017]} rotation={[0, 0, -0.1]} material={metal}>
          <torusGeometry args={[0.071, 0.013, 7, 20, Math.PI * 1.46]} />
        </mesh>
        <mesh position={[0.04, -0.17, 0.017]} material={metal} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.34, 12]} />
        </mesh>
        <mesh position={[0.04, -hangerDrop, 0.037]}>
          <boxGeometry args={[0.071, 0.084, 0.06]} />
          <meshStandardMaterial color="#ac977d" roughness={0.7} />
        </mesh>
        <group position={[0.04, 0, 0]}>
          <GarmentImage pose={garment.profile} texture={profileTexture} pivot={profile} material={profileMaterial} />
          <GarmentImage pose={garment.front} texture={frontTexture} pivot={front} material={frontMaterial} revealed />
        </group>
      </group>
      <mesh
        ref={hitArea}
        position={[0.04, -hangerDrop - garment.length / 2, 0.13]}
        onPointerOver={onEnter}
        onPointerOut={onLeave}
        onClick={onSelect}
      >
        <planeGeometry args={[spacing, garment.length]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
