import React from 'react'

interface Props {
  onConnect: () => void
}

export default function ConnectWallet({ onConnect }: Props) {
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert("MetaMask is not installed. Please install it from https://metamask.io/download.html")
      return
    }

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

  return (
    <div>
      <button onClick={connectWallet}>Connect Wallet</button>
    </div>
  )
}