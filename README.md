# Semantic Vega Editor

**Semantic Vega Editor** is a web-based authoring tool for creating semantically enriched visualization artifacts from **Vega** and **Vega-Lite** specifications.

The editor allows visualization authors to:

1. load or write a Vega/Vega-Lite specification,
2. render the visualization,
3. automatically discover visual cohorts in the rendered SVG,
4. label those cohorts manually or with AI assistance,
5. generate semantic outputs such as **SVA**, **SSVG**, and **CompactVEM**,
6. use those outputs in downstream systems for visualization transformation, personalization, accessibility, explanation, and AI-assisted editing.

The tool is designed for research and prototyping around **semantic visualization authoring** and **post-production personalization (P3)**. Its goal is to preserve and expose the semantic meaning of rendered visualization elements so that downstream systems can reason about them after the chart has already been produced.

---

## Live Demo

The editor is deployed through GitHub Pages:

```text
https://ali-sarvghad.github.io/semantic-vega-editor/
```

---

## Motivation

Vega and Vega-Lite specifications are rich, declarative descriptions of visualizations. They define data transformations, encodings, marks, scales, axes, legends, and interactions.

However, once a visualization is rendered as SVG, much of this semantic structure becomes difficult to recover. A rendered SVG may contain many `<path>`, `<text>`, `<g>`, and other SVG elements, but those elements do not always clearly indicate:

- which elements are data marks,
- which text elements are axis labels,
- which text elements are legend labels,
- which marks encode which data fields,
- which marks belong to the same logical visual group,
- which elements should be edited together,
- which elements are visible, hidden, or generated for layout,
- how an end-user request should be mapped to SVG elements.

This creates a problem for downstream systems that need to transform, personalize, explain, or interact with visualizations after rendering.

Semantic Vega Editor addresses this problem by adding a **human-in-the-loop semantic authoring layer** between the declarative specification and the rendered SVG.

The editor does not assume that all semantic meaning can be inferred automatically. Instead, it helps the visualization author inspect automatically detected visual cohorts and provide meaningful labels. These labels then become part of the exported semantic artifacts.

---

## Core idea

Semantic Vega Editor connects three layers:

1. **The declarative specification**  
   The original Vega or Vega-Lite code.

2. **The rendered visualization**  
   The SVG output produced from the specification.

3. **Author-provided semantic labels**  
   Human-verified descriptions of what visual cohorts mean.

The result is a semantically enriched visualization artifact that preserves both the rendered visual structure and the author’s semantic interpretation of that structure.

---

## What is a cohort?

A **cohort** is a group of related visual elements that play a shared role in the visualization.

Examples include:

- all bars in a bar chart,
- all points in a scatterplot,
- all rectangles in a heatmap,
- all x-axis tick labels,
- all y-axis tick labels,
- an axis title,
- legend labels,
- legend title,
- gridlines,
- annotation marks,
- grouped data marks,
- interactive or conditionally visible marks.

The editor automatically discovers cohorts from the rendered SVG using information such as:

- SVG structure,
- Vega-generated roles and classes,
- mark types,
- visual properties,
- parent-child relationships,
- axis and legend structures,
- visibility and render status,
- semantic attributes already present in the SVG.

The author can then label each required cohort.

---

## Why human-in-the-loop labeling?

Some semantic relationships are difficult or impossible to infer reliably from SVG alone.

For example, an SVG text element may visually look like an axis label, but the editor may not know whether it represents:

```text
months of the year
```

```text
week numbers
```

```text
categories
```

```text
years
```

```text
legend values
```

Likewise, a group of rectangles may visually look like data marks, but their semantic meaning depends on the visualization:

```text
data rectangles encoding daily S&P 500 changes
```

```text
bars encoding population by country
```

```text
cells encoding temperature anomalies
```

```text
interval marks showing uncertainty ranges
```

Semantic Vega Editor therefore uses a **human-in-the-loop workflow**. The system proposes visual cohorts, and the author provides or verifies the semantic labels.

