/**
 * Utility to dynamically resolve contract addresses from deployment files
 */

interface DeploymentInfo {
  network: string;
  mcToken: string;
  jbcToken: string;
  protocolProxy: string;
  protocolImplementation: string;
  timestamp: string;
}

/**
 * Get the latest deployment info for upgradeable contracts
 */
export async function getLatestDeploymentInfo(): Promise<DeploymentInfo | null> {
  try {
    // Try to load the latest known deployment file
    const response = await fetch('/deployments/deployment-upgradeable-mc-1766827174282.json');
    if (response.ok) {
      const deployment = await response.json();
      return deployment;
    }
  } catch (error) {
    console.warn('Failed to load latest deployment info:', error);
  }
  
  return null;
}

/**
 * Get contract addresses with fallback to hardcoded values
 */
export async function getContractAddresses() {
  const deployment = await getLatestDeploymentInfo();
  
  if (deployment) {
    return {
      MC_TOKEN: deployment.mcToken,
      JBC_TOKEN: deployment.jbcToken,
      PROTOCOL: deployment.protocolProxy, // Use proxy address for upgradeable contracts
    };
  }
  
  // Fallback to hardcoded addresses
  return {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
    PROTOCOL: "0x7a216BeA62eF7629904E0d30b24F6842c9b0d660",
  };
}

/**
 * Validate that a contract address is valid and deployed
 */
export async function validateContractAddress(address: string, provider: any): Promise<boolean> {
  try {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return false;
    }
    
    const code = await provider.getCode(address);
    return code !== '0x';
  } catch (error) {
    console.error('Failed to validate contract address:', error);
    return false;
  }
}

/**
 * Get deployment timestamp for a given contract address
 */
export function getDeploymentTimestamp(deployment: DeploymentInfo | null): Date | null {
  if (!deployment?.timestamp) {
    return null;
  }
  
  try {
    return new Date(deployment.timestamp);
  } catch (error) {
    console.error('Failed to parse deployment timestamp:', error);
    return null;
  }
}

/**
 * Check if the current contract address matches the latest deployment
 */
export async function isUsingLatestContract(currentAddress: string): Promise<boolean> {
  const deployment = await getLatestDeploymentInfo();
  if (!deployment) {
    return true; // Assume it's correct if we can't verify
  }
  
  return currentAddress.toLowerCase() === deployment.protocolProxy.toLowerCase();
}