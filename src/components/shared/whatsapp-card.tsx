import Image from "next/image";

// The club's WhatsApp Business number (bot lives at src/server/whatsapp).
export const WHATSAPP_NUMBER_DISPLAY = "+971 4 885 1669";
export const WHATSAPP_CHAT_LINK = "https://wa.me/97148851669?text=hi";

/** "Chat on WhatsApp" card: static QR (public/whatsapp-qr.svg encodes CHAT_LINK) + tap-to-chat
 *  for people already on their phone. Shown on the landing page and the dashboard. */
export function WhatsAppCard() {
  return (
    <div className="rounded-14 border border-hair bg-sf p-4.5">
      <div className="flex items-center gap-4.5">
        <a
          href={WHATSAPP_CHAT_LINK}
          target="_blank"
          rel="noreferrer"
          aria-label="Open a WhatsApp chat with the Peacock club bot"
          className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-hair"
        >
          {/* QR needs a light tile to stay scannable in dark mode */}
          <Image src="/whatsapp-qr.svg" alt="QR code — chat with the Peacock club bot on WhatsApp" width={104} height={104} unoptimized />
        </a>
        <div className="min-w-0">
          <div className="text-11 font-semibold uppercase leading-none tracking-5 text-teal">WhatsApp bot</div>
          <p className="mt-2 text-13 font-bold leading-none text-ink">Chat with the club on WhatsApp</p>
          <p className="mt-1.5 text-xs font-medium leading-140 text-mut">
            Scan the QR or message {WHATSAPP_NUMBER_DISPLAY} — ask for your balance, loan, dues or the latest transactions.
          </p>
          <a
            href={WHATSAPP_CHAT_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-block rounded-lg bg-teal px-3.5 py-2 text-xs font-semibold leading-none text-white"
          >
            Open chat
          </a>
        </div>
      </div>
    </div>
  );
}
