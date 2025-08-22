import React, { useEffect, useState } from 'react';
import { BrowserProvider, ethers } from 'ethers';
import { getFantasyLeagueContract } from '../utils/contract';

type PredictedEntry = {
  address: string;
  username: string;
  teamName: string;
  totalPoints: number;
};

const EndSeasonAndDistribute: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(true);
  const [predictedLeaderboard, setPredictedLeaderboard] = useState<PredictedEntry[]>([]);
  const [predictedError, setPredictedError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any | null>(null); // holds the structured confirmation to show

  // Load a frontend-predicted leaderboard (doubling captain totals) so admin can review before ending
  useEffect(() => {
    const loadPredictedLeaderboard = async () => {
      setLoadingPredictions(true);
      setPredictedError(null);

      try {
        if (!window.ethereum) {
          setPredictedError('Wallet not found; cannot build predicted leaderboard.');
          setLoadingPredictions(false);
          return;
        }

        const provider = new BrowserProvider(window.ethereum);
        const contract = getFantasyLeagueContract(provider);

        const participants: string[] = await contract.getParticipants();
        if (!participants || participants.length === 0) {
          setPredictedLeaderboard([]);
          setLoadingPredictions(false);
          return;
        }

        const toNumber = (v: any) => {
          const n = Number(v ?? 0);
          return isNaN(n) ? 0 : n;
        };

        const entries: PredictedEntry[] = [];

        // cache player rawStats parsing to reduce RPC calls for duplicates
        const playerPointsCache: { [id: number]: number } = {};

        for (const user of participants) {
          try {
            // getUserTeam returns: (playerIds, submitted, playerName, teamName, userRank, captain)
            const [ids, submitted, username, teamName, _rank, captainRaw] = await contract.getUserTeam(user);

            if (!submitted || !ids || ids.length === 0) continue;

            const captainId = Number(captainRaw ?? 0);

            let teamTotal = 0;

            for (const rawId of ids) {
              const id = Number(rawId);
              if (isNaN(id) || id === 0) continue;

              // cached?
              if (playerPointsCache[id] === undefined) {
                try {
                  const playerData = await contract.players(id);
                  let parsedStats: any = {};
                  if (
                    typeof playerData.rawStats === 'string' &&
                    playerData.rawStats.trim() !== '' &&
                    playerData.rawStats.trim().toLowerCase() !== 'undefined'
                  ) {
                    try {
                      parsedStats = JSON.parse(playerData.rawStats);
                    } catch {
                      parsedStats = {};
                    }
                  }
                  playerPointsCache[id] = toNumber(parsedStats?.current_TOTAL_POINTS ?? 0);
                } catch {
                  playerPointsCache[id] = 0;
                }
              }

              const basePts = playerPointsCache[id] ?? 0;
              teamTotal += id === captainId ? basePts * 2 : basePts;
            }

            entries.push({
              address: user,
              username: username || user,
              teamName: teamName || '',
              totalPoints: teamTotal,
            });
          } catch (err) {
            // if one user fails, continue with others but log a small note
            console.warn('Failed to compute for user', user, err);
          }
        }

        // sort descending
        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setPredictedLeaderboard(entries);
      } catch (err: any) {
        console.error('Error building predicted leaderboard', err);
        setPredictedError((err && err.message) || String(err));
        setPredictedLeaderboard([]);
      } finally {
        setLoadingPredictions(false);
      }
    };

    // Fire once
    loadPredictedLeaderboard();
  }, []);

  const handleEndSeason = async () => {
    try {
      setLoading(true);
      setStatus(null);
      if (!window.ethereum) { setStatus('Wallet not found'); return; }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getFantasyLeagueContract(signer);

      const winnerAddress = predictedLeaderboard?.[0]?.address ?? (await contract.getLeaderboard())[0];
      const ownerAddr = await contract.owner();

      const winnerBefore: bigint = await provider.getBalance(winnerAddress);
      const ownerBefore: bigint = await provider.getBalance(ownerAddr);

      const tx = await contract.endSeasonAndDistribute();
      const receipt = await tx.wait();

      // parse logs
      let prizePaidInfo: { to?: string; amount?: bigint; season?: bigint } = {};
      let ownerPaidInfo: { to?: string; amount?: bigint; season?: bigint } = {};
      const iface = contract.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'PrizePaid') {
            prizePaidInfo = { 
              to: String(parsed.args[0]), 
              amount: parsed.args[1] as bigint, 
              season: parsed.args[2] as bigint,
              username: parsed.args[3] as string,   // NEW
              teamName: parsed.args[4] as string    // NEW
            };
          } else if (parsed && parsed.name === 'OwnerPaid') {
            ownerPaidInfo = { to: String(parsed.args[0]), amount: parsed.args[1] as bigint, season: parsed.args[2] as bigint };
          }
        } catch (_) {}
      }

      const winnerAfter: bigint = await provider.getBalance(winnerAddress);
      const ownerAfter: bigint = await provider.getBalance(ownerAddr);
      const winnerDelta: bigint = winnerAfter - winnerBefore;
      const ownerDelta: bigint = ownerAfter - ownerBefore;

      const expectedPrize: bigint = prizePaidInfo.amount ?? 0n;
      const expectedOwner: bigint = ownerPaidInfo.amount ?? 0n;

      // compute gas adjustment if signer is owner
      const signerAddr = await signer.getAddress();
      let ownerMatches = false;
      if (signerAddr.toLowerCase() === ownerAddr.toLowerCase()) {
        const gasUsed: bigint = receipt.gasUsed ?? 0n;
        const gasPrice: bigint = receipt.effectiveGasPrice ?? 0n;
        const gasCost: bigint = gasUsed * gasPrice;
        ownerMatches = (ownerDelta + gasCost) === expectedOwner;
      } else {
        ownerMatches = ownerDelta === expectedOwner;
      }

      const conf = {
        txHash: receipt.transactionHash,
        prize: { 
          to: prizePaidInfo.to ?? null, 
          expectedWei: expectedPrize.toString(), 
          actualDeltaWei: winnerDelta.toString(),
          username: prizePaidInfo.username ?? null,
          teamName: prizePaidInfo.teamName ?? null
        },
        owner: { to: ownerPaidInfo.to ?? null, expectedWei: expectedOwner.toString(), actualDeltaWei: ownerDelta.toString(), ownerMatches },
        timestamp: Date.now(),
        season: prizePaidInfo.season ? prizePaidInfo.season.toString() : null,
        receiptStatus: receipt.status === 1,
      };

      // show confirmation in a nice card
      setConfirmation(conf);
      setStatus('Season ended - details shown below.');

    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err?.reason || err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
      <h2>End Season & Distribute Prize</h2>

      <p style={{ maxWidth: 800, margin: '0 auto 1rem' }}>
        Below is leaderboard, please confirm that you are happy with it before continuing.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        {loadingPredictions ? (
          <p>Computing leaderboard…</p>
        ) : predictedError ? (
          <p style={{ color: 'red' }}>{predictedError}</p>
        ) : predictedLeaderboard.length === 0 ? (
          <p>No participants or no submitted teams found.</p>
        ) : (
          <div style={{ textAlign: 'left', margin: '0 auto', maxWidth: 700 }}>
            <h3>Predicted Top Participants</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ width: 40 }}>#</th>
                  <th>User</th>
                  <th>Team</th>
                  <th style={{ textAlign: 'right' }}>Predicted Points</th>
                </tr>
              </thead>
              <tbody>
                {predictedLeaderboard.slice(0, 5).map((e, idx) => (
                  <tr key={e.address} style={{ borderTop: '1px solid #eee' }}>
                    <td>{idx + 1}</td>
                    <td style={{ wordBreak: 'break-all' }}>{e.username}</td>
                    <td>{e.teamName}</td>
                    <td style={{ textAlign: 'right' }}>{e.totalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p>
              <strong>Winner:</strong>{' '}
              {predictedLeaderboard[0]
                ? `${predictedLeaderboard[0].username} (${predictedLeaderboard[0].teamName}) — ${predictedLeaderboard[0].totalPoints} pts`
                : '—'}
            </p>
          </div>
        )}
      </div>

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
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Ending Season...' : 'End Season'}
      </button>

      {status && (
        <p style={{ marginTop: '15px', color: status.startsWith('Error') ? 'red' : 'green' }}>
          {status}
        </p>
      )}

    {/* Confirmation card — place near top so user sees it immediately */}
    {confirmation && (
      <div style={{
        maxWidth: 780, margin: '12px auto', padding: 16, borderRadius: 12,
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)', background: '#fff'
      }}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:28}}>✅</div>
          <div>
            <div style={{fontWeight:700}}>Distribution confirmed</div>
            <div style={{fontSize:13, color:'#555'}}>Tx: <code style={{wordBreak:'break-all'}}>{confirmation.txHash}</code></div>
          </div>
          <div style={{marginLeft:'auto'}}>
            <button onClick={() => {
              setConfirmation(null); setTimeout(() => window.location.reload(), 80);}}
               style={{padding:'6px 10px'}}>Dismiss</button>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
          <div style={{padding:12, borderRadius:8, background:'#f7fdf7', border:'1px solid #eaf6ea'}}>
            <div style={{fontSize:13, color:'#2a7f2a'}}>Winner</div>
            <div style={{fontWeight:600}}>
              {confirmation.prize.username 
                ? `${confirmation.prize.username} (${confirmation.prize.teamName})`
                : confirmation.prize.to || 'Unknown'}
            </div>
            <div style={{fontSize:12, color:'#777'}}>{confirmation.prize.to}</div>
            <div style={{fontSize:13, color:'#333'}}>Expected: {ethers.formatEther(BigInt(confirmation.prize.expectedWei))} ETH</div>
            <div style={{fontSize:13, color:'#333'}}>Actual received: {ethers.formatEther(BigInt(confirmation.prize.actualDeltaWei))} ETH</div>
          </div>

          <div style={{padding:12, borderRadius:8, background:'#f7f7ff', border:'1px solid #eceafe'}}>
            <div style={{fontSize:13, color:'#333'}}>Owner</div>
            <div style={{fontWeight:600}}>{confirmation.owner.to || 'Unknown'}</div>
            <div style={{fontSize:13, color:'#333'}}>Expected: {ethers.formatEther(BigInt(confirmation.owner.expectedWei))} ETH</div>
            <div style={{fontSize:13, color:'#333'}}>Actual change: {ethers.formatEther(BigInt(confirmation.owner.actualDeltaWei))} ETH</div>
            <div style={{marginTop:6, fontSize:12, color: confirmation.owner.ownerMatches ? 'green' : 'orange'}}>
              {confirmation.owner.ownerMatches ? 'Owner amount matches (adjusted for gas).' : 'Owner amount differs (check gas or logs).'}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default EndSeasonAndDistribute;
