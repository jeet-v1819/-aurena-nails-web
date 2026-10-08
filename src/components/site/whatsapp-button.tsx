import { whatsappLink } from "@/lib/constants";

/**
 * Floating WhatsApp button — visible on every public page, mobile and desktop.
 * The message is prefilled so the studio immediately knows what the visitor
 * wants.
 */
export function WhatsAppButton({ number, message, label = "Chat on WhatsApp" }: { number: string; message: string; label?: string }) {
  if (!number) return null;

  return (
    <a
      href={whatsappLink(number, message)}
      target="_blank"
      rel="noreferrer noopener"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_40px_-18px_rgba(37,211,102,0.9)] transition hover:scale-[1.03] focus-visible:outline-offset-4"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.03.24-3.5-.73-2.96-1.17-4.86-4.22-5.01-4.42-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.29.59-.37.78-.37.19 0 .39.01.56.02.18.01.42-.07.66.5.24.58.83 2.03.9 2.18.07.15.12.32.02.51-.1.2-.2.32-.39.51-.19.19-.29.24-.44.46-.15.22-.31.48-.13.8.18.32.8 1.3 1.72 2.11 1.18 1.05 2.17 1.38 2.48 1.53.31.15.49.13.67-.08.18-.2.78-.91.99-1.22.2-.31.41-.26.68-.16.27.1 1.72.81 2.02.96.29.15.49.22.56.34.07.12.07.71-.17 1.39z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  );
}
