import requests
import os
import json

GIST_ID = os.getenv("GIST_ID")
GIST_TOKEN = os.getenv("GIST_TOKEN")

def update_gist(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    url = f"https://api.github.com/gists/{GIST_ID}"
    headers = {
        "Authorization": f"Bearer {GIST_TOKEN}",
        "Accept": "application/vnd.github+json"
    }
    data = {
        "files": {
            "PlayerFullStats.json": {
                "content": content
            }
        }
    }

    response = requests.patch(url, headers=headers, json=data)
    if response.status_code == 200:
        print("Gist updated successfully.")
    else:
        print("Failed to update Gist:", response.status_code, response.text)

if __name__ == "__main__":
    update_gist("PlayerFullStats.json")
