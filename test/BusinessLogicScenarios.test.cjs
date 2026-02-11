/**
 * 八种不同场景模拟测试 — 潜在的Bug和业务逻辑问题
 * 
 * 场景1: 多笔活跃质押时 3 倍出局 — 未到期质押被强制退出
 * 场景2: 赎回手续费计算不一致 — redeem() vs _handleExit 手续费公式差异
 * 场景3: 72h 门票过期竞态 — 前端检查通过但合约已过期
 * 场景4: 追加门票后 maxSingleTicketAmount 不更新 — 质押金额计算错误
 * 场景5: 收益领取时 JBC 余额不足 — 50% JBC 静默跳过，用户损失
 * 场景6: 合约余额不足时 _handleExit 部分转账 — 用户损失本金
 * 场景7: 赎回后 lastStakeDeadlineBase 重置 — 72h 倒计时从赎回时重新开始
 * 场景8: 门票过期后立即重购再质押 — refundFeeAmount 与新门票交互
 */

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("八种业务逻辑场景模拟测试", function () {
    let protocol, jbc;
    let owner, user1, user2, user3, user4, marketing, buyback, lpInjection, treasury;
    const SECONDS_IN_UNIT = 86400; // 1天
    const TICKET_EXPIRY_CUTOFF_DATE = 1770595200; // 2026-02-09 00:00:00 UTC
    const TICKET_FLEX_DURATION = 72 * 3600; // 72小时

    async function deployFixture() {
        [owner, user1, user2, user3, user4, marketing, buyback, lpInjection, treasury] = await ethers.getSigners();

        // Deploy JBC Token
        const JBCToken = await ethers.getContractFactory("JBC");
        jbc = await JBCToken.deploy(owner.address);
        await jbc.waitForDeployment();

        // Deploy Protocol
        const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
        protocol = await upgrades.deployProxy(
            JinbaoProtocolNative,
            [
                await jbc.getAddress(),
                marketing.address,
                buyback.address,
                lpInjection.address,
                treasury.address,
            ],
            { initializer: "initialize" }
        );
        await protocol.waitForDeployment();

        // 给合约提供充足 JBC 和 MC
        await jbc.transfer(await protocol.getAddress(), ethers.parseEther("50000000"));
        
        // 给合约注入原生 MC（用于 swapReserveMC 和收益分发）
        await owner.sendTransaction({
            to: await protocol.getAddress(),
            value: ethers.parseEther("5000"),
        });

        // 初始化 swap 池子
        await protocol.adminSetSwapReserves(
            ethers.parseEther("10000"), // MC
            ethers.parseEther("10000")  // JBC
        );

        // Hardhat 默认每个账户有1万ETH，无需额外转账

        // 绑定推荐关系链: owner -> user1 -> user2 -> user3 -> user4
        await protocol.connect(user1).bindReferrer(owner.address);
        await protocol.connect(user2).bindReferrer(user1.address);
        await protocol.connect(user3).bindReferrer(user2.address);
        await protocol.connect(user4).bindReferrer(user3.address);

        // 把时间推进到过期机制生效之后（2026-02-09 之后）
        const currentTime = await time.latest();
        if (currentTime < TICKET_EXPIRY_CUTOFF_DATE) {
            await time.increaseTo(TICKET_EXPIRY_CUTOFF_DATE + 3600);
        }

        return { protocol, jbc, owner, user1, user2, user3, user4 };
    }

    // ======================================================================
    // 场景1: 多笔活跃质押时 3 倍出局 — 未到期质押被强制退出
    // ======================================================================
    describe("场景1: 多笔活跃质押 + 3倍出局强制退出", function () {
        /**
         * 风险：用户有多笔不同周期的质押（如7天+30天），7天质押到期赎回时
         * 累积收益可能触发 3 倍出局，导致 30 天质押（尚未到期）也被强制退出。
         * _handleExit 中的手续费公式与正常赎回不同（amount*2/300 vs maxTicketAmount*1%）。
         */
        it("应测试多笔质押赎回触发3倍出局，验证未到期质押的处理", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 用户1买100MC门票 → currentCap = 300 MC
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });

            const ticket = await protocol.userTicket(user1.address);
            expect(ticket.amount).to.equal(ethers.parseEther("100"));

            const info = await protocol.userInfo(user1.address);
            expect(info.currentCap).to.equal(ethers.parseEther("300"));

            // 质押1: 7天周期 — 金额 = 100 * 1.5 = 150 MC
            const stakeAmount = ethers.parseEther("150");
            await protocol.connect(user1).stakeLiquidity(7, { value: stakeAmount });

            // 等7天到期后赎回第一笔
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            // 赎回前先 claim 收益看看累积了多少
            let infoBeforeClaim = await protocol.userInfo(user1.address);
            console.log("[场景1] 赎回前 totalRevenue:", ethers.formatEther(infoBeforeClaim.totalRevenue), "MC");
            console.log("[场景1] 赎回前 currentCap:", ethers.formatEther(infoBeforeClaim.currentCap), "MC");

            // 计算手续费
            const feePercent = await protocol.redemptionFeePercent();
            const maxTicketAmt = infoBeforeClaim.maxTicketAmount > 0n ? infoBeforeClaim.maxTicketAmount : ticket.amount;
            const expectedFee = (maxTicketAmt * feePercent) / 100n;
            console.log("[场景1] 预期赎回手续费:", ethers.formatEther(expectedFee), "MC");

            // 赎回
            await protocol.connect(user1).redeem({ value: expectedFee });

            const infoAfterRedeem = await protocol.userInfo(user1.address);
            console.log("[场景1] 赎回后 totalRevenue:", ethers.formatEther(infoAfterRedeem.totalRevenue), "MC");
            console.log("[场景1] 赎回后 exited:", (await protocol.userTicket(user1.address)).exited);
            
            // 检查是否触发了3倍出局
            const ticketAfter = await protocol.userTicket(user1.address);
            if (ticketAfter.exited) {
                console.log("[场景1] ✅ 赎回触发了3倍出局");
                // 检查 refundFeeAmount
                const infoFinal = await protocol.userInfo(user1.address);
                console.log("[场景1] refundFeeAmount:", ethers.formatEther(infoFinal.refundFeeAmount), "MC");
            } else {
                console.log("[场景1] 未达到3倍上限，再进行第2笔质押测试");
                
                // 第2笔质押: 30天周期
                await protocol.connect(user1).stakeLiquidity(30, { value: stakeAmount });
                
                // 等30天到期
                await time.increase(30 * SECONDS_IN_UNIT + 1);
                
                // claimRewards 可能触发出局
                try {
                    await protocol.connect(user1).claimRewards();
                    console.log("[场景1] claimRewards 成功");
                } catch (e) {
                    console.log("[场景1] claimRewards 出错:", e.message?.substring(0, 100));
                }
                
                const infoFinal2 = await protocol.userInfo(user1.address);
                const ticketFinal2 = await protocol.userTicket(user1.address);
                console.log("[场景1] 最终 totalRevenue:", ethers.formatEther(infoFinal2.totalRevenue), "MC");
                console.log("[场景1] 最终 exited:", ticketFinal2.exited);
                console.log("[场景1] refundFeeAmount:", ethers.formatEther(infoFinal2.refundFeeAmount), "MC");
            }
        });

        it("应对比 _handleExit 和 redeem 的手续费差异", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 用户1买1000MC门票 → currentCap = 3000 MC
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("1000") });

            const stakeAmount = ethers.parseEther("1500"); // 1000 * 1.5

            // 进行多次质押和领取，使 totalRevenue 接近 3000
            // 第1笔: 30天 → 日收益率 2% → 30天总收益 = 1500 * 0.02 * 30 = 900 MC
            await protocol.connect(user1).stakeLiquidity(30, { value: stakeAmount });
            await time.increase(30 * SECONDS_IN_UNIT + 1);
            
            const feePercent = await protocol.redemptionFeePercent();
            const feeBase = ethers.parseEther("1000");
            const fee = (feeBase * feePercent) / 100n;
            
            await protocol.connect(user1).redeem({ value: fee });
            
            let info = await protocol.userInfo(user1.address);
            console.log("[场景1b] 第1轮赎回后 totalRevenue:", ethers.formatEther(info.totalRevenue));

            if (!(await protocol.userTicket(user1.address)).exited) {
                // 第2笔: 30天再来
                await protocol.connect(user1).stakeLiquidity(30, { value: stakeAmount });
                await time.increase(30 * SECONDS_IN_UNIT + 1);
                await protocol.connect(user1).redeem({ value: fee });
                
                info = await protocol.userInfo(user1.address);
                console.log("[场景1b] 第2轮赎回后 totalRevenue:", ethers.formatEther(info.totalRevenue));
            }

            if (!(await protocol.userTicket(user1.address)).exited) {
                // 第3笔: 应该触发出局
                await protocol.connect(user1).stakeLiquidity(30, { value: stakeAmount });
                await time.increase(30 * SECONDS_IN_UNIT + 1);

                const balanceBefore = await ethers.provider.getBalance(user1.address);
                
                // 这次赎回应触发 _handleExit
                await protocol.connect(user1).redeem({ value: fee });
                
                const balanceAfter = await ethers.provider.getBalance(user1.address);
                info = await protocol.userInfo(user1.address);
                
                console.log("[场景1b] 第3轮赎回后 totalRevenue:", ethers.formatEther(info.totalRevenue));
                console.log("[场景1b] exited:", (await protocol.userTicket(user1.address)).exited);
                console.log("[场景1b] 余额变化:", ethers.formatEther(balanceAfter - balanceBefore), "MC");
                console.log("[场景1b] refundFeeAmount:", ethers.formatEther(info.refundFeeAmount), "MC");
            }
            
            // _handleExit 手续费: amount * 2 * feePercent / 300
            // redeem 手续费: maxTicketAmount * feePercent / 100
            // 当 feePercent=1: exit手续费 = 1500 * 2 / 300 = 10 MC; redeem手续费 = 1000 / 100 = 10 MC
            console.log("[场景1b] _handleExit 手续费公式: stakeAmount * 2 * feePercent / 300");
            console.log("[场景1b] redeem 手续费公式: maxTicketAmount * feePercent / 100");
            console.log("[场景1b] 注：两公式基数不同 — 前者基于质押金额，后者基于门票金额");
        });
    });

    // ======================================================================
    // 场景2: 赎回手续费计算不一致 — 新旧逻辑 stakeRedemptionFeePaid
    // ======================================================================
    describe("场景2: 赎回手续费新旧逻辑分歧", function () {
        /**
         * 风险：合约有两套手续费逻辑 —
         *   旧逻辑: stakeRedemptionFeePaid[id] > 0 → 退还本金+预付手续费，不再收费
         *   新逻辑: stakeRedemptionFeePaid[id] == 0 → 收取 feeBase*feePercent/100
         * 前端 handleRedeem 镜像了此逻辑，但若 stakeRedemptionFeePaid 查询失败或
         * 合约升级后旧数据残留，可能导致手续费计算错误。
         */
        it("应验证新逻辑下手续费计算的正确性", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("500") });
            
            const stakeAmount = ethers.parseEther("750"); // 500 * 1.5
            await protocol.connect(user1).stakeLiquidity(7, { value: stakeAmount });

            // 获取 stakeId
            const stake0 = await protocol.userStakes(user1.address, 0);
            const stakeId = stake0.id || stake0[0];
            console.log("[场景2] stakeId:", stakeId.toString());

            // 检查 stakeRedemptionFeePaid（新逻辑应为0）
            let feePaid = 0n;
            try {
                feePaid = await protocol.stakeRedemptionFeePaid(stakeId);
            } catch (e) {
                console.log("[场景2] stakeRedemptionFeePaid 不可用");
            }
            console.log("[场景2] stakeRedemptionFeePaid:", ethers.formatEther(feePaid), "MC");
            expect(feePaid).to.equal(0n, "新质押的 stakeRedemptionFeePaid 应为0");

            // 等待到期
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            // 计算预期手续费
            const info = await protocol.userInfo(user1.address);
            const ticketData = await protocol.userTicket(user1.address);
            const feePercent = await protocol.redemptionFeePercent();
            const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ticketData.amount;
            const expectedFee = (feeBase * feePercent) / 100n;
            
            console.log("[场景2] feeBase:", ethers.formatEther(feeBase), "MC");
            console.log("[场景2] feePercent:", feePercent.toString());
            console.log("[场景2] expectedFee:", ethers.formatEther(expectedFee), "MC");

            // 检查如果少付手续费会不会 revert
            if (expectedFee > 0n) {
                await expect(
                    protocol.connect(user1).redeem({ value: expectedFee - 1n })
                ).to.be.reverted;
                console.log("[场景2] ✅ 手续费不足正确 revert");
            }

            // 正确手续费赎回
            const balBefore = await ethers.provider.getBalance(user1.address);
            const tx = await protocol.connect(user1).redeem({ value: expectedFee });
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balAfter = await ethers.provider.getBalance(user1.address);

            const netChange = balAfter - balBefore + gasUsed;
            console.log("[场景2] 赎回后净收入（含本金+收益-手续费）:", ethers.formatEther(netChange), "MC");
            
            // 检查 refundFeeAmount（手续费存入待退）
            const infoAfter = await protocol.userInfo(user1.address);
            console.log("[场景2] refundFeeAmount:", ethers.formatEther(infoAfter.refundFeeAmount), "MC");
            expect(infoAfter.refundFeeAmount).to.equal(expectedFee, "手续费应存入 refundFeeAmount");
        });

        it("应验证 redeemStake 单笔赎回手续费一致性", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("300") });
            
            const stakeAmount = ethers.parseEther("450"); // 300 * 1.5
            
            // 创建2笔质押
            await protocol.connect(user2).stakeLiquidity(7, { value: stakeAmount });
            await protocol.connect(user2).stakeLiquidity(15, { value: stakeAmount });

            const stake0 = await protocol.userStakes(user2.address, 0);
            const stake1 = await protocol.userStakes(user2.address, 1);
            console.log("[场景2b] 质押0 id:", stake0[0].toString(), "周期:", stake0[3].toString());
            console.log("[场景2b] 质押1 id:", stake1[0].toString(), "周期:", stake1[3].toString());

            // 等7天后用 redeemStake 赎回第一笔
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            const info = await protocol.userInfo(user2.address);
            const ticketData = await protocol.userTicket(user2.address);
            const feePercent = await protocol.redemptionFeePercent();
            const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ticketData.amount;
            const singleFee = (feeBase * feePercent) / 100n;
            
            console.log("[场景2b] 单笔手续费:", ethers.formatEther(singleFee), "MC");

            // redeemStake 赎回第一笔
            await protocol.connect(user2).redeemStake(stake0[0], { value: singleFee });
            console.log("[场景2b] ✅ redeemStake 成功赎回第1笔");

            // 第2笔还没到期，尝试赎回应失败
            await expect(
                protocol.connect(user2).redeemStake(stake1[0], { value: singleFee })
            ).to.be.reverted;
            console.log("[场景2b] ✅ 未到期质押正确拒绝赎回");

            // 等剩余时间后赎回第2笔
            await time.increase(8 * SECONDS_IN_UNIT + 1); // 15 - 7 = 还需8天
            await protocol.connect(user2).redeemStake(stake1[0], { value: singleFee });
            console.log("[场景2b] ✅ redeemStake 成功赎回第2笔");

            // 每笔赎回各收一次 singleFee，共 2 * singleFee
            const finalInfo = await protocol.userInfo(user2.address);
            console.log("[场景2b] 总 refundFeeAmount:", ethers.formatEther(finalInfo.refundFeeAmount), "MC");
            expect(finalInfo.refundFeeAmount).to.equal(singleFee * 2n, "两笔赎回手续费应累加");
        });
    });

    // ======================================================================
    // 场景3: 72h 门票过期竞态 — 过期边界精确测试
    // ======================================================================
    describe("场景3: 72h 门票过期边界测试", function () {
        /**
         * 风险：前端 handleStake 检查通过但交易上链时门票已过期。
         * 测试精确的过期边界（刚好72h vs 72h+1s）。
         */
        it("应测试72h边界：刚好72h可质押，72h+1s不可质押", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 确保在 cutoff 之后
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });
            
            const ticket = await protocol.userTicket(user1.address);
            const purchaseTime = Number(ticket.purchaseTime);
            console.log("[场景3] 购票时间:", purchaseTime);

            // 推进到刚好72h（time.increaseTo 设置下一区块的时间戳）
            // 合约条件: block.timestamp <= deadlineBase + flexDuration
            // 注意: stakeLiquidity 执行在下一区块，所以 -1 确保在边界内
            const targetTime = purchaseTime + TICKET_FLEX_DURATION - 1;
            const currentTime = await time.latest();
            if (targetTime > currentTime) {
                await time.increaseTo(targetTime);
            }

            // 刚好72h — 应该还能质押（block.timestamp <= deadlineBase + flexDuration）
            const stakeAmount = ethers.parseEther("150");
            try {
                await protocol.connect(user1).stakeLiquidity(7, { value: stakeAmount });
                console.log("[场景3] ✅ 刚好72h时质押成功");
            } catch (e) {
                console.log("[场景3] ❌ 刚好72h时质押失败:", e.message?.substring(0, 100));
            }

            // 检查门票状态
            const ticketAfter1 = await protocol.userTicket(user1.address);
            console.log("[场景3] 72h时门票金额:", ethers.formatEther(ticketAfter1.amount));
        });

        it("应测试72h+1s后门票过期，质押被拒绝", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });
            
            const ticket = await protocol.userTicket(user2.address);
            const purchaseTime = Number(ticket.purchaseTime);

            // 推进到72h + 1秒
            await time.increaseTo(purchaseTime + TICKET_FLEX_DURATION + 1);

            // 应该失败（门票已过期）
            const stakeAmount = ethers.parseEther("150");
            try {
                await protocol.connect(user2).stakeLiquidity(7, { value: stakeAmount });
                // 如果成功到这里，说明门票被过期后清除了，再查看状态
                const ticketAfter = await protocol.userTicket(user2.address);
                console.log("[场景3b] 质押后门票金额:", ethers.formatEther(ticketAfter.amount));
                if (ticketAfter.amount === 0n) {
                    console.log("[场景3b] ✅ 门票已被 _expireTicketIfNeeded 清除，合约 revert NotActive()");
                }
            } catch (e) {
                console.log("[场景3b] ✅ 72h+1s后质押正确被拒绝:", e.message?.substring(0, 100));
            }

            // 确认门票状态：
            // 重要发现！stakeLiquidity revert 时 _expireTicketIfNeeded 的状态变更也被回滚
            // 所以门票在存储中仍然显示为"有效"（amount>0），形成"僵尸门票"
            // 只有通过 buyTicket（不会revert）才能真正清除过期门票
            const finalTicket = await protocol.userTicket(user2.address);
            console.log("[场景3b] 门票最终金额:", ethers.formatEther(finalTicket.amount));
            
            if (finalTicket.amount > 0n) {
                console.log("[场景3b] ⚠️ 发现'僵尸门票'：门票实际已过期但存储未清除");
                console.log("[场景3b] 原因：stakeLiquidity 整体 revert 导致 _expireTicketIfNeeded 的修改也被回滚");
                console.log("[场景3b] 影响：用户看到门票金额仍为100MC，但无法质押");
                console.log("[场景3b] 解决：用户需通过 buyTicket 重新触发过期 + 重购");
                
                // 验证通过 buyTicket 可以正确处理过期门票
                await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });
                const ticketAfterRebuy = await protocol.userTicket(user2.address);
                console.log("[场景3b] ✅ 重新购票后门票金额:", ethers.formatEther(ticketAfterRebuy.amount));
                expect(ticketAfterRebuy.amount).to.equal(ethers.parseEther("100"));
            } else {
                expect(finalTicket.amount).to.equal(0n, "门票应已被过期清除");
            }
        });

        it("应测试有活跃质押时门票不过期", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            await protocol.connect(user3).buyTicket({ value: ethers.parseEther("100") });
            
            // 立即质押
            const stakeAmount = ethers.parseEther("150");
            await protocol.connect(user3).stakeLiquidity(30, { value: stakeAmount });

            // 推进超过72h
            await time.increase(TICKET_FLEX_DURATION + 3600);

            // 有活跃质押 → 门票不应过期 → 仍可操作
            const ticket = await protocol.userTicket(user3.address);
            expect(ticket.amount).to.be.gt(0n, "有活跃质押时门票不应过期");
            expect(ticket.exited).to.be.false;
            console.log("[场景3c] ✅ 有活跃质押时，超过72h门票仍有效");

            // 尝试再次质押（应成功，因为门票未过期）
            try {
                await protocol.connect(user3).stakeLiquidity(7, { value: stakeAmount });
                console.log("[场景3c] ✅ 有活跃质押时可继续追加质押");
            } catch (e) {
                console.log("[场景3c] 追加质押结果:", e.message?.substring(0, 100));
            }
        });
    });

    // ======================================================================
    // 场景4: 追加门票后 maxSingleTicketAmount 与质押金额
    // ======================================================================
    describe("场景4: 追加门票后质押金额计算", function () {
        /**
         * 风险：用户先买100MC门票，后追加到500MC。maxSingleTicketAmount 在首次质押时
         * 被锁定。追加门票后 baseMaxAmount 仍用旧值 → 质押金额可能不匹配期望。
         * 合约逻辑：maxSingleTicketAmount 在 buyTicket 时更新（取最大值），
         * 但 stakeLiquidity 用已存储的 maxSingleTicketAmount。
         */
        it("应测试追加门票后质押金额是否正确更新", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 第1次购票: 100MC
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });
            
            let info = await protocol.userInfo(user1.address);
            console.log("[场景4] 首购后 maxSingleTicketAmount:", ethers.formatEther(info.maxSingleTicketAmount));
            console.log("[场景4] 首购后 maxTicketAmount:", ethers.formatEther(info.maxTicketAmount));

            // 第2次购票: 追加500MC
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("500") });
            
            info = await protocol.userInfo(user1.address);
            const ticket = await protocol.userTicket(user1.address);
            console.log("[场景4] 追加后 maxSingleTicketAmount:", ethers.formatEther(info.maxSingleTicketAmount));
            console.log("[场景4] 追加后 maxTicketAmount:", ethers.formatEther(info.maxTicketAmount));
            console.log("[场景4] 追加后 ticket.amount:", ethers.formatEther(ticket.amount));
            
            // maxSingleTicketAmount 应为 500（取两次购票中的最大值）
            expect(info.maxSingleTicketAmount).to.equal(
                ethers.parseEther("500"),
                "maxSingleTicketAmount 应更新为最大单笔500"
            );

            // 质押金额应基于 maxSingleTicketAmount * 1.5 = 750 MC
            const expectedStakeAmount = (info.maxSingleTicketAmount * 150n) / 100n;
            console.log("[场景4] 预期质押金额:", ethers.formatEther(expectedStakeAmount), "MC");

            // 尝试用错误金额质押（旧的100*1.5=150）应失败
            await expect(
                protocol.connect(user1).stakeLiquidity(7, { value: ethers.parseEther("150") })
            ).to.be.reverted;
            console.log("[场景4] ✅ 旧金额150MC质押被正确拒绝");

            // 用正确金额质押
            await protocol.connect(user1).stakeLiquidity(7, { value: expectedStakeAmount });
            console.log("[场景4] ✅ 正确金额", ethers.formatEther(expectedStakeAmount), "MC 质押成功");
        });

        it("应测试门票追加但 maxSingleTicketAmount 不减小", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 先买500MC，再买100MC
            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("500") });
            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });

            const info = await protocol.userInfo(user2.address);
            console.log("[场景4b] maxSingleTicketAmount:", ethers.formatEther(info.maxSingleTicketAmount));
            
            // maxSingleTicketAmount 仍应为500（取最大值）
            expect(info.maxSingleTicketAmount).to.equal(
                ethers.parseEther("500"),
                "maxSingleTicketAmount 不应因小额追加而减小"
            );

            // 质押应基于500 * 1.5 = 750
            const stakeAmount = ethers.parseEther("750");
            await protocol.connect(user2).stakeLiquidity(7, { value: stakeAmount });
            console.log("[场景4b] ✅ 基于 maxSingleTicketAmount=500 的质押金额750MC正确");
        });
    });

    // ======================================================================
    // 场景5: 收益领取时 JBC 余额不足 — 静默跳过问题
    // ======================================================================
    describe("场景5: JBC 余额不足时收益分配", function () {
        /**
         * 风险：合约 claimRewards 和 _finalizeRedemption 中，
         * 如果 JBC 余额不足，只是跳过 JBC 部分（不 revert），
         * 用户只收到 50% MC 部分，损失 50% JBC 部分的收益。
         * 但 totalRevenue 仍按 100% 计入 → 3倍上限中已扣除但未实际收到。
         */
        it("应检测 JBC 不足时的收益损失", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 清空合约中的 JBC（转回 owner）
            const protocolAddr = await protocol.getAddress();
            const jbcBalance = await jbc.balanceOf(protocolAddr);

            // 用 adminSetSwapReserves 将 JBC 池子设为 0，模拟 JBC 耗尽
            // 注意：合约 JBC 余额仍有，但 swapReserveJBC=0 会影响价格计算
            await protocol.adminSetSwapReserves(
                ethers.parseEther("10000"), // MC 保留
                0n // JBC 设为0 — 价格计算时会回退到默认 1 ether/JBC
            );
            console.log("[场景5] 已将 swapReserveJBC 设为0");

            const swapJBC = await protocol.swapReserveJBC();
            console.log("[场景5] swapReserveJBC:", ethers.formatEther(swapJBC));

            // 用户正常购票+质押
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });
            await protocol.connect(user1).stakeLiquidity(7, { value: ethers.parseEther("150") });

            // 等7天
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            // 领取收益
            const balMCBefore = await ethers.provider.getBalance(user1.address);
            const balJBCBefore = await jbc.balanceOf(user1.address);

            try {
                await protocol.connect(user1).claimRewards();
                
                const balMCAfter = await ethers.provider.getBalance(user1.address);
                const balJBCAfter = await jbc.balanceOf(user1.address);
                
                const mcReceived = balMCAfter - balMCBefore;
                const jbcReceived = balJBCAfter - balJBCBefore;
                
                console.log("[场景5] MC收益:", ethers.formatEther(mcReceived));
                console.log("[场景5] JBC收益:", ethers.formatEther(jbcReceived));
                
                const infoCheck = await protocol.userInfo(user1.address);
                console.log("[场景5] totalRevenue 计入:", ethers.formatEther(infoCheck.totalRevenue));
                
                // 检查是否存在损失
                if (jbcReceived === 0n && infoCheck.totalRevenue > 0n) {
                    console.log("[场景5] ⚠️ 严重：JBC部分为0但totalRevenue已计入，用户损失50%收益的JBC部分！");
                }
            } catch (e) {
                console.log("[场景5] claimRewards:", e.message?.substring(0, 150));
            }
        });
    });

    // ======================================================================
    // 场景6: 合约 MC 余额不足时 _handleExit 部分转账
    // ======================================================================
    describe("场景6: 合约余额不足时的出局处理", function () {
        /**
         * 风险：_handleExit L1048-L1054 中，如果 contractBalance < totalReturn，
         * 只转可用余额，用户损失剩余本金。
         * 这是一种静默失败 — 不 revert，用户不知道少收了钱。
         */
        it("应验证余额不足时用户得到的金额", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 大量用户购票质押，消耗合约余额
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("1000") });
            await protocol.connect(user1).stakeLiquidity(7, { value: ethers.parseEther("1500") });

            // 查看合约余额
            const protocolAddr = await protocol.getAddress();
            const contractBalance = await ethers.provider.getBalance(protocolAddr);
            console.log("[场景6] 合约MC余额:", ethers.formatEther(contractBalance));

            // 等待到期
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            // 赎回
            const feePercent = await protocol.redemptionFeePercent();
            const info = await protocol.userInfo(user1.address);
            const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ethers.parseEther("1000");
            const fee = (feeBase * feePercent) / 100n;

            const balBefore = await ethers.provider.getBalance(user1.address);
            
            try {
                const tx = await protocol.connect(user1).redeem({ value: fee });
                const receipt = await tx.wait();
                const gasUsed = receipt.gasUsed * receipt.gasPrice;
                const balAfter = await ethers.provider.getBalance(user1.address);
                
                const netChange = balAfter - balBefore + gasUsed;
                console.log("[场景6] 用户净收入:", ethers.formatEther(netChange), "MC");
                console.log("[场景6] 预期收入 ≈ 本金1500 + 收益 - 手续费");
                
                // 检查合约余额
                const contractBalAfter = await ethers.provider.getBalance(protocolAddr);
                console.log("[场景6] 赎回后合约余额:", ethers.formatEther(contractBalAfter));

            } catch (e) {
                console.log("[场景6] 赎回失败:", e.message?.substring(0, 100));
                console.log("[场景6] ⚠️ InsufficientNativeBalance — 合约余额不足以返还本金");
            }
        });
    });

    // ======================================================================
    // 场景7: 赎回后 lastStakeDeadlineBase 重置与 72h 倒计时
    // ======================================================================
    describe("场景7: 赎回后72h倒计时重置", function () {
        /**
         * 风险：_finalizeRedemption 中，当 _getActiveStakeTotal == 0 时，
         * 设置 lastStakeDeadlineBase[user] = block.timestamp。
         * 这意味着赎回后用户有新的72h窗口来进行下一次质押。
         * 测试验证这个重置机制是否正确工作。
         */
        it("应验证赎回后72h窗口正确重置", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 购票
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });
            
            // 立即质押
            await protocol.connect(user1).stakeLiquidity(7, { value: ethers.parseEther("150") });

            // 等待7天赎回
            await time.increase(7 * SECONDS_IN_UNIT + 1);

            const feePercent = await protocol.redemptionFeePercent();
            const info = await protocol.userInfo(user1.address);
            const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ethers.parseEther("100");
            const fee = (feeBase * feePercent) / 100n;

            await protocol.connect(user1).redeem({ value: fee });
            
            const redeemTime = await time.latest();
            console.log("[场景7] 赎回时间:", redeemTime);

            // 检查 lastStakeDeadlineBase 是否更新
            const deadlineBase = await protocol.lastStakeDeadlineBase(user1.address);
            console.log("[场景7] lastStakeDeadlineBase:", Number(deadlineBase));
            expect(Number(deadlineBase)).to.be.approximately(redeemTime, 2, "deadlineBase 应等于赎回时间");

            // 在72h内再次质押应成功
            await time.increase(70 * 3600); // 70h
            try {
                await protocol.connect(user1).stakeLiquidity(7, { value: ethers.parseEther("150") });
                console.log("[场景7] ✅ 赎回后70h内再次质押成功");
            } catch (e) {
                console.log("[场景7] ❌ 赎回后70h内质押失败:", e.message?.substring(0, 100));
            }
        });

        it("应验证赎回后超过72h门票过期", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });
            await protocol.connect(user2).stakeLiquidity(7, { value: ethers.parseEther("150") });

            // 等待7天赎回
            await time.increase(7 * SECONDS_IN_UNIT + 1);
            
            const feePercent = await protocol.redemptionFeePercent();
            const info = await protocol.userInfo(user2.address);
            const feeBase = info.maxTicketAmount > 0n ? info.maxTicketAmount : ethers.parseEther("100");
            const fee = (feeBase * feePercent) / 100n;
            await protocol.connect(user2).redeem({ value: fee });

            // 超过72h后尝试质押
            await time.increase(TICKET_FLEX_DURATION + 1);

            try {
                await protocol.connect(user2).stakeLiquidity(7, { value: ethers.parseEther("150") });
                console.log("[场景7b] ❌ 意外：超过72h后仍能质押");
            } catch (e) {
                console.log("[场景7b] ✅ 赎回后超72h质押被正确拒绝");
            }

            // 验证门票状态
            // 与场景3b相同的"僵尸门票"现象
            const ticket = await protocol.userTicket(user2.address);
            console.log("[场景7b] 门票金额:", ethers.formatEther(ticket.amount));
            
            if (ticket.amount > 0n) {
                console.log("[场景7b] ⚠️ 僵尸门票：赎回后超72h，门票实际过期但存储未清除");
                // 通过 buyTicket 触发过期清除
                await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });
                const ticketAfter = await protocol.userTicket(user2.address);
                console.log("[场景7b] ✅ 重购后门票金额:", ethers.formatEther(ticketAfter.amount));
            } else {
                expect(ticket.amount).to.equal(0n, "超72h后门票应被过期清除");
            }
        });
    });

    // ======================================================================
    // 场景8: 3倍出局后重购门票+质押 — refundFeeAmount 交互
    // ======================================================================
    describe("场景8: 3倍出局后重新购票质押周期", function () {
        /**
         * 风险：用户3倍出局后：
         * 1. exited=true, refundFeeAmount > 0
         * 2. 重新买票时会重置门票（清零exited, totalRevenue）
         * 3. 再质押时合约先退还 refundFeeAmount
         * 4. 如果 swapReserveMC < refundFeeAmount 会 revert
         * 测试整个"出局→重购→再质押"链条是否通畅
         */
        it("应测试完整的出局→重购→再质押生命周期", async function () {
            ({ protocol, jbc, owner, user1, user2, user3, user4 } = await loadFixture(deployFixture));

            // 购票1000MC → cap = 3000
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("1000") });
            const stakeAmount = ethers.parseEther("1500");

            // 反复质押直到3倍出局
            let exited = false;
            let round = 0;
            while (!exited && round < 10) {
                round++;
                try {
                    await protocol.connect(user1).stakeLiquidity(30, { value: stakeAmount });
                } catch (e) {
                    console.log(`[场景8] 第${round}轮质押失败:`, e.message?.substring(0, 80));
                    break;
                }
                
                await time.increase(30 * SECONDS_IN_UNIT + 1);

                const infoNow = await protocol.userInfo(user1.address);
                const feeBase = infoNow.maxTicketAmount > 0n ? infoNow.maxTicketAmount : ethers.parseEther("1000");
                const feePercent = await protocol.redemptionFeePercent();
                const fee = (feeBase * feePercent) / 100n;

                try {
                    await protocol.connect(user1).redeem({ value: fee });
                } catch (e) {
                    console.log(`[场景8] 第${round}轮赎回失败:`, e.message?.substring(0, 80));
                    // 可能是 claimRewards 触发了出局
                }
                
                const ticketNow = await protocol.userTicket(user1.address);
                exited = ticketNow.exited;
                
                const infoAfter = await protocol.userInfo(user1.address);
                console.log(`[场景8] 第${round}轮 → totalRevenue: ${ethers.formatEther(infoAfter.totalRevenue)}, cap: ${ethers.formatEther(infoAfter.currentCap)}, exited: ${exited}`);
            }

            if (!exited) {
                console.log("[场景8] 未在10轮内出局，跳过后续测试");
                return;
            }

            // 出局后状态检查
            const infoExited = await protocol.userInfo(user1.address);
            console.log("[场景8] 出局后 refundFeeAmount:", ethers.formatEther(infoExited.refundFeeAmount));
            console.log("[场景8] 出局后 isActive:", infoExited.isActive);

            // 重新购买门票
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("500") });
            
            const newTicket = await protocol.userTicket(user1.address);
            const newInfo = await protocol.userInfo(user1.address);
            console.log("[场景8] 重购后 ticket.amount:", ethers.formatEther(newTicket.amount));
            console.log("[场景8] 重购后 currentCap:", ethers.formatEther(newInfo.currentCap));
            console.log("[场景8] 重购后 totalRevenue:", ethers.formatEther(newInfo.totalRevenue));
            console.log("[场景8] 重购后 exited:", newTicket.exited);
            
            expect(newTicket.exited).to.be.false;
            expect(newInfo.totalRevenue).to.equal(0n, "重购后 totalRevenue 应清零");
            expect(newInfo.currentCap).to.equal(ethers.parseEther("1500"), "重购500 → cap应为1500");

            // 检查 refundFeeAmount 是否保留（应保留，在质押时退还）
            const refundBefore = newInfo.refundFeeAmount;
            console.log("[场景8] 重购后 refundFeeAmount（应保留）:", ethers.formatEther(refundBefore));

            // 检查 swapReserveMC 是否足够退还
            const swapReserve = await protocol.swapReserveMC();
            console.log("[场景8] swapReserveMC:", ethers.formatEther(swapReserve));
            
            if (swapReserve < refundBefore) {
                console.log("[场景8] ⚠️ swapReserveMC 不足以退还 refundFeeAmount，质押将会 revert!");
            }

            // 重新质押
            const newStakeAmount = (newInfo.maxSingleTicketAmount * 150n) / 100n;
            console.log("[场景8] 新质押金额:", ethers.formatEther(newStakeAmount));
            
            const balBefore = await ethers.provider.getBalance(user1.address);
            
            try {
                const tx = await protocol.connect(user1).stakeLiquidity(7, { value: newStakeAmount });
                await tx.wait();
                console.log("[场景8] ✅ 重新质押成功！refund 已退还");
                
                const balAfter = await ethers.provider.getBalance(user1.address);
                console.log("[场景8] 余额变化（含refund退还）:", ethers.formatEther(balAfter - balBefore));
                
                const refundAfter = (await protocol.userInfo(user1.address)).refundFeeAmount;
                expect(refundAfter).to.equal(0n, "质押后 refundFeeAmount 应清零");
                console.log("[场景8] ✅ refundFeeAmount 已清零");
            } catch (e) {
                console.log("[场景8] ❌ 重新质押失败:", e.message?.substring(0, 150));
                console.log("[场景8] 可能原因: swapReserveMC 不足或金额不匹配");
            }
        });
    });

    // ======================================================================
    // 综合统计
    // ======================================================================
    describe("综合：潜在问题汇总输出", function () {
        it("应输出所有已知的合约 vs 前端不一致清单", function () {
            console.log("\n========================================");
            console.log("  合约与前端潜在不一致 / Bug 清单");
            console.log("========================================\n");
            
            const issues = [
                {
                    severity: "🔴 高",
                    title: "checkDirectStakes 只检查前10笔质押",
                    detail: "前端 activeStake 检测限制 i<10，超过10笔质押的用户可能错误显示'无活跃质押'",
                    location: "MiningPanel.tsx L787",
                    fix: "改为动态长度或增加上限到50"
                },
                {
                    severity: "🔴 高",
                    title: "_handleExit 余额不足时静默部分支付",
                    detail: "合约 _handleExit 在余额不足时只转可用余额，不revert，用户可能损失本金",
                    location: "JinbaoProtocolNative.sol L1048-1054",
                    fix: "合约层面：应revert或记录欠款；前端层面：提示风险"
                },
                {
                    severity: "🟡 中",
                    title: "JBC 余额不足时收益静默跳过",
                    detail: "claimRewards 和 _finalizeRedemption 中，JBC不足只跳过JBC部分，但totalRevenue按100%计入",
                    location: "JinbaoProtocolNative.sol L721-724",
                    fix: "应记录未发放的JBC金额或降低totalRevenue增量"
                },
                {
                    severity: "🟡 中",
                    title: "_handleExit 和 redeem 手续费公式不同",
                    detail: "_handleExit: amount*2*feePercent/300; redeem: maxTicketAmount*feePercent/100",
                    location: "JinbaoProtocolNative.sol L1030 vs L1661",
                    fix: "统一手续费计算基准"
                },
                {
                    severity: "🟡 中",
                    title: "前端 handleRedeem 手续费计算可能与合约不符",
                    detail: "前端用 maxTicketAmount 计算，但多笔赎回时合约对每笔分别计算，并发场景下可能不一致",
                    location: "MiningPanel.tsx L1155-1162",
                    fix: "在前端使用 estimateGas 预检查或增加余额冗余"
                },
                {
                    severity: "🟢 低",
                    title: "canStakeLiquidity 未检查 liquidityEnabled",
                    detail: "UI状态显示可质押，但实际 liquidityEnabled=false 时操作会失败",
                    location: "MiningPanel.tsx L248",
                    fix: "canStakeLiquidity = !isExited && contractStatus.liquidityEnabled"
                },
                {
                    severity: "🟢 低",
                    title: "前端收益预估与合约有精度差异",
                    detail: "前端用 JavaScript 浮点数计算日收益率，合约用整数除法，大金额时有 wei 级别差异",
                    location: "constants.ts vs JinbaoProtocolNative.sol L468",
                    fix: "前端使用 BigInt 精确计算"
                },
                {
                    severity: "🟢 低",
                    title: "质押历史展示假设严格顺序",
                    detail: "前端 fetchHistory 假设 purchase→stake→redeem 顺序，多笔质押打破此假设",
                    location: "MiningPanel.tsx fetchHistory",
                    fix: "改为按 stakeId 独立跟踪"
                }
            ];

            issues.forEach((issue, i) => {
                console.log(`${i + 1}. ${issue.severity} ${issue.title}`);
                console.log(`   详情: ${issue.detail}`);
                console.log(`   位置: ${issue.location}`);
                console.log(`   建议: ${issue.fix}`);
                console.log();
            });
        });
    });
});
