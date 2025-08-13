import React, { useEffect, useState } from 'react'
import { BrowserProvider, ethers } from 'ethers'
import { getFantasyLeagueContract } from '../utils/contract'

// Structure of data to put in the leaderboard (from various functions)
interface TeamData {
  address: string
  playerIds: number[]
  score: number
  userName: string
  teamName: string
}

const Leaderboard: React.FC = () => {
  const [teams, setTeams] = useState<TeamData[]>([])
  const [loading, setLoading] = useState(true)
  const [prizePool, setPrizePool] = useState<string | null>(null)
  const [ethToGbp, setEthToGbp] = useState<number | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const provider = new BrowserProvider(window.ethereum)
        const contract = getFantasyLeagueContract(provider)

        // Fetch prize pool from contract
        const pool = await contract.getPrizePool()
        const formattedPool = ethers.formatEther(pool)
        setPrizePool(formattedPool)

        // Fetch ETH to GBP conversion rate
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=gbp')
        const data = await res.json()
        setEthToGbp(data.ethereum.gbp)

        const participants: string[] = await contract.getParticipants()
        const leaderboard: TeamData[] = []    // Initially empty list of TeamData's

        // Get team data for each participant
        for (const addr of participants) {
          const [playerIds, submitted, fetchedUserName, fetchedTeamName] = await contract.getUserTeam(addr)
          if (!submitted) continue

          // Get player IDs from the mapping 
          const numericIds = playerIds.map((id) => Number(id))

        let totalPoints = 0

        // Parse the stats of each player to convert to JSON format (originally stored as a string in the contract)
        for (const id of numericIds) {
          const stats = await contract.players(id)

          let parsedStats = null
          try {
            parsedStats = JSON.parse(stats.rawStats)
          } catch (err) {
            console.warn(`Failed to parse rawStats for player ${id}`, err)
            continue
          }

          const playerPoints = Number(parsedStats?.current_TOTAL_POINTS ?? 0)
          totalPoints += isNaN(playerPoints) ? 0 : playerPoints
        }

          leaderboard.push({
            address: addr,
            playerIds: numericIds,
            score: totalPoints,
            userName: fetchedUserName,
            teamName: fetchedTeamName,
          })
        }

        // Sort descending by score
        leaderboard.sort((a, b) => b.score - a.score)

        setTeams(leaderboard)
        setLoading(false)
      } catch (err) {
        console.error('Error loading leaderboard:', err)
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  // Let the user know that leaderboard data is being fetched/compiled
  if (loading) return <p>Loading leaderboard...</p>

  // Round price to pence
  const prizeInGbp =
    prizePool && ethToGbp ? (parseFloat(prizePool) * ethToGbp).toFixed(2) : null

  return (
    <div style={{ padding: '20px' }}>
      <h2>🏆 League Leaderboard</h2>

      {prizePool && (
        <p style={{ fontSize: '18px', marginBottom: '20px' }}>
          💰 <strong>Total Prize Pool:</strong> {prizePool} ETH
          {prizeInGbp && (
            <span style={{ marginLeft: '10px', color: '#555' }}>
              (~£{prizeInGbp} GBP)
            </span>
          )}
        </p>
      )}

      {teams.length === 0 ? (
        <p>No submitted teams found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>#</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Team Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Username</th>
            <th style={{ textAlign: 'center', borderBottom: '1px solid #ccc' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.address}>
              <td>{index + 1}</td>
              <td>{team.teamName}</td>
              <td>{team.userName}</td>
              <td style={{ textAlign: 'center' }}>{team.score}</td>
            </tr>
          ))}
        </tbody>
        </table>
      )}
    </div>
  )
}

export default Leaderboard
