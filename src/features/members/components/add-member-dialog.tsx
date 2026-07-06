"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { Field, TextInput, FieldRow } from "@/components/shared/form";
import { formAction } from "@/lib/actions-client";
import { isoDate } from "@/lib/date";
import { initials } from "@/lib/avatar";
import type { JoinPreviewDTO } from "@/server/queries/members";
import { MonthInput } from "@/components/shared/month-input";

const OUT_SIZE = 256; // square avatar, resized down before base64 encoding

// Read an image file, centre-crop to a square and downscale to a small JPEG data URL. Crop/zoom
// framing can be refined later via the profile photo editor (settings) — this keeps add-member light.
function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = OUT_SIZE;
        canvas.height = OUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AddMemberDialog({
  children,
  buttonClassName,
  buttonAriaLabel,
  preview,
}: {
  children: React.ReactNode;
  buttonClassName?: string;
  buttonAriaLabel?: string;
  preview: JoinPreviewDTO;
}) {
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [avatar, setAvatar] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setFirst("");
    setLast("");
    setAvatar("");
    setActive(true);
    setError(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Pick an image file.");
    try {
      setAvatar(await fileToSquareDataUrl(file));
      setError(null);
    } catch {
      setError("Could not read that image.");
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("avatar", avatar);
    fd.set("status", active ? "Active" : "Inactive");
    start(async () => {
      const res = await formAction("addMember", fd);
      if (res.ok) close();
      else setError(res.error ?? "Something went wrong.");
    });
  };

  const name = [first, last].filter(Boolean).join(" ");
  const ini = name ? initials(name) : "AV";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName} aria-label={buttonAriaLabel}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Add member"
        subtitle="Create a new member account for the club."
        wide
        footer={<ModalActions onCancel={close} submitLabel="Add member" pending={pending} formId={formId} />}
      >
        <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Username" hint="Leave blank to auto-generate from the name. Members sign in by picking their name — username is not a login credential.">
            <TextInput name="username" placeholder="auto-generated from name" />
          </Field>

          <FieldRow>
            <Field label="First name *">
              <TextInput name="firstName" placeholder="First name" required value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="Last name">
              <TextInput name="lastName" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Email">
              <TextInput name="email" type="email" placeholder="name@example.com" />
            </Field>
            <Field label="Phone *">
              <TextInput name="phone" type="tel" placeholder="+91 90000 00000" required />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Joined date *">
              <MonthInput name="joined" value={isoDate().slice(0, 7)} required />
            </Field>
            <Field label="Avatar">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Upload avatar"
                  className="flex size-11.5 flex-none items-center justify-center overflow-hidden rounded-12 bg-tlsf text-15 font-bold text-teal"
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- inline base64 preview, no image domain config
                    <img src={avatar} alt="" className="size-full object-cover" />
                  ) : (
                    ini
                  )}
                </button>
                <p className="text-11 font-medium leading-140 text-fnt">Initials are used until a photo is uploaded.</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
              </div>
            </Field>
          </FieldRow>

          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            aria-pressed={active}
            className="flex items-center justify-between gap-3 rounded-14 border border-bd bg-bg2 px-4 py-3.5 text-left"
          >
            <span>
              <span className="block text-sm font-bold leading-none text-ink">Status · {active ? "Active" : "Inactive"}</span>
              <span className="mt-1.5 block text-12 font-medium leading-140 text-fnt">Active members can participate in club activities.</span>
            </span>
            <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${active ? "bg-teal" : "bg-bd2"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${active ? "left-5.5" : "left-0.5"}`} />
            </span>
          </button>

          <div className="rounded-14 border border-bd bg-bg2 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-11 font-bold uppercase leading-none tracking-5 text-fnt">On joining, expected to bring in</span>
              <span className="font-mono text-base font-bold leading-none text-ink">{preview.total}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-11 font-medium leading-130 text-fnt">Monthly deposits · since club start</div>
                <div className="mt-1 font-mono text-sm font-semibold leading-none text-ink">{preview.deposits}</div>
              </div>
              <div>
                <div className="text-11 font-medium leading-130 text-fnt">Catch-up · per-member profit</div>
                <div className="mt-1 font-mono text-sm font-semibold leading-none text-ink">{preview.profit}</div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-11 bg-sf2 px-3.5 py-3 text-12 font-medium leading-150 text-mut">
            <span>
              The <span className="font-semibold text-ink">phone number is the default password</span>. First login forces a password change. Joined date drives expected deposits &amp; catch-up.
            </span>
          </div>

          {error && <p className="text-13 font-medium leading-140 text-out">{error}</p>}
        </form>
      </Modal>
    </>
  );
}
