import React from 'react'

// Alias for the season currently in view
type StatView = 'current' | 'previous'

// Player object structure
interface Player {
  id: number | bigint
  name: string
  parsedStats: { [key: string]: string | number }
  isCaptain?: boolean // <-- mark if player is captain
}

// Structure expected by the player modal component (for formatting)
interface PlayerModalProps {
  player: Player
  statView: StatView
  setStatView: React.Dispatch<React.SetStateAction<StatView>>
  onClose: () => void
}

const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  statView,
  setStatView,
  onClose,
}) => {
  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  return (
    <div style={modalBackdrop}>
      <div style={modalStyle}>
        {/* Player name + captain badge if applicable */}
        <h3 style={{ marginBottom: '0.5rem' }}>
          {player.name}{' '}
          {player.isCaptain && (
            <span
              style={{
                fontSize: '0.85rem',
                color: '#fff',
                backgroundColor: '#f59e0b', // amber
                padding: '2px 8px',
                borderRadius: '12px',
                marginLeft: '0.5rem',
              }}
            >
              Captain
            </span>
          )}
        </h3>

        {/* Year toggle */}
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setStatView('current')}
            style={{
              marginRight: '10px',
              padding: '6px 12px',
              backgroundColor: statView === 'current' ? '#007bff' : '#eee',
              color: statView === 'current' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {currentYear}
          </button>
          <button
            onClick={() => setStatView('previous')}
            style={{
              padding: '6px 12px',
              backgroundColor: statView === 'previous' ? '#007bff' : '#eee',
              color: statView === 'previous' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {previousYear}
          </button>
        </div>

        {/* Stats table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries({
              Batting: [
                'RUNS_x',
                'HIGH_SCORE',
                'AVG',
                '50s',
                '100s',
                'STRIKE_RATE_x',
                'BATTING_POINTS',
              ],
              Bowling: [
                'OVERS',
                'MAIDENS',
                'RUNS_y',
                'WICKETS',
                'BEST_BOWLING',
                '5_WICKET_HAUL',
                'ECONOMY_RATE',
                'STRIKE_RATE_y',
                'AVERAGE',
                'BOWLING_POINTS',
              ],
              Fielding: [
                'WICKET_KEEPING_CATCHES',
                'STUMPINGS',
                'TOTAL_WICKET_KEEPING_WICKETS',
                'FIELDING_CATCHES',
                'RUN_OUTS',
                'TOTAL_FIELDING WICKETS',
                'TOTAL_CATCHES',
                'TOTAL_VICTIMS',
                'FIELDING_POINTS',
              ],
            }).map(([section, keys]) => (
              <React.Fragment key={section}>
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      paddingTop: '1rem',
                      paddingBottom: '0.25rem',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      borderBottom: '1px solid #ccc',
                    }}
                  >
                    {section} Stats
                  </td>
                </tr>
                {keys.map((key) => {
                  const statKey = `${statView}_${key}`
                  const value = player.parsedStats[statKey]
                  if (value !== undefined) {
                    return (
                      <tr key={statKey}>
                        <td
                          style={{
                            fontWeight: 'bold',
                            paddingRight: '1rem',
                            paddingTop: '0.25rem',
                          }}
                        >
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td style={{ paddingTop: '0.25rem' }}>{value}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <button
          onClick={onClose}
          style={{
            marginTop: '1.5rem',
            padding: '10px 20px',
            backgroundColor: '#aaa',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default PlayerModal

const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  width: '100vw',
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '2rem',
  borderRadius: '8px',
  maxHeight: '80vh',
  overflowY: 'auto',
}
