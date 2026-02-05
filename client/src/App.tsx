import { useState, useEffect, useCallback } from "react";
import { useDojo } from "./dojo/useDojo";
import { MASTER_ADDRESS } from "./dojo/dojoConfig";
import {
    apolloClient,
    GET_PLAYER_STATS,
    GET_LATEST_GAME,
    PlayerStatsResponse,
    LatestGameResponse,
} from "./dojo/apollo";
import "./App.css";

type Prediction = 0 | 1; // 0 = Heads, 1 = Tails

interface PlayerStats {
    total_flips: number;
    wins: number;
    losses: number;
}

interface GameResult {
    prediction: number;
    outcome: number;
    won: boolean;
}

function App() {
    const { account, client, isLoading, error } = useDojo();
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [lastResult, setLastResult] = useState<GameResult | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [coinAnimation, setCoinAnimation] = useState<"heads" | "tails" | null>(null);

    // Fetch player stats using Apollo Client
    const fetchPlayerStats = useCallback(async () => {
        try {
            const { data } = await apolloClient.query<PlayerStatsResponse>({
                query: GET_PLAYER_STATS,
                variables: { address: MASTER_ADDRESS },
                fetchPolicy: "network-only", // Always fetch fresh data
            });

            const player = data?.coinFlipPlayerModels?.edges?.[0]?.node;
            if (player) {
                setPlayerStats({
                    total_flips: Number(player.total_flips),
                    wins: Number(player.wins),
                    losses: Number(player.losses),
                });
            }
        } catch (err) {
            console.error("Failed to fetch player stats:", err);
        }
    }, []);

    // Fetch latest game result using Apollo Client
    const fetchLatestGame = useCallback(async () => {
        try {
            const { data } = await apolloClient.query<LatestGameResponse>({
                query: GET_LATEST_GAME,
                variables: { player: MASTER_ADDRESS },
                fetchPolicy: "network-only",
            });

            const game = data?.coinFlipGameModels?.edges?.[0]?.node;
            if (game) {
                return {
                    prediction: Number(game.prediction),
                    outcome: Number(game.outcome),
                    won: game.won,
                };
            }
            return null;
        } catch (err) {
            console.error("Failed to fetch latest game:", err);
            return null;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchPlayerStats();
    }, [fetchPlayerStats]);

    // Flip the coin
    const flip = async (prediction: Prediction) => {
        if (!client || !account) return;

        setIsFlipping(true);
        setCoinAnimation(null);
        setLastResult(null);

        try {
            // Execute flip transaction
            const tx = await client.actions.flip(account, prediction);
            console.log("Transaction:", tx);

            // Wait a moment for indexer to catch up
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Fetch latest game result using Apollo
            const result = await fetchLatestGame();
            if (result) {
                setLastResult(result);
                setCoinAnimation(result.outcome === 0 ? "heads" : "tails");
            }

            // Refresh player stats
            await fetchPlayerStats();
        } catch (err) {
            console.error("Flip failed:", err);
        } finally {
            setIsFlipping(false);
        }
    };

    if (isLoading) {
        return (
            <div className="app">
                <div className="loading">Connecting to Dojo world...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app">
                <div className="error">
                    <h2>Connection Error</h2>
                    <p>{error.message}</p>
                    <p>Make sure Katana and Torii are running.</p>
                </div>
            </div>
        );
    }

    const winRate = playerStats && playerStats.total_flips > 0
        ? ((playerStats.wins / playerStats.total_flips) * 100).toFixed(1)
        : "0";

    return (
        <div className="app">
            <h1>Coin Flip</h1>
            <p className="subtitle">On-chain prediction game built with Dojo</p>

            {/* Coin Display */}
            <div className={`coin ${coinAnimation || ""} ${isFlipping ? "flipping" : ""}`}>
                <div className="coin-face heads">H</div>
                <div className="coin-face tails">T</div>
            </div>

            {/* Result Display */}
            {lastResult && !isFlipping && (
                <div className={`result ${lastResult.won ? "win" : "lose"}`}>
                    <div className="result-text">
                        {lastResult.won ? "You Won!" : "You Lost!"}
                    </div>
                    <div className="result-details">
                        You picked {lastResult.prediction === 0 ? "Heads" : "Tails"} →
                        Coin landed {lastResult.outcome === 0 ? "Heads" : "Tails"}
                    </div>
                </div>
            )}

            {/* Buttons */}
            <div className="buttons">
                <button
                    className="flip-btn heads-btn"
                    onClick={() => flip(0)}
                    disabled={isFlipping}
                >
                    {isFlipping ? "Flipping..." : "Heads"}
                </button>
                <button
                    className="flip-btn tails-btn"
                    onClick={() => flip(1)}
                    disabled={isFlipping}
                >
                    {isFlipping ? "Flipping..." : "Tails"}
                </button>
            </div>

            {/* Stats */}
            <div className="stats">
                <h3>Your Stats</h3>
                <div className="stats-grid">
                    <div className="stat">
                        <div className="stat-value">{playerStats?.total_flips || 0}</div>
                        <div className="stat-label">Total Flips</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value wins">{playerStats?.wins || 0}</div>
                        <div className="stat-label">Wins</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value losses">{playerStats?.losses || 0}</div>
                        <div className="stat-label">Losses</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">{winRate}%</div>
                        <div className="stat-label">Win Rate</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="footer">
                <p>Connected to Katana (local)</p>
                <p className="address">
                    Account: {MASTER_ADDRESS.slice(0, 6)}...{MASTER_ADDRESS.slice(-4)}
                </p>
            </div>
        </div>
    );
}

export default App;
