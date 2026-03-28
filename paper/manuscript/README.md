# Manuscript

This directory contains the paper manuscript in Markdown format. The **LaTeX source** is in `../latex/`.

## Markdown Sources

| File | Content | Status |
|------|---------|--------|
| `01_introduction.md` | Abstract + Introduction | Draft |
| `02_background.md` | Background and Related Work | Draft |
| `03_system_design.md` | System Design | Draft |
| `04_implementation.md` | Implementation | Draft |
| `05_evaluation.md` | Evaluation | ⚠️ Draft (experiments pending measurement) |
| `06_conclusion.md` | Conclusion and Future Work | Draft |
| `07_related_work.md` | Related Work | ✅ Complete |

## LaTeX Paper

The **LaTeX source** for submission is in `../latex/`. Build with:

```bash
cd ../latex && make pdf
```

## Paper Information

- **Title**: Orchestrating Multi-Agent Collaboration through Containerized Agent Runtime
- **Authors**: 白小心, 朵拉
- **Status**: Draft — experiments pending K8s measurement

## TODO

- [x] Complete Related Work section
- [x] Analyze cold-start breakdown (theory + partial measurement)
- [x] Write test/benchmark scripts
- [ ] **Pending K8s access**: Full experiment measurements
- [ ] Add architecture diagram (`figures/architecture.pdf`)
- [ ] Resolve all `[TODO]` placeholders in evaluation section
- [ ] Proofread and refine writing
- [ ] Compile LaTeX and verify PDF

## Build Notes

To combine all sections into a single PDF:
```bash
# (Will add pandoc/markdown to PDF conversion instructions later)
```
