#!/usr/bin/env node

/**
 * 统计用户售出门票额（按用户汇总购买金额，并给出数据）
 * 从 TicketPurchased 事件统计每个用户购买的门票总额，以及平台总售出门票额
 * 支持以美元(USD)为单位输出，需提供 MC 兑美元汇率。
 *
 * 使用方法:
 *   node scripts/stats-ticket-sales-by-user.cjs
 *   node scripts/stats-ticket-sales-by-user.cjs --csv   # 同时输出 CSV 文件
 *   node scripts/stats-ticket-sales-by-user.cjs --top 50   # 只显示前50名
 *   node scripts/stats-ticket-sales-by-user.cjs --usd   # 以美元为单位（需 MC_USD 或 --mc-usd）
 *   MC_USD=0.5 node scripts/stats-ticket-sales-by-user.cjs --usd --csv
 *   node scripts/stats-ticket-sales-by-user.cjs --mc-usd 0.5 --usd --csv
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置（与 get-platform-financial-data.cjs 一致）
const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

function parseMcUsd() {
  const i = process.argv.indexOf("--mc-usd");
  if (i >= 0 && process.argv[i + 1]) {
    const v = parseFloat(process.argv[i + 1]);
    if (!Number.isNaN(v) && v > 0) return v;
  }
  const env = process.env.MC_USD;
  if (env) {
    const v = parseFloat(env);
    if (!Number.isNaN(v) && v > 0) return v;
  }
  return null;
}

async function main() {
  const outCsv = process.argv.includes("--csv");
  const useUsd = process.argv.includes("--usd");
  const mcUsd = useUsd ? parseMcUsd() : null;

  const topN = (() => {
    const i = process.argv.indexOf("--top");
    if (i >= 0 && process.argv[i + 1]) {
      return Math.max(1, parseInt(process.argv[i + 1], 10) || 0);
    }
    return 0;
  })();

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  const unitLabel = useUsd && mcUsd ? "美元(USD)" : "MC";
  console.log("📊 统计用户售出门票额（按用户汇总购买金额）\n");
  console.log("=".repeat(80));
  console.log(`查询时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log(`新合约: ${PROTOCOL_ADDRESS}`);
  console.log(`旧合约: ${OLD_PROTOCOL_ADDRESS}`);
  if (useUsd && mcUsd) {
    console.log(`单位: 美元(USD)，MC/USD 汇率: ${mcUsd}`);
  } else if (useUsd && !mcUsd) {
    console.log("⚠️  已指定 --usd 但未提供 MC/USD 汇率，将使用 MC 显示。可设置 MC_USD 或 --mc-usd <汇率>");
  }
  console.log("=".repeat(80) + "\n");

  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 2_000_000);

  // 按用户汇总: address -> { totalWei, count, events[] }
  const userTotal = new Map();

  function addEvent(user, amount, ticketId, blockNumber, source) {
    const key = user.toLowerCase();
    if (!userTotal.has(key)) {
      userTotal.set(key, { totalWei: 0n, count: 0, events: [] });
    }
    const r = userTotal.get(key);
    r.totalWei += amount;
    r.count += 1;
    r.events.push({ amount, ticketId, blockNumber, source });
  }

  try {
    console.log("📌 查询新合约 TicketPurchased 事件...");
    const newEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock);
    console.log(`   新合约: ${newEvents.length} 条`);

    console.log("📌 查询旧合约 TicketPurchased 事件...");
    const oldEvents = await oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), fromBlock);
    console.log(`   旧合约: ${oldEvents.length} 条\n`);

    for (const e of newEvents) {
      if (e.args?.user) {
        addEvent(e.args.user, e.args.amount ?? 0n, e.args.ticketId ?? 0n, e.blockNumber, "新合约");
      }
    }
    for (const e of oldEvents) {
      if (e.args?.user) {
        addEvent(e.args.user, e.args.amount ?? 0n, e.args.ticketId ?? 0n, e.blockNumber, "旧合约");
      }
    }

    const users = Array.from(userTotal.entries())
      .map(([addr, data]) => {
        const totalMC = Number(ethers.formatEther(data.totalWei));
        return {
          address: addr,
          totalWei: data.totalWei,
          totalMC,
          totalUSD: mcUsd ? totalMC * mcUsd : null,
          purchaseCount: data.count,
        };
      })
      .sort((a, b) => (b.totalWei > a.totalWei ? 1 : b.totalWei < a.totalWei ? -1 : 0));

    const totalSoldWei = users.reduce((s, u) => s + u.totalWei, 0n);
    const totalSoldMC = Number(ethers.formatEther(totalSoldWei));
    const totalSoldUSD = mcUsd ? totalSoldMC * mcUsd : null;

    console.log("=".repeat(80));
    console.log("📈 平台总售出门票额（单位: 美金 USD / MC）");
    console.log("=".repeat(80));
    if (useUsd && mcUsd && totalSoldUSD != null) {
      console.log(`已售出门票总额: ${totalSoldUSD.toFixed(2)} USD（${totalSoldMC.toFixed(4)} MC）`);
      console.log("可能盈利额（平台）请使用: node scripts/get-platform-financial-data.cjs --usd [--mc-usd <汇率>] 查看");
    } else {
      console.log(`已售出门票总额: ${totalSoldMC.toFixed(4)} MC` + (totalSoldUSD != null ? ` (约 ${totalSoldUSD.toFixed(2)} USD)` : ""));
    }
    console.log(`购买用户数: ${users.length}`);
    console.log(`总购买笔数: ${users.reduce((s, u) => s + u.purchaseCount, 0)}\n`);

    const displayList = topN > 0 ? users.slice(0, topN) : users;
    const caption = topN > 0 ? `前 ${topN} 名用户售出门票额` : "全部用户售出门票额";

    const showUsd = useUsd && mcUsd;
    const headers = ["排名", "用户地址", showUsd ? "购买金额(USD)" : "购买金额(MC)", "购买笔数"];
    console.log("=".repeat(80));
    console.log(`📋 ${caption}（单位: ${showUsd ? "美元" : "MC"}）`);
    console.log("=".repeat(80));
    console.log(headers.map((h) => String(h).padEnd(h.length + 2)).join(""));
    console.log("-".repeat(80));

    displayList.forEach((u, i) => {
      const rank = (i + 1).toString().padStart(4);
      const addr = (u.address.slice(0, 6) + "..." + u.address.slice(-4)).padEnd(16);
      const amount = showUsd && u.totalUSD != null ? u.totalUSD.toFixed(2) : u.totalMC.toFixed(4);
      const cnt = String(u.purchaseCount).padStart(8);
      console.log(`${rank}  ${addr}  ${amount.padStart(14)}  ${cnt}`);
    });

    if (topN > 0 && users.length > topN) {
      console.log(`\n... 共 ${users.length} 名用户，上表仅展示前 ${topN} 名。`);
    }

    if (outCsv) {
      const csvPath = path.join(
        __dirname,
        "..",
        `用户售出门票额统计-${new Date().toISOString().slice(0, 10)}.csv`
      );
      const header = showUsd
        ? "排名,用户地址,购买金额(USD),购买金额(MC),购买笔数\n"
        : "排名,用户地址,购买金额(MC),购买笔数\n";
      const rows = users
        .map((u, i) => {
          if (showUsd && u.totalUSD != null) {
            return `${i + 1},${u.address},${u.totalUSD.toFixed(2)},${u.totalMC.toFixed(4)},${u.purchaseCount}`;
          }
          return `${i + 1},${u.address},${u.totalMC.toFixed(4)},${u.purchaseCount}`;
        })
        .join("\n");
      fs.writeFileSync(csvPath, "\uFEFF" + header + rows, "utf8");
      console.log(`\n✅ CSV 已写入: ${csvPath}`);
    }

    console.log("\n✅ 统计完成。");
  } catch (err) {
    console.error("❌ 统计失败:", err.message);
    process.exit(1);
  }
}

main();
