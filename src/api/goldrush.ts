import type { Transaction, WalletInteraction } from '../types';

const API_KEY = import.meta.env.VITE_GOLDRUSH_API_KEY;
const BASE_URL = 'https://api.covalenthq.com/v1';

/**
 * Resolve an ENS name (or other named address) to a hex address via Covalent.
 * If the input is already a hex address, returns it as-is.
 */
export async function resolveAddress(input: string): Promise<string> {
  if (input.startsWith('0x')) return input;

  const url = `${BASE_URL}/eth-mainnet/address/${encodeURIComponent(input)}/balances_v2/?no-spam=true&no-nft-fetch=true`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error('Could not resolve ENS name');
  const data = await response.json();
  const resolved = data?.data?.address;
  if (!resolved) throw new Error('Could not resolve ENS name');
  return resolved;
}

const CHAINS = [
  'eth-mainnet',
  'bsc-mainnet',
  'matic-mainnet',
  'arbitrum-mainnet',
  'base-mainnet',
  'optimism-mainnet',
  'avalanche-mainnet',
  'fantom-mainnet',
];

/**
 * Fetch total portfolio value (USD) across all chains using historical token balances.
 * Sums up `quote` for each token on each chain.
 */
export async function fetchWalletBalance(walletAddress: string): Promise<number> {
  const balancePromises = CHAINS.map(async (chain) => {
    const url = `${BASE_URL}/${chain}/address/${encodeURIComponent(walletAddress)}/historical_balances/?quote-currency=USD&no-spam=true`;
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });
      if (!response.ok) return 0;
      const data = await response.json();
      const items = data?.data?.items ?? [];
      let chainTotal = 0;
      for (const item of items) {
        if (item.quote && item.quote > 0) {
          chainTotal += item.quote;
        }
      }
      return chainTotal;
    } catch {
      return 0;
    }
  });

  const results = await Promise.all(balancePromises);
  return results.reduce((sum, val) => sum + val, 0);
}

export async function fetchFirstActivity(walletAddress: string): Promise<string | null> {
  const url = `${BASE_URL}/eth-mainnet/bulk/transactions/${encodeURIComponent(walletAddress)}/?quote-currency=USD&no-logs=true`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const items = data?.data?.items ?? [];
    if (items.length > 0) {
      return items[0].block_signed_at ?? null;
    }
  } catch {
    // Non-critical — silently return null
  }

  return null;
}

async function fetchChainTransactions(chain: string, walletAddress: string): Promise<Transaction[]> {
  const url = `${BASE_URL}/${chain}/address/${encodeURIComponent(walletAddress)}/transactions_v3/?quote-currency=USD&no-logs=true`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items: Transaction[] = data?.data?.items ?? [];
    // Per-chain endpoint may not include chain_name — tag it
    for (const tx of items) {
      if (!tx.chain_name) tx.chain_name = chain;
    }
    return items.filter((tx: Transaction) => tx.successful);
  } catch {
    return [];
  }
}

export async function fetchTransactions(walletAddress: string): Promise<Transaction[]> {
  const results = await Promise.all(
    CHAINS.map((chain) => fetchChainTransactions(chain, walletAddress))
  );

  const allTxs = results.flat();
  if (allTxs.length === 0) {
    throw new Error('No transactions found across any chain');
  }
  return allTxs;
}

export function buildInteractions(
  walletAddress: string,
  transactions: Transaction[]
): WalletInteraction[] {
  const wallet = walletAddress.toLowerCase();
  const map = new Map<string, {
    address: string;
    label: string | null;
    totalValueUsd: number;
    txCount: number;
    sentCount: number;
    receivedCount: number;
    chains: Set<string>;
    primaryChainCount: Map<string, number>;
    firstInteraction: string;
    lastInteraction: string;
  }>();

  for (const tx of transactions) {
    const from = tx.from_address?.toLowerCase();
    const to = tx.to_address?.toLowerCase();
    if (!from || !to) continue;

    let counterparty: string;
    let counterpartyLabel: string | null;
    let direction: 'sent' | 'received';

    if (from === wallet) {
      counterparty = to;
      counterpartyLabel = tx.to_address_label;
      direction = 'sent';
    } else if (to === wallet) {
      counterparty = from;
      counterpartyLabel = tx.from_address_label;
      direction = 'received';
    } else {
      continue;
    }

    // Skip self-interactions
    if (counterparty === wallet) continue;

    let entry = map.get(counterparty);
    if (!entry) {
      entry = {
        address: counterparty,
        label: counterpartyLabel,
        totalValueUsd: 0,
        txCount: 0,
        sentCount: 0,
        receivedCount: 0,
        chains: new Set(),
        primaryChainCount: new Map(),
        firstInteraction: tx.block_signed_at,
        lastInteraction: tx.block_signed_at,
      };
      map.set(counterparty, entry);
    }

    entry.txCount++;
    if (direction === 'sent') entry.sentCount++;
    else entry.receivedCount++;

    entry.totalValueUsd += tx.value_quote ?? 0;
    if (tx.chain_name) {
      entry.chains.add(tx.chain_name);
      entry.primaryChainCount.set(
        tx.chain_name,
        (entry.primaryChainCount.get(tx.chain_name) ?? 0) + 1
      );
    }

    if (tx.block_signed_at > entry.lastInteraction) {
      entry.lastInteraction = tx.block_signed_at;
    }
    if (tx.block_signed_at < entry.firstInteraction) {
      entry.firstInteraction = tx.block_signed_at;
    }

    if (!entry.label && counterpartyLabel) {
      entry.label = counterpartyLabel;
    }
  }

  return Array.from(map.values())
    .map((entry) => {
      let primaryChain = 'eth-mainnet';
      let maxCount = 0;
      for (const [chain, count] of entry.primaryChainCount) {
        if (count > maxCount) {
          maxCount = count;
          primaryChain = chain;
        }
      }

      return {
        address: entry.address,
        label: entry.label,
        totalValueUsd: entry.totalValueUsd,
        txCount: entry.txCount,
        sentCount: entry.sentCount,
        receivedCount: entry.receivedCount,
        chains: Array.from(entry.chains),
        primaryChain,
        firstInteraction: entry.firstInteraction,
        lastInteraction: entry.lastInteraction,
      };
    })
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 20);
}
