# IntelliTex

LaTeX IDE with AI agent: editor | PDF preview | agent panel.

## Requirements

### LaTeX Distribution

IntelliTex requires `pdflatex` to compile documents.

**macOS:**
```bash
# MacTeX (recommended)
brew install --cask mactex-no-gui
# or download from https://tug.org/mactex/
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install texlive-latex-base texlive-latex-recommended

# Fedora
sudo dnf install texlive-scheme-basic
```

**Windows:**
- Install [MiKTeX](https://miktex.org/download) or [TeX Live](https://tug.org/texlive/windows.html)

Verify installation:
```bash
pdflatex --version
```

## Setup

```bash
npm install
```

## Run (dev)

Start Vite and Electron together:

```bash
npm run electron:dev
```

Or run Vite only (browser):

```bash
npm run dev
```

## Build

```bash
npm run build
npm run electron:build
```

## Project structure

```
IntelliTex/
├── electron/
│   ├── main.js       # Electron main process, window
│   └── preload.js    # Preload script (IPC bridge)
├── src/
│   ├── main.tsx      # React entry
│   ├── App.tsx       # Three-panel layout
│   ├── panels/
│   │   ├── EditorPanel.tsx   # LaTeX editor (Monaco placeholder)
│   │   ├── PDFPanel.tsx     # PDF preview (pdf.js placeholder)
│   │   └── AgentPanel.tsx   # AI assistant (chat placeholder)
│   └── agent/
│       └── types.ts  # Agent context / edit types
├── index.html
├── package.json
└── vite.config.ts
```

Next steps: add Monaco for the editor, pdf.js for the PDF panel, and IPC + LLM integration for the agent.
