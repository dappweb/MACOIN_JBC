import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useAccount, useChainId } from 'wagmi';
import { useEthersProvider, useEthersSigner } from './wagmi-adapters';
import { useConnectModal } from '@rainbow-me/rainbowkit';

// Partial ABIs
export const MC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

export const PROTOCOL_ABI = [
  "function bindReferrer(address _referrer) external",
  "function buyTicket(uint256 amount) external",
  "function stakeLiquidity(uint256 cycleDays) external",
  "function claimRewards() external",
  "function redeem() external",
  "function swapMCToJBC(uint256 mcAmount) external",
  "function swapJBCToMC(uint256 jbcAmount) external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive)",
  "function userTicket(address) view returns (uint256 amount, uint256 requiredLiquidity, uint256 purchaseTime, bool liquidityProvided, uint256 liquidityAmount, uint256 startTime, uint256 cycleDays, bool redeemed)"
];

// Contract Addresses (Mock for now, replace with real deployment)
export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xF38EaC9cDB449F52DEFf11707c97Fe7e7b005eBE", 
  JBC_TOKEN: "0x0000000000000000000000000000000000000000", // Replace with real JBC Address
  PROTOCOL: "0x490B6c6Cb9FEC80fD17FBd2D71f095aE01f67Ec0" 
};

interface Web3ContextType {
  provider: ethers.Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  connectWallet: () => void;
  isConnected: boolean;
  mcContract: ethers.Contract | null;
  jbcContract: ethers.Contract | null;
  protocolContract: ethers.Contract | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const provider = useEthersProvider({ chainId });
  const signer = useEthersSigner({ chainId });
  const { openConnectModal } = useConnectModal();

  const [mcContract, setMcContract] = useState<ethers.Contract | null>(null);
  const [jbcContract, setJbcContract] = useState<ethers.Contract | null>(null);
  const [protocolContract, setProtocolContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    if (signer) {
        // Init Contracts with Signer (Write access)
        const _mc = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, signer);
        const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, MC_ABI, signer);
        const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, signer);
        setMcContract(_mc);
        setJbcContract(_jbc);
        setProtocolContract(_protocol);
    } else if (provider) {
        // Init Contracts with Provider (Read only)
        const _mc = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, provider);
        const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, MC_ABI, provider);
        const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
        setMcContract(_mc);
        setJbcContract(_jbc);
        setProtocolContract(_protocol);
    } else {
        setMcContract(null);
        setJbcContract(null);
        setProtocolContract(null);
    }
  }, [signer, provider]);

  const connectWallet = () => {
    if (openConnectModal) {
        openConnectModal();
    }
  };

  return (
    <Web3Context.Provider value={{
      provider: provider || null,
      signer: signer || null,
      account: address || null,
      connectWallet,
      isConnected,
      mcContract,
      jbcContract,
      protocolContract
    }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
