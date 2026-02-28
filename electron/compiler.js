const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const { parse } = require("./itek/parser");
const {
  transpile,
  calculateSpacing,
  countSpacingPoints,
  DEFAULT_SPACING,
  CONDENSE_LIMITS,
} = require("./itek/transpiler");

// Common TeX binary locations that GUI apps like Electron don't get in PATH.
// Ordered by likelihood on macOS / Linux / Windows.
const TEX_BIN_DIRS = [
  "/Library/TeX/texbin",                   // MacTeX (macOS, standard)
  "/usr/local/texlive/2024/bin/universal-darwin",
  "/usr/local/texlive/2023/bin/universal-darwin",
  "/usr/local/texlive/2024/bin/x86_64-darwin",
  "/usr/local/texlive/2023/bin/x86_64-darwin",
  "/opt/homebrew/bin",                      // Homebrew on Apple Silicon
  "/usr/local/bin",                         // Homebrew on Intel / Linux
];

function buildEnv() {
  const existing = process.env.PATH || "";
  const extra = TEX_BIN_DIRS.join(":");
  return { ...process.env, PATH: `${extra}:${existing}` };
}

/**
 * Parse a pdflatex log for errors and warnings.
 * Returns an array of { message, line, type } objects.
 */
function parseLog(log) {
  const diagnostics = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Error lines start with "!"
    if (line.startsWith("!")) {
      const message = line.slice(1).trim();
      let lineNumber = null;

      // Look ahead up to 8 lines for a line reference: l.42
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const match = lines[j].match(/^l\.(\d+)/);
        if (match) {
          lineNumber = parseInt(match[1], 10);
          break;
        }
      }

      diagnostics.push({ message, line: lineNumber, type: "error" });
    }

    // LaTeX / Package warnings
    if (
      line.includes("LaTeX Warning:") ||
      line.includes("Package Warning:") ||
      line.includes("Class Warning:")
    ) {
      const message = line.replace(/^.*?Warning:\s*/, "").trim();
      const lineMatch = message.match(/on input line (\d+)/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
      diagnostics.push({ message, line: lineNumber, type: "warning" });
    }

    // Overfull / Underfull box warnings
    if (line.startsWith("Overfull \\") || line.startsWith("Underfull \\")) {
      const lineMatch = line.match(/at lines? (\d+)/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
      diagnostics.push({ message: line.trim(), line: lineNumber, type: "warning" });
    }
  }

  return diagnostics;
}

// ── Dimension parsing (for dynamic spacing) ──────────────────────────────────

/**
 * Extract page dimensions from a pdflatex log that includes our
 * measurement \typeout commands.
 */
