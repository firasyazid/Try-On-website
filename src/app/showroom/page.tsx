import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { SiteHeader } from "@/components/site-header";
import { getGarments } from "@/features/collection/garments.server";
import { Showroom } from "@/features/showroom/showroom";
import type { ShowroomGarment, ShowroomRacks } from "@/features/showroom/showroom-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The showroom | TryOn",
  description: "Look around the TryOn showroom and explore the collection under the skylight.",
};

function textureUrl(src: string, width: number, height: number) {
  return getImageProps({ src, width, height, alt: "" }).props.src;
}

export default async function ShowroomPage() {
  const garments = await getGarments();
  const front = garments.flatMap<ShowroomGarment>((garment) => {
    const src = garment.imageSrc ?? garment.profileSrc;
    if (!src) return [];

    const length = garment.visibleLength * 2.02;
    const frontPose = {
      src: textureUrl(src, 384, 540),
      width: garment.imageSrc ? 2.02 : length / garment.profileLength,
      collar: garment.imageSrc ? garment.frontCollar : garment.profileCollar,
    };

    return [{
      id: garment.id,
      name: garment.name,
      color: garment.color,
      priceUsd: garment.priceUsd,
      description: garment.description,
      length,
      front: frontPose,
      profile: garment.profileSrc ? {
        src: textureUrl(garment.profileSrc, 320, 450),
        width: length / garment.profileLength,
        collar: garment.profileCollar,
      } : frontPose,
    }];
  });
  const displays: ShowroomRacks = {
    front,
    left: front.filter((item) => item.id === "pullover-hoodie" || item.id === "cable-knit-quarter-zip"),
    right: front.filter((item) => item.id === "toggle-track-jacket" || item.id === "quilted-puffer"),
  };

  return (
    <>
      <div className="page-shell">
        <SiteHeader showroom />
      </div>
      <main>
        <Showroom
          displays={displays}
          useHuggingFace={process.env.FASHN_PROVIDER === "huggingface"}
          stoneTexture={textureUrl("/images/showroom/limestone.png", 512, 512)}
          roomPhoto={textureUrl("/images/showroom/skylight-wide.png", 900, 450)}
        />
      </main>
    </>
  );
}
