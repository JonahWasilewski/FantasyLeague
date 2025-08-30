require("dotenv").config();
const hre = require("hardhat");
const axios = require("axios");

const GIST_URL =
  "https://gist.githubusercontent.com/JonahWasilewski/c96c7d370fb63fc2ce273331555e2d47/raw/PlayerFullStats.json";

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// helper to wait for tx with timeout
async function waitForTx(tx, name, timeoutMs = 60000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Tx wait timeout")), timeoutMs)
  );
  return Promise.race([tx.wait(), timeout]).catch((err) => {
    throw new Error(`Tx failed for ${name}: ${err.message}`);
  });
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using wallet:", deployer.address);

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Missing CONTRACT_ADDRESS in .env file");
  }

  const FantasyLeague = await hre.ethers.getContractFactory("FantasyLeague");
  const contract = FantasyLeague.attach(contractAddress);

  console.log("Using contract at:", contract.target);

  const response = await axios.get(GIST_URL);
  const players = response.data;

  console.log(`Loading ${players.length} players...`);

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const name = player.PLAYER;
    const rawStats = JSON.stringify(player);
    const price = Number(player.price);

    console.log(`[${i}] Upserting: ${name} (price ${price})`);

    try {
      const tx = await contract.upsertPlayerRaw(name, rawStats, price, {
        gasLimit: 3_000_000,
      });
      console.log(
        `  tx sent: ${tx.hash} — waiting to be mined...`
      );

      await waitForTx(tx, name);
      console.log(`Upserted: ${name} (index ${i})`);

      // prevent rate limit and nonce issues
      await sleep(800);
    } catch (err) {
      console.error(`Failed: ${name} (index ${i}):`, err.message);
      // extra delay after a failure to avoid spamming
      await sleep(2000);
    }
  }

  console.log("🎉 All players attempted");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
