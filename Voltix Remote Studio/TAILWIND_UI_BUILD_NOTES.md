# Voltix Tailwind UI Build Notes

This build uses Tailwind CSS as the renderer stylesheet build step.

Tailwind source:

- `app/tailwind.config.js`
- `app/src/renderer/tailwind.input.css`

Generated runtime CSS:

- `app/src/renderer/style.css`

The app does not need Tailwind at runtime. The browser loads the generated `style.css` file from the local Voltix server.

Renderer-only UI files changed:

- `app/tailwind.config.js` added
- `app/src/renderer/tailwind.input.css` added
- `app/src/renderer/style.css` regenerated with Tailwind CLI

Backend/control logic was preserved.
