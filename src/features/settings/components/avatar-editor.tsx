"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { Pencil } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { updateAvatar } from "@/lib/actions-client";

const OUT_SIZE = 256; // square avatar, resized down before base64 encoding

/** Draw the selected crop area onto a fixed-size square canvas and return a JPEG data URL. */
async function croppedDataUrl(src: string, area: Area): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = OUT_SIZE;
  canvas.height = OUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUT_SIZE, OUT_SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function AvatarEditButton({ hasAvatar, className }: { hasAvatar: boolean; className?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setSrc(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setError(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Pick an image file.");
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const save = () =>
    start(async () => {
      if (!src || !area) return;
      const dataUrl = await croppedDataUrl(src, area);
      const res = await updateAvatar(dataUrl);
      if (!res.ok) return setError(res.error ?? "Could not save the photo.");
      close();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await updateAvatar("");
      if (!res.ok) return setError(res.error ?? "Could not remove the photo.");
      close();
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Edit photo" className={className}>
        <Pencil className="size-2.75" strokeWidth={2.4} />
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Profile photo"
        subtitle="Pick a photo, then drag and zoom to frame it."
        ariaLabel="Edit profile photo"
        footer={
          src ? (
            <ModalActions onCancel={close} submitLabel="Save photo" pending={pending} onSubmit={save} />
          ) : undefined
        }
      >
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        {src ? (
          <div className="flex flex-col gap-4">
            <div className="relative h-64 w-full overflow-hidden rounded-xl bg-ink/80">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setArea(px)}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="w-full accent-teal"
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="text-13 font-semibold text-teal">
              Choose a different photo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bd2 text-13 font-semibold text-mut hover:bg-bg2"
            >
              <Pencil className="size-5" strokeWidth={2} />
              Choose a photo
            </button>
            {hasAvatar && (
              <button type="button" onClick={remove} disabled={pending} className="text-13 font-semibold text-out disabled:opacity-60">
                Remove current photo
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-13 font-medium text-out">{error}</p>}
      </Modal>
    </>
  );
}
