# Design handoff

The canvas in `project/` holds five artboards made in the design canvas tool:

| Artboard | What it is |
| --- | --- |
| `Main.dc.html` | Diagnose workspace: hostname tabs, results list, selected check with evidence and fix |
| `FixPreview.dc.html` | Fix preview with a field-by-field diff and two-key confirmation |
| `Onboarding.dc.html` | Five-step first-run setup with Back, Next, Skip and save-for-later |
| `Settings.dc.html` | Grouped settings with search and a regex builder beside it |
| `Landing.dc.html` | Project site home page |

Look: Material Design 3 tones from seed `#36618e`, Roboto Flex and Roboto Mono,
light first with a dark scheme defined in `web/styles.css`. Status is always
shown as a word (Pass, Warn, Fail, Skipped) as well as colour.

## Implementation

`web/` implements all five app screens in plain HTML, CSS and JavaScript, and
`site/` implements the landing page. The implementation follows the artboards
with these deliberate changes:

- Bilingual labels inside buttons sit on one line (`Run all checks 全部檢查`)
  because two stacked lines overflowed a 40 px button.
- The fix dialog reads the real change list from the API instead of the fixed
  two-row example.
- Settings rows show real controls (selects, sliders, switches) instead of the
  value chips in the artboard.

## Review

Illustration guidance used: Stageshow (`benjitaylor/skills`, commit `299140f`).
Read: `SKILL.md` and `references/review.md`. Its filming and rehearsal tools are
written for animated marketing demos, so they were not run against these real
application screens. Instead the built interface was rendered and each frame
reviewed against the artboards (`docs/screenshots/`). That review found and
fixed four faults: an over-tall search bar, missing icons, button labels that
overflowed, and a hidden settings list behind an expanded regex builder in the
capture. The stills now match the artboards' hierarchy at 1424 px and 374 px.

Not done: the landing page hero illustration has not been filmed or reviewed
with Stageshow's tools; the dark theme was not drawn as separate artboards.
