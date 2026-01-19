const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
// 新合约地址 (2026-01-04部署)
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
// 旧合约地址
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || NEW_PROTOCOL_ADDRESS;

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getDirectReferrals(address) view returns (address[])",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event RewardCapped(address indexed user, uint256 requested, uint256 paid)",
];

// 要检查的用户地址
const REFERRER_ADDRESS = "0x056f617D93E7f8865dCb6e075aa7cb49B837927c";

async function checkUserReferralRewards() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("🔍 检查用户推荐奖励情况\n");
  console.log("=".repeat(60));
  console.log(`推荐人地址: ${REFERRER_ADDRESS}`);
  console.log(`协议合约: ${PROTOCOL_ADDRESS}`);
  console.log("=".repeat(60) + "\n");

  // 先检查新合约，如果没有数据再检查旧合约
  let protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  let directReferrals = await protocol.getDirectReferrals(REFERRER_ADDRESS);
  let currentProtocolAddress = PROTOCOL_ADDRESS;
  
  if (directReferrals.length === 0) {
    console.log("⚠️  在新合约中未找到直推用户，尝试检查旧合约...\n");
    protocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    currentProtocolAddress = OLD_PROTOCOL_ADDRESS;
    directReferrals = await protocol.getDirectReferrals(REFERRER_ADDRESS);
    if (directReferrals.length > 0) {
      console.log(`✅ 在旧合约中找到 ${directReferrals.length} 个直推用户\n`);
      console.log(`当前使用的合约地址: ${currentProtocolAddress}\n`);
    }
  } else {
    console.log(`✅ 在新合约中找到 ${directReferrals.length} 个直推用户\n`);
  }

  try {
    // 1. 检查推荐人基本信息
    console.log("📋 推荐人基本信息:");
    const referrerInfo = await protocol.userInfo(REFERRER_ADDRESS);
    const referrerTicket = await protocol.userTicket(REFERRER_ADDRESS);
    
    console.log(`  是否激活: ${referrerInfo.isActive ? "✅ 是" : "❌ 否"}`);
    console.log(`  活跃直推数: ${referrerInfo.activeDirects.toString()}`);
    console.log(`  团队人数: ${referrerInfo.teamCount.toString()}`);
    console.log(`  总收益: ${ethers.formatEther(referrerInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${ethers.formatEther(referrerInfo.currentCap)} MC`);
    console.log(`  可用额度: ${ethers.formatEther(referrerInfo.currentCap - referrerInfo.totalRevenue)} MC`);
    console.log(`  门票金额: ${ethers.formatEther(referrerTicket.amount)} MC`);
    console.log(`  门票是否退出: ${referrerTicket.exited ? "是" : "否"}`);
    console.log("");

    // 2. 显示直推列表
    console.log("📝 直推用户列表:");
    console.log(`  直推数量: ${directReferrals.length}`);
    console.log("");

    if (directReferrals.length === 0) {
      console.log("  ⚠️  没有直推用户");
      return;
    }

    // 3. 检查每个直推用户的情况
    console.log("🔍 检查每个直推用户的购买和奖励情况:\n");
    let totalExpectedReward = 0n;
    let totalPaidReward = 0n;
    const issues = [];

    for (let i = 0; i < directReferrals.length; i++) {
      const referredAddress = directReferrals[i];
      console.log(`${"=".repeat(60)}`);
      console.log(`直推用户 ${i + 1}/${directReferrals.length}: ${referredAddress}`);
      console.log(`${"=".repeat(60)}`);

      try {
        // 检查被推荐人信息
        const referredInfo = await protocol.userInfo(referredAddress);
        const referredTicket = await protocol.userTicket(referredAddress);

        console.log("\n📋 被推荐人信息:");
        console.log(`  推荐人: ${referredInfo.referrer}`);
        const isCorrectReferrer = referredInfo.referrer.toLowerCase() === REFERRER_ADDRESS.toLowerCase();
        console.log(`  推荐关系: ${isCorrectReferrer ? "✅ 正确" : "❌ 错误"}`);
        console.log(`  是否激活: ${referredInfo.isActive ? "✅ 是" : "❌ 否"}`);
        console.log(`  门票金额: ${ethers.formatEther(referredTicket.amount)} MC`);
        console.log(`  门票ID: ${referredTicket.ticketId.toString()}`);
        console.log(`  购买时间: ${referredTicket.purchaseTime > 0n ? new Date(Number(referredTicket.purchaseTime) * 1000).toLocaleString('zh-CN') : "未购买"}`);
        console.log(`  门票是否退出: ${referredTicket.exited ? "是" : "否"}`);

        // 如果购买了门票，检查推荐奖励
        if (referredTicket.amount > 0n) {
          const ticketAmount = referredTicket.amount;
          const expectedReward = ticketAmount * 25n / 100n; // 25% 直推奖励
          totalExpectedReward += expectedReward;

          console.log(`\n💰 推荐奖励分析:`);
          console.log(`  门票金额: ${ethers.formatEther(ticketAmount)} MC`);
          console.log(`  应得奖励: ${ethers.formatEther(expectedReward)} MC (25%)`);

          // 查询推荐奖励事件
          console.log(`\n📜 查询推荐奖励事件:`);
          try {
            const referralEvents = await protocol.queryFilter(
              protocol.filters.ReferralRewardPaid(REFERRER_ADDRESS, referredAddress)
            );

            if (referralEvents.length > 0) {
              let paidForThisUser = 0n;
              for (let idx = 0; idx < referralEvents.length; idx++) {
                const event = referralEvents[idx];
                const mcAmount = event.args.mcAmount || 0n;
                const jbcAmount = event.args.jbcAmount || 0n;
                paidForThisUser += mcAmount;
                totalPaidReward += mcAmount;

                const block = await provider.getBlock(event.blockNumber);
                console.log(`  ✅ 事件 ${idx + 1}:`);
                console.log(`     区块: ${event.blockNumber}`);
                console.log(`     时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
                console.log(`     MC金额: ${ethers.formatEther(mcAmount)} MC`);
                console.log(`     JBC金额: ${ethers.formatEther(jbcAmount)} JBC`);
                console.log(`     奖励类型: ${event.args.rewardType === 2 ? '直推奖励' : event.args.rewardType === 3 ? '层级奖励' : '其他'}`);
                console.log(`     门票ID: ${event.args.ticketId?.toString() || 'N/A'}`);
                console.log(`     交易哈希: ${event.transactionHash}`);
              }

              if (paidForThisUser < expectedReward) {
                const missing = expectedReward - paidForThisUser;
                console.log(`\n  ⚠️  奖励不足:`);
                console.log(`     应得: ${ethers.formatEther(expectedReward)} MC`);
                console.log(`     已得: ${ethers.formatEther(paidForThisUser)} MC`);
                console.log(`     缺失: ${ethers.formatEther(missing)} MC`);
                issues.push({
                  referred: referredAddress,
                  ticketAmount: ethers.formatEther(ticketAmount),
                  expected: ethers.formatEther(expectedReward),
                  paid: ethers.formatEther(paidForThisUser),
                  missing: ethers.formatEther(missing),
                  ticketId: referredTicket.ticketId.toString()
                });
              } else {
                console.log(`\n  ✅ 奖励已完整支付`);
              }
            } else {
              console.log(`  ❌ 未找到推荐奖励事件`);
              issues.push({
                referred: referredAddress,
                ticketAmount: ethers.formatEther(ticketAmount),
                expected: ethers.formatEther(expectedReward),
                paid: "0",
                missing: ethers.formatEther(expectedReward),
                ticketId: referredTicket.ticketId.toString()
              });

              // 检查购买门票的交易
              console.log(`\n  🔍 检查购买门票交易:`);
              try {
                const purchaseEvents = await protocol.queryFilter(
                  protocol.filters.TicketPurchased(referredAddress)
                );

                if (purchaseEvents.length > 0) {
                  // 找到对应门票ID的购买事件
                  const purchaseEvent = purchaseEvents.find(e => 
                    e.args.ticketId?.toString() === referredTicket.ticketId.toString()
                  ) || purchaseEvents[purchaseEvents.length - 1];

                  if (purchaseEvent) {
                    const txHash = purchaseEvent.transactionHash;
                    const blockNumber = purchaseEvent.blockNumber;
                    const block = await provider.getBlock(blockNumber);

                    console.log(`    购买交易哈希: ${txHash}`);
                    console.log(`    购买区块: ${blockNumber}`);
                    console.log(`    购买时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);

                    // 检查购买时推荐人的状态
                    console.log(`\n  🔍 检查购买时推荐人状态:`);
                    try {
                      const historicalReferrerInfo = await protocol.userInfo.staticCall(REFERRER_ADDRESS, {
                        blockTag: blockNumber
                      });
                      const historicalReferrerTicket = await protocol.userTicket.staticCall(REFERRER_ADDRESS, {
                        blockTag: blockNumber
                      });

                      console.log(`    是否激活: ${historicalReferrerInfo.isActive ? "✅ 是" : "❌ 否"}`);
                      console.log(`    门票金额: ${ethers.formatEther(historicalReferrerTicket.amount)} MC`);
                      console.log(`    门票是否退出: ${historicalReferrerTicket.exited ? "是" : "否"}`);
                      console.log(`    总收益: ${ethers.formatEther(historicalReferrerInfo.totalRevenue)} MC`);
                      console.log(`    当前上限: ${ethers.formatEther(historicalReferrerInfo.currentCap)} MC`);
                      console.log(`    可用额度: ${ethers.formatEther(historicalReferrerInfo.currentCap - historicalReferrerInfo.totalRevenue)} MC`);

                      if (!historicalReferrerInfo.isActive || historicalReferrerTicket.amount === 0n || historicalReferrerTicket.exited) {
                        console.log(`\n    ❌ 问题确认: 购买时推荐人未激活！`);
                        console.log(`    这就是为什么没有支付推荐奖励的原因。`);
                      } else {
                        const availableCap = historicalReferrerInfo.currentCap - historicalReferrerInfo.totalRevenue;
                        if (availableCap < expectedReward) {
                          console.log(`\n    ⚠️  可用额度不足:`);
                          console.log(`      需要: ${ethers.formatEther(expectedReward)} MC`);
                          console.log(`      可用: ${ethers.formatEther(availableCap)} MC`);
                        } else {
                          console.log(`\n    ✅ 购买时推荐人状态正常，但未支付奖励`);
                          console.log(`    需要进一步检查合约代码或交易详情`);
                        }
                      }

                      // 检查购买时合约余额
                      console.log(`\n  🔍 检查购买时合约余额:`);
                      try {
                        const historicalBalance = await provider.getBalance(currentProtocolAddress, blockNumber);
                        console.log(`    合约余额: ${ethers.formatEther(historicalBalance)} MC`);
                        if (historicalBalance < expectedReward) {
                          console.log(`    ❌ 合约余额不足！`);
                        } else {
                          console.log(`    ✅ 合约余额充足`);
                        }
                      } catch (e) {
                        console.log(`    ⚠️  无法查询历史余额: ${e.message}`);
                      }

                      // 检查交易详情
                      console.log(`\n  🔍 检查购买交易详情:`);
                      try {
                        const tx = await provider.getTransactionReceipt(txHash);
                        console.log(`    交易状态: ${tx.status === 1 ? '✅ 成功' : '❌ 失败'}`);
                        console.log(`    Gas使用: ${tx.gasUsed.toString()}`);

                        // 解析事件
                        const protocolInterface = new ethers.Interface(PROTOCOL_ABI);
                        let foundReferralReward = false;
                        let foundRewardCapped = false;

                        for (const log of tx.logs) {
                          if (log.address.toLowerCase() === currentProtocolAddress.toLowerCase()) {
                            try {
                              const parsed = protocolInterface.parseLog(log);
                              if (parsed) {
                                if (parsed.name === 'ReferralRewardPaid') {
                                  if (parsed.args.user?.toLowerCase() === REFERRER_ADDRESS.toLowerCase()) {
                                    foundReferralReward = true;
                                    console.log(`    ✅ 找到推荐奖励事件:`);
                                    console.log(`       MC: ${ethers.formatEther(parsed.args.mcAmount || 0n)} MC`);
                                    console.log(`       类型: ${parsed.args.rewardType === 2 ? '直推' : '层级'}`);
                                  }
                                } else if (parsed.name === 'RewardCapped') {
                                  if (parsed.args.user?.toLowerCase() === REFERRER_ADDRESS.toLowerCase()) {
                                    foundRewardCapped = true;
                                    console.log(`    ⚠️  找到奖励上限事件:`);
                                    console.log(`       请求: ${ethers.formatEther(parsed.args.requested || 0n)} MC`);
                                    console.log(`       支付: ${ethers.formatEther(parsed.args.paid || 0n)} MC`);
                                  }
                                }
                              }
                            } catch (e) {
                              // 忽略无法解析的事件
                            }
                          }
                        }

                        if (!foundReferralReward && !foundRewardCapped) {
                          console.log(`    ❌ 交易中未找到推荐奖励相关事件`);
                        }
                      } catch (e) {
                        console.log(`    ⚠️  无法查询交易详情: ${e.message}`);
                      }
                    } catch (e) {
                      console.log(`    ⚠️  无法查询历史状态: ${e.message}`);
                    }
                  }
                } else {
                  console.log(`    ⚠️  未找到购买门票事件`);
                }
              } catch (e) {
                console.log(`    ⚠️  查询购买事件失败: ${e.message}`);
              }
            }
          } catch (e) {
            console.log(`  ⚠️  查询奖励事件失败: ${e.message}`);
          }
        } else {
          console.log(`\n  ⚠️  该用户未购买门票，推荐人无法获得奖励`);
        }
      } catch (e) {
        console.log(`\n  ❌ 查询失败: ${e.message}`);
        console.log(e.stack);
      }

      console.log("");
    }

    // 4. 总结
    console.log("\n" + "=".repeat(60));
    console.log("📊 总结");
    console.log("=".repeat(60));
    console.log(`推荐人地址: ${REFERRER_ADDRESS}`);
    console.log(`直推用户数: ${directReferrals.length}`);
    console.log(`应得总奖励: ${ethers.formatEther(totalExpectedReward)} MC`);
    console.log(`已得总奖励: ${ethers.formatEther(totalPaidReward)} MC`);
    console.log(`缺失总奖励: ${ethers.formatEther(totalExpectedReward - totalPaidReward)} MC`);
    console.log("");

    if (issues.length > 0) {
      console.log(`❌ 发现 ${issues.length} 个问题:\n`);
      issues.forEach((issue, idx) => {
        console.log(`问题 ${idx + 1}:`);
        console.log(`  被推荐人: ${issue.referred}`);
        console.log(`  门票金额: ${issue.ticketAmount} MC`);
        console.log(`  应得奖励: ${issue.expected} MC`);
        console.log(`  已得奖励: ${issue.paid} MC`);
        console.log(`  缺失奖励: ${issue.missing} MC`);
        console.log(`  门票ID: ${issue.ticketId}`);
        console.log("");
      });
    } else {
      console.log("✅ 所有推荐奖励都已正常支付");
    }

    console.log("=".repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    console.error(error.stack);
  }
}

// 执行检查
checkUserReferralRewards().catch(console.error);
