/**
 * Utility to decode common OpenZeppelin and custom contract errors
 */

// OpenZeppelin error signatures
const OPENZEPPELIN_ERRORS: Record<string, string> = {
  '0x118cdaa7': 'OwnableUnauthorizedAccount', // Ownable: caller is not the owner
  '0x49e27cff': 'OwnableInvalidOwner',        // Ownable: new owner is the zero address
  '0x8b78c6d8': 'ReentrancyGuardReentrantCall', // ReentrancyGuard: reentrant call
  '0x7e273289': 'ERC20InsufficientBalance',   // ERC20: insufficient balance
  '0x94280d62': 'ERC20InsufficientAllowance', // ERC20: insufficient allowance
  '0xf645eedf': 'ERC20InvalidReceiver',       // ERC20: invalid receiver
  '0xe602df05': 'ERC20InvalidSpender',        // ERC20: invalid spender
};

// Custom protocol error signatures (if any)
const PROTOCOL_ERRORS: Record<string, string> = {
  // Add custom error signatures here when available
};

/**
 * Decode error data to human-readable error name
 */
export function decodeContractError(errorData: string): string | null {
  if (!errorData || !errorData.startsWith('0x')) {
    return null;
  }

  // Extract the first 4 bytes (8 hex characters + 0x)
  const errorSignature = errorData.slice(0, 10);
  
  // Check OpenZeppelin errors first
  if (OPENZEPPELIN_ERRORS[errorSignature]) {
    return OPENZEPPELIN_ERRORS[errorSignature];
  }
  
  // Check protocol-specific errors
  if (PROTOCOL_ERRORS[errorSignature]) {
    return PROTOCOL_ERRORS[errorSignature];
  }
  
  return null;
}

/**
 * Get user-friendly error message for common contract errors
 */
export function getErrorMessage(error: any, t: any): string {
  // Check for error data first
  if (error.data) {
    const decodedError = decodeContractError(error.data);
    if (decodedError) {
      switch (decodedError) {
        case 'OwnableUnauthorizedAccount':
          return t.admin.onlyOwner || '只有合约所有者可以执行此操作';
        case 'OwnableInvalidOwner':
          return 'Invalid owner address provided.';
        case 'ReentrancyGuardReentrantCall':
          return 'Transaction failed due to reentrancy protection.';
        case 'ERC20InsufficientBalance':
          return 'Insufficient token balance.';
        case 'ERC20InsufficientAllowance':
          return 'Insufficient token allowance. Please approve tokens first.';
        default:
          return `Contract error: ${decodedError}`;
      }
    }
  }
  
  // Fallback to message-based error detection
  if (error.message) {
    if (error.message.includes('Ownable: caller is not the owner') || 
        error.message.includes('OwnableUnauthorizedAccount')) {
      return t.admin.onlyOwner || '只有合约所有者可以执行此操作';
    }
    if (error.message.includes('insufficient funds')) {
      return t.admin.insufficientFunds;
    }
    if (error.message.includes('InvalidAmount')) {
      return t.admin.invalidAmount;
    }
    if (error.message.includes('execution reverted')) {
      return `Transaction reverted: ${error.message}`;
    }
  }
  
  // Default fallback
  return error.message || 'Unknown contract error occurred.';
}

/**
 * Enhanced contract error formatter that includes decoding
 */
export function formatEnhancedContractError(error: any, t: any): string {
  const enhancedMessage = getErrorMessage(error, t);
  
  // Add technical details for debugging if available
  if (error.data && process.env.NODE_ENV === 'development') {
    const decodedError = decodeContractError(error.data);
    if (decodedError) {
      return `${enhancedMessage} (${decodedError}: ${error.data})`;
    }
  }
  
  return enhancedMessage;
}