import React, { useState } from 'react'
import { BrowserProvider } from 'ethers'
import { getFantasyLeagueContract } from '../utils/contract'

const EndSeasonAndDistribute: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleEndSeason = async () => {
    try {
      setLoading(true)
      setStatus(null)

      if (!window.ethereum) {
        setStatus('Wallet not found')
        return
      }

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getFantasyLeagueContract(signer)

      const tx = await contract.endSeasonAndDistribute()
      await tx.wait()

      setStatus('Season ended, prize pool sent to winner!')
      setTimeout(() => {
      window.location.reload()
        }, 2000) // waits 2 seconds so the user can see the success message
      } catch (error: any) {
        console.error(error)
        setStatus(`Error: ${error.reason || error.message}`)
      } finally {
        setLoading(false)
      }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h2>End Season & Distribute Prize</h2>
      <button
        onClick={handleEndSeason}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Ending Season...' : 'End Season'}
      </button>
      {status && (
        <p style={{ marginTop: '15px', color: status.startsWith('Error') ? 'red' : 'green' }}>
          {status}
        </p>
      )}
    </div>
  )
}

export default EndSeasonAndDistribute
