const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const { itekToLatex } = require("./itek");

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
 * Compile an .itek file by transpiling to LaTeX first, then running pdflatex.
 */
async function compileItek(filePath) {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const basename = path.basename(resolved, ".itek");
  const texPath = path.join(dir, basename + ".tex");

  const source = await fs.readFile(filePath, "utf-8");
  let latex;
  try {
    latex = itekToLatex(source);
  } catch (err) {
    return {
      success: false,
      pdfPath: null,
      errors: [{ message: `itek transpile error: ${err.message}`, line: null, type: "error" }],
      log: err.stack || err.message,
    };
  }

  await fs.writeFile(texPath, latex, "utf-8");
  const result = await compileTex(texPath, dir, basename);

  // Clean up the intermediate .tex file
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
