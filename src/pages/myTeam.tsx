import React, { useEffect, useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import { getFantasyLeagueContract } from "../utils/contract";
import "./styles/myTeam.css";
import PlayerModal from "../components/PlayerModal";

type Player = {
  id: number;
  name: string; 
  parsedStats: { [key: string]: string | number };
};


const MyTeam: React.FC = () => {
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [statView, setStatView] = useState<'current' | 'previous'>('current')

  useEffect(() => {
    async function loadTeam() {
      if (!window.ethereum) return alert("Ethereum wallet not detected.");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      const contract = getFantasyLeagueContract(signer);
      const [fetchedPlayerIds, submitted, fetchedUserName, fetchedTeamName] =
        await contract.getUserTeam(address);

      if (!submitted || fetchedPlayerIds.length === 0) {
        alert("You haven't submitted a team yet. Redirecting to selection.");
        window.location.href = "/select";
        return;
      }

      const playerIds = fetchedPlayerIds.map((id: ethers.BigNumberish) => Number(id));

      const statsPromises = playerIds.map(async (id) => {
        const playerData = await contract.players(id);
        let parsedStats = {};

        // Check rawStats is a non-empty string AND not the literal string "undefined"
        if (
          typeof playerData.rawStats === 'string' &&
          playerData.rawStats.trim() !== '' &&
          playerData.rawStats.trim().toLowerCase() !== 'undefined'
        ) {
          try {
            parsedStats = JSON.parse(playerData.rawStats);
          } catch (e) {
            console.warn(`Could not parse rawStats for player ${playerData.id}`, e);
          }
        } else {
          console.warn(`Invalid or missing rawStats for player ${playerData.id}`);
        }

        return {
          id: Number(playerData.id),
          name: playerData.name,
          parsedStats,
        };
      });

      const statsData = await Promise.all(statsPromises);
      setTeamPlayers(statsData);
      setUserName(fetchedUserName);
      setTeamName(fetchedTeamName);
      setLoading(false);
    }

    loadTeam();
  }, []);

  if (loading) return <p style={{ textAlign: "center" }}>Loading your team...</p>;

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h2>My Fantasy Team</h2>
      <p><strong>Wallet:</strong> {walletAddress}</p>
      <p><strong>Username:</strong> {userName}</p>
      <p><strong>Team Name:</strong> {teamName}</p>

      <table
        className="table"
        style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th rowSpan={2}>#</th>
            <th rowSpan={2}>Player</th>
            <th colSpan={4} style={{ textAlign: "center" }}>Points</th>
          </tr>
          <tr>
            <th>Total</th>
            <th>Batting</th>
            <th>Bowling</th>
            <th>Fielding</th>
          </tr>
        </thead>
        <tbody>
          {teamPlayers.map((player, idx) => (
            <tr key={player.id}>
              <td>{idx + 1}</td>
              <td
                style={{ color: "blue", cursor: "pointer" }}
                onClick={() => setSelectedPlayer(player)}
              >
                {player.name}
              </td>
              <td>{player.parsedStats.current_TOTAL_POINTS}</td>
              <td>{player.parsedStats.current_BATTING_POINTS}</td>
              <td>{player.parsedStats.current_BOWLING_POINTS}</td>
              <td>{player.parsedStats.current_FIELDING_POINTS}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => (window.location.href = "/select")} style={{ marginTop: "2rem" }}>
        Back to Team Selection
      </button>

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          statView={statView}
          setStatView={setStatView}
        />
      )}
    </div>
  );
};

export default MyTeam;
