import pandas as pd
from PlayCricketScraping import scrape_playcricket_stats

def calculate_batting_points():
    print("Scraping batting stats...")
    df = scrape_playcricket_stats(tab="batting").fillna(0)

    for col in ['RUNS', '50s', '100s']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    df['BATTING_POINTS'] = df['RUNS'] + df['50s'] * 10 + df['100s'] * 20

    print("Batting stats successfully scraped.")
    return df[['PLAYER', 'BATTING_POINTS']]

def calculate_bowling_points():
    print("Scraping bowling stats...")
    df = scrape_playcricket_stats(tab="bowling").fillna(0)

    for col in ['WICKETS', 'MAIDENS', '5 WICKET HAUL']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    df['BOWLING_POINTS'] = df['WICKETS'] * 10 + df['MAIDENS'] * 3 + df['5 WICKET HAUL'] * 10

    print("Bowling stats successfully scraped.")
    return df[['PLAYER', 'BOWLING_POINTS']]

def calculate_fielding_points():
    print("Scraping fielding stats...")
    df = scrape_playcricket_stats(tab="fielding").fillna(0)

    for col in ['WICKET KEEPING CATCHES', 'STUMPINGS', 'FIELDING CATCHES', 'RUN OUTS']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    df['FIELDING_POINTS'] = (
        df['WICKET KEEPING CATCHES'] * 2 +
        df['STUMPINGS'] * 5 +
        df['FIELDING CATCHES'] * 3 +
        df['RUN OUTS'] * 5
    )

    print("Fielding stats successfully scraped.")
    return df[['PLAYER', 'FIELDING_POINTS']]


def calculate_total_points(output_csv='PlayerPoints.csv'):
    batting_df = calculate_batting_points()
    bowling_df = calculate_bowling_points()
    fielding_df = calculate_fielding_points()

    total_df = pd.merge(batting_df, bowling_df, on='PLAYER', how='outer').fillna(0)
    total_df = pd.merge(total_df, fielding_df, on='PLAYER', how='outer').fillna(0)

    total_df['TOTAL_POINTS'] = total_df['BATTING_POINTS'] + total_df['BOWLING_POINTS'] + total_df['FIELDING_POINTS']
    total_df = total_df.sort_values(by='TOTAL_POINTS', ascending=False)

    total_df.to_csv(output_csv, index=False)
    total_df.to_json('PlayerPoints.json', orient='records')
    print(f'Total points saved to {output_csv}')

if __name__ == "__main__":
    calculate_total_points()