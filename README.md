[Catalog](https://nebelwerfer41.github.io/) · [Repository](https://github.com/nebelwerfer41/stripboard-studio)

> **MMSX support:** local import and export of dataFormat 3 and 5 plans, alongside MSD support. Features, limitations, and tests are documented in [docs/mmsx-support.md](docs/mmsx-support.md).

# Stripboard Studio v1.21

Breakdown uses searchable dropdowns for **Set, Location, INT/EXT, D/N, Script Day, Unit, Sequence and Episode**, including **Aggiungi** for missing values. Built-in values appear only in the scene fields, and choosing or clearing one keeps a single value per scene; resource categories retain multiple checkbox selections, quantities and daily-use options. Scene, synopsis, times, page fields and comments retain direct entry; Sheet remains read-only.

Print preview now offers **Fit to width** or manual scale. Print headers and black-and-white output live in that window, and preview strips have no selection controls. The automatic scale is shared by all strips and also keeps tall source layouts inside the page.

Breakdown navigation updates Stripboard selection, and double-clicking a scene strip opens its Breakdown. New scenes have a blank scene number and an automatic read-only sheet. **Duplica** creates independent scene copies with new sheets; **Elimina** asks for confirmation, then removes each selected scene’s breakdown sheet and every occurrence from all plans and Boneyards. Both support Undo/Redo.

Stripboard and Calendar have separate display controls, with no cross-workspace tabs in their settings overlays. The source-layout dropdown remains open when clicked. Banner/day visibility appears before the field picker; field choices and the color matrix use a more compact layout.

The element catalog sorts by ID, name, **Occorrenze**, **Start**, **End** and **Pose**. Category editing exposes defaults for new elements and ordered property definitions with single-line/multiline types. Element editing includes ID locking, board exclusion, DOOD rules, linked elements and properties; Scenes, Red Flags and Days & Dates are calculated read-only tabs. Built-in categories are protected; scalar-only imported values appear as catalog projections and are registered when assigned to a scene or when their properties are saved. Images are omitted.

Red Flag Entry uses element and date multiselection, type/note entry, batch creation, sortable records, deletion and CSV export. Existing native intervals and unresolved targets remain visible. Calendar rules, direct insertion, fraction/time entry, red selection markers and plan/calendar selector actions from v1.18 remain available.

Complete edits persist in `.studio.json` v2 with the original imported archive retained. Native MSD/MMSX exports remain conservative; an untouched import exports the original bytes. See [editing and compatibility](docs/document-editing.md), [Calendar](docs/calendar-workspace.md), [the common model](docs/flash-common-model.md), [DOOD](docs/dood.md), and [MSD calendars and Red Flags](docs/msd-production-calendars-red-flags.md).

The editor’s format audit and conservative writing strategy are described in [docs/msd-writer-audit.md](docs/msd-writer-audit.md).

A static application for viewing and reordering stripboards, creating alternative schedules, and inspecting report templates in Movie Magic Scheduling 6 (`.msd`) files. Parsing, rendering, and writing run in the browser, without a backend, database, or account. Imported files remain in the browser and are not uploaded to a server.

## GitHub Pages

Upload this folder’s contents to the root of a GitHub repository. In the repository settings, open **Pages**, select **Deploy from a branch**, then `main` and `/ (root)`. The application will be available at the repository’s Pages URL. HTML, CSS, JavaScript, and sample paths are relative, so they also work under a repository path such as `/repository-name/`.

The only included sample is `samples/Wonderful Life Demo.msd`; it will be published with the site. Use **Import .msd** to open a local file. GitHub Pages serves static files; importing and parsing happen in the browser.

## Local setup

On macOS, double-click `Avvia Stripboard Studio.command`. If macOS blocks the first launch, open Terminal in the application folder and run:

```sh
python3 -m http.server 0 --bind 127.0.0.1
```

Open the address using the port printed by the command. The launcher selects an available port and opens the browser. Python only serves static files during local testing; it does not read or interpret MSD files. Any static HTTP server can be used. Opening `index.html` directly through `file://` is unsupported for JavaScript modules and sample loading.

The browser must support `DecompressionStream('deflate-raw')`, `DOMParser`, `XMLSerializer`, and JavaScript modules. The parser and writer accept the EPSF/MSD 6 variant observed in the samples.

## Features

Control names below are given in English; some labels in the application are currently in Italian.

- Select a project, shooting schedule, and an imported stripboard layout, or choose **Compatto**, **Dettagliato** or **Produzione** under **Visualizzazione**. Standard layouts let you select scene fields and project categories; Calendar has its own display overlay and field preferences. Display changes leave the imported file untouched.
- Click or tap a scene to select and activate it. Shift-click selects the range from the initial strip, including banners and day breaks; Ctrl/⌘-Shift-click adds that range to the selection. Ctrl/⌘-click adds or removes items. On touch devices, hold a strip to enter multi-selection mode, then tap to add or remove items. Esc or a click in empty space clears the selection. Drag a strip directly; on touch devices, dragging begins after a long press and deliberate movement. If the strip is already selected, the whole group moves while preserving its relative order. The preview shows the scene count, total page eighths, and other items, with a line marking the insertion point. Banners and day breaks can be dragged in the same way, including into and out of the Boneyard. F2 offers the same destinations.
- **Undo** (Ctrl/⌘-Z) restores the order before the last operation; **Redo** (Ctrl/⌘-Shift-Z) reapplies the undone reorder. From the keyboard, Enter or Space selects a strip and F2 opens the day and position picker. The “At the end” position in a `ScheduleDay` is before the layout-generated day break.
- **Nuova Stripboard** inside the plan selector creates an empty stripboard or copies the current order. **Riordina** in the same selector changes plan ordering. The new schedule uses the same scene references and can be edited independently. Its unique name provides the identity expected by the observed format. The selector changes the current schedule and the exported `ActiveStripBoard` value.
- **Save .msd** creates a new `-edited.msd` file. The unsaved-changes indicator tracks document revisions; edits remain available if saving fails. If the browser does not provide a file picker with a confirmed save result, a download starts and the state becomes saved when the browser accepts the download.
- The calendar selector changes the plan’s calendar association and recalculates shooting dates using its workweek and exceptions. Creation, editing and reorder actions live in the same selector.
- **Calendar** combines a dense monthly plan with recurring days off, per-date exceptions, production start and explicit rescheduling. Drag scene strips or banners to reorder them within a day, move them to another date, or move between Calendar and Stripboard. An empty date creates a shooting day in the associated visible segment. Undo/Redo covers every move. With one view visible, hold the dragged strip over the other top navigation tab for half a second to reveal it; touch uses a long press before dragging.
- The top navigation is ordered Stripboard, Breakdown, Calendar, DooD, Red Flags, Elementi and Progetto. Progetto contains Production Info and access to Reports; Elementi contains the element catalog. Click the project title to switch projects; **Visualizzazione** opens layout, field, visibility and print settings; **Colori strip** opens the separate combination-color editor. Compact controls leave more space for the active view, which scrolls independently.
- **Aggiunta rapida** in Breakdown searches elements across all categories by name or Board ID and adds the chosen element to the active scene. For a new name, choose an existing category or type a new category and use **Aggiungi**. Creating the category, element and scene association is one Undo/Redo step. Escape or **Annulla** cancels the draft; existing associations keep their quantities and built-in fields keep one value per scene.
- **Breakdown** follows the active scene from Calendar or Stripboard, including custom categories and elements shown by ID (when available) and name. Built-in values stay in the scene fields. The header contains New Scene and first/previous/next/last navigation in the current stripboard order; New Scene is available only in Breakdown. Its scene selector and previous/next buttons also allow direct browsing in plan order. Category properties can hide numeric quantities in Breakdown while preserving saved values. Linked elements are added by selecting a category and searching by name or Board ID; selected links stay visible across categories, and can be applied to existing scenes. Optional resizable pairs are available only above 1200 CSS px, with each pane limited to 25–75% of the usable width; smaller viewports use one full-width view.
- Phones show readable scene rows and a compact Calendar agenda of shooting days, events and the selected date. **Mostra mese** restores the monthly grid. These display preferences do not change the file or the schedule. Print uses the selected source or standard layout; phone summaries preserve source geometry for printing.
- The **Red Flag Entry** view supports category selection, multiple elements and civil dates, batch type/note entry, sortable records, editing, deletion and CSV export. Imported types and intervals are preserved.
- Display scenes, banners, days, dates, and the unscheduled queue, with search and controls for hiding banners and day breaks.
- Banners and day breaks are drawn as strips with the same width as scene strips.
- The **Black and white** checkbox in print preview controls monochrome output. Editing views retain the file’s `INT/EXT` × `Day/Night` colors, plus dedicated banner and day-break colors.
- Days have no additional heading or trailing space. In vertical layouts, days sit side by side with horizontal scrolling.
- The horizontal stripboard preview automatically fits the panel width, including when the window is resized.
- Preview report layouts stored in the file, with fields linked to data and browser printing. Banners and day breaks appear as text rows in the report flow when the template includes them.
- Print stripboards and DOOD through the shared preview with paper size, orientation, margins and scale. Stripboard offers automatic width fitting or manual scaling; header and monochrome options are in the preview. PDF uses the same preview document via the browser’s Save as PDF destination. The application retains options for the header and starting each day on a new page.
- Import other local `.msd` files compatible with the sample format.

MSD dates are initially derived by the parser; MMSX retains native dates on import. Explicit calendar assignment, calendar-rule saving and End of Day creation update the plan using the chosen calendar. Selection, layout and visibility preferences do not change the document. Report previews reproduce the main fields’ content and geometry, but do not fully replicate Movie Magic’s proprietary pagination features and formulas.

## MSD writer and integrity

Saving without edits returns the original bytes. After a strip edit, the writer rebuilds only `StripBoardMgr` using original nodes. Calendar edits additionally patch `CalendarMgr`; the EPSF offsets and lengths are updated. Other sections remain byte-identical. Studio namespace attributes preserve MSD dates until explicit rescheduling, because MSD has no native per-day dates. These dates round-trip in Studio; preservation in Movie Magic has not been verified. See [the calendar writer extension](docs/calendar-workspace.md). The modified section uses uncompressed raw DEFLATE blocks, so the saved file may be larger, while the other sections remain unchanged. The writer rejects an edit if an original strip would be lost or duplicated.

In the sample, strip order follows the children of `ScheduleDay`, `RemainingScheduledStrips`, and `RemainingUnscheduledStrips`/`UnscheduledDay`. Day breaks are generated by the layout and have no record of their own. Moving them redistributes strips between `ScheduleDay` and `UnscheduledDay` groups, preserving attributes and identity, including transfers into and out of the Boneyard. Schedule order and `SortOrder` are separate: they differ in the sample, and Movie Magic Scheduling 6.02.413 displayed physical schedule order in its menu. The samples contain no numeric schedule ID, checksum, or direct reference from Red Flags to schedules. The writer does not assign new scene or schedule IDs.

`tests/roundtrip.html` checks binary identity without edits, reopening after moves and schedule creation, counts and references, and preservation of opaque sections. `tests/strip-drag.mjs` covers group reordering, movement across days, and the preview. A modified test file was opened in Movie Magic Scheduling 6.02.413, which displayed the new schedule and strips moved between days. On opening, it selected the first schedule even though `ActiveStripBoard` pointed to the new one; this preference’s behavior remains unclear. Compatibility with other MSD versions, files containing checksums or container extensions, and subsequent saving from Movie Magic have not yet been verified.

## MSD layout fidelity

The compact model exposes strip dimensions (`StripLength`, `StripWidth`), field and line geometry, text styles, `PageFormat/Paper` with `PrintableRect`, day-break and header layouts, and original layout and banner attributes. In Element Sum fields, `Type=0/1` shows the total, `Type=2` shows text only, and `Type=3` shows text and total. `Suppress` hides a field when its total is zero. The total uses the leading number in each element’s name where present, otherwise counts that element as one. In reports, `PrntCat=1` in Custom List fields displays the category name before its elements.

In reports, `BDSCategoryElementsField` with `Style=GRID` arranges elements in rows, while `Style=COMMA_DELIMETED_LIST` separates them with commas. The `COMMA_DELIMETED_LIST` value was verified in the supplied MSD file’s example-report layout. `NumColumns` and `ColCnt` set the column count for grid lists; `WrapText` controls wrapping within each entry. Stripboard element tables use IDs and the `LowBoardIDFilter`/`HighBoardIDFilter` filters. `CategorySource=ALL_REMAINING` excludes categories already included by other report fields. `SeparateRecordsWithALine` controls the line between records, and `KeepOnOnePage` prevents a record from splitting across printed pages. `IsGrowable`, `Flow`, `RowHeight`, and `SplitColumnAfterRows` are preserved by the parser but require verification against the original application before they can drive pagination.

For banner and day-break styles, `Alignment` uses `20` for left, `21` for right, and `22` for center. Printing removes the application panel’s rounding and clipping so strip borders remain square.

The sample files contain no day-break margin/spacing attribute or stripboard page-break attribute. A day break therefore occupies a strip at the layout’s specified height, without an external margin; the small text padding is internal. Stripboard printing continues across days without forced page breaks. The schedule’s `HideStripBoardHeader` determines the header option’s initial state. For reports, `ReportSettings.PageBreak` is a separate property and is not applied to the stripboard.

The shared schedule/DOOD preview now sets paper and the printable area with a physical `@page` size. Other legacy report views continue to use the browser dialog directly. The shared preview fits source strips inside the selected printable area and exposes page scale; print the generated pages at 100% in the browser dialog. The `.msd` file retains its original values. `PrintScale` and `ScaleStyle` remain in the original model: the observed templates use `ScaleStyle=Refit`, while some `PrintScale` values do not match strip length.

The side marker has been removed from the stripboard. Print-canvas width depends only on the strips; the optional header and the strips’ left border start at the same printable margin. In reports, template properties `IncludeBanners`, `IncludeDayBreaks`, and `DayBreakFooterText` determine the initial special rows. Visibility controls can hide these rows without changing the MSD model.

Some proprietary details remain to be reproduced precisely: individual field border patterns and codes, `AREA` styles, estimated-time formulas in banners and day breaks, layout images, and the exact meaning of all numeric `Type` values in category counts. Required original attributes are retained where available. A visual comparison of these samples with a Movie Magic Scheduling installation was not possible.

## Verification

Open `tests/parser.html` from the static site to compare the JavaScript parser with the expected Wonderful Life values. The original Python files are in `legacy/` as historical references; the application does not use them.

Credits: [nebelwerfer41 on GitHub](https://github.com/nebelwerfer41).

## License

[MIT](LICENSE). Copies and derivative works must retain the copyright notice and license text. Dependencies and third-party materials retain their own licenses.

## Verification commands

`node --test tests/*.mjs` covers display fields, DOOD calculations and pagination, Studio project saving, and native MMSX day creation in formats 5, 3 and hybrid, including conservation and Undo/Redo. `tests/calendar-roundtrip.html` also verifies new civil-date drops and reopening in the included MSD sample.

`tests/mmsx-conservation.mjs` verifies that edits preserve metadata on records already in the Boneyard, clear scheduling dates on transfers from a schedule, and recalculate day totals only when their strips change. It covers save/reopen and Undo/Redo in formats 5, 3 and hybrid. `tests/msd-categories.html`, included in the browser workspace suite, checks import, element references, binary no-op and save/reopen with custom category names `constructor`, `toString` and `__proto__`.

Browser suites require Playwright, a local server and optionally `CHROME_PATH`. The DOOD suite also requires `pdfinfo` and `pdftotext` to verify the generated PDF against the preview:

```sh
CHROME_PATH=/usr/bin/chromium node tests/browser-refinements.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-workspace-revision.cjs
CHROME_PATH=/usr/bin/chromium STUDIO_TEST_OUTPUT=/tmp/stripboard-qa node tests/browser-workspace.cjs
CHROME_PATH=/usr/bin/chromium STUDIO_TEST_OUTPUT=/tmp/stripboard-dood-qa node tests/browser-dood.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-calendar-density.cjs
CHROME_PATH=/usr/bin/chromium node tests/browser-responsive.cjs
CHROME_PATH=/usr/bin/chromium SYNTHETIC_MMSX=/path/to/fixture.mmsx node tests/browser-strip-layouts-drag.cjs
```

The DOOD suite checks rules, events, scene navigation, Studio/native round-trips, shared print preview and PDF page/text parity. The last suite checks independent field settings without file changes, calendar reorder, both cross-pane directions, blank-date save/reopen, cancellation, Undo/Redo, tablet/phone navigation during drag and native phone touch multiselection. MMSX uses the synthetic fixture described in [the calendar documentation](docs/calendar-workspace.md); MSD uses the included real sample.

## Release history

The following entries describe earlier releases; current calendar and editing behavior is documented above.

### v1.12 — Calendar fixes

Changing the selected calendar keeps scene strips and shooting-day summaries visible. Calendar uses the same read-only MSD date projection as Stripboard; MMSX keeps native dates, the displayed month and the selected date.

**Rules and dates** now edits the selected calendar. Weekday rules, date exceptions, production start and rescheduling use that calendar, with associated plans listed in the panel. Start-date drafts remain separate for each calendar.

Verified with the Node suites and Chromium browser tests for MSD and MMSX 5, 3 and hybrid: calendar switching, targeted edits, save/reopen and Undo. Changing the calendar alone preserves the original file bytes.

### v1.13 — One DOOD category at a time

DOOD selects the first available category on opening and displays only that category’s elements. The category menu has no “All” option; changing the category updates the grid, rules, CSV Summary and print output. Category selection is a display preference and does not modify the project.

### v1.14 — Built-in DOOD attendance

DOOD now reads Set, Location, Script Day, Unit, Sequence, DN and INT/EXT from scheduled scenes. MMSX uses native field element IDs; MSD uses scalar scene values and reuses catalog IDs where available. Missing MSD catalog entries appear as derived DOOD rows without changing the imported elements or file. Rules, scene details, CSV and print use the same attendance projection.

Verified against the real MSD sample and synthetic MMSX 5/3/hybrid fixtures, including duplicate names, moves to the Boneyard, save/reopen and byte-identical Undo.

### v1.15 — Consolidated main branch and Home Screen icons

All branch changes are merged into `main`, including the iOS Home Screen metadata and web app manifest. The referenced Apple touch icon and 192/512 px app icons are included. Use the browser’s Add to Home Screen action to open the site in standalone mode on iOS.

### v1.16 — Document creation and complete editing

Create projects from scratch, edit scene fields and element quantities, manage production properties and linked elements, and update calendars, plans, days, banners, events and availability constraints. Shared references update across breakdown, scheduling, DOOD and reports. Complete edits use the versioned Studio v2 container, retaining original MSD/MMSX archives and compatibility with Studio v1. Validation, Undo/Redo, draft protection and failed-write recovery cover the authoring flows. Report and stripboard geometry and rendering remain unchanged. See [sources, implementation, compatibility limits and verification](docs/document-editing.md).

### v1.17 — Integrated authoring and spacious breakdown entry

Edit scene fields and quantities directly in Spoglio, select and create elements inside their categories, and manage the element catalog by category. Scene, banner, day, plan, calendar and constraint controls open in their existing workspaces. Undo/Redo remains available in the top bar.

Set, Synopsis and Comments span the entry panel; Location and Sequence have wider fields than short codes and numbers. Long text expands vertically and the form adapts to narrow split panes and phones. Sheet numbers are displayed in read-only form, preserved on existing scenes and generated automatically for new ones. Studio v2 persistence and the conservative native export contract remain unchanged.

Verified with 147 Node tests and Chromium authoring, responsive, workspace and DOOD/PDF suites, including sheet protection, text expansion, save/reopen and phone authoring.

### v1.18 — Workspace editing and calendar workflow

Unified toolbars, shared overlays with outside-click dismissal, direct scene/banner insertion, automatic End of Day scheduling, fraction/time inputs, separate combination-color editing, red bounded selection markers, Calendar multiselection and double-click navigation, bulk element IDs/category moves, unified calendar editing and selector creation/reordering.

Verified with 155 Node tests and Chromium suites for the new authoring flows, MMSX 3/5/hybrid calendar association and rules, dense calendars, seven responsive viewport sizes, cross-view mouse/touch drag, native round-trips and DOOD/PDF output.

### v1.19 — Print fitting, strip commands and element/Red Flag management

Automatic or manual print scaling, noninteractive preview, print-only header/monochrome options, separate display settings, stable layout dropdown, selection following Spoglio navigation, blank new scene numbers, duplication and deletion, usage sorting, category defaults/property schemas, element tabs with calculated data, protected built-ins and batch Red Flags.

Verified with 166 Node tests and Chromium suites for authoring/save/reopen, the new refinements, seven responsive sizes, Calendar density, drag between views, native adapter round-trips and DOOD/PDF page/text parity.

### v1.20 — Searchable Spoglio dropdowns and single built-in values

Search/select/create controls in scene fields and category cards, synchronized single-value built-ins, multi-resource selection with daily-use checkboxes, Episode support and consistent catalog renames. Legacy conflicting built-in associations are reconciled to the scene value in the common model; original imported archives remain intact.

Verified with 182 Node tests and Chromium suites for dropdowns, keyboard and blur behavior, source/save/reopen, authoring, previous refinements, responsive layouts, native round-trips and DOOD/PDF output.


### v1.21 — Breakdown entry, navigation and project organization

Global Quick Add searches existing elements or creates an element and category in one undoable operation. New Scene lives in the Breakdown header alongside first/previous/next/last scene navigation with monochrome icons. Built-in values remain in scene fields, and category properties can hide numeric quantities without discarding saved values.

Navigation is ordered Stripboard, Breakdown, Calendar, DooD, Red Flags, Elementi and Progetto. Production Info moves to Progetto with access to Reports; the scene quantities panel and duplicate DOOD export action are removed. Linked elements are selected through category and text filters, retain selections across categories and can be applied to existing scenes.

Verified with all 23 Node test files and Chromium suites covering Quick Add, navigation/Boneyard, quantity visibility, linked elements, production editing, dropdowns, authoring, workspace refinements, Studio save/reopen, source conservation, mobile layouts and DOOD/PDF output.
