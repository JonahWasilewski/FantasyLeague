import React from 'react'

interface Props {
  onConnect: () => void
}

export default function ConnectWallet({ onConnect }: Props) {
  const connectWallet = async () => {
    // Make sure the user has MetaMask installed on their browser
    if (typeof window.ethereum === 'undefined') {
      alert("MetaMask is not installed. Please install it from https://metamask.io/download.html")
      return
    }

    // Connect wallet via MetaMask extension and take user to team selection page if successful
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts.length > 0) {
        onConnect()
        window.location.href = "/"
      }
    } catch (err) {
      console.error('Connection error:', err)
    }
  }

  // UI is a button to connect wallet
  return (
    <div>
      <button onClick={connectWallet}>Connect Wallet</button>
    </div>
  )
}
