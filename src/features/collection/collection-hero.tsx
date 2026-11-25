import Image, { getImageProps } from "next/image";
import { GarmentRail } from "./garment-rail";
import { getGarments } from "./garments.server";
import styles from "./collection-hero.module.css";

const showroomSizes = "100vw";

export async function CollectionHero() {
  const garments = await getGarments();
  const { props: portrait } = getImageProps({
    src: "/images/showroom/skylight-portrait.png",
    alt: "",
    width: 1122,
    height: 1402,
    sizes: showroomSizes,
  });

  return (
    <section id="collection" className={styles.hero} aria-labelledby="collection-title">
      <GarmentRail
        garments={garments}
        showroom={
          <picture className={styles.showroom}>
            <source media="(max-width: 699px)" srcSet={portrait.srcSet} sizes={portrait.sizes} />
            <Image
              src="/images/showroom/skylight-wide.png"
              alt=""
              fill
              sizes={showroomSizes}
              loading="eager"
              fetchPriority="high"
            />
          </picture>
        }
      />
    </section>
  );
}
