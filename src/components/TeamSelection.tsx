import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrowserProvider } from 'ethers'
import { getFantasyLeagueContract } from '../utils/contract'
import { ethers } from 'ethers'
import PlayerModal from "../components/PlayerModal";

// Player data structure - Returned by the contract
interface PlayerFromContract {
  id: bigint
  name: string
  price: bigint
  rawStats: string
}

// Handle raw stats and calculated fields for UI
interface Player extends PlayerFromContract {
  parsedStats: { [key: string]: string | number }
  selectionPercentage: number
}

// Triggered when a team is submitted
interface Props {
  onTeamSubmit: () => void
}

const TeamSelection: React.FC<Props> = ({ onTeamSubmit }) => {
  const navigate = useNavigate()

  // State management
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState<keyof Player | 'PRICE'>('current_TOTAL_POINTS')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [statView, setStatView] = useState<'current' | 'previous'>('current')
  const [players, setPlayers] = useState<Player[]>([])

  const playersPerPage = 10

  const sortedPlayers = [...players].sort((a, b) => {
    const valA = sortKey === 'PRICE' ? Number(a.price) : Number(a.parsedStats[sortKey] || 0)
    const valB = sortKey === 'PRICE' ? Number(b.price) : Number(b.parsedStats[sortKey] || 0)
    return sortAsc ? valA - valB : valB - valA
  })

  const paginatedPlayers = sortedPlayers.slice(
    (currentPage - 1) * playersPerPage,
    currentPage * playersPerPage
  )

  const totalPages = Math.ceil(players.length / playersPerPage)

  const handleSort = (key: keyof Player | 'PRICE') => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  // States for the selected team
  const [mainPlayers, setMainPlayers] = useState<Player[]>([])
  const [reservePlayer, setReservePlayer] = useState<Player | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [loading, setLoading] = useState(false)

  const maxTeamSize = 11
  const teamBudget = 100_000_000

  // Fetch players and wallet from contract
  useEffect(() => {
    async function fetchWallet() {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' })
        const address = accounts[0]
        setWalletAddress(address)

        // Reset team when new account is used
        setMainPlayers([])
        setReservePlayer(null)
        localStorage.removeItem(`team-${address}`)
      }
    }

    async function loadPlayersFromContract() {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const contract = getFantasyLeagueContract(provider);

        const playerIds = await contract.getPlayerIds();

        const allPlayers: Player[] = await Promise.all(
          playerIds.map(async (id: bigint) => {
            const player = await contract.players(id);
            const parsedStats = JSON.parse(player.rawStats);

            // Fetch percentage (scaled by 1e18 in contract)
            const percentageScaled = await contract.getPlayerSelectionPercentage(id);
            const percentage = Number(percentageScaled) / 1e16;         // Scale

            return {
              id: player.id,
              name: player.name,
              price: player.price,
              rawStats: player.rawStats,
              parsedStats,
              selectionPercentage: percentage // store as %
            };
          })
        );

        setPlayers(allPlayers);
      } catch (err) {
        console.error("Failed to load players:", err);
      }
    }

    loadPlayersFromContract()
    fetchWallet()
  }, [])

  const teamPrice = Number([...mainPlayers, ...(reservePlayer ? [reservePlayer] : [])].reduce(
    (sum, p) => sum + p.price,
    0n
  ))

  // Add/Remove highlighted players
  const togglePlayer = (player: Player) => {
    const isMain = mainPlayers.some(p => p.id === player.id)
    const isReserve = reservePlayer?.id === player.id

    if (isMain) {
      setMainPlayers(mainPlayers.filter(p => p.id !== player.id))
      return
    }
    if (isReserve) {
      setReservePlayer(null)
      return
    }

    if (mainPlayers.length < maxTeamSize) {
      setMainPlayers([...mainPlayers, player])
    } else if (!reservePlayer) {
      setReservePlayer(player)
    } else {
      alert("You can only choose up to 12 players.")
    }
  }

  // Row background for selected players
  const getRowStyle = (player: Player): React.CSSProperties => {
    if (mainPlayers.some(p => p.id === player.id)) return { backgroundColor: '#d0f0c0' }
    if (reservePlayer?.id === player.id) return { backgroundColor: '#cce5ff' }
    return {}
  }

  const handleSubmitTeam = async () => {
    const totalSelected = mainPlayers.length + (reservePlayer ? 1 : 0)
    if (totalSelected !== 12) return alert("Select 11 main + 1 reserve player.")
    if (teamPrice > teamBudget) return alert("Budget exceeded.")
    if (!walletAddress) return alert("Connect wallet.")
    if (!userName || !teamName) return alert("Enter name and team.")

    const selectedIds = [...mainPlayers.map(p => p.id), reservePlayer!.id]

    try {
      setLoading(true)
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getFantasyLeagueContract(signer)
      const userAddress = await signer.getAddress()
      const alreadyJoined = await contract.hasJoined(userAddress)
      const entryFee = await contract.entryFee()

      // Check for address already in the league, and pay entry fee if not
      if (!alreadyJoined) {
        const confirmJoin = window.confirm(
          `You haven't paid the entry fee yet. Entry fee is ${ethers.formatEther(entryFee)} ETH. Proceed?`
        )
        if (!confirmJoin) return
        const joinTx = await contract.joinLeague({ value: entryFee })
        await joinTx.wait()
      }

      // Submit team and user info to contract
      const tx = await contract.submitTeam(
        selectedIds.map(id => BigInt(id)),
        userName,
        teamName
      )
      await tx.wait()

      // Team stored in local storage to improve retrieval time (and lower query costs) when loading team on next page
      localStorage.setItem(
        `team-${userAddress}`,
        JSON.stringify({
          main: mainPlayers.map(p => ({ ...p, id: p.id.toString(), price: p.price.toString() })),
          reserve: reservePlayer ? { ...reservePlayer, id: reservePlayer.id.toString(), price: reservePlayer.price.toString() } : null,
        })
      )
      alert("Team submitted successfully!")
      onTeamSubmit()
      navigate('/myteam')
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Submission failed.")
    } finally {
      setLoading(false)
    }
  }


  // Render the UI
  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              border: '4px solid rgba(255,255,255,0.2)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              width: '40px', height: '40px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <div>Processing transaction...</div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: '1rem' }}>Select Your Fantasy Team</h2>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Player Name"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          style={{ flex: 1, padding: '10px' }}
        />
        <input
          type="text"
          placeholder="Team Name"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          style={{ flex: 1, padding: '10px' }}
        />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Player</th>
            <th style={thStyle} onClick={() => handleSort('current_TOTAL_POINTS')}>Total</th>
            <th style={thStyle} onClick={() => handleSort('current_BATTING_POINTS')}>Batting</th>
            <th style={thStyle} onClick={() => handleSort('current_BOWLING_POINTS')}>Bowling</th>
            <th style={thStyle} onClick={() => handleSort('current_FIELDING_POINTS')}>Fielding</th>
            <th style={thStyle}>Selection %</th>
            <th style={thStyle} onClick={() => handleSort('PRICE')}>Price (£M)</th>
          </tr>
        </thead>
        <tbody>
          {paginatedPlayers.map((player, idx) => (
            <tr
              key={player.id}
              onClick={() => togglePlayer(player)}
              style={{ cursor: 'pointer', ...getRowStyle(player) }}
            >
              <td style={tdStyle}>{(currentPage - 1) * playersPerPage + idx + 1}</td>
              <td style={{ ...tdStyle, color: 'blue' }} onClick={() => setSelectedPlayer(player)}>
                {player.name}
              </td>
              <td style={tdStyle}>{player.parsedStats['current_TOTAL_POINTS']}</td>
              <td style={tdStyle}>{player.parsedStats['current_BATTING_POINTS']}</td>
              <td style={tdStyle}>{player.parsedStats['current_BOWLING_POINTS']}</td>
              <td style={tdStyle}>{player.parsedStats['current_FIELDING_POINTS']}</td>
              <td style={tdStyle}>
                {player.selectionPercentage.toFixed(2)}%
              </td>
              <td style={tdStyle}>
                {(Number(player.price) / 1_000_000).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem' }}>
        <strong>Main Players:</strong> {mainPlayers.length} / 11 &nbsp; | &nbsp;
        <strong>Reserve:</strong> {reservePlayer ? "✓" : "✗"} &nbsp; | &nbsp;
        <strong>Total Price:</strong> £{(teamPrice / 1_000_000).toFixed(2)}M / £100M
      </div>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            style={{
              margin: '0 5px',
              padding: '5px 10px',
              backgroundColor: currentPage === i + 1 ? '#aaa' : '#eee',
              border: '1px solid #999',
              cursor: 'pointer'
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmitTeam}
        disabled={mainPlayers.length !== 11 || !reservePlayer}
        style={{
          marginTop: '1.5rem',
          padding: '12px 24px',
          backgroundColor: mainPlayers.length === 11 && reservePlayer ? '#007bff' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: mainPlayers.length === 11 && reservePlayer ? 'pointer' : 'not-allowed'
        }}
      >
        Submit Team
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
  )
}

export default TeamSelection

const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  backgroundColor: '#f0f0f0',
  cursor: 'pointer',
  borderBottom: '2px solid #ccc'
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '1px solid #ddd',
  textAlign: 'center'
}
