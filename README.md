# Semantic Vega Editor v0.1

This version marks the start of the **cohort-first semantic authoring** approach.

## Architectural reset

This branch intentionally drops the earlier `artifactMeta` workflow. The app no longer inserts semantic labels into Vega/Vega-Lite specification objects before rendering.

Instead, the workflow is:

1. The author writes or pastes a Vega/Vega-Lite specification.
2. The author presses **Run**.
3. The app renders the visualization internally to SVG.
4. The app discovers visible visual cohorts from rendered SVG structure and Vega-generated classes.
5. The bottom panel shows one blue/red thumbnail per cohort.
6. The author clicks a thumbnail to inspect it in the SVG Cohort View.
7. The selected cohort is shown in blue; the rest of the visualization is muted red.
8. The author clicks a blue element to add or edit a semantic label.
9. The app propagates that author label to the cohort members in the generated SSVG.

## Invariant

Semantic intent is authored over rendered visual cohorts. The compiler derives structural cohort membership, SVG element ids, part roles, and style grounding.


## v1.8 editor upgrade: Monaco code editor

The code editor now uses **Monaco Editor** instead of the earlier custom textarea/highlight overlay. This adds common code-editor features needed for Vega/Vega-Lite authoring:

- JSON syntax highlighting
- line numbers
- auto indentation
- format on paste/type
- folding
- bracket-pair highlighting and indentation guides
- minimap
- inline error and warning underlines
- autocomplete and hover support from Vega/Vega-Lite JSON schemas
- automatic schema switching between Vega and Vega-Lite based on `$schema` or spec structure
- line focusing from the existing Problems panel

The app still keeps Semantic Vega-specific logic separate: cohort discovery, label propagation, P3-compatible SSVG generation, and render-time problems remain in the existing pipeline. Monaco is used only for the generic code-editing layer and JSON/schema diagnostics.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```


## v1.9 Cohort labeling UI cleanup

- Cohort cards are now more compact and show only the essential information: thumbnail, index/title, element count, and label/todo status.
- The labeling panel now includes a persistent progress summary with labeled/total counts, remaining count, a progress bar, and clickable status dots for each authorable cohort.
- The progress summary remains visible above the horizontally scrollable thumbnails, so users can understand labeling progress even on smaller screens where only a subset of thumbnails is visible.

## v1.10 tab rename update

- File tabs can now be renamed inline.
- Double-click a tab title to edit it.
- Press Enter or click away to save the new title.
- Press Escape to cancel the rename.

## v1.11 interaction cleanup

- The SVG/visualization panel now starts collapsed, giving the code editor the full workspace by default.
- Pressing Play automatically reopens the SVG panel and renders the chart/cohort view.
- Manual reopening remains available through the right-side "Open SVG View" rail.
- The pre-render placeholder message was removed to reduce visual clutter.
- The preview tabs now include an explicit "Chart View" tab and a "Cohort Labeling" tab, allowing users to return from cohort labeling to the full chart inspection view.

## v1.12 Interaction update

The chart view and cohort-labeling view now share a mouse pan/zoom viewport:

- Use the mouse wheel or trackpad scroll to zoom in and out around the pointer.
- Drag the white preview area to pan.
- Use the toolbar controls to zoom, zoom out, reset the view, or fit/reset to the default transform.
- In cohort-labeling mode, clicking blue cohort members still opens the label editor; dragging the background pans the view.

## v1.16 Semantic Vega Artifact export

- Added **Create SVA** after **Play** and **Label**.
- The editor now creates a **Semantic Vega Artifact (SVA)** bundle containing the source spec, normalized spec, compiled Vega spec when available, SSVG, cohort metadata, widget metadata, and interaction metadata.
- After the SVA is created, the app opens a simple interactive inspector in a new tab so users can test the visualization and its runtime interactivity.
- The inspector page includes a **Download SVA** button.
- The editor toolbar also includes **Download SVA** so users can still download the latest generated bundle if they close the inspector tab.

## v1.17 SVA semantic rehydration

- Semantic Vega Artifact (SVA) export now includes a dedicated `rehydration` map.
- The preview page and external embed protocol use `SemanticVegaEmbed`, not plain `vegaEmbed`, so the live Vega-rendered SVG is rehydrated with Semantic Vega attributes such as `p3-element-id`, `p3-cohort-id`, `p3-role`, `p3-viz-part`, and `p3-data-role`.
- The SVA now includes an `embedding` object with the required runtime protocol and a minimal HTML snippet for webpage embedding.
- A reusable `semantic-vega-runtime.js` file is included in `public/` and copied into `dist/` during build.
- The static SSVG snapshot remains in the SVA for archival/debugging, but runtime embedding uses the compact rehydration map as the authoritative semantic attachment mechanism.

### AI-assisted cohort labeling

The **Label** toolbar button is now a dropdown:

- **Manual Label** opens the existing cohort labeling workflow.
- **Label with AI** opens a dialog for entering an OpenAI API key, loading available models, and selecting a vision-capable model. The editor sends each highlighted cohort thumbnail to the selected model one at a time, updates the cohort progress indicator as labels arrive, and writes the generated labels into the same editable label state used by manual labeling. Authors can review or edit any generated label before creating the SVA.

The editor can optionally save the OpenAI key and selected model in browser `localStorage`; nothing is saved unless the checkbox is selected.

### v1.28 Rendered-semantics cohort policy

This version tightens cohort generation so that normal cohorts represent visible, perceivable, editable visualization parts. Non-rendering mark buckets and zero-geometry residue are no longer shown as authorable cohorts or emitted as CompactVEM rows. Interaction-dependent hidden content is preserved only as compact latent metadata inside the SSVG, avoiding SVA/SSVG bloat while retaining awareness of conditional visual states.