This makes the exported artifacts more reliable for downstream tools.

---

## Main workflow

The typical workflow is:

1. **Load or write a Vega/Vega-Lite specification**
2. **Render the visualization**
3. **Inspect the rendered chart**
4. **Run cohort discovery**
5. **Review detected cohorts**
6. **Label cohorts manually or with AI assistance**
7. **Generate semantic outputs**
8. **Download or copy the outputs**
9. **Use the outputs in downstream visualization tools**

---

## Manual labeling

In manual labeling mode, the author reviews each cohort and types a label that describes what the cohort means in the visualization.

Good labels should describe the cohort’s semantic role, not just its appearance.

Good examples:

```text
x-axis tick labels for weeks
```

```text
y-axis tick labels for days of the week
```

```text
legend labels for daily change color scale
```

```text
data rectangles encoding daily S&P 500 changes
```

```text
annotation labels identifying peak values
```

Less useful examples:

```text
blue things
```

```text
small text
```

```text
rectangles
```

```text
labels
```

A good label should help a downstream system understand what the elements are and how they should be interpreted.

---

## AI-assisted labeling

Semantic Vega Editor includes an optional **AI labeling** workflow.

Instead of labeling every cohort manually, the author can use the **Label with AI** option. In this mode, the editor sends cohort information to an OpenAI model and asks the model to suggest semantic labels.

The AI labeling workflow is intended to reduce authoring effort, especially for complex visualizations with many cohorts. It is not intended to remove author oversight. Authors should review AI-generated labels before generating final semantic outputs.

---

## OpenAI API key requirement

AI-assisted labeling requires the user to provide their own **OpenAI API key**.

The key is used only to make model calls for cohort labeling. The editor does not include a built-in shared API key.

When the user selects **Label with AI**, the editor may ask for:

- an OpenAI API key,
- a model selection,
- whether to save the key and model preference locally.

If the user chooses to save this information, it is stored locally in the browser so that the user does not need to enter it every time.

Depending on the implementation and browser settings, this local storage may persist across sessions on the same device and browser. Users should avoid saving API keys on shared or public machines.

---

## How AI labeling works

The AI labeling workflow follows this general process:

1. The editor identifies the cohorts in the rendered visualization.
2. For each cohort, the editor prepares context such as:
   - cohort thumbnail or visual preview,
   - cohort type,
   - suggested role,
   - SVG structure,
   - mark type,
   - parent container,
   - representative elements,
   - text samples,
   - data summaries where available.
3. The selected OpenAI model suggests a semantic label.
4. The editor inserts the suggested labels into the cohort labeling interface.
5. The author reviews and edits the labels if needed.
6. Once all required cohorts are labeled, the semantic outputs can be generated.

The purpose of AI labeling is to assist the author, not to make the final semantic judgment automatically.

---

## Privacy and data considerations for AI labeling

When AI labeling is used, cohort-related information is sent to the selected OpenAI model. Depending on the visualization, this may include:

- rendered cohort thumbnails,
- chart text,
- labels,
- data field names,
- sample data values,
- visual structure summaries,
- semantic context.

Users should avoid using AI labeling with sensitive, private, or confidential data unless they are comfortable sending the relevant cohort context to the model provider.

Manual labeling can be used when the author does not want to send visualization content to an external model.

---

## Key features

### Vega and Vega-Lite editing

The editor provides a code-editing environment for Vega and Vega-Lite specifications. Authors can edit specifications, render the visualization, and inspect the result.

### Rendered SVG analysis

The editor analyzes the rendered SVG rather than relying only on the original specification. This allows it to capture the actual visual elements that appear in the final chart.

### Cohort discovery

The editor identifies meaningful groups of visual elements, such as data marks, axes, legends, labels, and annotations.

### Manual cohort labeling

Authors can label cohorts directly, ensuring that the final semantic artifact reflects the author’s intended meaning.

### AI-assisted cohort labeling

Authors can optionally use an OpenAI model to suggest labels for cohorts.

### Local model settings

