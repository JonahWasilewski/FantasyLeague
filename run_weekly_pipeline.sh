#!/bin/bash

echo "Starting weekly fantasy stats pipeline..."
cd "C:/Users/jonah/Documents/Manchester Uni/SummerProject"

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Step 1: Run Python scraper
echo "Running Python scraper..."
source venv/Scripts/activate  # activate virtual env
python Web_Scraping/PointsCalculation.py

# Step 2: Update GitHub Gist
echo "Updating GitHub Gist..."
python update_gist.py

deactivate

# Step 3: Upload to smart contract
echo "Uploading data to smart contract..."
npx hardhat run C:/Users/jonah/Documents/Manchester\ Uni/SummerProject/chainlink-functions/fantasy-league-frontend-v2/scripts/loadPlayers.js --network sepolia

echo "Weekly pipeline completed."
