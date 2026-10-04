# July Oven card: design documents

| Document | What it is |
|---|---|
| [DESIGN.md](DESIGN.md) | **Start here.** The design as built, how it was reached, every decision and why, and open questions |
| [brief.md](brief.md) | The needs and wants: musts, shoulds, and where each one came from |
| [research/r1-june-glass.md](research/r1-june-glass.md) | What the June oven's glass screen and app actually do, state by state |
| [research/r2-glance-budget.md](research/r2-glance-budget.md) | What fits on a small glanceable surface, and the per-state budget method |
| [research/r3-comparables.md](research/r3-comparables.md) | How other ovens, thermometers and smart-home apps present the same information |
| [study/index.html](study/index.html) | The Glass study: three concepts drawn live in Home Assistant grid boxes, compared and scored |
| [study/concepts/](study/concepts/) | Each concept's spec (`d1.md` Second Screen, `d2.md` Still Glass, `d3.md` Door) and mockup code |
| [study/harness/](study/harness/) | The mockup harness: grid boxes, sample oven data, a fit checker, and a per-concept preview |
| [archive/first-study.html](archive/first-study.html) | The first study (five directions), kept as history |

The study pages run JavaScript and load files next to them, so open them through a local web
server rather than by double-clicking:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000/docs/july-oven-card/study/index.html`, or to
`http://localhost:8000/docs/july-oven-card/study/harness/preview.html?c=d2` for one concept at
every size and state. They load fonts from Google Fonts. In the first study, the state diagrams
show as plain text.

The card's test pages are in [tests/card/](../../tests/card/README.md).
