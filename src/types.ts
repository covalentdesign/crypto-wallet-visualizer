export interface WalletInteraction {
  address: string;
  label: string | null;
  totalValueUsd: number;
  txCount: number;
  sentCount: number;
  receivedCount: number;
  chains: string[];
  primaryChain: string;
  firstInteraction: string;
  lastInteraction: string;
}

export interface Transaction {
  from_address: string;
  to_address: string | null;
  from_address_label: string | null;
  to_address_label: string | null;
  value_quote: number | null;
  block_signed_at: string;
  successful: boolean;
  chain_name: string;
  chain_id: string;
  tx_hash: string;
  gas_quote: number | null;
}

export interface Planet {
  interaction: WalletInteraction;
  orbitRadius: number;
  angle: number;
  angularSpeed: number;
  size: number;
  color: string;
  glowColor: string;
  x: number;
  y: number;
  z: number;
  hovered: boolean;
  // Orbital plane orientation (each chain gets a different plane)
  planeTiltX: number;  // tilt the orbital plane around X axis
  planeTiltZ: number;  // tilt the orbital plane around Z axis
}

export interface Ship {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
  direction: 'outbound' | 'inbound';
  chain: string;
  activationTime: number; // 0-1 position on timeline when this ship becomes active
}

export interface Camera {
  tiltX: number;
  rotationY: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  depth: number; // 0-1 parallax layer (0 = far/slow, 1 = near/fast)
}
