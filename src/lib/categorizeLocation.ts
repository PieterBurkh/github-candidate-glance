const GERMANY_KEYWORDS = [
  "germany", "deutschland", "berlin", "munich", "münchen", "hamburg",
  "frankfurt", "cologne", "köln", "düsseldorf", "stuttgart", "dortmund",
  "essen", "leipzig", "bremen", "dresden", "hannover", "nuremberg",
  "nürnberg", "duisburg", "bochum", "wuppertal", "bielefeld", "bonn",
  "mannheim", "karlsruhe", "augsburg", "wiesbaden", "heidelberg",
];

const UK_KEYWORDS = [
  "united kingdom", "uk", "u.k.", "england", "scotland", "wales",
  "northern ireland", "london", "manchester", "birmingham", "leeds",
  "glasgow", "liverpool", "edinburgh", "bristol", "sheffield",
  "cardiff", "belfast", "nottingham", "newcastle", "brighton",
  "cambridge", "oxford", "bath", "york", "great britain",
];

const EUROPE_KEYWORDS = [
  "france", "paris", "spain", "madrid", "barcelona", "italy", "rome",
  "milan", "netherlands", "amsterdam", "rotterdam", "belgium", "brussels",
  "austria", "vienna", "switzerland", "zurich", "zürich", "geneva", "bern",
  "sweden", "stockholm", "norway", "oslo", "denmark", "copenhagen",
  "finland", "helsinki", "portugal", "lisbon", "ireland", "dublin",
  "poland", "warsaw", "czech", "prague", "romania", "bucharest",
  "hungary", "budapest", "greece", "athens", "croatia", "zagreb",
  "serbia", "belgrade", "ukraine", "kyiv", "bulgaria", "sofia",
  "slovakia", "bratislava", "slovenia", "ljubljana", "estonia", "tallinn",
  "latvia", "riga", "lithuania", "vilnius", "luxembourg", "malta",
  "cyprus", "iceland", "reykjavik", "europe",
];

export type LocationCategory = "Germany" | "UK" | "Rest of Europe" | "Rest of World" | "N/A";

export function categorizeLocation(location: string | null | undefined): LocationCategory {
  if (!location || !location.trim()) return "N/A";
  const lower = location.toLowerCase().trim();

  if (GERMANY_KEYWORDS.some((k) => lower.includes(k))) return "Germany";
  if (UK_KEYWORDS.some((k) => lower.includes(k))) return "UK";
  if (EUROPE_KEYWORDS.some((k) => lower.includes(k))) return "Rest of Europe";
  return "Rest of World";
}

