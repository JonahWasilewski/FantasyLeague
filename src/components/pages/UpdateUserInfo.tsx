import React, { useEffect, useState } from 'react';
import { getFantasyLeagueContract } from '../utils/contract';
import { BrowserProvider, ethers } from 'ethers';

const MAX_NAME_LENGTH = 20;
const MAX_TEAM_NAME_LENGTH = 30;

const UpdateProfile: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentTeamName, setCurrentTeamName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = getFantasyLeagueContract(signer);
        const userAddress = await signer.getAddress();

        const username = await contract.playerNames(userAddress);
        const teamName = await contract.teamNames(userAddress);

        setCurrentUsername(username);
        setCurrentTeamName(teamName);
        setNewUsername(username);
        setNewTeamName(teamName);
      }
    }

    fetchProfile();
  }, []);

  const handleUpdate = async () => {
    if (!window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = getFantasyLeagueContract(signer);

    try {
      setLoading(true);
      setFeedback(null);

      // Submit username update only if changed
      if (newUsername !== currentUsername) {
        if (newUsername.length === 0 || newUsername.length > MAX_NAME_LENGTH) {
          throw new Error(`Username must be 1-${MAX_NAME_LENGTH} characters.`);
        }

        const tx = await contract.updatePlayerName(newUsername);
        await tx.wait();
        setCurrentUsername(newUsername);
      }

      // Submit team name update only if changed
      if (newTeamName !== currentTeamName) {
        if (newTeamName.length === 0 || newTeamName.length > MAX_TEAM_NAME_LENGTH) {
          throw new Error(`Team name must be 1-${MAX_TEAM_NAME_LENGTH} characters.`);
        }

        const tx = await contract.updateTeamName(newTeamName);
        await tx.wait();
        setCurrentTeamName(newTeamName);
      }

      setFeedback('Profile updated successfully!');
    } catch (err: any) {
      setFeedback(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h2>Update Profile</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Username:</label>
        <input
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Team Name:</label>
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          maxLength={MAX_TEAM_NAME_LENGTH}
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <button onClick={handleUpdate} disabled={loading} style={{ padding: '10px 20px' }}>
        {loading ? 'Updating...' : 'Update'}
      </button>
      {feedback && <p style={{ marginTop: 12 }}>{feedback}</p>}
    </div>
  );
};

export default UpdateProfile;
