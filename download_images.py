import json
import os
import time
import requests
import warnings

from ddgs import DDGS

warnings.filterwarnings("ignore")

JSON_FILE = "pairs.json"
OUTPUT_FILE = "pairs.json"
MAX_RETRIES = 5

def get_candidates(query):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=MAX_RETRIES))
            return [r['image'] for r in results]
    except Exception as e:
        print(f"\n      [!] Search Error: {e}")
        return []

def download_file(url, path):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.google.com/"
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(r.content)
            return True
    except:
        pass
    return False

def main():
    if not os.path.exists(JSON_FILE):
        print("Source file missing.")
        return

    with open(JSON_FILE, 'r') as f:
        data = json.load(f)

    clean_data = []
    total = len(data)
    
    print(f"{'='*50}\nSTARTING DOWNLOADER ({total} items)\n{'='*50}")

    for idx, item in enumerate(data, 1):
        word = item['word']
        path = item['image']
        
        clean_data.append({"pair": item["pair"], "word": word, "image": path})
        
        print(f"[{idx:03d}/{total}] {word:<25}", end="", flush=True)

        if os.path.exists(path):
            print(" ->  [SKIP] (File Exists)")
            continue

        print() 
        candidates = get_candidates(word)
        success = False

        if candidates:
            for i, url in enumerate(candidates, 1):
                print(f"      Try {i}: {url[:60]:<60} ...", end="", flush=True)
                
                if download_file(url, path):
                    print("SAVED")
                    success = True
                    break
                else:
                    print("FAILED")
        else:
            print("      [!] No results found.")

        if not success:
            print(f"      [!] Could not download any image for '{word}'")

        time.sleep(5.5)

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(clean_data, f, indent=2)
    
    print(f"\n{'='*50}\nCOMPLETE. Saved to {OUTPUT_FILE}\n{'='*50}")

if __name__ == "__main__":
    main()

