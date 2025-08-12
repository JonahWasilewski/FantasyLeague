import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ConnectWallet from './components/WalletConnect'
import TeamSelection from './components/TeamSelection'
import MyTeam from './pages/MyTeam'
import Leaderboard from './pages/Leaderboard'
import EndSeasonAndDistribute from './pages/EndSeasonAndDistribute'
import UpdateUserInfo from './pages/UpdateUserInfo'
import PastSeasons from './pages/PastSeasons'
import Navbar from './components/Navbar'
import { getFantasyLeagueContract } from './utils/contract'
import { BrowserProvider, ethers, keccak256, toUtf8Bytes } from 'ethers'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [hasSubmittedTeam, setHasSubmittedTeam] = useState<boolean | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [isOracle, setIsOracle] = useState(false)
  const ORACLE_ROLE = keccak256(toUtf8Bytes("ORACLE_ROLE"))

  useEffect(() => {
    async function checkConnection() {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const address = accounts[0]
          setIsConnected(true)
          setWalletAddress(accounts[0])

          const provider = new BrowserProvider(window.ethereum)
          const contract = getFantasyLeagueContract(provider)
          const hasRole = await contract.hasRole(ORACLE_ROLE, address)
          setIsOracle(hasRole)
        }
      }
    }

    checkConnection()

    window.ethereum?.on('accountsChanged', async (accounts: string[]) => {
      const address = accounts[0]
      setIsConnected(accounts.length > 0)
      setWalletAddress(address || null)
      setHasSubmittedTeam(null)

      if (address) {
        const provider = new BrowserProvider(window.ethereum)
        const contract = getFantasyLeagueContract(provider)
        const hasRole = await contract.hasRole(ORACLE_ROLE, address)
        setIsOracle(hasRole)
      } else {
        setIsOracle(false)
      }
    })    

    return () => {
      window.ethereum?.removeAllListeners('accountsChanged')
    }
  }, [])

  useEffect(() => {
    async function checkSubmission() {
      if (walletAddress) {
        const provider = new BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contract = getFantasyLeagueContract(signer)

        const [, submitted] = await contract.getUserTeam(walletAddress)
        setHasSubmittedTeam(submitted)
      }
    }
    checkSubmission()
  }, [walletAddress])

  const handleLogout = () => {
    setIsConnected(false)
    setWalletAddress(null)
    setHasSubmittedTeam(null)
  }

  return (
    <Router>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          flexWrap: 'wrap'
        }}
      >
        {isConnected && (
          <>
            <button
              onClick={handleLogout}
              style={{
                padding: '5px 10px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Logout
            </button>
            <button
              onClick={() => setShowHelp(true)}
              style={{
                padding: '5px 10px',
                cursor: 'pointer'
              }}
            >
              Help
            </button>
          </>
        )}
      </header>

      {isConnected && hasSubmittedTeam && <div><Navbar /></div>}

      <main
        style={{
          height: 'calc(100vh - 60px)',
          width: '100%',
          overflowY: 'auto',
          padding: '20px',
          boxSizing: 'border-box'
        }}
      >
        {showHelp && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
            }}
            onClick={() => setShowHelp(false)} // click outside to close
          >
            <div
              onClick={(e) => e.stopPropagation()} // prevent close when clicking modal content
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '10px',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                textAlign: 'left',
              }}
            >
              <h2>Help</h2>
              <p>
                {hasSubmittedTeam === false && (
                  <>
                    <strong>Getting Started:</strong><br />
                    - First, connect your MetaMask wallet. If you have not installed MetaMask on your browser then you can do this <a href="https://metamask.io/en-GB/download" target="_blank" rel="noopener noreferrer">here.</a><br />
                    - Enter your team name and username.<br />
                    - Select your fantasy team (12 players) within the cost limit.<br />
                    - When you submit your team, the data is stored on the blockchain via a smart contract.<br />
                    - The contract saves your address, team selection, and entry status, ensuring fairness and immutability.<br />
                  </>
                )}

                {hasSubmittedTeam === true && (
                  <>
                    <strong>App Sections Explained:</strong><br /><br />
                    <u>My Team</u>: View your current team selection and player details. This data is fetched directly from the smart contract using your wallet address.<br /><br />
                    <u>Leaderboard</u>: Displays users ranked by total points. The points are computed off-chain and updated on-chain via an Oracle (with a special role).<br /><br />
                    <u>Update Info</u>: Lets you update your team name and username, which are saved on-chain.<br /><br />
                    <u>Past Seasons</u>: Shows historic data from completed seasons, stored permanently on the contract.<br /><br />
                    <u>End Season & Distribute</u>: (Visible only to Oracles) This function ends the current season, distributes winnings, and starts a new season.<br />
                  </>
                )}
              </p>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  marginTop: '20px',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              isConnected
                ? hasSubmittedTeam === null
                  ? <div>Loading...</div>
                  : hasSubmittedTeam
                    ? <Navigate to="/myteam" />
                    : <Navigate to="/select" />
                : <ConnectWallet onConnect={() => setIsConnected(true)} />
            }
          />
          <Route
            path="/select"
            element={
              isConnected && hasSubmittedTeam === false
                ? <TeamSelection onTeamSubmit={() => setHasSubmittedTeam(true)} />
                : <Navigate to="/" />
            }
          />
          <Route
            path="/myteam"
            element={
              isConnected && hasSubmittedTeam
                ? <MyTeam />
                : <Navigate to="/" />
            }
          />
          <Route
            path="/leaderboard"
            element={
              isConnected
                ? <Leaderboard />
                : <Navigate to="/" />
            }
          />
          <Route
            path="/endSeasonAndDistribute"
            element={
              isConnected && isOracle
                ? <EndSeasonAndDistribute />
                : <Navigate to="/" />
            }
          />
          <Route
            path="/updateUserInfo"
            element={
              isConnected && hasSubmittedTeam
                ? <UpdateUserInfo />
                : <Navigate to="/" />
            }
          />
        <Route
            path="/PastSeasons"
            element={
              isConnected
                ? <PastSeasons />
                : <Navigate to="/" />
            }
          />
        </Routes>
      </main>
    </Router>
  )
}

export default App