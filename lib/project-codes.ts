/** New projects are numbered in order: P000001, P000002, … Codes in other formats are left alone. */
export const PROJECT_CODE_PREFIX = "P";

const PROJECT_CODE_DIGITS = 6;
const SEQUENCED_CODE = /^P(\d+)$/i;

/** The code after the highest sequenced code in use; widens past P999999 instead of wrapping. */
export function nextProjectCode(existingCodes: Iterable<string | null | undefined>) {
  let highest = 0;
  for (const code of existingCodes) {
    const match = SEQUENCED_CODE.exec(code?.trim() ?? "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${PROJECT_CODE_PREFIX}${String(highest + 1).padStart(PROJECT_CODE_DIGITS, "0")}`;
}
