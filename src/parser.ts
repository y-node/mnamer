import path from "path";
import { ParsedMedia } from "./types";

/**
 * Clean up a raw extracted title: replace dots/underscores with spaces, collapse whitespace, trim.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(/[._]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple title-casing: capitalize first letter of each word (keeps small words capitalized too).
 */
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Parse a filename (basename) into ParsedMedia, or return null if it doesn't match known patterns.
 * Recognizes TV patterns:
 *   - Show.Name.S01E02(...)
 *   - Show Name - 1x02 (...)
 * Recognizes Movie pattern:
 *   - Movie.Name.2007.ext or Movie Name (2007).ext
 */
export function parseFilename(fullname: string): ParsedMedia | null {
  const ext = path.extname(fullname);
  const name = path.basename(fullname, ext);

  // TV patterns
  // Example: Show.Name.S01E02 or Show Name - S01E02 or Show.Name.1x02
  const tvRegex1 = /(.+?)[. _\-]*[sS](\d{1,2})[eE](\d{2})/; // capture title, season, episode
  const tvRegex2 = /(.+?)[. _\-]*(\d{1,2})[xX](\d{2})/; // capture title, season, episode

  let m = name.match(tvRegex1) || name.match(tvRegex2);
  if (m) {
    const rawTitle = m[1];
    const season = parseInt(m[2], 10);
    const episode = parseInt(m[3], 10);
    const title = titleCase(cleanTitle(rawTitle));
    return {
      type: "tv",
      title,
      season,
      episode,
      ext,
      originalName: name,
    };
  }

  // Movie pattern: look for a four-digit year (1900-2099)
  const movieRegex = /(.+?)[. _\-]*\(?((19|20)\d{2})\)?/;
  m = name.match(movieRegex);
  if (m) {
    const rawTitle = m[1];
    const year = parseInt(m[2], 10);
    const title = titleCase(cleanTitle(rawTitle));
    return {
      type: "movie",
      title,
      year,
      ext,
      originalName: name,
    };
  }

  // Fallback: treat as unknown movie-like media with just title (no year)
  const cleaned = titleCase(cleanTitle(name));
  if (cleaned.length > 0) {
    return {
      type: "movie",
      title: cleaned,
      ext,
      originalName: name,
    };
  }

  return null;
}