import React, { useState } from 'react';
import { getContract } from '../utils/contract';

const TeamNameForm = () => {
  const [name, setName] = useState('');

  const submitTeamName = async () => {
    if (!name) return alert("Team name cannot be empty!");
    try {
      const contract = await getContract();
      const tx = await contract.setTeamName(name);
      await tx.wait();
      alert("Team name saved!");
    } catch (err) {
      console.error(err);
      alert("Error setting team name.");
    }
  };

  return (
    <div className="mb-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter team name"
        className="border px-3 py-1 rounded"
      />
      <button
        onClick={submitTeamName}
        className="ml-2 bg-green-600 text-white px-3 py-1 rounded"
      >
        Submit
      </button>
    </div>
  );
};

export default TeamNameForm;
