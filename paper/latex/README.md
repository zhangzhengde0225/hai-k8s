# LaTeX Paper

This directory contains the LaTeX source for the paper.

## Files

```
latex/
├── paper.tex           # Main document
├── references.bib      # Bibliography
├── Makefile           # Build system
├── sections/          # Chapter/section files
│   ├── 01_introduction.tex
│   ├── 02_background.tex
│   ├── 03_system_design.tex
│   ├── 04_implementation.tex
│   ├── 05_evaluation.tex
│   ├── 06_conclusion.tex
│   ├── 07_related_work.tex
│   └── appendix.tex
├── figures/          # Figure files
│   └── architecture.pdf (to be added)
└── README.md
```

## Building

Requires: `pdflatex`, `bibtex`

```bash
# Full build
make pdf

# Quick build (no bibliography)
make quick

# Clean build artifacts
make clean

# View PDF
make view

# Check for TODO placeholders
make check-todo
```

## Notes

- The main document includes all sections via `\input{sections/...}`
- Figures should be placed in `figures/` directory
- The `figures/architecture.pdf` should be generated (architecture diagram)
- All TODO placeholders should be resolved before submission