The editor can save OpenAI model settings locally, so users do not need to re-enter them each time.

### Semantic artifact generation

The editor generates semantic outputs that can be used for downstream editing, transformation, personalization, explanation, and accessibility.

### Exportable outputs

The editor supports multiple output formats, including SVA, SSVG, and CompactVEM.

---

## Main outputs

Semantic Vega Editor produces several related outputs. Each output serves a different purpose.

---

## 1. SVA: Semantic Vega Artifact

The **Semantic Vega Artifact (SVA)** is the main semantic artifact produced by the editor.

It captures the relationship between:

- the original Vega/Vega-Lite specification,
- the rendered SVG,
- discovered visual cohorts,
- author-provided labels,
- semantic roles,
- visualization parts,
- data roles,
- targetable SVG elements,
- metadata needed for downstream visualization editing.

The SVA is useful when a downstream system needs to understand both the original visualization specification and the rendered semantic structure.

### What SVA contains

An SVA may include:

- source specification metadata,
- chart-level metadata,
- cohort metadata,
- author labels,
- role information,
- visualization part information,
- data role information,
- parent-child relationships among cohorts,
- targeting selectors,
- representative element IDs,
- readiness or validation metadata.

### What SVA can be used for

SVA can support:

- post-production visualization editing,
- natural-language visualization transformation,
- semantic chart inspection,
- visualization debugging,
- AI-assisted target resolution,
- reproducible semantic annotation,
- downstream transformation planning.

For example, if a user asks:

```text
Make the data rectangles for negative daily changes more visible.
```

a downstream system can use the SVA to identify the relevant data-mark cohort and determine how to target it.

---

## 2. SSVG: Semantic SVG

The **Semantic SVG (SSVG)** is an SVG file enriched with semantic attributes.

It preserves the rendered visualization as SVG, but adds machine-readable attributes directly to the SVG elements.

Example attributes may include:

```html
p3-element-id="p3_el_00046"
p3-cohort-id="cohort_data_mark-rect_0"
p3-role="data rectangles encoding daily S&P 500 changes"
p3-viz-part="data-mark"
p3-data-role="data"
p3-mark="rect"
p3-shapeDescriptor="path"
```

### What SSVG contains

An SSVG may include:

- the full rendered SVG,
- semantic metadata,
- element IDs,
- cohort IDs,
- author-provided roles,
- visualization part labels,
- data roles,
- mark types,
- shape descriptors,
- style or paint attributes,
- data values or summaries,
- visibility information,
- targeting information.

### What SSVG can be used for

SSVG is useful when a downstream system needs to directly manipulate SVG elements.

It can support:

- DOM-based visualization transformations,
- changing styles of semantic groups,
- selecting elements by cohort,
- hiding or showing chart parts,
- adding emphasis or annotation,
- attaching interaction handlers,
- generating accessible descriptions,
- explaining selected chart elements,
- exporting semantically meaningful SVG.

For example, a downstream system can select all data marks using:

```css
[p3-viz-part="data-mark"]
```

or select a specific cohort using:

```css
[p3-cohort-id="cohort_data_mark-rect_0"]
```

This allows systems to edit meaningful visualization parts rather than arbitrary SVG paths.

---

## 3. CompactVEM: Compact Visual Edit Model

The **Compact Visual Edit Model (CompactVEM)** is a compact representation of the visualization designed for downstream editing and AI-assisted transformation.

Unlike SSVG, which preserves the full rendered SVG, CompactVEM summarizes the visualization into semantically meaningful editable units.

### What CompactVEM contains

CompactVEM may include:

- chart-level summary,
- chart dimensions,
- cohort summaries,
- semantic roles,
- visualization parts,
- data roles,
- shape information,
- style summaries,
- geometry summaries,
- text summaries,
- data summaries,
- representative elements,
- targeting selectors,
- available packet types.

A cohort entry in CompactVEM may summarize a group of elements without listing every SVG element in full.

### What CompactVEM can be used for

CompactVEM is useful for:

