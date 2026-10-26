export const WORK_SUMMARY_LIMITS = {
  chineseCharacters: 20,
  englishWords: 10,
  effectiveCharacters: 40,
  maximumCharacters: 1000,
} as const;

// A character or short phrase repeated three or more times in a row only counts once.
function collapseRepeats(value: string) {
  return value.replace(/([\s\S]{1,6}?)\1{2,}/gu, "$1");
}

/** Counts only meaningful content: repeated padding collapses and digits do not count toward the requirement. */
export function getWorkSummaryMetrics(value: string) {
  const countable = collapseRepeats(value.trim());
  const chineseCharacters = countable.match(/\p{Script=Han}/gu)?.length || 0;
  const englishWords = countable.match(/[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*(?:['’-][A-Za-z0-9]+)*/g)?.length || 0;
  const effectiveCharacters = Array.from(countable.replace(/[\s\p{Nd}]/gu, "")).length;

  return { chineseCharacters, englishWords, effectiveCharacters };
}

export function isWorkSummaryValid(value: string) {
  const metrics = getWorkSummaryMetrics(value);
  return value.trim().length <= WORK_SUMMARY_LIMITS.maximumCharacters && /\p{L}/u.test(value) && (
    metrics.chineseCharacters >= WORK_SUMMARY_LIMITS.chineseCharacters
    || metrics.englishWords >= WORK_SUMMARY_LIMITS.englishWords
    || metrics.effectiveCharacters >= WORK_SUMMARY_LIMITS.effectiveCharacters
  );
}
