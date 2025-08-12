import os
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv
import pandas as pd
import time
from io import StringIO

# Load environment variables
load_dotenv()
EMAIL = os.getenv("PLAYCRICKET_EMAIL")
PASSWORD = os.getenv("PLAYCRICKET_PASSWORD")

LOGIN_URL = "https://myaccount.play-cricket.com/idp-signin"
STARTING_URL = "https://toft.play-cricket.com/Statistics"

def login_and_scrape():

    all_dfs = []

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto(STARTING_URL)

        # Handle the cookie popup
        page.get_by_role("button", name="Strictly Necessary Only").click()
        page.get_by_role("link", name="SIGN IN").click()

        # Enter email
        page.locator("#email").click()
        page.locator("#email").fill(EMAIL)

        # Enter password - 2 clicks as the first one doesn't always work
        page.locator("#password").click()
        page.locator("#password").click()
        page.locator("#password").fill(PASSWORD)

        # Press sign in button
        page.get_by_role("button", name="SIGN IN").click()

        # Wait for the table
        page.wait_for_selector("table#stats-table-rows")

        # Loop to use pagination to get all players
        while True:
            # Extract full table with headers & all rows
            stats_table = page.locator("table#stats-table-rows").evaluate("el => el.outerHTML")
            df = pd.read_html(StringIO(stats_table))[0]

            # Drop any unnamed duplicate columns - webpage code uses nested tables in some cases
            df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

            # Remove any rows that are just repeating stats
            df = df[df["RANK"].apply(lambda x: str(x).isdigit())]

            # Drop the RANK column
            df = df.drop(columns=["RANK"])
            all_dfs.append(df)

            # Check if the Next button is disabled
            next_button = page.locator("span.next_page.disabled")
            if next_button.count() > 0:
                break  # No more pages

            # Click the Next button and wait for the table to reload
            page.click("a.next_page")
            page.wait_for_selector("table#stats-table-rows", timeout=5000)
            time.sleep(1)  # small delay to ensure stability

        # Combine all scraped DataFrames
        final_df = pd.concat(all_dfs, ignore_index=True)
        # final_df.to_csv("all_runs_stats.csv", index=False)
        #print(final_df.head())

        browser.close()

        return final_df

if __name__ == "__main__":
    final_df = login_and_scrape()
