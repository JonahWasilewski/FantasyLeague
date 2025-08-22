import React, { useState } from "react";
import ConnectWallet from "./WalletConnect";
import "./styles/LoginPage.css";

export default function LoginPage({ onConnect }: { onConnect?: () => void }) {

  const handleConnect = () => {
    if (onConnect) onConnect();
  };

  return (
    <div className="lp-container">
      <div className="lp-card">
        <section className="lp-hero">
          <div className="lp-hero-inner">
            <h1 className="lp-title">Fantasy Cricket League</h1>
            <p className="lp-tag">Build your dream XI • Compete weekly • Climb the leaderboard</p>

            <div className="lp-hero-features">
              <div className="lp-hero-text">
                <p>
                  Pick 11 starting players and a sub under a budget. Players score points from real match actions — runs, wickets, catches and more.
                  No prior crypto knowledge required — just connect once to save your team.<br></br>
                  All player data is retrieved from <a href="https://www.play-cricket.com/" target="_blank" rel="noopener noreferrer">play 
                  cricket</a> and updated weekly to provide an up-to-date representation of real-world statistics.
                </p>
              </div>
            </div>

            <div className="lp-tips">
              <strong>Quick tips</strong>
              <ul>
                <li>Balance batters, bowlers and all-rounders.</li>
                <li>Set a captain - they score extra points.</li>
                <li>Manage your budget: top stars cost more.</li>
              </ul>
            </div>
          </div>
        </section>

        <aside className="lp-info">
          <h2>How the game works</h2>

          <div className="lp-scroll">
            <p>
              Welcome! This is a beginner-friendly fantasy cricket game. You create a team of 12 players, stay within a fixed
              budget, and earn points based on how those players perform in real matches. We handle the scores - you pick the team
              and enjoy the competition.
            </p>

            <div className="lp-section">
              <strong>Step-by-step</strong>
              <ol>
                <li><strong>Connect your wallet</strong> - this creates your game account.</li>
                <li><strong>Name your team</strong> and choose a username for the leaderboard.</li>
                <li><strong>Pick 12 players</strong> within the total budget. Mix expensive stars with value picks.</li>
                <li><strong>Choose a captain</strong> - captaincy gives a points multiplier.</li>
                <li><strong>Submit your team</strong> before the round starts. Teams lock at the deadline.</li>
              </ol>
            </div>

            <div className="lp-section">
              <strong>What earns points</strong>
              <p>
                Players score for batting (runs, boundaries), bowling (wickets, maidens), and fielding (catches, run-outs).
                The app shows short player descriptions and expected roles to help your choices.
              </p>
            </div>

            <div className="lp-section">
              <strong>New to cricket?</strong>
              <p>
                Start simple: pick a few dependable batters, a couple of strike bowlers, and one or two all-rounders. You can adjust
                your team in later rounds as you learn.
              </p>
            </div>

            <p className="lp-meta">
              Need MetaMask? Install it <a href="https://metamask.io/en-GB/download" target="_blank" rel="noopener noreferrer">here</a>.
            </p>
          </div>

          <div className="lp-form">
            <div className="lp-connect-card">
              <div className="lp-connect-row">
                <div>
                  <p className="lp-connect-title">Connect Wallet</p>
                  <p className="lp-connect-sub">Use MetaMask to sign in and save your team</p>
                </div>
                <div>
                  <ConnectWallet onConnect={handleConnect} />
                </div>
              </div>

              <p className="lp-connect-legal">By connecting you accept the game rules. No crypto knowledge required to play.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
