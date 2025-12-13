import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

const mcChain = {
  id: 88813,
  name: 'JBC Chain',
  nativeCurrency: { name: 'MC', symbol: 'MC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://chain.mcerscan.com/'] },
  },
  blockExplorers: {
    default: { name: 'Mcerscan', url: 'https://mcerscan.com' },
  },
} as const;

export const config = getDefaultConfig({
  appName: 'RWA Jinbao',
  projectId: 'YOUR_PROJECT_ID', // Reown (WalletConnect) Project ID. Using placeholder for now or user can update later.
  chains: [mcChain, sepolia, bscTestnet],
  transports: {
    [mcChain.id]: http(),
    [sepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
});
