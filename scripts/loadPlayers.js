require("dotenv").config();
const hre = require("hardhat");
const axios = require("axios");

const GIST_URL =
  "https://gist.githubusercontent.com/JonahWasilewski/c96c7d370fb63fc2ce273331555e2d47/raw/PlayerPoints.json";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using wallet:", deployer.address);

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Missing FANTASY_LEAGUE_ADDRESS in .env file");
  }

  const FantasyLeague = await hre.ethers.getContractFactory("FantasyLeague");
  const contract = FantasyLeague.attach(contractAddress);

  console.log("Using contract at:", contract.target);

  const response = await axios.get(GIST_URL);
  const players = response.data;

  for (const player of players) {
    const name     = player.PLAYER;
    const rawStats = JSON.stringify(player);
    const price    = Number(player.price);

    console.log(`Upserting: ${name} (price ${price})`);

    try {
        const tx = await contract.upsertPlayerRaw(
        name,
        rawStats,
        price
        );
        await tx.wait();
        console.log(`Upserted: ${name}`);
    } catch (err) {
        console.error(`Failed: ${name}:`, err.message);
    }
  }

  console.log("All players attempted");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
