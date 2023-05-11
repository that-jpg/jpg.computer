#!/usr/bin/env python3
import matplotlib.pyplot as plt
import numpy as np
import json


def generate_sport_graph(data):
    plt.rcdefaults()
    fig, ax = plt.subplots()
    print()
    # Example data
    grades = ([route['grade'] for route in data])
    y_pos = np.arange(len(grades))
    count = [len(route['climbs']) for route in data]

    bars = ax.barh(y_pos, count, align='center')
    for i, bar in enumerate(bars):
        print(bar.get_width())
        ax.text(bar.get_width() / 2, bar.get_y() + bar.get_height() / 2,
            str(count[i]), ha='left', va='center', color='white')

    ax.set_yticks(y_pos, labels=grades)
    ax.invert_yaxis()  # labels read top-to-bottom
    ax.set_xlabel('Count')
    ax.set_title('Grade x Count')

    plt.savefig('my_plot.jpg', format='jpeg')
    plt.show()


# Open the JSON file
with open('ticklist.json', 'r') as f:
    # Load the data from the file into a Python object
    data = json.load(f)
    generate_sport_graph(data['routes']);
