#!/usr/bin/env python3

from os import listdir
import subprocess
from sys import getsizeof
from os.path import isfile, join, isdir, getsize
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

def add_file_size_to_template(template, output_filepath):
    filesize = str(getsize(output_filepath))
    return re.sub(r'{% size %}', filesize, template)

def save_file(current_dir, filename, template_to_save):
    # open the file in write mode
    output_filepath = f'{OUTPUT_PATH}/{current_dir[5:]}{filename[:-3]}html'
    # open the file in write mode
    with open(output_filepath, 'w') as file:
        # write the string into the file
        file.write(template_to_save)

    template_to_save = add_file_size_to_template(template_to_save, output_filepath);

    with open(output_filepath, 'w') as file:
        # write the string into the file
        file.write(template_to_save)

#    parsed_template = re.sub(r'{% size %}', str(getsizeof(parse_template)), parsed_template)

def generate(current_dir):
    print("Generating folder: ", current_dir)
    files = [f for f in listdir(current_dir) if isfile(join(current_dir, f)) and f not in IGNORED_FILES]
    has_custom_build = "custom.py" in files and current_dir is not PATH
    if (has_custom_build):
        # execute python script to generate the template
        subprocess.call(['python3', f'{current_dir}/custom.py'])

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