function parseDimensions(log) {
  const pagesMatch = log.match(/ITEK_PAGES:\s*(\d+)/);
  const pagetotalMatch = log.match(/ITEK_PAGETOTAL:\s*([\d.]+)pt/);
  const textheightMatch = log.match(/ITEK_TEXTHEIGHT:\s*([\d.]+)pt/);

  // Fallback page count from the "Output written on" line
  const outputMatch = log.match(/Output written on .+?\((\d+) pages?/);

  return {
    pages: pagesMatch
      ? parseInt(pagesMatch[1], 10)
      : outputMatch
        ? parseInt(outputMatch[1], 10)
        : null,
    pagetotal: pagetotalMatch ? parseFloat(pagetotalMatch[1]) : null,
    textheight: textheightMatch ? parseFloat(textheightMatch[1]) : null,
  };
}

/**
 * Estimate the condense scale needed to recover `overflow` points of
 * vertical space, given the document's spacing point counts.
 *
 * Derives maximum recoverable space from the difference between
 * DEFAULT_SPACING and CONDENSE_LIMITS for each element type.
 */
function calculateCondenseScale(overflow, counts) {
  const d = (key) => Math.abs(CONDENSE_LIMITS[key] - DEFAULT_SPACING[key]);

  const maxSavings =
    counts.sections * (d("sectionBefore") + d("sectionAfter")) +
    counts.subheadings * (d("subheadingBefore") + d("subheadingAfter") + d("subheadingRowGap")) +
    counts.projectHeadings * d("projectAfter") +
    counts.bullets * d("itemAfter") +
    counts.bulletLists * d("listEndAfter") +
    d("headerAfter") +
    (d("topMargin") + d("textheight")) * 72;

  if (maxSavings <= 0) return 1.0;

  const needed = overflow * 1.15;
  return Math.min(1.0, Math.max(0.05, needed / maxSavings));
}

/**
 * Calculate how much to expand spacing based on how full the single page is.
 * Returns 0 (no expansion) to 1 (maximum expansion).
 */
function calculateExpandScale(fillRatio) {
  if (fillRatio >= 0.85) return 0;
  // Linear from 0 at fill=0.85 to 1 at fill=0.50
  return Math.min(1.0, (0.85 - fillRatio) / 0.35);
}

// ── Compilation ──────────────────────────────────────────────────────────────

/**
 * Compile a .tex file using pdflatex.
 *
 * Returns:
 *   { success: boolean, pdfPath: string|null, errors: Diagnostic[], log: string }
 */
async function compileTex(texPath, dir, basename) {
  const pdfPath = path.join(dir, basename + ".pdf");

  return new Promise((resolve) => {
    execFile(
      "pdflatex",
      [
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-output-directory",
        dir,
        texPath,
      ],
      { cwd: dir, timeout: 60000, maxBuffer: 5 * 1024 * 1024, env: buildEnv() },
      async (error, stdout, stderr) => {
        if (error && error.code === "ENOENT") {
          resolve({
            success: false,
            pdfPath: null,
            errors: [
              {
                message:
                  "pdflatex not found. Install a LaTeX distribution (TeX Live, MiKTeX, or MacTeX).",
                line: null,
                type: "error",
              },
            ],
            log: "",
          });
          return;
        }

        const log = stdout + (stderr ? "\n" + stderr : "");
        const diagnostics = parseLog(log);

        let pdfExists = false;
        try {
          await fs.access(pdfPath);
          pdfExists = true;
        } catch {
          pdfExists = false;
        }

        const hasErrors = diagnostics.some((d) => d.type === "error");

        const auxExts = [".aux", ".log", ".out", ".toc", ".lof", ".lot", ".fls", ".fdb_latexmk", ".synctex.gz", ".nav", ".snm", ".vrb"];
        await Promise.all(
          auxExts.map((ext) =>
            fs.unlink(path.join(dir, basename + ext)).catch(() => {})
          )
        );

        resolve({
          success: pdfExists && !hasErrors,
          pdfPath: pdfExists ? pdfPath : null,
          errors: diagnostics,
          log,
        });
      }
    );
  });
}

/**
 * Compile an .itek file with dynamic spacing.
 *
 * Pass 1 — Measurement: compile with default spacing and LaTeX dimension
 *          reporting to determine page count and content fill ratio.
 * Pass 2 — Adjustment: if content overflows one page, condense spacing and
 *          recompile (up to 3 attempts with progressively tighter spacing).
 *          If content is sparse on a single page, expand spacing to distribute
 *          whitespace pleasantly.
 */
async function compileItek(filePath) {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const basename = path.basename(resolved, ".itek");
  const texPath = path.join(dir, basename + ".tex");

  const source = await fs.readFile(filePath, "utf-8");

  let doc;
  try {
    doc = parse(source);
  } catch (err) {
    return {
      success: false,
      pdfPath: null,
      errors: [{ message: `itek parse error: ${err.message}`, line: null, type: "error" }],
      log: err.stack || err.message,
    };
  }

  // ── Pass 1: Measurement ────────────────────────────────────────────────────
  let latex;
  try {
    latex = transpile(doc, { measure: true });
  } catch (err) {
    return {
      success: false,
      pdfPath: null,
      errors: [{ message: `itek transpile error: ${err.message}`, line: null, type: "error" }],
      log: err.stack || err.message,
    };
  }

  await fs.writeFile(texPath, latex, "utf-8");
  let result = await compileTex(texPath, dir, basename);

  if (!result.success) {
    await fs.unlink(texPath).catch(() => {});
    return result;
  }

  // ── Analyze dimensions ─────────────────────────────────────────────────────
  const dims = parseDimensions(result.log);

  if (dims.pages !== null && dims.textheight !== null && dims.textheight > 0) {

    // ── Condense: content overflows to multiple pages ────────────────────────
    if (dims.pages > 1 && dims.pagetotal !== null) {
      const counts = countSpacingPoints(doc);

      // Step 1: Verify maximum condensing fits on one page.
      // This guarantees we have at least one working single-page result
      // before trying to optimise for the lightest possible condensing.
      let fitsAtMax = false;
      {
        const spacing = calculateSpacing(1.0);
        let maxLatex;
        try {
          maxLatex = transpile(doc, { spacing, measure: true });
        } catch {
          /* fall through */
        }
        if (maxLatex) {
          await fs.writeFile(texPath, maxLatex, "utf-8");
          const maxResult = await compileTex(texPath, dir, basename);
          if (maxResult.success) {
            const maxDims = parseDimensions(maxResult.log);
            if (maxDims.pages && maxDims.pages <= 1) {
              fitsAtMax = true;
            }
            result = maxResult;
          }
        }
      }

      // Step 2: If max condensing fits, binary search for the minimum scale
      // that still stays on one page — producing the lightest, most uniform
      // condensing possible.
      if (fitsAtMax) {
        let lo = 0, hi = 1.0;
        const estimate = calculateCondenseScale(dims.pagetotal, counts);
        let pdfMatchesResult = false;

        for (let i = 0; i < 4; i++) {
          const scale = i === 0 ? estimate : (lo + hi) / 2;

          const spacing = calculateSpacing(scale);
          let tryLatex;
          try {
            tryLatex = transpile(doc, { spacing, measure: true });
          } catch {
            break;
          }

          await fs.writeFile(texPath, tryLatex, "utf-8");
          const tryResult = await compileTex(texPath, dir, basename);

          if (!tryResult.success) {
            lo = scale;
            pdfMatchesResult = false;
            continue;
          }

          const tryDims = parseDimensions(tryResult.log);
          if (tryDims.pages && tryDims.pages <= 1) {
            result = tryResult;
            hi = scale;
            pdfMatchesResult = true;
          } else {
            lo = scale;
            pdfMatchesResult = false;
          }
        }

        // If the last binary-search compile overwrote the PDF with a
        // multi-page attempt, recompile with the best known working scale.
        if (!pdfMatchesResult) {
          const spacing = calculateSpacing(hi);
          const fixLatex = transpile(doc, { spacing });
          await fs.writeFile(texPath, fixLatex, "utf-8");
          result = await compileTex(texPath, dir, basename);
        }
      }

    // ── Expand: single page with excessive whitespace ────────────────────────
    } else if (dims.pages === 1 && dims.pagetotal !== null) {
      const fillRatio = dims.pagetotal / dims.textheight;
      const maxExpandScale = calculateExpandScale(fillRatio);

      if (maxExpandScale > 0.05) {
        let lo = 0, hi = maxExpandScale;
        let pdfMatchesResult = true;

        for (let i = 0; i < 4; i++) {
          const scale = (lo + hi) / 2;
          const spacing = calculateSpacing(-scale);
          let expandLatex;
          try {
            expandLatex = transpile(doc, { spacing, measure: true });
          } catch {
            hi = scale;
            continue;
          }

          await fs.writeFile(texPath, expandLatex, "utf-8");
          const expandResult = await compileTex(texPath, dir, basename);

          if (expandResult.success) {
            const expandDims = parseDimensions(expandResult.log);
            if (expandDims.pages && expandDims.pages <= 1) {
              result = expandResult;
              lo = scale;
              pdfMatchesResult = true;
            } else {
              hi = scale;
              pdfMatchesResult = false;
            }
          } else {
            hi = scale;
            pdfMatchesResult = false;
          }
        }

        // If the last compile overwrote the PDF with a failed (multi-page)
        // attempt, recompile with the best known working expansion scale.
        if (!pdfMatchesResult) {
          const spacing = lo > 0.01 ? calculateSpacing(-lo) : undefined;
          const fixLatex = transpile(doc, spacing ? { spacing } : {});
          await fs.writeFile(texPath, fixLatex, "utf-8");
          result = await compileTex(texPath, dir, basename);
        }
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await fs.unlink(texPath).catch(() => {});

  return result;
}

/**
 * Compile a file — dispatches to the right pipeline based on extension.
 */
async function compile(filePath) {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();

  if (ext === ".itek") {
    return compileItek(resolved);
  }

  const dir = path.dirname(resolved);
  const basename = path.basename(resolved, ".tex");
  return compileTex(resolved, dir, basename);
}

module.exports = { compile };
