function filenamePart(value: string, fallback: string) {
  const normalized = Array.from(value.normalize("NFKC"))
    .filter((character) => (character.codePointAt(0) || 0) >= 32)
    .join("");
  const cleaned = normalized
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || fallback;
}

export function buildPdfReportFilename({
  siteName,
  start,
  end,
  workerName,
}: {
  siteName?: string | null;
  start?: string | null;
  end?: string | null;
  workerName?: string | null;
}) {
  const datePart = start && end
    ? (start === end ? start : `${start}_to_${end}`)
    : start || end || "All-Dates";
  return `${filenamePart(siteName || "", "Project-Site")}_${filenamePart(datePart, "All-Dates")}_${filenamePart(workerName || "", "All-Personnel")}.pdf`;
}
