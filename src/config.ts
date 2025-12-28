import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { 
  injectedWallet,
  tokenPocketWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
  okxWallet,
  bitgetWallet
} from '@rainbow-me/rainbowkit/wallets';
import { sepolia, bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

const mcChain = {
  id: 88813,
  name: 'MC Chain',
  nativeCurrency: { name: 'MC', symbol: 'MC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://chain.mcerscan.com/'] },
  },
  blockExplorers: {
    default: { name: 'Mcerscan', url: 'https://mcerscan.com' },
  },
  iconUrl: '/logo.png',
} as const;

export const config = getDefaultConfig({
  appName: 'RWA Jinbao',
  projectId: '2f05ae7f1116030fde2d36508f472bfb', // 使用一个有效的项目ID
  chains: [mcChain, sepolia, bscTestnet],
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        injectedWallet,
        tokenPocketWallet,
        metaMaskWallet,
        trustWallet,
        okxWallet,
        bitgetWallet,
        walletConnectWallet,
        rainbowWallet,
        coinbaseWallet,
      ],
    },
  ],
  transports: {
    [mcChain.id]: http(),
    [sepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
});
