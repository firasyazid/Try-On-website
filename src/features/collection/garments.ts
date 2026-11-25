type CollarOpening = readonly [center: number, top: number, depth: number];

export type Garment = {
  id: string;
  name: string;
  color: string;
  priceUsd: number;
  description: string;
  swatch: string;
  filename: string;
  profileFilename: string;
  necklineInset: number;
  visibleLength: number;
  profileInset: number;
  profileLength: number;
  frontCollar: CollarOpening;
  profileCollar: CollarOpening;
};

export type RailGarment = Garment & {
  imageSrc: string | null;
  profileSrc: string | null;
};

// Sample prices for the showroom prototype.
export const garments: readonly Garment[] = [
  {
    id: "pullover-hoodie",
    name: "Pullover hoodie",
    color: "White",
    priceUsd: 69,
    description: "A white pullover with a drawstring hood, ribbed cuffs, and a kangaroo pocket.",
    swatch: "#f2f1ef",
    filename: "white-pullover-hoodie-cleaned.png",
    profileFilename: "white-pullover-hoodie-profile.png",
    necklineInset: 0.037,
    visibleLength: 1.28,
    profileInset: 0.02,
    profileLength: 1.3,
    frontCollar: [0.5, 0.16, 0.048],
    profileCollar: [0.57, 0.171, 0.05],
  },
  {
    id: "toggle-track-jacket",
    name: "Toggle track jacket",
    color: "Ice blue",
    priceUsd: 89,
    description: "Ice blue with dark sleeve stripes, a stand collar, and toggle fastenings.",
    swatch: "#a9bed0",
    filename: "Ice Blue Toggle Track Jacket.png",
    profileFilename: "ice-blue-track-jacket-profile.png",
    necklineInset: 0.076,
    visibleLength: 1.14,
    profileInset: 0.018,
    profileLength: 1.22,
    frontCollar: [0.5, 0.15, 0.036],
    profileCollar: [0.515, 0.072, 0.028],
  },
  {
    id: "calvin-klein-midnight-puffer",
    name: "Calvin Klein puffer jacket",
    color: "Midnight navy",
    priceUsd: 169,
    description: "A midnight navy puffer with horizontal quilting and a high zip collar.",
    swatch: "#172131",
    filename: "Doudoune Calvin Klein bleu nuit.png",
    profileFilename: "calvin-klein-midnight-puffer-profile.png",
    necklineInset: 0.017,
    visibleLength: 1.114,
    profileInset: 0.02,
    profileLength: 1.465,
    frontCollar: [0.5, 0.04, 0.027],
    profileCollar: [0.47, 0.045, 0.024],
  },
  {
    id: "cable-knit-quarter-zip",
    name: "Cable-knit quarter zip",
    color: "Ivory",
    priceUsd: 79,
    description: "An ivory knit with raised cables and a quarter zip at the ribbed collar.",
    swatch: "#e4dbc6",
    filename: "Pull ivoire torsadé à col zippé.png",
    profileFilename: "ivory-quarter-zip-profile.png",
    necklineInset: 0.045,
    visibleLength: 1.17,
    profileInset: 0.033,
    profileLength: 1.19,
    frontCollar: [0.5, 0.125, 0.044],
    profileCollar: [0.5, 0.07, 0.025],
  },
  {
    id: "quilted-puffer",
    name: "Quilted puffer jacket",
    color: "Black",
    priceUsd: 129,
    description: "A black puffer with wide quilted panels and a high stand collar.",
    swatch: "#27282a",
    filename: "Black Quilted Puffer Jacket Cutout.png",
    profileFilename: "black-quilted-puffer-profile.png",
    necklineInset: 0.048,
    visibleLength: 0.94,
    profileInset: 0.052,
    profileLength: 1.42,
    frontCollar: [0.5, 0.066, 0.027],
    profileCollar: [0.47, 0.073, 0.022],
  },
];
