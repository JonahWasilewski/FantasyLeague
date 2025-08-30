const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const FantasyLeague = await ethers.getContractFactory("FantasyLeague");

  const entryFee = ethers.parseEther("0.01");
  const oracle = deployer.address;

  const fantasyLeague = await FantasyLeague.deploy(entryFee, oracle);
  await fantasyLeague.waitForDeployment();

  console.log("FantasyLeague deployed to:", fantasyLeague.target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
