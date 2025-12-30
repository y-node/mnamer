export type MediaType = "tv" | "movie";

export interface ParsedMedia {
  type: MediaType;
  title: string; // show or movie title
  season?: number;
  episode?: number;
  year?: number;
  ext: string; // extension including leading dot, e.g. ".mkv"
  originalName: string; // basename without path
}