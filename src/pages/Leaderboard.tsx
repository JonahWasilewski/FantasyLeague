import React, { useEffect, useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import { getFantasyLeagueContract } from "../utils/contract";
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

type LeaderboardEntry = {
  address: string;
  username: string;
  teamName: string;
  totalPoints: number;
};

const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [statView, setStatView] = useState<"current" | "previous">("current");

  useEffect(() => {
    async function loadLeaderboard() {
      if (!window.ethereum) return;

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getFantasyLeagueContract(signer);

      // Fetch participants (addresses)
      const participants: string[] = await contract.getParticipants();
      const entries: LeaderboardEntry[] = [];

      // Helper to safely convert to number
      const toNumber = (v: any) => {
        const n = Number(v ?? 0);
        return isNaN(n) ? 0 : n;
      };

      for (const address of participants) {
        // getUserTeam returns: (playerIds, submitted, playerName, teamName, userRank, captain)
        const [ids, submitted, username, teamName, _rank, captainIdRaw] = await contract.getUserTeam(address);

        if (!submitted || ids.length === 0) continue;

        const captainId = Number(captainIdRaw ?? 0);

        let teamTotal = 0;
        for (const id of ids) {
          // id may be BigNumber or number
          const numericId = Number(id);
          const playerData = await contract.players(numericId);

          // Parse rawStats safely
          let parsedStats: { [key: string]: any } = {};
          if (
            typeof playerData.rawStats === "string" &&
            playerData.rawStats.trim() !== "" &&
            playerData.rawStats.trim().toLowerCase() !== "undefined"
          ) {
            try {
              parsedStats = JSON.parse(playerData.rawStats);
            } catch (e) {
              parsedStats = {};
            }
          }

          const baseTotal = toNumber(parsedStats?.current_TOTAL_POINTS ?? 0);

          // Double captain total points
          const displayTotal = numericId === captainId ? baseTotal * 2 : baseTotal;

          teamTotal += displayTotal;
        }

        entries.push({
          address,
          username,
          teamName,
          totalPoints: teamTotal,
        });
      }

      // Sort descending
      entries.sort((a, b) => b.totalPoints - a.totalPoints);
      setLeaderboard(entries);
      setLoading(false);
    }

    loadLeaderboard();
  }, []);

  const handleRowClick = async (entry: LeaderboardEntry) => {
    if (!window.ethereum) return;
    setSelectedUser(entry);

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = getFantasyLeagueContract(signer);

    // getUserTeam returns: (playerIds, submitted, playerName, teamName, userRank, captain)
    const [ids, submitted, username, teamName, _rank, captainIdRaw] = await contract.getUserTeam(entry.address);
    const captainId = Number(captainIdRaw ?? 0);

    const toNumber = (v: any) => {
      const n = Number(v ?? 0);
      return isNaN(n) ? 0 : n;
    };

    const teamPromises = ids.map(async (id: ethers.BigNumberish) => {
      const numericId = Number(id);
      const playerData = await contract.players(numericId);
      let parsedStats: { [key: string]: any } = {};

      if (
        typeof playerData.rawStats === "string" &&
        playerData.rawStats.trim() !== "" &&
        playerData.rawStats.trim().toLowerCase() !== "undefined"
      ) {
        try {
          parsedStats = JSON.parse(playerData.rawStats);
        } catch {
          parsedStats = {};
        }
      }

      const baseTotal = toNumber(parsedStats?.current_TOTAL_POINTS ?? 0);
      const baseBatting = toNumber(parsedStats?.current_BATTING_POINTS ?? 0);
      const baseBowling = toNumber(parsedStats?.current_BOWLING_POINTS ?? 0);
      const baseFielding = toNumber(parsedStats?.current_FIELDING_POINTS ?? 0);

      const isCaptain = numericId === captainId;
      const displayTotal = isCaptain ? baseTotal * 2 : baseTotal;

      return {
        id: Number(playerData.id),
        name: playerData.name,
        parsedStats: parsedStats || {},
        isCaptain,
        displayPoints: {
          total: displayTotal,
          batting: baseBatting,
          bowling: baseBowling,
          fielding: baseFielding,
        },
      } as Player;
    });

    const team = await Promise.all(teamPromises);
    setSelectedTeam(team);
  };

  if (loading) return <p>Loading leaderboard...</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Leaderboard</h2>
      <table className="table" style={{ width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>Team</th>
            <th>Total Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, idx) => (
            <tr
              key={entry.address}
              onClick={() => handleRowClick(entry)}
              style={{
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              title="Click to view this player's team"
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f0f8ff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "")
              }
            >
              <td><strong>{idx + 1}</strong></td>
              <td>{entry.username}</td>
              <td>{entry.teamName}</td>
              <td>{entry.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && selectedTeam.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>
            {selectedUser.username}'s Team ({selectedUser.teamName}) –{" "}
            {selectedUser.totalPoints} pts
          </h3>
          <table className="table" style={{ width: "100%", marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Total</th>
                <th>Batting</th>
                <th>Bowling</th>
                <th>Fielding</th>
              </tr>
            </thead>
            <tbody>
              {selectedTeam.map((player, idx) => (
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
        </div>
      )}

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

export default Leaderboard;