- natural-language visualization editing,
- deciding which cohort a user request refers to,
- AI-assisted transformation planning,
- checking whether a requested edit is possible,
- selecting representative elements,
- reducing the amount of context sent to an AI model,
- generating transformation scripts,
- validating transformation targets.

For example, a request such as:

```text
Highlight the legend labels and make the data marks less saturated.
```

can be mapped to relevant cohorts using CompactVEM before applying the actual transformation to the SSVG.

### Important note on CompactVEM size

CompactVEM is smaller than full SSVG, but for very large charts it can still be large. For model calls, it is often better to generate a smaller task-specific packet from CompactVEM containing only:

- the user request,
- the chart summary,
- relevant cohorts,
- selectors,
- representative examples,
- necessary data summaries.

---

## 4. Cohort metadata

The editor produces metadata for each discovered cohort.

A cohort may include:

- cohort ID,
- source cohort ID,
- suggested role,
- author-provided role,
- role source,
- member count,
- parent cohort,
- child cohorts,
- whether it is authorable,
- whether it writes renderable attributes,
- whether it is container-only,
- visualization part,
- data role,
- representative elements,
- style summary,
- geometry summary,
- text summary,
- data summary,
- render status,
- visibility mode,
- interaction role.

### What cohort metadata can be used for

Cohort metadata can support:

- inspecting how the visualization was decomposed,
- checking whether important visual parts were detected,
- detecting missing labels,
- detecting over-fragmented cohorts,
- detecting overly broad cohorts,
- debugging hidden or invisible marks,
- reviewing cohort hierarchy,
- validating semantic completeness.

---

## 5. Targeting selectors

The exported artifacts include selectors that downstream tools can use to locate elements in the SVG.

Examples include:

```css
[p3-cohort-id="cohort_data_mark-rect_0"]
```

```css
[p3-role="data rectangles encoding daily S&P 500 changes"]
```

```css
[p3-viz-part="axis-tick-label"]
```

```css
[p3-data-role="data"]
```

### What targeting selectors can be used for

Targeting selectors allow downstream systems to:

- recolor a cohort,
- change opacity,
- add stroke or emphasis,
- hide or show elements,
- attach interactions,
- select representative elements,
- apply transformations to chart parts,
- generate explanations for selected marks.

Selectors are central to post-production personalization because they allow transformations to target semantic groups instead of arbitrary SVG elements.

---

## 6. Data summaries and data values

For data marks, the semantic outputs may include data-related information.

This may include:

- encoded fields,
- encoding channels,
- sample values,
- numeric ranges,
- categorical examples,
- per-element data values,
- data summaries by cohort.

### What data information can be used for

Data information can support:

- filtering marks by value,
- finding outliers,
- explaining what a mark represents,
- resolving natural-language references to data fields,
- locating marks that satisfy a condition,
- generating data-aware visual transformations.

For example, a request such as:

```text
Highlight days where the daily change was strongly negative.
```

requires the system to know:

- which field represents daily change,
- which marks encode that field,
- which marks have negative values,
- how those marks can be selected and styled.

---

## 7. Validation and readiness metadata

The editor can include metadata that checks whether the semantic artifact is ready for downstream use.

This may include:

- number of checked elements,
- number of checked cohorts,
- required semantic attributes,
- missing attribute counts,
- selector failures,
- warnings.

### What validation metadata can be used for

Validation metadata can support:

- checking artifact completeness,
- preventing incomplete exports,
- detecting missing labels,
- verifying selectors,
- debugging semantic generation,
- improving downstream reliability.

---

## How to use the editor

### 1. Load or write a specification

Open the editor and paste a Vega or Vega-Lite specification into the code editor.

### 2. Render the chart

Use the render/play button to compile and display the visualization.

### 3. Inspect the visualization

Review the rendered output and confirm that the chart appears correctly.

### 4. Start cohort labeling

Run the cohort labeling workflow. The editor will show detected cohorts.

### 5. Choose manual or AI labeling

The labeling workflow can be performed in two ways:

#### Manual Label

Choose **Manual Label** to type labels yourself.

