import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRenderer,
  updateSize,
  setInteractions,
  startRenderLoop,
  stopRenderLoop,
  setupInteraction,
  type RendererState,
} from './canvas/renderer';
import { fetchTransactions, fetchFirstActivity, fetchWalletBalance, buildInteractions } from './api/goldrush';
import type { Planet, WalletInteraction } from './types';
import './styles/global.css';

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererState | null>(null);
  const [walletInput, setWalletInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactions, setInteractionsState] = useState<WalletInteraction[]>([]);
  const [hoveredPlanet, setHoveredPlanet] = useState<Planet | null>(null);
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [firstActivity, setFirstActivity] = useState<string | null>(null);
  const [planetFirstSeen, setPlanetFirstSeen] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [planetBalance, setPlanetBalance] = useState<number | null>(null);
  const [disabledChains, setDisabledChains] = useState<Set<string>>(new Set());
  const [musicPlaying, setMusicPlaying] = useState(true);
  const [trailsEnabled, setTrailsEnabled] = useState(true);
  const [trackIndex, setTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleHover = useCallback((planet: Planet | null) => {
    setHoveredPlanet(planet);
  }, []);

  const handleClickPlanet = useCallback((planet: Planet | null) => {
    setSelectedPlanet((prev) => (prev === planet ? null : planet));
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = createRenderer(canvas);
    rendererRef.current = state;
    updateSize(state);
    setupInteraction(state);
    state.onClickPlanet = handleClickPlanet;
    startRenderLoop(state, handleHover);

    const handleResize = () => {
      updateSize(state);
      if (interactions.length > 0) {
        setInteractions(state, interactions);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      state.mouseX = e.clientX;
      state.mouseY = e.clientY;
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      stopRenderLoop(state);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update canvas when interactions change
  useEffect(() => {
    const state = rendererRef.current;
    if (state && interactions.length > 0) {
      setInteractions(state, interactions);
    }
  }, [interactions]);

  // Sync disabled chains to renderer
  useEffect(() => {
    const state = rendererRef.current;
    if (state) state.disabledChains = disabledChains;
  }, [disabledChains]);

  // Sync loading state to renderer (drives starburst loader animation)
  useEffect(() => {
    const state = rendererRef.current;
    if (state) state.loading = loading;
  }, [loading]);

  // Sync trails toggle to renderer
  useEffect(() => {
    const state = rendererRef.current;
    if (state) state.trailsEnabled = trailsEnabled;
  }, [trailsEnabled]);

  // Background music
  const TRACKS = ['/twin-currents.mp3', '/clouds-that-never-land.mp3'];

  useEffect(() => {
    const audio = new Audio(TRACKS[trackIndex]);
    audio.loop = false;
    audio.volume = 0.3;
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      setTrackIndex((prev) => (prev + 1) % TRACKS.length);
    });

    if (musicPlaying) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [trackIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start music when orbits appear (user has interacted by clicking Scan, so autoplay is allowed)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicPlaying || interactions.length === 0) return;
    audio.play().catch(() => {});
  }, [interactions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [musicPlaying]);

  // Fetch first on-chain activity and balance when a planet is selected
  useEffect(() => {
    if (!selectedPlanet) {
      setPlanetFirstSeen(null);
      setPlanetBalance(null);
      return;
    }
    let cancelled = false;
    setPlanetFirstSeen(null);
    setPlanetBalance(null);
    const addr = selectedPlanet.interaction.address;
    fetchFirstActivity(addr).then((date) => {
      if (!cancelled) setPlanetFirstSeen(date);
    });
    fetchWalletBalance(addr).then((bal) => {
      if (!cancelled) setPlanetBalance(bal);
    });
    return () => { cancelled = true; };
  }, [selectedPlanet]);

  const handleSubmit = async () => {
    const address = walletInput.trim();
    if (!address) return;

    setLoading(true);
    setError(null);
    setInteractionsState([]);
    setActiveWallet(address);
    setFirstActivity(null);
    setWalletBalance(null);

    try {
      const [txs, firstDate, balance] = await Promise.all([
        fetchTransactions(address),
        fetchFirstActivity(address),
        fetchWalletBalance(address),
      ]);
      setFirstActivity(firstDate);
      setWalletBalance(balance);
      if (txs.length === 0) {
        setError('No transactions found for this address');
        setLoading(false);
        return;
      }
      const result = buildInteractions(address, txs);
      if (result.length === 0) {
        setError('No wallet interactions found in transactions');
        setLoading(false);
        return;
      }
      setInteractionsState(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const totalVolume = interactions.reduce((sum, w) => sum + w.totalValueUsd, 0);
  const totalTxns = interactions.reduce((sum, w) => sum + w.txCount, 0);
  const allChains = interactions.flatMap((w) => w.chains);
  const uniqueChains = new Set(allChains).size;

  // Count planets per chain for legend
  const chainCounts = new Map<string, number>();
  for (const w of interactions) {
    chainCounts.set(w.primaryChain, (chainCounts.get(w.primaryChain) ?? 0) + 1);
  }

  const CHAIN_LEGEND_COLORS: Record<string, string> = {
    'eth-mainnet': '#627EEA',
    'matic-mainnet': '#8247E5',
    'polygon-mainnet': '#8247E5',
    'arbitrum-mainnet': '#28A0F0',
    'base-mainnet': '#0052FF',
    'optimism-mainnet': '#FF0420',
    'bsc-mainnet': '#F0B90B',
    'avalanche-mainnet': '#E84142',
    'fantom-mainnet': '#1969FF',
  };
  const defaultColor = '#4ECDC4';

  return (
    <>
      <canvas ref={canvasRef} />

      {/* Corner decorations */}
      <div className="corner-decor corner-tl" />
      <div className="corner-decor corner-tr" />
      <div className="corner-decor corner-bl" />
      <div className="corner-decor corner-br" />

      <div className="ui-overlay">
        {/* Wallet Input */}
        <div className="wallet-input-container">
          <div className="wallet-input-wrapper">
            <span className="wallet-input-label">Wallet Address</span>
            <input
              className="wallet-input"
              type="text"
              placeholder="0x..."
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={loading || !walletInput.trim()}
          >
            {loading ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-text">Scanning cross-chain transactions</div>
            <div className="loading-subtext">Mapping wallet interactions...</div>
          </div>
        )}

        {/* HUD Panel */}
        {activeWallet && interactions.length > 0 && (
          <div className="hud">
            <div className="hud-panel">
              <div className="hud-title">System Overview</div>
              <div className="hud-row">
                <span className="hud-label">Center</span>
                <span className="hud-value">{truncateAddress(activeWallet)}</span>
              </div>
              {firstActivity && (
                <div className="hud-row">
                  <span className="hud-label">First Activity</span>
                  <span className="hud-value">{formatDate(firstActivity)}</span>
                </div>
              )}
              {walletBalance !== null && (
                <div className="hud-row">
                  <span className="hud-label">Portfolio</span>
                  <span className="hud-value">{formatUsd(walletBalance)}</span>
                </div>
              )}
              <div className="hud-divider" />
              <div className="hud-row">
                <span className="hud-label">Orbiting wallets</span>
                <span className="hud-value">{interactions.length}</span>
              </div>
              <div className="hud-row">
                <span className="hud-label">Transactions</span>
                <span className="hud-value">{totalTxns}</span>
              </div>
              <div className="hud-row">
                <span className="hud-label">Volume</span>
                <span className="hud-value">{formatUsd(totalVolume)}</span>
              </div>
              <div className="hud-row">
                <span className="hud-label">Chains</span>
                <span className="hud-value">{uniqueChains}</span>
              </div>
              {chainCounts.size > 0 && (
                <>
                  <div className="hud-divider" />
                  <div className="hud-title" style={{ fontSize: '8px', marginTop: '4px' }}>Chain Legend</div>
                  {Array.from(chainCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([chain, count]) => {
                      const isDisabled = disabledChains.has(chain);
                      return (
                        <div
                          className="hud-row"
                          key={chain}
                          style={{ opacity: isDisabled ? 0.25 : 1, cursor: 'pointer', transition: 'opacity 0.3s ease' }}
                          onClick={() => {
                            setDisabledChains((prev) => {
                              const next = new Set(prev);
                              if (next.has(chain)) next.delete(chain);
                              else next.add(chain);
                              return next;
                            });
                          }}
                        >
                          <span className="hud-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              className="chain-dot"
                              style={{ background: CHAIN_LEGEND_COLORS[chain] ?? defaultColor }}
                            />
                            {chain.replace('-mainnet', '')}
                          </span>
                          <span className="hud-value">{count}</span>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Planet Tooltip */}
        {hoveredPlanet && (
          <div
            className="planet-tooltip"
            style={{
              left: tooltipPos.x + 20,
              top: tooltipPos.y - 20,
              opacity: 1,
            }}
          >
            <div className="tooltip-address">
              {truncateAddress(hoveredPlanet.interaction.address)}
            </div>
            {hoveredPlanet.interaction.label && (
              <div className="tooltip-label">{hoveredPlanet.interaction.label}</div>
            )}
            <div className="tooltip-row">
              <span className="tooltip-key">Transactions</span>
              <span className="tooltip-val">{hoveredPlanet.interaction.txCount}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-key">Sent</span>
              <span className="tooltip-val">{hoveredPlanet.interaction.sentCount}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-key">Received</span>
              <span className="tooltip-val">{hoveredPlanet.interaction.receivedCount}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-key">Volume</span>
              <span className="tooltip-val">{formatUsd(hoveredPlanet.interaction.totalValueUsd)}</span>
            </div>
            <div
              className="tooltip-chain-badge"
              style={{
                background: `${hoveredPlanet.color}22`,
                border: `1px solid ${hoveredPlanet.color}44`,
                color: hoveredPlanet.color,
              }}
            >
              {hoveredPlanet.interaction.primaryChain.replace('-mainnet', '')}
            </div>
          </div>
        )}

        {/* Planet Detail Panel (right side) */}
        {selectedPlanet && (
          <div className="detail-panel">
            <button className="detail-close" onClick={() => setSelectedPlanet(null)}>x</button>
            <div className="detail-title">Wallet Details</div>

            <div className="detail-address">{truncateAddress(selectedPlanet.interaction.address)}</div>

            {selectedPlanet.interaction.label && (
              <div className="detail-label">{selectedPlanet.interaction.label}</div>
            )}

            <div className="detail-divider" />

            <div className="detail-row">
              <span className="detail-key">Transactions</span>
              <span className="detail-val">{selectedPlanet.interaction.txCount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Sent</span>
              <span className="detail-val">{selectedPlanet.interaction.sentCount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Received</span>
              <span className="detail-val">{selectedPlanet.interaction.receivedCount}</span>
            </div>

            <div className="detail-divider" />

            <div className="detail-row">
              <span className="detail-key">Total Volume</span>
              <span className="detail-val">{formatUsd(selectedPlanet.interaction.totalValueUsd)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Portfolio</span>
              <span className="detail-val">{planetBalance !== null ? formatUsd(planetBalance) : '...'}</span>
            </div>

            <div className="detail-divider" />

            <div className="detail-row">
              <span className="detail-key">First Seen</span>
              <span className="detail-val">{planetFirstSeen ? formatDate(planetFirstSeen) : '...'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Last Seen</span>
              <span className="detail-val">{formatDate(selectedPlanet.interaction.lastInteraction)}</span>
            </div>

            <div className="detail-divider" />

            <div className="detail-row">
              <span className="detail-key">Primary Chain</span>
              <span className="detail-val">
                <span
                  className="chain-dot"
                  style={{
                    background: CHAIN_LEGEND_COLORS[selectedPlanet.interaction.primaryChain] ?? defaultColor,
                    marginRight: 6,
                  }}
                />
                {selectedPlanet.interaction.primaryChain.replace('-mainnet', '')}
              </span>
            </div>

            {selectedPlanet.interaction.chains.length > 1 && (
              <div className="detail-row">
                <span className="detail-key">All Chains</span>
                <span className="detail-val">
                  {selectedPlanet.interaction.chains.map((c) => c.replace('-mainnet', '')).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Music & trails toggles */}
        <div className="bottom-toggles">
          <div
            className="toggle-btn"
            style={{ opacity: trailsEnabled ? 1 : 0.25 }}
            onClick={() => setTrailsEnabled((prev) => !prev)}
            title={trailsEnabled ? 'Disable trails' : 'Enable trails'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {trailsEnabled ? (
                <>
                  <circle cx="6" cy="12" r="2" />
                  <path d="M8 12h2c1.5 0 2.5-2 4-2s2.5 2 4 2h2" />
                  <circle cx="22" cy="12" r="1" />
                </>
              ) : (
                <>
                  <circle cx="6" cy="12" r="2" />
                  <path d="M8 12h12" opacity="0.3" />
                  <line x1="18" y1="8" x2="14" y2="16" />
                </>
              )}
            </svg>
          </div>
          <div
            className="toggle-btn"
            style={{ opacity: musicPlaying ? 1 : 0.25 }}
            onClick={() => setMusicPlaying((prev) => !prev)}
            title={musicPlaying ? 'Mute' : 'Unmute'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {musicPlaying ? (
                <>
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
              ) : (
                <>
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              )}
            </svg>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={`status-dot ${interactions.length > 0 ? 'active' : 'idle'}`} />
            <span className="status-text">
              {interactions.length > 0 ? 'System Active' : 'Awaiting Input'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
