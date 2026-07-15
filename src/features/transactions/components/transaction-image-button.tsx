"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Paperclip, Trash2 } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { updateTransactionImage } from "@/lib/actions-client";

const MAX_DIM = 1600; // cap the long edge before encoding — proof photos don't need full resolution

/**
 * Redraw a picked image onto a canvas (downscaled if huge) and return a PNG or JPEG data URL.
 * PNG sources keep PNG (crisp screenshots / transparency); everything else encodes as JPEG (smaller
 * for photos) — the "best choice" the brief asks for, done client-side so the server stays sharp-free.
 */
async function toPngOrJpeg(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
}

/** Admin affordance on a ledger row: attach, replace, or remove a proof image. */
export function TransactionImageButton({ id, hasImage, what }: { id: string; hasImage: boolean; what: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // freshly picked image (data URL), pending save
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setPreview(null);
    setError(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Pick an image file.");
    setError(null);
    toPngOrJpeg(file)
      .then(setPreview)
      .catch(() => setError("Could not read that image."));
  };

  const save = () =>
    start(async () => {
      if (!preview) return;
      const res = await updateTransactionImage(id, preview);
      if (!res.ok) return setError(res.error ?? "Could not save the image.");
      close();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await updateTransactionImage(id, "");
      if (!res.ok) return setError(res.error ?? "Could not remove the image.");
      close();
      router.refresh();
    });

  // Current image (when nothing new is picked yet) streams from the API; a cache-buster keeps a
  // just-replaced image from showing the stale one.
  const currentSrc = hasImage ? `/api/transactions/${id}/image?v=${id}` : null;
  const shown = preview ?? currentSrc;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasImage ? "View or change image" : "Attach image"}
        className={`grid size-8 place-items-center rounded-lg transition-colors hover:bg-bg2 hover:text-ink ${hasImage ? "text-teal" : "text-fnt"}`}
      >
        {hasImage ? <Paperclip className="size-3.75" strokeWidth={2} /> : <ImagePlus className="size-3.75" strokeWidth={2} />}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={hasImage ? "Transaction image" : "Attach an image"}
        subtitle={what}
        ariaLabel="Transaction image"
        footer={preview ? <ModalActions onCancel={close} submitLabel="Save image" pending={pending} onSubmit={save} /> : undefined}
      >
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <div className="flex flex-col gap-3">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Transaction proof" className="max-h-80 w-full rounded-xl border border-bd object-contain bg-bg2" />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bd2 text-13 font-semibold text-mut hover:bg-bg2"
            >
              <ImagePlus className="size-6" strokeWidth={1.8} />
              Choose an image (PNG or JPEG)
            </button>
          )}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-13 font-semibold text-teal">
              {shown ? "Choose a different image" : "Browse…"}
            </button>
            {hasImage && !preview && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-13 font-semibold text-out disabled:opacity-60"
              >
                <Trash2 className="size-3.5" strokeWidth={2} /> Remove
              </button>
            )}
          </div>
          {error && <p className="text-13 font-medium text-out">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
