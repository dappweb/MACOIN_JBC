const { ethers } = require("ethers");

const errors = [
    "InvalidAmount()",
    "InvalidAddress()",
    "InvalidRate()",
    "InvalidTax()",
    "InvalidFee()",
    "InvalidCycle()",
    "InvalidLevelConfig()",
    "Unauthorized()",
    "AlreadyBound()",
    "SelfReference()",
    "NotActive()",
    "AlreadyExited()",
    "Expired()",
    "LowLiquidity()",
    "InsufficientBalance()",
    "NoRewards()",
    "NothingToRedeem()",
    "TransferFailed()",
    "SumNot100()",
    "TeamCountOverflow()",
    "RecursionDepthExceeded()",
    "InvalidTeamCountUpdate()",
    "BatchUpdateSizeMismatch()"
];

errors.forEach(err => {
    console.log(`${err}: ${ethers.id(err).slice(0, 10)}`);
});
