from bs4 import BeautifulSoup
import json
from typing import List, Dict
import os
from datetime import datetime

def extract_ascent_data(soup: BeautifulSoup) -> List[Dict]:
    """
    Extract climbing ascent data from the HTML content
    
    Args:
        soup (BeautifulSoup): Parsed HTML content
        
    Returns:
        List[Dict]: List of dictionaries containing ascent information
    """
    ascents = []
    
    # Debug: Print the first 500 characters of the HTML to verify content
    print("First 500 characters of HTML content:")
    print(str(soup)[:500])
    
    # Find the table containing the ascents
    table = soup.find('table', class_='ascents-table')
    if not table:
        print("Could not find table with class 'ascents-table'")
        # Try to find any table as a fallback
        table = soup.find('table')
        if table:
            print("Found a table, but not with the expected class")
        else:
            print("No tables found in the document")
            return ascents
    
    # Find all rows in the table body
    tbody = table.find('tbody')
    if not tbody:
        print("Could not find tbody in the table")
        return ascents
    
    rows = tbody.find_all('tr')
    print(f"Found {len(rows)} rows in the table")
    
    for row in rows:
        ascent = {}
        
        # Extract date
        date_cell = row.find('td', class_='date')
        if date_cell:
            ascent['date'] = date_cell.text.strip()
        else:
            print("No date cell found in row")
        
        # Extract route name and grade
        route_cell = row.find('td', class_='route')
        if route_cell:
            route_link = route_cell.find('a')
            if route_link:
                ascent['route_name'] = route_link.text.strip()
                ascent['route_url'] = route_link.get('href', '')
            else:
                print("No route link found in route cell")
            
            grade_span = route_cell.find('span', class_='grade')
            if grade_span:
                ascent['grade'] = grade_span.text.strip()
            else:
                print("No grade span found in route cell")
        else:
            print("No route cell found in row")
        
        # Extract crag/location
        crag_cell = row.find('td', class_='crag')
        if crag_cell:
            crag_link = crag_cell.find('a')
            if crag_link:
                ascent['crag'] = crag_link.text.strip()
                ascent['crag_url'] = crag_link.get('href', '')
            else:
                print("No crag link found in crag cell")
        else:
            print("No crag cell found in row")
        
        # Extract style (if available)
        style_cell = row.find('td', class_='style')
        if style_cell:
            ascent['style'] = style_cell.text.strip()
        
        # Extract notes (if available)
        notes_cell = row.find('td', class_='notes')
        if notes_cell:
            ascent['notes'] = notes_cell.text.strip()
        
        # Only add the ascent if we found at least some data
        if ascent:
            ascents.append(ascent)
            print(f"Added ascent: {ascent.get('route_name', 'Unknown route')}")
        else:
            print("Skipping row with no data")
    
    return ascents

def scrape_from_file(file_path: str) -> List[Dict]:
    """
    Scrape climbing data from a local HTML file
    
    Args:
        file_path (str): Path to the HTML file
        
    Returns:
        List[Dict]: List of dictionaries containing climbing data
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist")
    
    try:
        # Read the HTML file
        print(f"Reading file: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as file:
            html_content = file.read()
        
        print(f"File size: {len(html_content)} bytes")
        
        # Parse HTML content
        soup = BeautifulSoup(html_content, 'lxml')
        
        # Extract the climbing data
        return extract_ascent_data(soup)
        
    except Exception as e:
        print(f"Error scraping file: {e}")
        import traceback
        traceback.print_exc()
        return []

def save_to_json(data: List[Dict], filename: str) -> None:
    """
    Save scraped data to a JSON file
    
    Args:
        data (List[Dict]): List of dictionaries containing climbing data
        filename (str): Name of the output JSON file
    """
    print(f"Saving {len(data)} ascents to {filename}")
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def main():
    # Path to the HTML file
    html_file = "8apage.html"
    
    print(f"Starting to scrape climbing data from {html_file}...")
    
    # Scrape the data
    ascents = scrape_from_file(html_file)
    
    # Save results to JSON file
    output_file = "climbing_ascents.json"
    save_to_json(ascents, output_file)
    
    print(f"Scraping completed! Found {len(ascents)} ascents.")
    print(f"Data saved to {output_file}")

if __name__ == "__main__":
    main() 