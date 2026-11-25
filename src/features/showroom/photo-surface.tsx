import { Matrix3, type Texture } from "three";

type Point = readonly [number, number];
type Quad = readonly [Point, Point, Point, Point];
type Vector = [number, number, number];

// Corners in the Collection's 1774 × 887 photograph, clockwise from top left.
const photoRegions = {
  front: [[297, 343], [1476, 343], [1476, 724], [297, 724]],
  left: [[51, 131], [290, 340], [290, 728], [51, 811]],
  right: [[1484, 340], [1710, 151], [1710, 785], [1484, 728]],
  floor: [[296, 729], [1477, 729], [1770, 885], [4, 885]],
  roof: [[119, 1], [1622, 1], [1384, 290], [388, 290]],
  beam: [[386, 300], [1386, 300], [1386, 334], [386, 334]],
} satisfies Record<string, Quad>;

function projection([topLeft, topRight, bottomRight, bottomLeft]: Quad) {
  const [x0, y0] = topLeft;
  const [x1, y1] = topRight;
  const [x2, y2] = bottomRight;
  const [x3, y3] = bottomLeft;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dx = x0 - x1 + x2 - x3;
  const dy = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx * dy2 - dx2 * dy) / determinant;
  const h = (dx1 * dy - dx * dy1) / determinant;

  return new Matrix3().set(
    (x1 - x0 + g * x1) / 1774, (x3 - x0 + h * x3) / 1774, x0 / 1774,
    (y1 - y0 + g * y1) / 887, (y3 - y0 + h * y3) / 887, y0 / 887,
    g, h, 1,
  );
}

const projections = {
  front: projection(photoRegions.front),
  left: projection(photoRegions.left),
  right: projection(photoRegions.right),
  floor: projection(photoRegions.floor),
  roof: projection(photoRegions.roof),
  beam: projection(photoRegions.beam),
};

const vertexShader = `
  varying vec2 surfaceUv;

  void main() {
    surfaceUv = vec2(uv.x, 1.0 - uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D roomPhoto;
  uniform mat3 photoProjection;
  varying vec2 surfaceUv;

  void main() {
    vec3 projected = photoProjection * vec3(surfaceUv, 1.0);
    vec2 texel = projected.xy / projected.z;
    gl_FragColor = texture2D(roomPhoto, vec2(texel.x, 1.0 - texel.y));
    #include <colorspace_fragment>
  }
`;

export function PhotoSurface({ region, texture, position, rotation, size, shade = 0 }: {
  region: keyof typeof projections;
  texture: Texture;
  position: Vector;
  rotation?: Vector;
  size: [number, number];
  shade?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={size} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ roomPhoto: { value: texture }, photoProjection: { value: projections[region] } }}
          toneMapped={false}
        />
      </mesh>
      {shade > 0 && (
        <mesh position={[0, 0, 0.005]} receiveShadow>
          <planeGeometry args={size} />
          <shadowMaterial opacity={shade} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
