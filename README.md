[Catalog](https://nebelwerfer41.github.io/) · [Repository](https://github.com/nebelwerfer41/stripboard-studio)

> **MMSX support:** local import and export of dataFormat 3 and 5 plans, alongside MSD support. Features, limitations, and tests are documented in [docs/mmsx-support.md](docs/mmsx-support.md).

> **Flash common model:** calendars, calendar events, red flag intervals, production data and per-sheet quantities are now available for read-only inspection. Imported projects save in their original format; native MMSX dates are never recalculated on import or calendar selection. See [the common contract and save strategy](docs/flash-common-model.md).

# Stripboard Studio v1.6

Support for MSD **Production Calendars** and **Red Flags** is documented in [docs/msd-production-calendars-red-flags.md](docs/msd-production-calendars-red-flags.md). The Calendars and Red Flag Entry views display these records without changing the file.

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

- Select a project, shooting schedule, and stripboard layout saved in the `.msd` file.
- Click or tap a scene to select and activate it. Shift-click selects the range from the initial strip, including banners and day breaks; Ctrl/⌘-Shift-click adds that range to the selection. Ctrl/⌘-click adds or removes items. On touch devices, hold a strip to enter multi-selection mode, then tap to add or remove items. Esc or a click in empty space clears the selection. Drag a strip directly; on touch devices, dragging begins after a long press and deliberate movement. If the strip is already selected, the whole group moves while preserving its relative order. The preview shows the scene count, total page eighths, and other items, with a line marking the insertion point. Banners and day breaks can be dragged in the same way, including into and out of the Boneyard. F2 offers the same destinations.
- **Undo** (Ctrl/⌘-Z) restores the order before the last operation; **Redo** (Ctrl/⌘-Shift-Z) reapplies the undone reorder. From the keyboard, Enter or Space selects a strip and F2 opens the day and position picker. The “At the end” position in a `ScheduleDay` is before the layout-generated day break.
- **＋** beside the schedule creates a stripboard by copying the current order. The new schedule uses the same scene references and can be edited independently. Its unique name provides the identity expected by the observed format. The selector changes the current schedule and the exported `ActiveStripBoard` value.
- **Save .msd** creates a new `-edited.msd` file. The unsaved-changes indicator tracks document revisions; edits remain available if saving fails. If the browser does not provide a file picker with a confirmed save result, a download starts and the state becomes saved when the browser accepts the download.
- The calendar selector beside the layout displays the same schedule with dates inferred from the selected calendar, without changing the file’s `CalendarName` reference.
- The **Calendars** view lists MSD calendars, non-working days, production dates, exceptions, and a monthly grid containing the schedule’s shooting days.
- The **Red Flag Entry** view includes filters for category, element, type, and date range, along with a monthly grid, list, and flag details. Types come from `RedFlagMgr`; managing and editing flags remain future work.
- Display scenes, banners, days, dates, and the unscheduled queue, with search and controls for hiding banners and day breaks.
- Banners and day breaks are drawn as strips with the same width as scene strips.
- The **Strip colors** toggle applies the file’s `INT/EXT` × `Day/Night` color grid, plus dedicated banner and day-break colors. The display can return to a neutral view.
- Days have no additional heading or trailing space. In vertical layouts, days sit side by side with horizontal scrolling.
- The horizontal stripboard preview automatically fits the panel width, including when the window is resized.
- Preview report layouts stored in the file, with fields linked to data and browser printing. Banners and day breaks appear as text rows in the report flow when the template includes them.
- Print stripboards with paper size, orientation, margins, and scaling controlled by the browser’s print dialog. The application retains options for the header and starting each day on a new page.
- Import other local `.msd` files compatible with the sample format.

Day dates are derived from calendars by the included parser and marked as estimates. Selecting another calendar changes only the reading projection: strips, scenes, and schedule order remain intact. Report previews reproduce the main fields’ content and geometry, but do not fully replicate Movie Magic’s proprietary pagination features and formulas.

## MSD writer and integrity

Saving without edits returns the original bytes. After an edit, the writer rebuilds only the `StripBoardMgr` XML section using the original strip nodes, then updates its offset and length in the EPSF section map. The sample’s other twelve sections are copied byte for byte, including Calendars, Red Flags, breakdowns, templates, reports, layouts, metadata, and uninterpreted properties. The modified section uses uncompressed raw DEFLATE blocks, so the saved file may be larger, while the other sections remain unchanged. The writer rejects an edit if an original strip would be lost or duplicated.

In the sample, strip order follows the children of `ScheduleDay`, `RemainingScheduledStrips`, and `RemainingUnscheduledStrips`/`UnscheduledDay`. Day breaks are generated by the layout and have no record of their own. Moving them redistributes strips between `ScheduleDay` and `UnscheduledDay` groups, preserving attributes and identity, including transfers into and out of the Boneyard. Schedule order and `SortOrder` are separate: they differ in the sample, and Movie Magic Scheduling 6.02.413 displayed physical schedule order in its menu. The samples contain no numeric schedule ID, checksum, or direct reference from Red Flags to schedules. The writer does not assign new scene or schedule IDs.

`tests/roundtrip.html` checks binary identity without edits, reopening after moves and schedule creation, counts and references, and preservation of opaque sections. `tests/strip-drag.mjs` covers group reordering, movement across days, and the preview. A modified test file was opened in Movie Magic Scheduling 6.02.413, which displayed the new schedule and strips moved between days. On opening, it selected the first schedule even though `ActiveStripBoard` pointed to the new one; this preference’s behavior remains unclear. Compatibility with other MSD versions, files containing checksums or container extensions, and subsequent saving from Movie Magic have not yet been verified.

## MSD layout fidelity

The compact model exposes strip dimensions (`StripLength`, `StripWidth`), field and line geometry, text styles, `PageFormat/Paper` with `PrintableRect`, day-break and header layouts, and original layout and banner attributes. In Element Sum fields, `Type=0/1` shows the total, `Type=2` shows text only, and `Type=3` shows text and total. `Suppress` hides a field when its total is zero. The total uses the leading number in each element’s name where present, otherwise counts that element as one. In reports, `PrntCat=1` in Custom List fields displays the category name before its elements.

In reports, `BDSCategoryElementsField` with `Style=GRID` arranges elements in rows, while `Style=COMMA_DELIMETED_LIST` separates them with commas. The `COMMA_DELIMETED_LIST` value was verified in the supplied MSD file’s example-report layout. `NumColumns` and `ColCnt` set the column count for grid lists; `WrapText` controls wrapping within each entry. Stripboard element tables use IDs and the `LowBoardIDFilter`/`HighBoardIDFilter` filters. `CategorySource=ALL_REMAINING` excludes categories already included by other report fields. `SeparateRecordsWithALine` controls the line between records, and `KeepOnOnePage` prevents a record from splitting across printed pages. `IsGrowable`, `Flow`, `RowHeight`, and `SplitColumnAfterRows` are preserved by the parser but require verification against the original application before they can drive pagination.

For banner and day-break styles, `Alignment` uses `20` for left, `21` for right, and `22` for center. Printing removes the application panel’s rounding and clipping so strip borders remain square.

The sample files contain no day-break margin/spacing attribute or stripboard page-break attribute. A day break therefore occupies a strip at the layout’s specified height, without an external margin; the small text padding is internal. Stripboard printing continues across days without forced page breaks. The schedule’s `HideStripBoardHeader` determines the header option’s initial state. For reports, `ReportSettings.PageBreak` is a separate property and is not applied to the stripboard.

The browser controls paper and the printable area without an application-imposed `@page` constraint. The stripboard automatically enlarges or shrinks to fill the printable width when strip height permits; scaling remains adjustable in the print dialog. The `.msd` file retains its original values. `PrintScale` and `ScaleStyle` remain in the original model: the observed templates use `ScaleStyle=Refit`, while some `PrintScale` values do not match strip length.

The side marker has been removed from the stripboard. Print-canvas width depends only on the strips; the optional header and the strips’ left border start at the same printable margin. In reports, template properties `IncludeBanners`, `IncludeDayBreaks`, and `DayBreakFooterText` determine the initial special rows. Visibility controls can hide these rows without changing the MSD model.

Some proprietary details remain to be reproduced precisely: individual field border patterns and codes, `AREA` styles, estimated-time formulas in banners and day breaks, layout images, and the exact meaning of all numeric `Type` values in category counts. Required original attributes are retained where available. A visual comparison of these samples with a Movie Magic Scheduling installation was not possible.

## Verification

Open `tests/parser.html` from the static site to compare the JavaScript parser with the expected Wonderful Life values. The original Python files are in `legacy/` as historical references; the application does not use them.

Credits: [nebelwerfer41 on GitHub](https://github.com/nebelwerfer41).

## License

[MIT](LICENSE). Copies and derivative works must retain the copyright notice and license text. Dependencies and third-party materials retain their own licenses.
