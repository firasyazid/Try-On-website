"use client";

import Image from "next/image";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { RailGarment } from "./garments";
import styles from "./collection-hero.module.css";

type Reveal = { id: string; source: "pointer" | "focus" | "activation" };
const cutoutSizes = "(max-width: 353px) 145px, (max-width: 470px) 41vw, (max-width: 699px) 193px, (max-width: 1031px) 165px, (max-width: 1437px) 16vw, 230px";

export function GarmentRail({ garments, showroom }: { garments: readonly RailGarment[]; showroom: ReactNode }) {
  const detailId = useId();
  const pointerType = useRef<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const activeId = reveal?.id;
  const activeIndex = garments.findIndex((garment) => garment.id === activeId);

  function clearOnEscape(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") setReveal(null);
  }

  function clearReveal(id: string, source: Reveal["source"]) {
    setReveal((current) => (current?.id === id && current.source === source ? null : current));
  }

  return (
    <>
      <div
        className={styles.stage}
        data-has-images={garments.some((garment) => garment.imageSrc || garment.profileSrc)}
        style={{ "--rail-midpoint": (garments.length - 1) / 2 } as CSSProperties}
      >
        {showroom}
        <div className={styles.rail} aria-hidden="true">
          <span className={styles.railSupport} />
          <span className={styles.railSupport} />
          <span className={styles.railBar} />
        </div>
        <ul className={styles.track} aria-label="Garments on the rail" onKeyDown={clearOnEscape}>
          {garments.map((garment, index) => {
            const active = garment.id === activeId;
            const direction = activeIndex === -1 ? 0 : Math.sign(index - activeIndex);
            const front = garment.imageSrc ?? garment.profileSrc;
            const profile = garment.imageSrc ? garment.profileSrc : null;
            const [frontCollarCenter, frontCollarTop, frontCollarDepth] = garment.imageSrc
              ? garment.frontCollar
              : garment.profileCollar;
            const [profileCollarCenter, profileCollarTop, profileCollarDepth] = garment.profileCollar;

            return (
              <li
                key={garment.id}
                className={styles.slot}
                data-active={active}
                data-profile={!!profile}
                style={{
                  "--slot-index": index,
                  "--direction": direction,
                  "--swatch": garment.swatch,
                  "--neckline-inset": garment.imageSrc ? garment.necklineInset : garment.profileInset,
                  "--garment-length": garment.visibleLength,
                  "--profile-inset": garment.profileInset,
                  "--profile-length": garment.profileLength,
                  "--front-collar-center": frontCollarCenter,
                  "--front-collar-top": frontCollarTop,
                  "--front-collar-depth": frontCollarDepth,
                  "--profile-collar-center": profileCollarCenter,
                  "--profile-collar-top": profileCollarTop,
                  "--profile-collar-depth": profileCollarDepth,
                } as CSSProperties}
              >
                <button
                  type="button"
                  className={styles.garment}
                  aria-label={`${garment.name}, ${garment.color}`}
                  aria-expanded={active}
                  aria-controls={`${detailId}-${garment.id}`}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") {
                      setReveal({ id: garment.id, source: "pointer" });
                    }
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") {
                      clearReveal(garment.id, "pointer");
                    }
                  }}
                  onPointerDown={(event) => { pointerType.current = event.pointerType; }}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) {
                      setReveal({ id: garment.id, source: "focus" });
                    }
                  }}
                  onBlur={() => clearReveal(garment.id, "focus")}
                  onClick={(event) => {
                    if (event.detail > 0 && pointerType.current === "mouse") return;

                    setReveal((current) => (
                      current?.id === garment.id ? null : { id: garment.id, source: "activation" }
                    ));
                  }}
                >
                  <span className={styles.piece} aria-hidden="true">
                    <span className={styles.artwork}>
                      {front ? (
                        <>
                          <span className={styles.hanger}>
                            <span className={styles.hangerHook} />
                            <span className={styles.hangerYoke} />
                          </span>
                          <span className={`${styles.photo} ${styles.front}`}>
                            <Image src={front} alt="" fill sizes={cutoutSizes} className={styles.cutout} loading="eager" />
                          </span>
                          {profile && (
                            <span className={`${styles.photo} ${styles.profile}`}>
                              <Image src={profile} alt="" fill sizes={cutoutSizes} className={styles.cutout} loading="eager" />
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.tagSwatch} />
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={`page-shell ${styles.caption}`}>
        <h1 id="collection-title" className={styles.title}>On the rail.</h1>
        <div className={styles.detail} aria-live="polite" aria-atomic="true">
          {garments.map((garment) => (
            <div
              key={garment.id}
              id={`${detailId}-${garment.id}`}
              className={styles.garmentDetail}
              data-visible={garment.id === activeId}
              aria-hidden={garment.id !== activeId}
            >
              <p className={styles.garmentName}>{garment.name}</p>
              <p className={styles.garmentColor}>{garment.color}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
