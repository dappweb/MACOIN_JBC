import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'RWA Jinbao',
  projectId: 'YOUR_PROJECT_ID', // Reown (WalletConnect) Project ID. Using placeholder for now or user can update later.
  chains: [sepolia, bscTestnet],
  transports: {
    [sepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
});
