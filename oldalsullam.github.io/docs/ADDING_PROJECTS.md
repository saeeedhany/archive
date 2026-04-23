# Adding a New Project to AL Sullam

## 1. Create the project file

Create `_projects/your-project-name.md` with this front matter:

```yaml
---
layout: project
title: "Project Name"
slug: "project-slug"           # used in URL: /projects/project-slug/
description: "One-sentence description for SEO."
category: "Category / Subcategory"
lang: "C"                      # or Rust, Zig, Asm, etc.
status: "complete"             # complete | wip | planned
started: "2024"
version: "1.0.0"
lines_of_code: "~3,000"
github: "https://github.com/alsullam/project"

tags:
  - Tag One
  - Tag Two
  - Tag Three

specs:
  - key: "Language"
    value: "C11"
  - key: "Platform"
    value: "Linux"
  - key: "Key spec"
    value: "Value"

toc:
  - id: "overview"
    label: "Overview"
  - id: "architecture"
    label: "Architecture"
  - id: "build-process"
    label: "Build Process"
  # Add as many sections as you need
---
```

## 2. Write the content

After the front matter, write your documentation using standard HTML/Markdown.
Use these components (they're all pre-styled):

### Section wrapper
```html
<div class="content-section" id="your-section-id">
  <h2>Section Title</h2>
  <p>Your content...</p>
</div>
```

### Callout box
```html
<div class="callout callout--spark">  <!-- or callout--note, callout--warn -->
  <div class="callout__title">Note Title</div>
  <p>Your note text.</p>
</div>
```

### Spec table
```html
<table class="spec-table">
  <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
  <tbody>
    <tr><td>key</td><td>value</td></tr>
  </tbody>
</table>
```

### Build steps (numbered process)
```html
<div class="build-steps">
  <div class="build-step">
    <div class="build-step__num">01</div>
    <div class="build-step__content">
      <h4>Step Title</h4>
      <p>Step description.</p>
    </div>
  </div>
</div>
```

### Module grid
```html
<div class="module-grid">
  <div class="module-card">
    <div class="module-card__name">module_name</div>
    <div class="module-card__file">src/module.c · include/module.h</div>
    <p class="module-card__desc">What this module does.</p>
  </div>
</div>
```

### Architecture diagram (monospace)
```html
<div class="arch-diagram">
  <pre>
your ASCII diagram here
  </pre>
</div>
```

## 3. Add the card to the homepage

In `index.html`, add a new `<article class="project-card">` to the `.projects-grid`:

```html
<article class="project-card">
  <div class="card__header">
    <div class="card__number">PROJECT-005</div>   <!-- next number -->
    <div class="card__title">Your Project</div>
    <div class="card__lang">C</div>
  </div>
  <div class="card__body">
    <p class="card__description">Short description for the card.</p>
  </div>
  <div class="card__tags">
    <span class="tag">Tag One</span>
    <span class="tag">Tag Two</span>
  </div>
  <div class="card__footer">
    <span class="card__status status--complete">Complete</span>
    <!-- or: status--wip, status--planned -->
    <a href="/projects/project-slug/" class="card__link">View Project</a>
  </div>
</article>
```

## 4. Build and serve

```bash
# Install Jekyll (once)
gem install bundler jekyll
bundle install

# Serve locally with live reload
bundle exec jekyll serve --livereload

# Build for production
bundle exec jekyll build
# Output is in _site/
```

## Status values

| Status | Class | When to use |
|--------|-------|-------------|
| Complete | `status--complete` | All core features done, tested |
| In Progress | `status--wip` | Actively being built |
| Planned | `status--planned` | Not started yet |
