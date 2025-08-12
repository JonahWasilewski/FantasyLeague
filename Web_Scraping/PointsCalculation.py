import pandas as pd
from PlayCricketScraping import scrape_playcricket_stats
import json
from PriceCalculation import calculatePrice

def calculate_batting_stats():
    print("Scraping current season...")
    current = scrape_playcricket_stats(tab="batting", season_offset=0).fillna(0)
    current['SEASON'] = 'current'
    for col in ['RUNS', '50s', '100s']:
        current[col] = pd.to_numeric(current[col], errors='coerce').fillna(0)
    current['BATTING_POINTS'] = current['RUNS'] + current['50s'] * 10 + current['100s'] * 20

    print("Scraping previous season stats")
    previous = scrape_playcricket_stats(tab="batting", season_offset=1).fillna(0)
    previous['SEASON'] = 'previous'
    for col in ['RUNS', '50s', '100s']:
        previous[col] = pd.to_numeric(previous[col], errors='coerce').fillna(0)
    previous['BATTING_POINTS'] = previous['RUNS'] + previous['50s'] * 10 + previous['100s'] * 20

    print("All batting stats scraped.")
    return current, previous

def calculate_bowling_stats():
    print("Scraping current season...")
    current = scrape_playcricket_stats(tab="bowling", season_offset=0).fillna(0)
    current['SEASON'] = 'current'
    for col in ['WICKETS', 'MAIDENS', '5 WICKET HAUL']:
        current[col] = pd.to_numeric(current[col], errors='coerce').fillna(0)
    current['BOWLING_POINTS'] = current['WICKETS'] * 10 + current['MAIDENS'] * 3 + current['5 WICKET HAUL'] * 10

    print("Scraping previous season stats")
    previous = scrape_playcricket_stats(tab="bowling", season_offset=1).fillna(0)
    previous['SEASON'] = 'previous'
    for col in ['WICKETS', 'MAIDENS', '5 WICKET HAUL']:
        previous[col] = pd.to_numeric(previous[col], errors='coerce').fillna(0)
    previous['BOWLING_POINTS'] = previous['WICKETS'] * 10 + previous['MAIDENS'] * 3 + previous['5 WICKET HAUL'] * 10    

    print("Bowling stats calculated.")
    return current, previous

def calculate_fielding_stats():
    print("Scraping current season...")
    current = scrape_playcricket_stats(tab="fielding", season_offset=0).fillna(0)
    current['SEASON'] = 'current'
    for col in ['WICKET KEEPING CATCHES', 'STUMPINGS', 'FIELDING CATCHES', 'RUN OUTS']:
        current[col] = pd.to_numeric(current[col], errors='coerce').fillna(0)
    current['FIELDING_POINTS'] = (current['WICKET KEEPING CATCHES'] * 2 + current['STUMPINGS'] * 5 + current['FIELDING CATCHES'] * 3 + current['RUN OUTS'] * 5)

    print("Scraping previous season stats")
    previous = scrape_playcricket_stats(tab="fielding", season_offset=1).fillna(0)
    previous['SEASON'] = 'previous'
    for col in ['WICKET KEEPING CATCHES', 'STUMPINGS', 'FIELDING CATCHES', 'RUN OUTS']:
        previous[col] = pd.to_numeric(previous[col], errors='coerce').fillna(0)
    previous['FIELDING_POINTS'] = (previous['WICKET KEEPING CATCHES'] * 2 + previous['STUMPINGS'] * 5 + previous['FIELDING CATCHES'] * 3 + previous['RUN OUTS'] * 5)

    print("Fielding stats calculated.")
    return current, previous

def merge_stats_dfs(current_bat_df, current_bowl_df, current_field_df,
                    prev_bat_df, prev_bowl_df, prev_field_df):
    # Merge current season
    current = current_bat_df.merge(current_bowl_df, on="PLAYER", how="outer")
    current = current.merge(current_field_df, on="PLAYER", how="outer")
    current = current.fillna(0)
    current.columns = ["PLAYER"] + [f"current_{col}" for col in current.columns if col != "PLAYER"]

    # Merge previous season
    previous = prev_bat_df.merge(prev_bowl_df, on="PLAYER", how="outer")
    previous = previous.merge(prev_field_df, on="PLAYER", how="outer")
    previous = previous.fillna(0)
    previous.columns = ["PLAYER"] + [f"previous_{col}" for col in previous.columns if col != "PLAYER"]

    # Combine current and previous into one row per player
    merged = current.merge(previous, on="PLAYER", how="outer")
    return merged.fillna(0)

def sanitize_column(col: str) -> str:
    sanitized = col.replace(" ", "_") \
                .replace("/", "_") \
                .replace("-", "_")
    # Keep only alphanumeric characters and underscores
    sanitized = ''.join(ch for ch in sanitized if ch.isalnum() or ch == '_')
    return sanitized

def compile_player_stats():
    print("Scraping batting stats...")
    current_bat_df, prev_bat_df = calculate_batting_stats()

    print("Scraping bowling stats...")
    current_bowl_df, prev_bowl_df = calculate_bowling_stats()

    print("Scraping fielding stats...")
    current_field_df, prev_field_df = calculate_fielding_stats()

    print("Merging stats...")
    merged_df = merge_stats_dfs(
        current_bat_df, current_bowl_df, current_field_df,
        prev_bat_df, prev_bowl_df, prev_field_df
    )

    merged_df["current_BATTING_POINTS"] = pd.to_numeric(merged_df.get("current_BATTING_POINTS", 0), errors='coerce').fillna(0)
    merged_df["previous_BATTING_POINTS"] = pd.to_numeric(merged_df.get("previous_BATTING_POINTS", 0), errors='coerce').fillna(0)

    merged_df["total_BATTING_POINTS"] = (
        merged_df["current_BATTING_POINTS"] + merged_df["previous_BATTING_POINTS"]
    )

    print("Calculating total points...")
    merged_df["current_TOTAL_POINTS"] = (
        merged_df.get("current_BATTING_POINTS", 0) +
        merged_df.get("current_BOWLING_POINTS", 0) +
        merged_df.get("current_FIELDING_POINTS", 0)
    )
    merged_df["previous_TOTAL_POINTS"] = (
        merged_df.get("previous_BATTING_POINTS", 0) +
        merged_df.get("previous_BOWLING_POINTS", 0) +
        merged_df.get("previous_FIELDING_POINTS", 0)
    )

    # Calculate the price of each player
    merged_df = calculatePrice(merged_df)

    # Rename all columns
    merged_df = merged_df.rename(columns={col: sanitize_column(col) for col in merged_df.columns})

    # Sort by total points
    merged_df = merged_df.sort_values(by="current_TOTAL_POINTS", ascending=False).reset_index(drop=True)

    # Assign an id to each player
    merged_df["id"] = merged_df.index

    # Export to JSON
    print("Exporting to JSON...")
    merged_df.to_json("./PlayerFullStats.json", orient="records", indent=2)
    print("All stats compiled and saved.")

if __name__ == "__main__":
    compile_player_stats()
