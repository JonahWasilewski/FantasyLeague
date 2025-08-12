def calculatePrice(merged_df):
    MIN_PRICE = 3_000_000
    MAX_PRICE = 15_000_000
    CURRENT_WEIGHT = 0.7
    PREVIOUS_WEIGHT = 0.3

    # Step 1: Compute weighted points
    merged_df["weighted_points"] = (
        CURRENT_WEIGHT * merged_df["current_TOTAL_POINTS"] +
        PREVIOUS_WEIGHT * merged_df["previous_TOTAL_POINTS"]
    )

    # Step 2: Normalize weighted points
    min_pts = merged_df["weighted_points"].min()
    max_pts = merged_df["weighted_points"].max()

    if min_pts == max_pts:
        merged_df["price"] = MIN_PRICE
    else:
        normalized = (merged_df["weighted_points"] - min_pts) / (max_pts - min_pts)
        adjusted = normalized ** 0.4 
        merged_df["price"] = (MIN_PRICE + adjusted * (MAX_PRICE - MIN_PRICE)).round()

    print("Prices successfully calculated.")
    return merged_df