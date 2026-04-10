#!/usr/bin/env python3

from os import listdir, makedirs
import subprocess
import shutil
from os.path import isfile, join, isdir, getsize
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

def parse_template(template, content, title=None):
    result = re.sub(r'{% content %}', content, template)
    result = re.sub(r'{% title %}', title or 'Philipe Godoy - Just a dev | Home', result)
    return result

def add_file_size_to_template(template, output_filepath):
    filesize = str(getsize(output_filepath))
    return re.sub(r'{% size %}', filesize, template)

def save_file(current_dir, filename, template_to_save):
    rel = current_dir[len(PATH):]
    output_dir = f'{OUTPUT_PATH}{rel}'
    makedirs(output_dir, exist_ok=True)
    output_filepath = f'{output_dir}/{filename[:-3]}html'
    with open(output_filepath, 'w') as file:
        file.write(template_to_save)
    template_to_save = add_file_size_to_template(template_to_save, output_filepath)
    with open(output_filepath, 'w') as file:
        file.write(template_to_save)

def generate(current_dir):
    print("Generating folder: ", current_dir)
    files = [f for f in listdir(current_dir) if isfile(join(current_dir, f)) and f not in IGNORED_FILES]
    has_custom_build = "custom.py" in files and current_dir is not PATH
    if has_custom_build:
        subprocess.call(['python3', f'{current_dir}/custom.py'])
    else:
        for f in files:
            if f[-3:] == TEMPLATE_FORMAT:
                with open(f'{current_dir}/{f}', 'r') as file:
                    raw_content = file.read()
                template_name, title, content = parse_jwm(raw_content)
                template = get_template(template_name)
                template_to_save = parse_template(template, content, title)
                save_file(current_dir, f, template_to_save)
            else:
                rel = current_dir[len(PATH):]
                output_dir = f'{OUTPUT_PATH}{rel}'
                makedirs(output_dir, exist_ok=True)
                shutil.copy2(f'{current_dir}/{f}', output_dir)
        print(files)

def walk(current_dir):
    print(current_dir)
    directories = [join(current_dir, _dir) for _dir in listdir(current_dir) if isdir(join(current_dir, _dir))]
    for directory in directories:
        walk(directory)
    generate(current_dir)

walk(PATH)
