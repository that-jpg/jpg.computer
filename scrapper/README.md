# Web Scraper Example

This is a simple web scraper that extracts book information from [books.toscrape.com](http://books.toscrape.com) and saves it to a JSON file.

## Features

- Scrapes book information including title, price, availability, and rating
- Saves data in JSON format
- Includes error handling and rate limiting
- Type hints for better code maintainability

## Installation

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

2. Install the required packages:
```bash
pip install -r requirements.txt
```

## Usage

Run the script using:
```bash
python scraper.py
```

The script will:
1. Scrape 2 pages of books by default
2. Save the results in `books_data.json`

To modify the number of pages to scrape, edit the `pages_to_scrape` variable in the `main()` function.

## Output Format

The script generates a JSON file with the following structure:
```json
[
    {
        "title": "Book Title",
        "price": "£XX.XX",
        "availability": "In stock",
        "rating": "star-rating Three",
        "url": "http://books.toscrape.com/..."
    },
    ...
]
```

## Note

This is an example scraper that demonstrates web scraping basics. When scraping other websites:
- Always check the website's robots.txt file
- Respect rate limits
- Review the website's terms of service
- Consider using the website's API if available 