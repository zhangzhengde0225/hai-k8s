# LaTeX Paper Build System

.PHONY: all pdf clean view

# Default target
all: pdf

# Build PDF
pdf: paper.pdf

paper.pdf: paper.tex sections/*.tex references.bib
	pdflatex -interaction=nonstopmode paper.tex
	bibtex paper
	pdflatex -interaction=nonstopmode paper.tex
	pdflatex -interaction=nonstopmode paper.tex

# Alternative with xelatex (for Unicode support)
xelatex: paper-xe.pdf

paper-xe.pdf: paper.tex sections/*.tex references.bib
	xelatex -interaction=nonstopmode paper.tex
	bibtex paper
	xelatex -interaction=nonstopmode paper.tex
	xelatex -interaction=nonstopmode paper.tex

# Clean build artifacts
clean:
	rm -f paper.pdf paper-xe.pdf
	rm -f paper.aux paper.bbl paper.blg paper.log paper.out paper.toc paper.fls paper.fdb_latexmk paper.synctex.gz
	rm -f sections/*.aux sections/*.log

# View PDF (Linux)
view: paper.pdf
	xdg-open paper.pdf

# View PDF (macOS)
view-mac: paper.pdf
	open paper.pdf

# View PDF (WSL/Windows)
view-win: paper.pdf
	start paper.pdf

# Word count
wc:
	@echo "Word count (approximate):"
	@cat paper.tex sections/*.tex | wc -w

# Check for TODO placeholders
check-todo:
	@echo "Checking for TODO/FIXME placeholders..."
	@grep -n "TODO\|FIXME\|\\[TODO\\]" paper.tex sections/*.tex || echo "None found"

# Quick check (single pass, no bibliography)
quick: paper-quick.pdf

paper-quick.pdf: paper.tex sections/*.tex references.bib
	pdflatex -interaction=nonstopmode paper.tex

# Full build with biber (alternative to bibtex)
biber: paper-biber.pdf

paper-biber.pdf: paper.tex sections/*.tex references.bib
	pdflatex -interaction=nonstopmode paper.tex
	biber paper
	pdflatex -interaction=nonstopmode paper.tex
	pdflatex -interaction=nonstopmode paper.tex
