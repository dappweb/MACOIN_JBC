export const formatContractError = (error: any): string => {
  if (!error) return 'Unknown error occurred';

  // Handle string errors directly
  if (typeof error === 'string') {
      if (error.includes('user rejected') || error.includes('User denied')) return 'User rejected the transaction';
      return error;
  }

  // Extract error message/code
  const message = error.message || '';
  const code = error.code;
  const reason = error.reason;

  // 1. User Rejection
  if (
    message.includes('user rejected') || 
    message.includes('User denied') || 
    code === 'ACTION_REJECTED' || 
    code === 4001
  ) {
    return 'Transaction cancelled by user';
  }

  // 2. Insufficient Funds
  if (
    message.includes('insufficient funds') || 
    message.includes('exceeds balance') ||
    code === 'INSUFFICIENT_FUNDS'
  ) {
    return 'Insufficient funds for transaction';
  }

  // 3. Execution Reverted (Smart Contract Custom Errors)
  // Ethers v6 often puts the reason in 'reason' field or inside the message
  if (reason) {
      return `Transaction failed: ${reason}`;
  }
  
  if (message.includes('execution reverted')) {
    const match = message.match(/execution reverted:? (.*?)(?:\"|$)/);
    if (match && match[1]) {
        return `Transaction failed: ${match[1]}`;
    }
    return 'Transaction failed: Execution reverted';
  }

  // 4. Missing Revert Data (Gas Estimation Failed)
  // This typically means the transaction will fail, but the node didn't return a reason.
  // Could be due to: logic error, requirement not met, or wrong address.
  if (message.includes('missing revert data') || code === 'CALL_EXCEPTION') {
      // Check if we have more info in the data
      if (error.data && error.data !== '0x') {
          return 'Transaction failed: Contract execution error';
      }
      return 'Transaction failed: Check your inputs and wallet balance';
  }

  // 5. Internal RPC Error
  if (message.includes('Internal JSON-RPC error')) {
      const match = message.match(/message":"(.*?)"/);
      if (match && match[1]) {
          return `RPC Error: ${match[1]}`;
      }
      return 'Internal Wallet/RPC Error';
  }

  // 6. Network Issues
  if (message.includes('Network Error') || code === 'NETWORK_ERROR') {
      return 'Network connection error. Please check your internet or RPC URL.';
  }

  // Fallback: Use the short message if available and readable
  if (message && message.length < 80 && !message.includes('{')) {
      return message;
  }

  // Final fallback
  return 'Transaction failed. Please check details in console.';
};
