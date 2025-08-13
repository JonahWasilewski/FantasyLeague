import React, { useState } from 'react'
import { BrowserProvider } from 'ethers'
import { getFantasyLeagueContract } from '../utils/contract'

const WithdrawPrizePool: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleWithdraw = async () => {
    try {
      setLoading(true)
      setStatus(null)

      if (!window.ethereum) {
        setStatus('Wallet not found')
        setLoading(false)
        return
      }

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getFantasyLeagueContract(signer)
      const address = await signer.getAddress()

      const tx = await contract.withdrawPrizePool(address)
      await tx.wait()

      setStatus('Withdrawal successful!')
    } catch (error: any) {
      console.error(error)
      setStatus(`Error: ${error.reason || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h2>Withdraw Prize Pool</h2>
      <p>This will transfer all prize pool funds to your wallet.</p>
      <button
        onClick={handleWithdraw}
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
        {loading ? 'Withdrawing...' : 'Withdraw Funds'}
      </button>

      {status && (
        <p style={{ marginTop: '15px', color: status.startsWith('Error') ? 'red' : 'green' }}>
          {status}
        </p>
      )}
    </div>
  )
}

export default WithdrawPrizePool
