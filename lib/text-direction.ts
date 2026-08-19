export type TextDirection = "rtl" | "ltr";

// Arabic (0600–06FF), Arabic Supplement (0750–077F), Arabic Extended-A
// (08A0–08FF), and the Presentation Forms blocks (FB50–FDFF, FE70–FEFF).
const ARABIC =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN = /[A-Za-z]/g;

// Share of letters that must be Arabic before text reads as RTL. Not 50%:
// Arabic prose routinely carries Latin brand names — "متجر يستخدم Stripe و
// Shopify و Google Sheets" is majority-Latin by character count but plainly
// an Arabic sentence. Latin prose containing a stray Arabic word is far rarer,
// so the bar is deliberately low rather than even.
const RTL_SHARE = 0.2;

/**
 * Decides which way a block of text should read.
 *
 * Deliberately Arabic-script detection rather than language detection: it is
 * the one case this product needs, it needs no dependency, and it is a single
 * function to upgrade or delete if that changes.
 *
 * Mixed text degrades gracefully in both directions, and text with no Arabic
 * at all — English, digits, emoji, empty — falls back to LTR.
 */
export function getTextDirection(text: string): TextDirection {
  const arabic = text.match(ARABIC)?.length ?? 0;
  if (arabic === 0) return "ltr";

  const latin = text.match(LATIN)?.length ?? 0;

  return arabic / (arabic + latin) >= RTL_SHARE ? "rtl" : "ltr";
}
