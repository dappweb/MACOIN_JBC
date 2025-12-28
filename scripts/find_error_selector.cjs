const ethers = require('ethers');

const errors = [
    'InvalidAmount()',
    'InvalidAddress()',
    'InvalidRate()',
    'InvalidTax()',
    'InvalidFee()',
    'InvalidCycle()',
    'InvalidLevelConfig()',
    'Unauthorized()',
    'AlreadyBound()',
    'SelfReference()',
    'NotActive()',
    'AlreadyExited()',
    'Expired()',
    'LowLiquidity()',
    'InsufficientBalance()',
    'NoRewards()',
    'NothingToRedeem()',
    'TransferFailed()',
    'SumNot100()',
    'TeamCountOverflow()',
    'RecursionDepthExceeded()',
    'InvalidTeamCountUpdate()',
    'TeamCountMismatch(address,uint256,uint256)',
    'BatchUpdateSizeMismatch()',
    'OwnableUnauthorizedAccount(address)',
    'OwnableInvalidOwner(address)',
    'EnforcedPause()',
    'ExpectedPause()',
    'ReentrancyGuardReentrantCall()',
    'ERC20InsufficientBalance(address,uint256,uint256)',
    'ERC20InsufficientAllowance(address,uint256,uint256)',
    'ERC20InvalidApprover(address)',
    'ERC20InvalidReceiver(address)',
    'ERC20InvalidSender(address)',
    'ERC20InvalidSpender(address)'
];

const functions = [
    'addLiquidity(uint256,uint256)',
    'stakeLiquidity(uint256,uint256)'
];

const target = '0x118cdaa7';
const targetFunc = '0x9cd441da';

console.log('Searching for error selector:', target);

for (const error of errors) {
    const selector = ethers.id(error).slice(0, 10);
    console.log(`${selector} : ${error}`);
    if (selector === target) {
        console.log('MATCH FOUND:', error);
    }
}

console.log('\nSearching for function selector:', targetFunc);

for (const func of functions) {
    const selector = ethers.id(func).slice(0, 10);
    console.log(`${selector} : ${func}`);
    if (selector === targetFunc) {
        console.log('MATCH FOUND:', func);
    }
}
