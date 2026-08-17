export const WORK_SUMMARY_LIMITS = {
  chineseCharacters: 20,
  englishWords: 10,
  effectiveCharacters: 40,
  maximumCharacters: 1000,
} as const;

export function getWorkSummaryMetrics(value: string) {
  const trimmed = value.trim();
  const chineseCharacters = trimmed.match(/\p{Script=Han}/gu)?.length || 0;
  const englishWords = trimmed.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length || 0;
  const effectiveCharacters = Array.from(trimmed.replace(/\s/gu, "")).length;

  return { chineseCharacters, englishWords, effectiveCharacters };
}

export function isWorkSummaryValid(value: string) {
  const metrics = getWorkSummaryMetrics(value);
  return value.trim().length <= WORK_SUMMARY_LIMITS.maximumCharacters && (
    metrics.chineseCharacters >= WORK_SUMMARY_LIMITS.chineseCharacters
    || metrics.englishWords >= WORK_SUMMARY_LIMITS.englishWords
    || metrics.effectiveCharacters >= WORK_SUMMARY_LIMITS.effectiveCharacters
  );
}
