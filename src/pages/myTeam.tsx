import React, { useEffect, useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import { getFantasyLeagueContract } from "../utils/contract";
import "./styles/myTeam.css";
import PlayerModal from "../components/PlayerModal";

type Player = {
  id: number;
  name: string;
  parsedStats: { [key: string]: string | number };
  isCaptain?: boolean;
  displayPoints?: {
    total: number;
    batting: number;
    bowling: number;
    fielding: number;
  };
};

const MyTeam: React.FC = () => {
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [statView, setStatView] = useState<'current' | 'previous'>('current');

  useEffect(() => {
    async function loadTeam() {
      if (!window.ethereum) return alert("Ethereum wallet not detected.");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      const contract = getFantasyLeagueContract(signer);
      // getUserTeam returns: (playerIds, submitted, playerName, teamName, userRank, captain)
      const [
        fetchedPlayerIds,
        submitted,
        fetchedUserName,
        fetchedTeamName,
        _userRank,
        fetchedCaptainId
      ] = await contract.getUserTeam(address);

      if (!submitted || fetchedPlayerIds.length === 0) {
        alert("You haven't submitted a team yet. Redirecting to selection.");
        window.location.href = "/select";
        return;
      }

      const playerIds = fetchedPlayerIds.map((id: ethers.BigNumberish) => Number(id));
      const captainId = Number(fetchedCaptainId ?? 0);

      let teamTotal = 0;

      const toNumber = (v: any) => {
        const n = Number(v ?? 0);
        return isNaN(n) ? 0 : n;
      };

      const statsPromises = playerIds.map(async (id) => {
        const playerData = await contract.players(id);
        let parsedStats: { [key: string]: any } = {};

        if (
          typeof playerData.rawStats === "string" &&
          playerData.rawStats.trim() !== "" &&
          playerData.rawStats.trim().toLowerCase() !== "undefined"
        ) {
          try {
            parsedStats = JSON.parse(playerData.rawStats);
          } catch (e) {
            console.warn(`Could not parse rawStats for player ${playerData.id}`, e);
          }
        }

        // Read base numeric points from parsedStats (safe conversion)
        const baseTotal = toNumber(parsedStats?.current_TOTAL_POINTS ?? 0);
        const baseBatting = toNumber(parsedStats?.current_BATTING_POINTS ?? 0);
        const baseBowling = toNumber(parsedStats?.current_BOWLING_POINTS ?? 0);
        const baseFielding = toNumber(parsedStats?.current_FIELDING_POINTS ?? 0);

        const isCaptain = Number(playerData.id) === captainId;

        // Double only the player's TOTAL points for captain; leave component breakdowns as-is
        // (If you want to double components instead, change the logic here.)
        const displayTotal = isCaptain ? baseTotal * 2 : baseTotal;

        teamTotal += displayTotal;

        return {
          id: Number(playerData.id),
          name: playerData.name,
          parsedStats,
          isCaptain,
          displayPoints: {
            total: displayTotal,
            batting: baseBatting,
            bowling: baseBowling,
            fielding: baseFielding,
          },
        } as Player;
      });

      const statsData = await Promise.all(statsPromises);
      setTeamPlayers(statsData);
      setUserName(fetchedUserName);
      setTeamName(fetchedTeamName);
      setTotalPoints(teamTotal);
      setLoading(false);
    }

    loadTeam();
  }, []);

  if (loading) return <p style={{ textAlign: "center" }}>Loading your team...</p>;

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h2>My Fantasy Team</h2>
      <p>
        <strong>Username:</strong> {userName} •{" "}
        <strong>Team Name:</strong> {teamName} •{" "}
        <strong>Total Points:</strong> {totalPoints}
      </p>

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
                {player.name} {player.isCaptain ? <strong>(C)</strong> : null}
              </td>
              <td>{player.displayPoints?.total ?? 0}</td>
              <td>{player.displayPoints?.batting ?? 0}</td>
              <td>{player.displayPoints?.bowling ?? 0}</td>
              <td>{player.displayPoints?.fielding ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
