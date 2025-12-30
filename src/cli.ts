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
              const nested = await walkPaths([fp], recursive, target*`

