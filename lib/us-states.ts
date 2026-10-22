/** US states (plus DC and Puerto Rico) as stored on projects: always the two-letter code. */
export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["PR", "Puerto Rico"],
  ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

const STATE_CODES = new Map<string, string>(US_STATES.flatMap(([code, name]) => [[code.toLowerCase(), code], [name.toLowerCase(), code]]));
STATE_CODES.set("washington dc", "DC");

function simplify(value: string) {
  return value.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

/** Whether a country, as people type it, is the United States. */
export function isUnitedStates(country: string | null | undefined) {
  return ["united states", "united states of america", "usa", "us"].includes(simplify(country ?? ""));
}

/** The two-letter code for a US state given as a code or a full name, in any case; null if unknown. */
export function usStateCode(value: string | null | undefined) {
  return STATE_CODES.get(simplify(value ?? "")) ?? null;
}

/** The state to store: US states become their two-letter code; anything else is kept as typed. */
export function normalizeProjectState(country: string | null | undefined, state: string | null | undefined) {
  if (!state || !isUnitedStates(country)) return state ?? null;
  return usStateCode(state) ?? state;
}
