# jpg.computer

Personal website. Built with a custom static site generator (`generate.py`) and deployed on Vercel.

## How it works

Source files live in `src/`. Running `generate.py` walks that directory tree, processes `.jwm` files through templates, and writes the output to `build/`. Vercel runs this automatically on deploy — you don't need to commit the `build/` folder.

## Running locally

Install dependencies (only needed for thumbnail generation):

```bash
pip install Pillow
```

Build the whole site:

```bash
python3 generate.py
```

Build a specific subdirectory:

```bash
python3 generate.py src/climbing
```

Output goes to `build/`.

## Writing pages

Create a `.jwm` file anywhere under `src/`. At the top you can use these directives:

```
{% use page %}         # use a specific template (defaults to "default")
{% title = My Page %}  # set the page title
```

The rest of the file is the HTML content that gets injected into `{% content %}` in the template.

### Templates

Templates live in `src/` and are named `<name>.template.jwm`. The available placeholders are:

| Placeholder | Description |
|---|---|
| `{% content %}` | Page content |
| `{% title %}` | Page title |
| `{% root %}` | Relative path to the site root |
| `{% size %}` | Total page size in bytes (HTML + images) |

### Galleries

To embed a gallery, put images in a subfolder and use:

```html
{% gallery folder-name %}
```

This generates a grid of thumbnail links. Thumbnails are auto-generated into `build/.../folder-name/thumbs/` and capped at 400px. You can add captions by placing a `descriptions.json` file in the folder:

```json
{
  "photo.jpg": "A caption for this photo"
}
```

### Custom build scripts

If a directory contains a `custom.py` file, `generate.py` will run it instead of processing `.jwm` files normally. Useful for pages that need special generation logic.
