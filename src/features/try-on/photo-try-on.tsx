"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { acceptsPhoto, maxPhotoBytes, photoTypes } from "./photo";
import styles from "./photo-try-on.module.css";

type Garment = { id: string; name: string; image: string };

export function PhotoTryOn({ garment, onClose, useHuggingFace }: {
  garment: Garment;
  onClose: () => void;
  useHuggingFace: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const title = useId();
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => request.current?.abort();
  }, []);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result); }, [result]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!acceptsPhoto(file.type) || file.size === 0) {
      setMessage("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size > maxPhotoBytes) {
      setMessage("Choose a photo up to 8 MB.");
      return;
    }
    setPhoto({ file, url: URL.createObjectURL(file) });
    setResult(null);
    setMessage("");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || request.current) return;

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setResult(null);
    setMessage("");

    try {
      const response = await fetch(`/api/try-on?garment=${encodeURIComponent(garment.id)}`, {
        method: "POST",
        headers: { "Content-Type": photo.file.type },
        body: photo.file,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message ?? "Photo try-on couldn't finish. Please try again.");
      }
      const preview = await response.blob();
      if (!controller.signal.aborted) setResult(URL.createObjectURL(preview));
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : "Photo try-on couldn't finish. Please try again.");
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const source = result ?? photo?.url ?? garment.image;
  const imageLabel = result ? "Your generated try-on preview" : photo ? "Your selected photo" : garment.name;

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={onClose}>
      <div className={styles.layout}>
        <div className={styles.preview} data-photo={Boolean(photo)}>
          <Image src={source} alt={imageLabel} fill unoptimized sizes="(max-width: 640px) 100vw, 480px" />
        </div>
        <div className={styles.content}>
          <button className={styles.close} type="button" aria-label="Close photo try-on" onClick={() => dialog.current?.close()}>
            <span aria-hidden="true">×</span>
          </button>
          <h2 id={title}>Photo try-on</h2>
          <p className={styles.garment}>{garment.name}</p>
          <p className={styles.instructions}>Choose a front-facing photo with your shoulders and upper body visible. JPEG, PNG, or WebP up to 8 MB.</p>
          {useHuggingFace && <p className={styles.instructions}>Hugging Face processes your photo when you generate a preview.</p>}
          <form className={styles.actions} onSubmit={generate}>
            <input ref={input} type="file" accept={photoTypes.join(",")} onChange={choosePhoto} hidden />
            {!photo ? (
              <button type="button" className={styles.primary} onClick={() => input.current?.click()}>
                Choose a photo <span aria-hidden="true">→</span>
              </button>
            ) : result ? (
              <a className={styles.primary} href={result} download="try-on.png">Download preview <span aria-hidden="true">↓</span></a>
            ) : (
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? "Generating…" : "Generate preview"} <span aria-hidden="true">→</span>
              </button>
            )}
            {photo && (
              <button type="button" className={styles.pickPhoto} disabled={busy} onClick={() => input.current?.click()}>
                Choose another photo
              </button>
            )}
          </form>
          <div className={styles.status} aria-live="polite">
            {busy && <p>Generating your preview. This can take a few minutes.</p>}
            {result && <p>Your preview is ready.</p>}
            {message && <p className={styles.error} role="alert">{message}</p>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
