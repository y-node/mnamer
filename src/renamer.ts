import path from "path";
import fs from "fs/promises";
import { ParsedMedia } from "./types";

/**
 * Pad number to 2 digits.
 */
function pad2(n: number | undefined): string {
  if (n === undefined) return "00";
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Generate a new filename (basename) for a parsed media item using simple templates.
 * - TV: "Show Name - S01E02.ext"
 * - Movie: "Movie Name (Year).ext" or "Movie Name.ext"
 */
export function generateFilename(parsed: ParsedMedia): string {
  const ext = parsed.ext || "";
  if (parsed.type === "tv") {
    const season = pad2(parsed.season);
    const episode = pad2(parsed.episode);
    return `${parsed.title} - S${season}E${episode}${ext}`;
  } else {
    if (parsed.year) {
      return `${parsed.title} (${parsed.year})${ext}`;
    } else {
      return `${parsed.title}${ext}`;
    }
  }
}

export interface RenameOptions {
  apply: boolean; // if true, actually perform rename/move
  dryRun?: boolean; // if true, log only
  replace?: boolean; // if true, overwrite destination if exists
  targetDir?: string; // optional directory to place renamed files into
}

/**
 * Ensure parent directory exists.
 */
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Move/rename a single file on disk (or simulate when dry run).
 * If targetDir is provided, the file will be moved to targetDir with the new basename.
 * Uses fs.rename and falls back to copy+unlink for EXDEV (cross-device).
 * Returns the final path or throws on error.
 */
export async function renameFile(
  originalPath: string,
  newBasename: string,
  options: RenameOptions
): Promise<string> {
  const origDir = path.dirname(originalPath);
  const destDir = options.targetDir ? options.targetDir : origDir;
  const newPath = path.join(destDir, newBasename);

  if (path.resolve(originalPath) === path.resolve(newPath)) {
    // Names identical, nothing to do
    return newPath;
  }

  // If dry-run, don't touch FS beyond existence checks for reporting.
  if (!options.apply) {
    return newPath;
  }

  // Ensure destination directory exists
  await ensureDir(destDir);

  // Check destination existence
  try {
    await fs.access(newPath);
    // dest exists
    if (!options.replace) {
      throw new Error(`Destination exists and --replace not set: ${newPath}`);
    }
    // if replace: remove it first
    await fs.unlink(newPath);
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      // destination does not exist -> OK
    } else if (err && err.message && err.message.startsWith("Destination exists")) {
      // rethrow explicit message
      throw err;
    } else {
      // Other errors: continue and let rename attempt
    }
  }

  // Try to rename (fast move). If EXDEV (cross-device), fallback to copy+unlink.
  try {
    await fs.rename(originalPath, newPath);
    return newPath;
  } catch (err: any) {
    if (err && err.code === "EXDEV") {
      // Cross-device, fallback
      await fs.copyFile(originalPath, newPath);
      await fs.unlink(originalPath);
      return newPath;
    }
    // Unexpected error
    throw err;
  }
}