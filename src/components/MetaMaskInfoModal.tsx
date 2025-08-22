import React, { useState } from "react";

interface MetaMaskInfoModalProps {
  entryFee: string
  onConfirm: () => void
  onCancel: () => void
}

const MetaMaskInfoModal: React.FC<MetaMaskInfoModalProps> = ({ entryFee, onConfirm, onCancel }) => {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000
    }}>
      <div style={{
        backgroundColor: "white", padding: "2rem", borderRadius: "12px",
        maxWidth: "500px", textAlign: "center", boxShadow: "0px 4px 20px rgba(0,0,0,0.3)"
      }}>
        <h3 style={{ marginBottom: "1rem" }}>Confirm Entry with MetaMask</h3>
        <p style={{ marginBottom: "1rem" }}>
          To join the Fantasy League, you’ll need to pay the entry fee of <strong>{entryFee} ETH</strong>.
        </p>
        <p style={{ marginBottom: "1rem" }}>
          When you click confirm, MetaMask will pop up asking for permission to send the transaction.
          The popup comes from the MetaMask browser extension and will contain information about who is 
          involved in the transaction (you and the smart contract), and how much you will be sending. 
          There will also be a small network fee to pay, this is the cost of interacting with the contract. 
          This ensures you stay in control of your wallet and funds.  
          <br></br><strong>Important!! Once you submit your team, there is no changing it. So be sure you are happy 
            with your selections.</strong>
        </p>
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: "1.5rem" }}>
          <button
            onClick={onCancel}
            style={{ padding: "10px 20px", backgroundColor: "#ccc", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default MetaMaskInfoModal
