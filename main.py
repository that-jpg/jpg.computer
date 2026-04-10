#!/usr/bin/env python3

from os import listdir, makedirs
import subprocess
import shutil
import sys
import json
from os.path import isfile, join, isdir, splitext, getmtime, relpath
import re

PATH = "./src"
TEMPLATE_FORMAT = "jwm"
IGNORED_FILES = [".DS_Store"]
OUTPUT_PATH = "./build"

_template_cache = {}

def get_template(name='default'):
    if name not in _template_cache:
        with open(f'{PATH}/{name}.template.jwm', 'r') as file:
            _template_cache[name] = file.read()
    return _template_cache[name]

def parse_jwm(raw_content):
    """Extract optional {% use name %} and {% title = ... %} directives from the top."""
    lines = raw_content.split('\n')
    template_name = 'default'
    title = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        use_m = re.match(r'\{%\s*use\s+(\w+)\s*%\}', line)
        title_m = re.match(r'\{%\s*title\s*=\s*(.+?)\s*%\}', line)
        if use_m:
            template_name = use_m.group(1)
            i += 1
        elif title_m:
            title = title_m.group(1)
            i += 1
        else:
            break
    return template_name, title, '\n'.join(lines[i:])

def parse_template(template, content, title=None, root='./'):
    result = re.sub(r'{% content %}', content, template)
    result = re.sub(r'{% title %}', title or 'Philipe Godoy - Just a dev | Home', result)
    result = re.sub(r'{% root %}', root, result)
    return result

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'}
THUMB_MAX_PX = 400

def generate_thumbnails(collection_dir, thumbs_dir, images):
    """Generate thumbnails into thumbs_dir, skipping files that are up to date."""
    from PIL import Image
    makedirs(thumbs_dir, exist_ok=True)
    for img in images:
        src  = join(collection_dir, img)
        dest = join(thumbs_dir, img)
        if isfile(dest) and getmtime(dest) >= getmtime(src):
            continue
        print(f"  thumbnail: {img}")
        with Image.open(src) as im:
            im.thumbnail((THUMB_MAX_PX, THUMB_MAX_PX))
            im.save(dest)

def process_gallery(content, current_dir):
    """Replace {% gallery <folder> %} with a generated JS const pieces = [...] array.

    Folder layout expected under current_dir/<folder>/:
      *.jpg / *.png / ...   — full-size images (sorted alphabetically)
      descriptions.json     — optional { "filename.jpg": "caption" } map

    Thumbnails are generated automatically into the build output directory.
    """
    def replace(m):
        folder = m.group(1).strip()
        collection_dir = join(current_dir, folder)
        if not isdir(collection_dir):
            return 'const pieces = [];'

        desc_path = join(collection_dir, 'descriptions.json')
        descriptions = {}
        if isfile(desc_path):
            with open(desc_path, 'r') as f:
                descriptions = json.load(f)

        images = sorted(
            f for f in listdir(collection_dir)
            if isfile(join(collection_dir, f))
            and splitext(f)[1].lower() in IMAGE_EXTS
        )

        thumbs_dir = join(OUTPUT_PATH, relpath(current_dir, PATH), folder, 'thumbs')
        generate_thumbnails(collection_dir, thumbs_dir, images)

        url_base = '/' + relpath(current_dir, PATH).replace('\\', '/') + '/'

        entries = []
        for img in images:
            name = splitext(img)[0]
            desc = descriptions.get(img, descriptions.get(name,
                name.replace('-', ' ').replace('_', ' ')))
            full  = f'{url_base}{folder}/{img}'
            thumb = f'{url_base}{folder}/thumbs/{img}'
            entries.append(
                f'  {{ thumb: {json.dumps(thumb)}, full: {json.dumps(full)}, desc: {json.dumps(desc)} }}'
            )

        joined = ',\n'.join(entries)
        return f'const pieces = [\n{joined}\n];'

    return re.sub(r'\{%\s*gallery\s+(\S+)\s*%\}', replace, content)

def save_file(output_dir, filename, template_to_save):
    makedirs(output_dir, exist_ok=True)
    output_filepath = f'{output_dir}/{filename[:-3]}html'
    filesize = str(len(template_to_save.encode()))
    template_to_save = re.sub(r'{% size %}', filesize, template_to_save)
    with open(output_filepath, 'w') as file:
        file.write(template_to_save)

def generate(current_dir):
    print("Generating folder: ", current_dir)
    files = [f for f in listdir(current_dir) if isfile(join(current_dir, f)) and f not in IGNORED_FILES]
    has_custom_build = "custom.py" in files and current_dir != PATH
    if has_custom_build:
        subprocess.call(['python3', f'{current_dir}/custom.py'])
    else:
        for f in files:
            if f.endswith(f'.{TEMPLATE_FORMAT}') and not f.endswith(f'.template.{TEMPLATE_FORMAT}'):
                with open(f'{current_dir}/{f}', 'r') as file:
                    raw_content = file.read()
                template_name, title, content = parse_jwm(raw_content)
                content = process_gallery(content, current_dir)
                template = get_template(template_name)
                output_dir = join(OUTPUT_PATH, relpath(current_dir, PATH))
                root = relpath(OUTPUT_PATH, output_dir).replace('\\', '/') + '/'
                template_to_save = parse_template(template, content, title, root)
                save_file(output_dir, f, template_to_save)
            else:
                output_dir = join(OUTPUT_PATH, relpath(current_dir, PATH))
                makedirs(output_dir, exist_ok=True)
                shutil.copy2(f'{current_dir}/{f}', output_dir)
        print(files)

def walk(current_dir):
    print(current_dir)
    directories = [join(current_dir, _dir) for _dir in listdir(current_dir) if isdir(join(current_dir, _dir))]
    for directory in directories:
        walk(directory)
    generate(current_dir)

target = sys.argv[1] if len(sys.argv) > 1 else PATH
walk(target)
