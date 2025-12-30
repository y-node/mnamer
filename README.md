```markdown
# mnamer-ts-ref

A small, focused TypeScript reference implementation of basic mnamer-like rename functionality.

Features
- Parse TV filenames (S01E02, 1x02) and movie filenames with year.
- Generate normalized filenames:
  - TV: `Show Name - S01E02.ext`
  - Movie: `Movie Name (Year).ext` or `Movie Name.ext`
- CLI with dry-run (default) and `--apply` to actually rename/move files.
- Recursive directory traversal with `--recursive`.
- Optionally write output into a separate target directory with `--target`.
- Conflict detection and optional `--replace` to overwrite existing files.

New: Source and Target handling
- Provide sources as positional args (default is current directory).
- Use `--target <dir>` to place renamed files into another directory. When omitted, renames are in-place.
- The walker will skip the target directory if it is inside the source directory to avoid re-processing output when using `--recursive`.

Install / Build
```bash
# install dev deps
npm install

# build
npm run build

# run (dry-run)
node dist/cli.js --recursive --target ./renamed path/to/media

# apply (perform moves)
node dist/cli.js --apply --recursive --target ./renamed path/to/media
```

Examples
- Dry-run: scan current directory recursively and show actions that would place renamed files into ./renamed
  - node dist/cli.js --recursive --target ./renamed
- Apply: actually move/rename a single file into ./out
  - node dist/cli.js --apply --target ./out "Some.Show.S01E02.mkv"
- In-place rename (no target)
  - node dist/cli.js --apply "Movie.Name.2007.mkv"

Notes
- The initial target implementation writes files flat into the target directory. Preserving directory structure can be added next if you want that behavior.
- Moving across file systems is supported (rename fallback to copy+unlink).
- If the target directory already contains a destination file, `--replace` is required to overwrite it.

Next steps you might want:
- Preserve relative directory structure in the target (e.g., keep subfolders).
- Add a --copy mode (keep originals and write renamed copies).
- Add pattern-based templates for filenames or a config file.
- Add unit tests for file matching and rename behavior.

License: MIT
```