Use this mode when:

- the chart contains sensitive data,
- you want full control over labels,
- the chart is small enough to label manually,
- you do not want to use an external AI model.

#### Label with AI

Choose **Label with AI** to use an OpenAI model to suggest labels.

Use this mode when:

- the chart has many cohorts,
- you want faster first-pass labels,
- you are comfortable sending cohort context to the model,
- you plan to review and correct suggested labels.

If model information has not already been saved, the editor will ask for:

- your OpenAI API key,
- the model to use,
- whether to save this information locally.

If model information has already been saved, AI labeling can start directly.

### 6. Review labels

Review all labels before generating the final semantic artifact. AI-generated labels may need correction.

### 7. Generate semantic outputs

Once all required cohorts are labeled, generate the semantic outputs.

### 8. Export outputs

Export the SVA, SSVG, CompactVEM, or other available outputs for downstream use.

---

## Example downstream use cases

### Natural-language visualization editing

A downstream system can use the exported artifacts to interpret requests such as:

```text
Make the negative daily changes more visible.
```

```text
Increase the size of the legend labels.
```

```text
Hide the year labels.
```

```text
Explain what the green rectangles represent.
```

### Post-production personalization

The artifacts can support tools that let end users personalize an existing visualization without editing the original Vega/Vega-Lite specification.

Examples include:

- changing emphasis,
- simplifying the chart,
- highlighting personally relevant values,
- modifying labels,
- hiding irrelevant parts,
- adding explanations.

### Accessibility

Semantic outputs can help accessibility tools generate more meaningful chart descriptions by identifying:

- data marks,
- axes,
- legends,
- labels,
- annotations,
- chart structure,
- encoded data fields.

### AI-assisted visualization transformation

CompactVEM and SSVG can help AI systems:

- understand chart structure,
- resolve user intent,
- select target elements,
- generate transformation scripts,
- validate the result.

### Visualization research

The tool can be used to study:

- semantic visualization authoring,
- human-in-the-loop labeling,
- AI-assisted labeling,
- post-production chart editing,
- accessibility-oriented visualization representations,
- semantic SVG generation.

---

## Development

This project is implemented as a Vite-based web application.

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

---

## GitHub Pages deployment

The app is designed to run on GitHub Pages at:

```text
https://ali-sarvghad.github.io/semantic-vega-editor/
```

Because it is hosted from a repository subpath, the Vite configuration should include:

```ts
base: '/semantic-vega-editor/'
```

The repository includes a GitHub Actions workflow that builds the app and deploys the `dist` output to GitHub Pages.

---

## Project status

Semantic Vega Editor is a research prototype under active development. The interface, schema, and exported artifact formats may evolve as the project develops.

Current development priorities include:

- improving cohort discovery,
- supporting robust semantic labeling,
- improving AI-assisted labeling,
- reducing artifact size for AI workflows,
- improving CompactVEM generation,
- supporting richer interaction metadata,
- improving compatibility with downstream post-production personalization tools.

---

## Terminology

### Vega / Vega-Lite

Declarative grammars for specifying interactive visualizations.

### SVG

Scalable Vector Graphics, the rendered vector representation of the chart.

### SSVG

Semantic SVG: an SVG enriched with semantic attributes and metadata.

### SVA

Semantic Vega Artifact: an authoring-level semantic artifact connecting the original specification, rendered visualization, cohorts, labels, and semantic metadata.

### CompactVEM

Compact Visual Edit Model: a compact representation of the visualization designed for downstream editing, target resolution, and AI-assisted transformation.

### Cohort

A group of related visual elements that share a semantic or structural role in the visualization.

### Data mark

A visual element that represents data, such as a bar, point, line segment, rectangle, or area.

### Visualization part

The functional part of the visualization that an element belongs to, such as data mark, axis label, axis title, legend label, legend title, gridline, or annotation.

### Post-production personalization

A workflow in which an existing rendered visualization is adapted, transformed, or personalized after it has already been produced.

---

## License

License information to be added.
