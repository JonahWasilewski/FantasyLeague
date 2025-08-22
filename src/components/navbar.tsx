import React from 'react'
import { Link, useLocation } from 'react-router-dom'

type NavbarProps = {
  isOracle: boolean
}

const Navbar: React.FC<NavbarProps> = ({ isOracle }) => {
  const location = useLocation()

  const linkStyle = (path: string) => ({
    padding: '10px 15px',
    margin: '0 10px',
    textDecoration: 'none',
    color: location.pathname === path ? '#fff' : '#ccc',
    backgroundColor: location.pathname === path ? '#007bff' : 'transparent',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer'
  })

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 20px',
      backgroundColor: '#1e1e1e',
      borderBottom: '2px solid #444'
    }}>
      <h2 style={{ color: '#fff' }}>🏏 Fantasy League</h2>
      <div>
        <Link to="/myteam" style={linkStyle('/myteam')}>My Team</Link>
        <Link to="/leaderboard" style={linkStyle('/leaderboard')}>Leaderboard</Link>
        <Link to="/updateUserInfo" style={linkStyle('/updateUserInfo')}>Update User Info</Link>

        {isOracle && ( // Only show if Oracle
          <Link to="/endSeasonAndDistribute" style={linkStyle('/endSeasonAndDistribute')}>
            End Season and Distribute
          </Link>
        )}

        <Link to="/pastSeasons" style={linkStyle('/pastSeasons')}>Past Seasons</Link>
      </div>
    </nav>
  )
}

export default Navbar
