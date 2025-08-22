import { ethers } from 'ethers';
import { fantasyLeagueABI } from '../abi/FantasyLeagueABI.js';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Load the contract from the ABI
export function getFantasyLeagueContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS is not set in your .env file");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, fantasyLeagueABI, signerOrProvider);
}