#!/usr/bin/env python3

from os import listdir
from os.path import isfile, join, isdir
import re

PATH = "./src"
TEMPLATE_FORMAT = "jwm" # jpg web
IGNORED_FILES = [".DS_Store"]
ROOT_TEMPLATE = "default.template.jwm"
OUTPUT_PATH = "./build"

#onlyfiles = [f for f in listdir(PATH) if isfile(join(PATH, f)) and f[-3:] == TEMPLATE_FORMAT]

def get_root_template():
    with open(f'{PATH}/{ROOT_TEMPLATE}', 'r') as file:
        # read all the text into a string
        data = file.read()
    return data

def parse_template(template, content):
    return re.sub(r'{% content %}', content, template)

def save_file(current_dir, filename, template_to_save):
    # open the file in write mode
    output_filepath = f'{OUTPUT_PATH}/{current_dir[5:]}{filename[:-3]}html'
    # open the file in write mode
    with open(output_filepath, 'w') as file:
        # write the string into the file
        file.write(template_to_save)

def generate(current_dir):
    print("Generating folder: ", current_dir)
    files = [f for f in listdir(current_dir) if isfile(join(current_dir, f)) and f not in IGNORED_FILES]
    has_custom_build = "default.template.jwm" in files and current_dir is not PATH
    if (has_custom_build):
        print("     TODO: this need to be implemented, currently we are not handling custom templates :/")
        template = None
    else:
        template = get_root_template()

        for f in files:
            if f[-3:] == TEMPLATE_FORMAT:
                with open(f'{current_dir}/{f}', 'r') as file:
                    # read all the text into a string
                    content = file.read()
                    template_to_save = parse_template(template, content)
                    save_file(current_dir, f, template_to_save);

        print(files)

def walk(current_dir):
    print(current_dir)
    directories = [join(current_dir, _dir) for _dir in listdir(current_dir) if isdir(join(current_dir, _dir))]
    for directory in directories:
        walk(directory)

    generate(current_dir)


walk(PATH)