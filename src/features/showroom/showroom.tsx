"use client";

import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { PhotoTryOn } from "@/features/try-on/photo-try-on";
import { CameraTurn, Room } from "./room";
import { entryPosition, productView, type ProductView, type Selection, type ShowroomRacks } from "./showroom-layout";
import styles from "./showroom.module.css";

const walls = [
  { id: "left", label: "Left wall", heading: 58 },
  { id: "front", label: "Front wall", heading: 0 },
  { id: "right", label: "Right wall", heading: -58 },
] as const;
const swipeThreshold = 28;
const wheelEndDelay = 220;
const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

function wallAt(heading: number) {
  if (heading > walls[0].heading / 2) return 0;
  if (heading < walls[2].heading / 2) return 2;
  return 1;
}

type Drag = {
  id: number;
  x: number;
  y: number;
  heading: number;
  turning: boolean;
};

type WheelTurn = { heading: number; distance: number; timer: number };

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div className={styles.fallback}>
      <p>The 3D view couldn’t load.</p>
      <Link href="/#collection">Explore the collection</Link>
    </div>
  );
}

export function Showroom({ displays, stoneTexture, roomPhoto, useHuggingFace }: {
  displays: ShowroomRacks;
  stoneTexture: string;
  roomPhoto: string;
  useHuggingFace: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const invalidate = useRef(() => {});
  const heading = useRef(0);
  const motion = useRef(true);
  const closeup = useRef<ProductView | null>(null);
  const drag = useRef<Drag | null>(null);
  const wheel = useRef<WheelTurn | null>(null);
  const pointerType = useRef("mouse");
  const suppressClick = useRef(false);
  const [activeWall, setActiveWall] = useState(1);
  const [turning, setTurning] = useState(false);
  const [peek, setPeek] = useState<{ item: Selection; touch: boolean } | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      motion.current = !preference.matches;
      invalidate.current();
    }
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  const look = useCallback((angle: number) => {
    closeup.current = null;
    setSelected(null);
    setPeek(null);
    setTryOnOpen(false);
    heading.current = Math.max(walls[2].heading, Math.min(walls[0].heading, angle));
    setActiveWall(wallAt(heading.current));
    invalidate.current();
  }, []);

  const settleTurn = useCallback((initialHeading: number, distance: number) => {
    const initialWall = wallAt(initialHeading);
    const nearestWall = wallAt(heading.current);
    const nextWall = nearestWall === initialWall && Math.abs(distance) >= swipeThreshold
      ? Math.max(0, Math.min(2, initialWall + Math.sign(distance)))
      : nearestWall;

    look(walls[nextWall].heading);
  }, [look]);

  const cancelWheel = useCallback(() => {
    if (wheel.current) window.clearTimeout(wheel.current.timer);
    wheel.current = null;
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;

    function onWheel(event: WheelEvent) {
      const horizontal = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      if (drag.current?.turning || event.ctrlKey || horizontal === 0 ||
        (!event.shiftKey && Math.abs(horizontal) <= Math.abs(event.deltaY))) return;

      event.preventDefault();
      const unit = event.deltaMode === 1 ? 15 : event.deltaMode === 2 ? 100 : 1;
      const movement = wheel.current ?? { heading: heading.current, distance: 0, timer: 0 };
      // Wheel deltas describe scroll offsets, opposite to the fingers' movement.
      movement.distance -= horizontal * unit;
      look(movement.heading - movement.distance * 0.23);

      window.clearTimeout(movement.timer);
      movement.timer = window.setTimeout(() => {
        wheel.current = null;
        settleTurn(movement.heading, movement.distance);
      }, wheelEndDelay);
      wheel.current = movement;
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      cancelWheel();
    };
  }, [cancelWheel, look, settleTurn]);

  function startTurn(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    pointerType.current = event.pointerType;
    suppressClick.current = false;
    cancelWheel();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, heading: heading.current, turning: false };
  }

  function moveTurn(event: PointerEvent<HTMLDivElement>) {
    const movement = drag.current;
    if (!movement || movement.id !== event.pointerId) return;
    const dx = event.clientX - movement.x;

    if (!movement.turning) {
      const dy = event.clientY - movement.y;
      if (Math.abs(dx) < 7 || Math.abs(dx) <= Math.abs(dy)) return;
      movement.turning = true;
      suppressClick.current = true;
      setTurning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    look(movement.heading - dx / Math.min(event.currentTarget.clientWidth, 690) * 160);
  }

  function endTurn(event: PointerEvent<HTMLDivElement>) {
    if (event.type === "lostpointercapture" && event.target !== event.currentTarget) return;
    const movement = drag.current;
    if (!movement || movement.id !== event.pointerId) return;
    drag.current = null;
    if (!movement.turning) return;
    setTurning(false);

    settleTurn(movement.heading, event.type === "pointerup" ? event.clientX - movement.x : 0);
  }

  function selectWall(index: number) {
    cancelWheel();
    look(walls[index].heading);
  }

  function preview(item: Selection) {
    if (!wheel.current && !drag.current?.turning && walls[wallAt(heading.current)].id === item.wall &&
      (selected?.wall !== item.wall || selected.id !== item.id)) {
      setPeek({ item, touch: false });
    }
  }

  function leave(item: Selection) {
    setPeek((current) => current && !current.touch && current.item.wall === item.wall && current.item.id === item.id ? null : current);
  }

  function openProduct(item: Selection) {
    if (selected?.wall === item.wall && selected.id === item.id) return;
    const garments = displays[item.wall];
    const index = garments.findIndex((garment) => garment.id === item.id);
    if (index < 0) return;

    const wallIndex = walls.findIndex((wall) => wall.id === item.wall);
    cancelWheel();
    setPeek(null);
    setTryOnOpen(false);
    heading.current = walls[wallIndex].heading;
    setActiveWall(wallIndex);
    closeup.current = productView(item.wall, garments[index], index, garments.length);
    setSelected(item);
    invalidate.current();
    viewport.current?.scrollIntoView({ block: "nearest" });
  }

  function activate(item: Selection) {
    if (suppressClick.current || drag.current?.turning || wheel.current ||
      walls[wallAt(heading.current)].id !== item.wall) return;
    if (closeup.current || pointerType.current === "mouse" || (peek?.touch && peek.item.id === item.id && peek.item.wall === item.wall)) {
      openProduct(item);
      viewport.current?.focus({ preventScroll: true });
    } else {
      setPeek({ item, touch: true });
    }
  }

  function closeProduct() {
    look(heading.current);
    viewport.current?.focus({ preventScroll: true });
  }

  function keyboardTurn(event: KeyboardEvent<HTMLElement>) {
    if (tryOnOpen) return;
    if (event.key === "Escape" && closeup.current) {
      event.preventDefault();
      closeProduct();
      return;
    }
    if (event.target !== viewport.current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;

    if (selected) {
      const garments = displays[selected.wall];
      const index = garments.findIndex((garment) => garment.id === selected.id);
      const adjacent = garments[index + direction];
      if (adjacent) openProduct({ wall: selected.wall, id: adjacent.id });
      return;
    }

    const next = Math.max(0, Math.min(2, wallAt(heading.current) + direction));
    selectWall(next);
  }

  const wall = walls[activeWall];
  const product = selected && displays[selected.wall].find((garment) => garment.id === selected.id);
  const revealed = peek && displays[peek.item.wall].find((garment) => garment.id === peek.item.id);

  return (
    <section className={styles.showroom} aria-labelledby="showroom-title" onKeyDown={keyboardTurn}>
      <div
        ref={viewport}
        className={styles.viewport}
        data-wall={wall.id}
        data-turning={turning}
        data-detail={Boolean(product)}
        data-peek={Boolean(revealed)}
        role="region"
        aria-label="Interactive showroom"
        aria-describedby="showroom-instructions"
        tabIndex={0}
        onPointerDown={startTurn}
        onPointerMove={moveTurn}
        onPointerUp={endTurn}
        onPointerCancel={endTurn}
        onLostPointerCapture={endTurn}
        onPointerLeave={(event) => {
          if (!drag.current?.turning) endTurn(event);
          setPeek((current) => current?.touch ? current : null);
        }}
      >
        <span className={styles.loading} aria-hidden="true">Loading showroom…</span>
        <SceneBoundary fallback={<SceneFallback />}>
          <Canvas
            fallback={<SceneFallback />}
            shadows="percentage"
            dpr={[1, 1.5]}
            frameloop="demand"
            camera={{ position: entryPosition, fov: 49, near: 0.1, far: 80 }}
            onCreated={(state) => { invalidate.current = state.invalidate; }}
          >
            <CameraTurn heading={heading} closeup={closeup} motion={motion} />
            <Suspense fallback={null}>
              <Room
                displays={displays}
                stoneTexture={stoneTexture}
                roomPhoto={roomPhoto}
                selection={selected ?? peek?.item ?? null}
                detail={selected !== null}
                motion={motion}
                onPreview={preview}
                onLeave={leave}
                onSelect={activate}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
        {product && (
          <button type="button" className={styles.overviewButton} aria-label="Back to full rack view" onClick={closeProduct}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12H4m7 7-7-7 7-7" />
            </svg>
          </button>
        )}
        {!product && peek && revealed && (
          <div className={styles.reveal} data-touch={peek.touch}>
            <div aria-live="polite">
              <strong>{revealed.name}</strong>
              <span>{revealed.color}</span>
            </div>
            {peek.touch && (
              <button type="button" onClick={() => openProduct(peek.item)}>View details <span aria-hidden="true">↗</span></button>
            )}
          </div>
        )}
        <div className={styles.views} role="group" aria-label="Showroom walls">
          {walls.map((view, index) => (
            <button
              key={view.id}
              type="button"
              aria-pressed={index === activeWall}
              onClick={() => selectWall(index)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`page-shell ${styles.caption}`}>
        <div className={product ? styles.productCaption : undefined}>
          <h1 id="showroom-title" aria-live="polite">{product?.name ?? "The showroom."}</h1>
          <p id="showroom-instructions" className={product ? styles.productDescription : undefined}>
            {product?.description ?? "Drag, swipe, or scroll sideways to look around."}
          </p>
          {product && (
            <>
              <p className={styles.price}>{priceFormat.format(product.priceUsd)}</p>
              <div className={styles.productAction}>
                <button type="button" className={styles.tryOn} onClick={() => setTryOnOpen(true)}>
                  Try on <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}
        </div>
        <details className={styles.rackList}>
          <summary>Browse this rack</summary>
          <ul>
            {displays[wall.id].map((garment) => (
              <li key={garment.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === garment.id}
                  onClick={() => openProduct({ wall: wall.id, id: garment.id })}
                >
                  {garment.name} <span>{garment.color}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
      {product && tryOnOpen && (
        <PhotoTryOn
          garment={{ id: product.id, name: product.name, image: product.front.src }}
          useHuggingFace={useHuggingFace}
          onClose={() => setTryOnOpen(false)}
        />
      )}
    </section>
  );
}
