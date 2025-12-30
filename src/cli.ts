#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { parseFilename } from "./parser";
import { generateFilename, renameFile } from "./renamer";

type CLIArgs = {
  apply: boolean;
  recursive: boolean;
  replace: boolean;
  target?: string | undefined;
  sources: string[];
};

function printHelp() {
  console.log(`mnamer-ts - basic media renamer (TypeScript reference)

Usage:
  mnamer-ts [options] [sources...]

Options:
  --apply             Actually perform renames/moves. Without --apply, runs in dry-run mode (default).
  --recursive         Recurse into directories to find media files.
  --replace           Overwrite destination files if they exist.
  --target <dir>      Target directory to place renamed files. If omitted, renames are in-place.
  --help              Show this help message.

Sources:
  If no sources are provided, defaults to "." (current directory).

Examples:
  mnamer-ts --recursive --target ./renamed .          # dry-run: files from . -> ./renamed
  mnamer-ts --apply --target ./out "Some.Show.S01E02.mkv"
  mnamer-ts --apply "Movie.Name.2007.mkv"             # in-place rename
`);
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  const res: CLIArgs = {
    apply: false,
    recursive: false,
    replace: false,
    target: undefined,
    sources: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--apply") res.apply = true;
    else if (a === "--recursive") res.recursive = true;
    else if (a === "--replace") res.replace = true;
    else if (a === "--target") {
      const val = args[i + 1];
      if (!val) {
        console.error("--target requires a directory path");
        process.exit(2);
      }
      res.target = val;
      i++;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      res.sources.push(a);
    }
  }
  if (res.sources.length === 0) {
    res.sources.push(".");
  }
  return res;
}

/**
 * Walk given source paths and return a list of files to process.
 * If recursive is true, recurse into directories.
 * If a targetDir is inside a source directory, skip walking into it to avoid re-processing output.
 */
async function walkPaths(
  paths: string[],
  recursive: boolean,
  targetDir?: string
): Promise<string[]> {
  const results: string[] = [];
  const resolvedTarget = targetDir ? path.resolve(targetDir) : null;

  for (const p of paths) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        results.push(p);
      } else if (stat.isDirectory()) {
        // Option to recurse or just include files in the directory
        const entries = await fs.readdir(p);
        for (const e of entries) {
          const fp = path.join(p, e);
          try {
            const s = await fs.stat(fp);
            if (s.isFile()) {
              results.push(fp);
            } else if (s.isDirectory() && recursive) {
              // Skip targetDir if it's inside this tree
              const resolved = path.resolve(fp);
              if (resolvedTarget && resolved === resolvedTarget) {
                // skip walking the target directory
                continue;
              }
              const nested = await walkPaths([fp], recursive, targetDir);
              results.push(...nested);
            }
          } catch {
            // ignore individual entry errors
          }
        }
      }
    } catch (err) {
      console.warn(`Skipping path ${p}: ${String(err)}`);
    }
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv);

  // Resolve sources now so we can compute relative paths against them when
  // mirroring directory structure into the target root. The sources themselves
  // should not become part of the target path — we mirror their children.
  // Treat file inputs as their parent directory so we only keep directory roots.
  const resolvedSourcesRaw = await Promise.all(
    args.sources.map(async (s) => {
      const abs = path.resolve(s);
      try {
        const st = await fs.stat(abs);
        if (st.isDirectory()) return abs;
        if (st.isFile()) return path.dirname(abs);
      } catch {
        // Skip non-existent / unreadable sources
      }
      return null;
    })
  );

  // Filter out nulls and deduplicate
  const resolvedSources = Array.from(
    new Set(resolvedSourcesRaw.filter((v): v is string => !!v))
  );

  // Precompute sources sorted by directory depth (most specific first)
  const sortedResolvedSources = [...resolvedSources].sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length
  );

  /**
   * Find the most specific (deepest) source path that is an ancestor of filePath.
   * Returns null if none match.
   */
  function findBestSourceForFile(filePath: string): string | null {
    const fileResolved = path.resolve(filePath);
    for (const src of sortedResolvedSources) {
      const srcResolved = path.resolve(src);
      if (fileResolved === srcResolved || fileResolved.startsWith(srcResolved + path.sep)) {
        return srcResolved;
      }
    }
    return null;
  }

  // Walk using resolved sources so paths are absolute and consistent
  const filePaths = await walkPaths(resolvedSources.length ? resolvedSources : args.sources, args.recursive, args.target);

  if (filePaths.length === 0) {
    console.log("No files found to process.");
    return;
  }

  console.log(
    args.apply
      ? `Running in APPLY mode: files will be moved${args.target ? ` to ${args.target}` : " in-place"}.`
      : `Running in DRY-RUN mode: no files will be changed. Use --apply to perform renames/moves.`
  );

  let processed = 0;
  for (const file of filePaths) {
    const basename = path.basename(file);
    const parsed = parseFilename(basename);
    if (!parsed) {
      console.log(`Skipping (unparseable): ${file}`);
      continue;
    }
    const newBasename = generateFilename(parsed);
    if (newBasename === basename && !args.target) {
      console.log(`No change: ${basename}`);
      processed++;
      continue;
    }

    // Compute destination directory. When a target root is provided and the file
    // belongs to one of the declared source roots, preserve the file's relative
    // directory structure under the target root (without adding the source root
    // directory itself). If no matching source root is found, fall back to
    // placing files directly in the target root.
    let targetLocation: string;
    if (args.target) {
      const targetRoot = path.resolve(args.target);
      const bestSource = findBestSourceForFile(file);
      if (bestSource) {
        const relDir = path.relative(bestSource, path.dirname(file)); // "" if in source root
        targetLocation = relDir ? path.join(targetRoot, relDir) : targetRoot;
      } else {
        targetLocation = targetRoot;
      }
    } else {
      targetLocation = path.dirname(file);
    }

    const destPath = path.join(targetLocation, newBasename);
    console.log(`${file} -> ${destPath}`);
    try {
      await renameFile(file, newBasename, {
        apply: args.apply,
        dryRun: !args.apply,
        replace: args.replace,
        targetDir: targetLocation,
      });
      processed++;
    } catch (err: any) {
      console.error(`Failed to rename/move ${file}: ${err?.message ?? err}`);
    }
  }

  console.log(`Processed ${processed} file(s).`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
