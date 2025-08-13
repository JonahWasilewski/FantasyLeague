import React, { useEffect, useState } from 'react';
import { BrowserProvider, ethers } from 'ethers';
import { getFantasyLeagueContract } from '../utils/contract';
import './styles/pastSeasons.css';

type Team = {
  playerIds: number[];
  playerNames: string[];
  submitted: boolean;
};

type ParticipantData = {
  address: string;
  team: Team;
  playerName: string;
  teamName: string;
};

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
        const provider = new BrowserProvider(window.ethereum);
        const contract = getFantasyLeagueContract(provider);
        const currentSeason = await contract.currentSeason();
        const pastSeasons: SeasonData[] = [];
        const playerNameCache: { [id: number]: string } = {};

        const getPlayerName = async (id: number, contract: any): Promise<string> => {
        if (playerNameCache[id]) return playerNameCache[id];

        try {
            const player = await contract.players(id); // ⬅️ Direct access to public mapping
            const name = player.name;
            playerNameCache[id] = name;
            return name || `Player #${id}`;
        } catch (err) {
            console.error(`Failed to fetch player with ID ${id}`, err);
            return `Player #${id}`;
        }
        };

        for (let season = 1; season < currentSeason; season++) {
            const participants: string[] = await contract.getPastParticipants(season);
            const participantData: ParticipantData[] = [];

            for (const user of participants) {
                const [playerIdsRaw, submitted]: [ethers.BigNumberish[], boolean] = await contract.getPastTeam(season, user);
                const playerIds = playerIdsRaw.map((id) => Number(id));
                const playerNames = await Promise.all(playerIds.map((id) => getPlayerName(id, contract)));

                const playerName: string = await contract.getPastPlayerNames(season, user);
                const teamName: string = await contract.getPastTeamName(season, user);

                participantData.push({
                    address: user,
                    team: {
                    playerIds,
                    playerNames,
                    submitted,
                    },
                    playerName,
                    teamName,
                });
            }

        const winner = await contract.getPastWinner(season);
        const prizePool = await contract.getPastPrizePool(season);

        pastSeasons.push({
            seasonNumber: season,
            participants: participantData,
            winner,
            prizePool,
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
              </div>
            ))}
            <div className="season-summary">
              <p><strong>🏆 Winner:</strong> {season.winner}</p>
              <p><strong>💰 Prize Pool:</strong> {season.prizePool} WEI</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PastSeasons;
