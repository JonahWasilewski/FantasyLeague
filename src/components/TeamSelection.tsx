import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrowserProvider } from 'ethers'
import { getFantasyLeagueContract } from '../utils/contract'
import { ethers } from 'ethers'
import PlayerModal from "../components/PlayerModal";
import MetaMaskInfoModal from "../components/MetaMaskInfoModal";
import ErrorModal from "../components/ErrorModal";
import Navbar from './Navbar'

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
  const [captain, setCaptain] = useState<Player | null>(null)
  const [statView, setStatView] = useState<'current' | 'previous'>('current')
  const [players, setPlayers] = useState<Player[]>([])
  const [showMetaMaskModal, setShowMetaMaskModal] = useState(false)
  const [pendingJoinAction, setPendingJoinAction] = useState<null | (() => Promise<void>)>(null)
  const [entryFeeDisplay, setEntryFeeDisplay] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const playersPerPage = 10

  const sortedPlayers = [...players].sort((a, b) => {
    const valA = sortKey === 'PRICE' ? Number(a.price) : Number((a.parsedStats as any)[sortKey] || 0)
    const valB = sortKey === 'PRICE' ? Number(b.price) : Number((b.parsedStats as any)[sortKey] || 0)
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

  // Fetch players from contract
  useEffect(() => {
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
            const percentage = Number(percentageScaled) / 1e16; // Scale

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
  }, [])

  // Fetch wallet & reset when new account selected
  useEffect(() => {
    async function fetchWallet() {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' })
        const address = accounts[0]
        setWalletAddress(address)

        const provider = new BrowserProvider(window.ethereum)
        const contract = getFantasyLeagueContract(provider)
        const alreadyJoined = await contract.hasJoined(address)

        if (alreadyJoined) {
          onTeamSubmit()
          return
        }

        // Reset team when new account is used
        setMainPlayers([])
        setReservePlayer(null)
        setCaptain(null)
      }
    }

    fetchWallet()
  }, [onTeamSubmit])

  // Restore saved team (main/reserve/captain) from localStorage once players+wallet are available
  useEffect(() => {
    if (!walletAddress || players.length === 0) return

    const raw = localStorage.getItem(`team-${walletAddress}`)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      const savedMain: { id: string, price: string }[] = parsed.main || []
      const savedReserve: { id: string, price: string } | null = parsed.reserve || null
      const savedCaptainId: string | null = parsed.captain || null

      // map saved ids back to Player objects
      const mainMapped: Player[] = savedMain
        .map(s => players.find(p => p.id.toString() === s.id))
        .filter(Boolean) as Player[]

      const reserveMapped: Player | null = savedReserve ? (players.find(p => p.id.toString() === savedReserve.id) || null) : null
      const captainMapped: Player | null = savedCaptainId ? (players.find(p => p.id.toString() === savedCaptainId) || null) : null

      if (mainMapped.length > 0) setMainPlayers(mainMapped)
      if (reserveMapped) setReservePlayer(reserveMapped)
      if (captainMapped) setCaptain(captainMapped)
    } catch (err) {
      console.warn("Failed to restore saved team:", err)
    }
  }, [walletAddress, players])

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
      if (captain?.id === player.id) setCaptain(null) // clear captain if removed
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

  // Row background / captain highlight for selected players
  const getRowStyle = (player: Player): React.CSSProperties => {
    const base: React.CSSProperties = {}
    if (mainPlayers.some(p => p.id === player.id)) base.backgroundColor = '#d0f0c0'
    if (reservePlayer?.id === player.id) base.backgroundColor = '#cce5ff'
    if (captain?.id === player.id) {
      base.border = '2px solid #ffd700'
      base.borderRadius = '4px'
    }
    return base
  }

  const submitTeam = async (
    contract: any,
    selectedIds: bigint[],
    userName: string,
    teamName: string,
    userAddress: string
  ) => {
    const captainIdToSend = captain ? BigInt(captain.id) : BigInt(0)
    const tx = await contract.submitTeam(selectedIds.map(id => BigInt(id)), userName, teamName, captainIdToSend)
    await tx.wait()

    // Save team and captain locally
    localStorage.setItem(
      `team-${userAddress}`,
      JSON.stringify({
        main: mainPlayers.map(p => ({ ...p, id: p.id.toString(), price: p.price.toString() })),
        reserve: reservePlayer ? { ...reservePlayer, id: reservePlayer.id.toString(), price: reservePlayer.price.toString() } : null,
        captain: captain ? captain.id.toString() : null
      })
    )
    onTeamSubmit()
  }

  const handleSubmitTeam = async () => {
    const totalSelected = mainPlayers.length + (reservePlayer ? 1 : 0)
    if (totalSelected !== 12) return alert("Please select 11 main + 1 reserve player.")
    if (!captain) return alert("Please select a captain before submitting.")
    if ((Math.round(teamPrice / 10000) * 10000) > teamBudget) 
      return alert("Budget exceeded.\nPrice: " + (Math.floor(teamPrice / 10000) * 10000) + 
                   "\nBudget: " + teamBudget)
    if (!walletAddress) return alert("You must first connect your wallet using MetaMask.")
    if (!userName || !teamName) return alert("Please enter both your username and team name.")

    const selectedIds = [...mainPlayers.map(p => p.id), reservePlayer!.id]

    try {
      setLoading(true)
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getFantasyLeagueContract(signer)
      const userAddress = await signer.getAddress()
      const alreadyJoined = await contract.hasJoined(userAddress)
      const entryFee = await contract.entryFee()

      if (!alreadyJoined) {
        setEntryFeeDisplay(ethers.formatEther(entryFee))
        setShowMetaMaskModal(true)

        setPendingJoinAction(() => async () => {
          try {
            setLoading(true)
            const joinTx = await contract.joinLeague({ value: entryFee })
            await joinTx.wait()
            await submitTeam(contract, selectedIds, userName, teamName, userAddress)
          } catch (err: any) {
            console.error("Join/Submit error:", err)
            setErrorMessage("Failed to join league or submit team. Please try again.")
            setLoading(false)
          }
        })
        return
      }

      await submitTeam(contract, selectedIds, userName, teamName, userAddress)
    } catch (err: any) {
      console.error("Submission error:", err)

      let userFriendlyMessage = "Something went wrong. Please try again."

      if (err.code === 4001) {
        // MetaMask user rejected transaction
        userFriendlyMessage = "You rejected the transaction in MetaMask. If this was a mistake, please confirm it again."
      } else if (err.message?.includes("insufficient funds")) {
        userFriendlyMessage = "You don't have enough ETH to cover the entry fee + gas. Please top up your wallet."
      } else if (err.message?.includes("already submitted")) {
        userFriendlyMessage = "You have already submitted a team. Only one submission per account is allowed."
      } else if (err.message?.includes("userName") || err.message?.includes("teamName")) {
        userFriendlyMessage = "Please make sure you have entered both a username and team name before submitting."
      } else if (err.message?.includes("Team name taken")) {
        userFriendlyMessage = "Sorry, this team name is already in use."
      }

      setErrorMessage(userFriendlyMessage)
      setLoading(false)
    }
  }

  // Render the UI
  return (
    <>
      <Navbar isOracle={false} showLinks={false} />
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
      <p style={{ marginBottom: '1rem' }}>11 Players | 1 Substitute | 1 Captain</p>

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
            <th style={thStyle}>Captain?</th>
          </tr>
        </thead>
        <tbody>
          {paginatedPlayers.map((player, idx) => (
            <tr
              key={player.id.toString()}
              onClick={() => togglePlayer(player)}
              style={{ cursor: 'pointer', ...getRowStyle(player) }}
            >
              <td style={tdStyle}>{(currentPage - 1) * playersPerPage + idx + 1}</td>
              <td
                style={{ ...tdStyle, color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPlayer(player)
                }}
              >
                {player.name}
              </td>
              <td style={tdStyle}>{(player.parsedStats as any)['current_TOTAL_POINTS']}</td>
              <td style={tdStyle}>{(player.parsedStats as any)['current_BATTING_POINTS']}</td>
              <td style={tdStyle}>{(player.parsedStats as any)['current_BOWLING_POINTS']}</td>
              <td style={tdStyle}>{(player.parsedStats as any)['current_FIELDING_POINTS']}</td>
              <td style={tdStyle}>
                {player.selectionPercentage.toFixed(2)}%
              </td>
              <td style={tdStyle}>
                {(Number(player.price) / 1_000_000).toFixed(2)}
              </td>
              <td style={tdStyle}>
                {mainPlayers.some(p => p.id === player.id) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCaptain(captain?.id === player.id ? null : player)
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: captain?.id === player.id ? '#ffd700' : '#eee',
                      border: '1px solid #aaa',
                      cursor: 'pointer'
                    }}
                  >
                    {captain?.id === player.id ? "Captain" : "Set"}
                  </button>
                ) : (
                  <span style={{ color: '#999' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TEAM STATUS */}
      <div style={{
        margin: '1rem 0',
        fontSize: '0.95rem',
        color: '#444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Players */}
        <div>
          <strong>Current Selection: </strong>{mainPlayers.length}/11 main, {reservePlayer ? "1/1" : "0/1"} reserve
          {captain ? <span style={{ marginLeft: '0.6rem' }}>• <strong>Captain:</strong> {captain.name}</span> : null}
        </div>

        {/* Budget with progress bar */}
        <div style={{ flex: '1', maxWidth: '280px' }}>
          <strong>Remaining Budget: </strong>£{(teamPrice / 1_000_000).toFixed(2)}M / £100M
          <div style={{
            height: '6px',
            borderRadius: '4px',
            backgroundColor: '#eee',
            marginTop: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min((teamPrice / teamBudget) * 100, 100)}%`,
              height: '100%',
              backgroundColor: teamPrice > teamBudget ? '#d9534f'
                              : teamPrice > teamBudget * 0.85 ? '#f0ad4e'
                              : '#5bc0de',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
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
        disabled={mainPlayers.length !== 11 || !reservePlayer || !captain}
        style={{
          marginTop: '1.5rem',
          padding: '12px 24px',
          backgroundColor: mainPlayers.length === 11 && reservePlayer && captain ? '#007bff' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: mainPlayers.length === 11 && reservePlayer && captain ? 'pointer' : 'not-allowed'
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

      {showMetaMaskModal && (
        <MetaMaskInfoModal
          entryFee={entryFeeDisplay}
          onConfirm={async () => {
            setShowMetaMaskModal(false)
            if (pendingJoinAction) await pendingJoinAction()
          }}
          onCancel={() => setShowMetaMaskModal(false)}
        />
      )}

      {errorMessage && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  </>
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
