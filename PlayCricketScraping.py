# shared_scraper.py
import os
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv
import pandas as pd
import time
from io import StringIO

# Load environment variables only once
load_dotenv()
EMAIL = os.getenv("PLAYCRICKET_EMAIL")
PASSWORD = os.getenv("PLAYCRICKET_PASSWORD")

LOGIN_URL = "https://myaccount.play-cricket.com/idp-signin"
STARTING_URL = "https://toft.play-cricket.com/Statistics"

TAB_URLS = {
    "batting": "",
    "bowling": "/Statistics?season=258&sub_tab=Standard&tab=Bowling",
    "fielding": "/Statistics?season=258&sub_tab=Standard&tab=Fielding"
}

def scrape_playcricket_stats(tab: str = "batting") -> pd.DataFrame:
    assert tab in TAB_URLS, f"Invalid tab: {tab}. Must be one of {list(TAB_URLS.keys())}"

    all_dfs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto(STARTING_URL)

        # Accept cookies and sign in
        page.get_by_role("button", name="Strictly Necessary Only").click()
        page.get_by_role("link", name="SIGN IN").click()

        page.locator("#email").click()
        page.locator("#email").fill(EMAIL)

        page.locator("#password").click()
        page.locator("#password").fill(PASSWORD)
        page.get_by_role("button", name="SIGN IN").click()

        # Wait for table
        page.wait_for_selector("table#stats-table-rows")

        # Navigate to correct tab
        if TAB_URLS[tab]:
            page.click(f'a[href="{TAB_URLS[tab]}"]')
            page.wait_for_selector("table#stats-table-rows")

        # Loop through pages
        while True:
            stats_table = page.locator("table#stats-table-rows").evaluate("el => el.outerHTML")
            df = pd.read_html(StringIO(stats_table))[0]

            df = df.loc[:, ~df.columns.str.contains("^Unnamed")]
            df = df[df["RANK"].apply(lambda x: str(x).isdigit())]
            df = df.drop(columns=["RANK"])
            all_dfs.append(df)

            if page.locator("span.next_page.disabled").count() > 0:
                break

            page.click("a.next_page")
            page.wait_for_selector("table#stats-table-rows", timeout=5000)
            time.sleep(1)

        browser.close()

    return pd.concat(all_dfs, ignore_index=True)
