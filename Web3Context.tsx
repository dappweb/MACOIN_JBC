import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

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
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive)",
  "function userTicket(address) view returns (uint256 amount, uint256 requiredLiquidity, uint256 purchaseTime, bool liquidityProvided, uint256 liquidityAmount, uint256 startTime, uint256 cycleDays, bool redeemed)"
];

// Contract Addresses (Mock for now, replace with real deployment)
export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xMockMCTokenAddress", 
  PROTOCOL: "0xMockProtocolAddress" 
};

interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  account: string | null;
  connectWallet: () => Promise<void>;
  isConnected: boolean;
  mcContract: ethers.Contract | null;
  protocolContract: ethers.Contract | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [mcContract, setMcContract] = useState<ethers.Contract | null>(null);
  const [protocolContract, setProtocolContract] = useState<ethers.Contract | null>(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const _signer = await _provider.getSigner();
        const _account = await _signer.getAddress();
        
        setProvider(_provider);
        setSigner(_signer);
        setAccount(_account);

        // Init Contracts
        const _mc = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, _signer);
        const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, _signer);
        
        setMcContract(_mc);
        setProtocolContract(_protocol);

      } catch (err) {
        console.error("User rejected connection or error", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  return (
    <Web3Context.Provider value={{
      provider,
      signer,
      account,
      connectWallet,
      isConnected: !!account,
      mcContract,
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
