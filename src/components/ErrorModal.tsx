import React from "react"

interface ErrorModalProps {
  message: string
  onClose: () => void
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000
    }}>
      <div style={{
        background: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ marginBottom: '1rem' }}>Transaction Error</h3>
        <p style={{ marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>{message}</p>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default ErrorModal
