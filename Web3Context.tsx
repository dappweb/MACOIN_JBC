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
  "function userTicket(address) view returns (uint256 amount, uint256 requiredLiquidity, uint256 purchaseTime, bool liquidityProvided, uint256 liquidityAmount, uint256 startTime, uint256 cycleDays, bool redeemed)",
  "function getDirectReferrals(address) view returns (address[])",
  "function getDirectReferralsData(address) view returns (tuple(address user, uint256 ticketAmount, uint256 joinTime)[])",
  "function owner() view returns (address)",
  "function setWallets(address, address, address, address) external",
  "function setDistributionPercents(uint256, uint256, uint256, uint256, uint256, uint256) external",
  "function setSwapTaxes(uint256, uint256) external",
  "function setRedemptionFee(uint256) external",
  "function adminSetUserStats(address, uint256, uint256) external",
  "function adminSetReferrer(address, address) external",
  "function getJBCPrice() view returns (uint256)",
  "function getAmountOut(uint256, uint256, uint256) pure returns (uint256)"
];

// Contract Addresses (Mock for now, replace with real deployment)
export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
  JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD", // Replace with real JBC Address
  PROTOCOL: "0x941E18CB27BA8326a1F962D4C1B94360D5A3e29f"
};

// Contract Addresses - Update these with your deployed contract addresses
// export const CONTRACT_ADDRESSES = {
//   MC_TOKEN: "0x33A6FE1Ae840c4dd2dfaC4d5aDFc8AD2a1d87eA5",    // MC Token (ERC20) - 用于购买 JBC
//   JBC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",   // JBC Token (ERC20) - 项目主代币
//   PROTOCOL: "0xA743cB357a9f59D349efB7985072779a094658dD"    // Protocol Contract - 主协议合约（包含兑换池）
// };

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

  useEffect(() => {
    // Check for referral code in URL
    const searchParams = new URLSearchParams(window.location.search);
    const ref = searchParams.get('ref');
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem('pendingReferrer', ref);
      console.log('Referrer stored:', ref);
    }
  }, []);

  // Auto-bind referrer when connected
  useEffect(() => {
    const bindReferrer = async () => {
        const pendingRef = localStorage.getItem('pendingReferrer');
        if (isConnected && address && protocolContract && pendingRef) { // Changed 'account' to 'address'
            // Validate
            if (pendingRef.toLowerCase() === address.toLowerCase()) return; // Self-ref

            try {
                // Check if already bound
                const userInfo = await protocolContract.userInfo(address);
                const currentReferrer = userInfo[0]; // referrer is first return val

                if (currentReferrer === ethers.ZeroAddress) {
                    console.log("Binding referrer:", pendingRef);
                    // Call bind
                    const tx = await protocolContract.bindReferrer(pendingRef);
                    await tx.wait();
                    console.log("Bind successful");
                    // Clear pending
                    localStorage.removeItem('pendingReferrer');
                    // Optional: Show toast or reload
                } else {
                    // Already bound
                    localStorage.removeItem('pendingReferrer');
                }
            } catch (err) {
                console.error("Auto-bind failed", err);
            }
        }
    };
    bindReferrer();
  }, [isConnected, address, protocolContract]); // Changed dependency from 'account' to 'address'

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
