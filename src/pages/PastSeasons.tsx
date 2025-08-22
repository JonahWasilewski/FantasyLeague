import React, { useEffect, useState } from 'react';
import { BrowserProvider, ethers } from 'ethers';
import { getFantasyLeagueContract } from '../utils/contract';
import './styles/pastSeasons.css';

// ID and Name info of players in a team
type Team = {
  playerIds: number[];
  playerNames: string[];
  submitted: boolean;
};

// Model for each participant in a given season
type ParticipantData = {
  address: string;
  team: Team;
  playerName: string;
  teamName: string;
  score?: number;
};

// All info to be displayed for each season
type SeasonData = {
  seasonNumber: number;
  participants: ParticipantData[];
  winner: string;
  prizePool: string; // formatted string in ETH
};

const PastSeasons: React.FC = () => {
  const [seasonData, setSeasonData] = useState<SeasonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeasons = async () => {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const contract = getFantasyLeagueContract(provider);

        // Convert currentSeason to a number safely
        const currentSeasonRaw: any = await contract.currentSeason();
        const currentSeason = Number(currentSeasonRaw ?? 0);

        const pastSeasons: SeasonData[] = [];
        const playerNameCache: { [id: number]: string } = {};
        const playerStatsCache: { [id: number]: number } = {};

        const getPlayerName = async (id: number) => {
          if (playerNameCache[id]) return playerNameCache[id];
          try {
            const player = await contract.players(id);
            const name = player.name;
            playerNameCache[id] = name || `Player #${id}`;
            return playerNameCache[id];
          } catch {
            return `Player #${id}`;
          }
        };

        const getPlayerPoints = async (id: number) => {
          if (playerStatsCache[id] !== undefined) return playerStatsCache[id];
          try {
            const player = await contract.players(id);
            let stats: any = {};
            if (
              typeof player.rawStats === 'string' &&
              player.rawStats.trim() !== '' &&
              player.rawStats.trim().toLowerCase() !== 'undefined'
            ) {
              try {
                stats = JSON.parse(player.rawStats);
              } catch {
                stats = {};
              }
            }
            const points = Number(stats?.current_TOTAL_POINTS ?? 0);
            playerStatsCache[id] = isNaN(points) ? 0 : points;
            return playerStatsCache[id];
          } catch {
            return 0;
          }
        };

        for (let season = 1; season < currentSeason; season++) {
          const participants: string[] = await contract.getPastParticipants(season);
          const participantData: ParticipantData[] = [];

          // Gather participant info and calculate total points (doubling captain)
          for (const user of participants) {
            // getPastTeam returns (playerIds, submitted, captain)
            const [playerIdsRaw, submitted, captainRaw]: [ethers.BigNumberish[], boolean, any] =
              await contract.getPastTeam(season, user);

            if (!submitted) continue;

            const playerIds = playerIdsRaw.map((id) => Number(id));
            const captainId = Number(captainRaw ?? 0);

            // fetch names & points in parallel
            const playerNames = await Promise.all(playerIds.map((id) => getPlayerName(id)));
            const playerPointsArr = await Promise.all(playerIds.map((id) => getPlayerPoints(id)));

            // build playerNames with (C) for captain
            const playerNamesWithCaptain = playerNames.map((name, idx) =>
              playerIds[idx] === captainId ? `${name} (C)` : name
            );

            // sum points, doubling captain's total points only
            let totalPoints = 0;
            for (let i = 0; i < playerIds.length; i++) {
              const id = playerIds[i];
              const pts = playerPointsArr[i] ?? 0;
              totalPoints += id === captainId ? pts * 2 : pts;
            }

            const playerName: string = await contract.getPastPlayerNames(season, user);
            const teamName: string = await contract.getPastTeamName(season, user);

            participantData.push({
              address: user,
              team: { playerIds, playerNames: playerNamesWithCaptain, submitted },
              playerName,
              teamName,
              score: totalPoints,
            } as ParticipantData);
          }

          // Sort descending by score and pick top 5 (or all if <5)
          participantData.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          const topParticipants = participantData.slice(0, 5);

          const winnerAddress: string = await contract.getPastWinner(season);
          const prizePoolWei: any = await contract.getPastPrizePool(season);
          const prizePoolEth: string = ethers.formatEther(prizePoolWei);

          // Find winner info (best effort)
          const winnerData = topParticipants.find(
            (p) => p.address.toLowerCase() === winnerAddress.toLowerCase()
          );
          const winnerDisplay = winnerData
            ? `${winnerData.playerName} (${winnerData.teamName})`
            : winnerAddress;

          pastSeasons.push({
            seasonNumber: season,
            participants: topParticipants,
            winner: winnerDisplay,
            prizePool: prizePoolEth,
          });
        }

        setSeasonData(pastSeasons);
      } catch (error) {
        console.error('Error loading past seasons:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeasons();
  }, []);

  return (
    <div className="past-seasons-container">
      <h1>📜 Past Fantasy League Seasons</h1>
      {loading ? (
        <p>Loading past season data...</p>
      ) : seasonData.length === 0 ? (
        <p>No past seasons found.</p>
      ) : (
        seasonData.map((season) => (
          <div key={season.seasonNumber} className="season-block">
            <h2>Season {season.seasonNumber}</h2>
            {season.participants.map((p) => (
              <div key={p.address} className="participant-card">
                <p><strong>Player Name:</strong> {p.playerName}</p>
                <p><strong>Team Name:</strong> {p.teamName}</p>
                <p><strong>Players:</strong> {p.team.playerNames.join(', ')}</p>
                <p><strong>Score:</strong> {(p as any).score ?? 0}</p>
              </div>
            ))}
            <div className="season-summary">
              <p><strong>🏆 Winner:</strong> {season.winner}</p>
              <p><strong>💰 Prize Pool:</strong> {season.prizePool} ETH</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PastSeasons;
