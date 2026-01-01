/**
 * 统一的格式化工具函数
 * 用于对齐所有组件中的数据显示格式
 */

import { ethers } from "ethers";

/**
 * 格式化 MC 金额
 * @param amount - 金额（可以是 BigInt, string, number）
 * @param decimals - 小数位数，默认 4
 * @returns 格式化后的字符串，例如 "123.4567 MC"
 */
export function formatMC(amount: bigint | string | number, decimals: number = 4): string {
  let num: number;
  
  if (typeof amount === 'bigint') {
    num = parseFloat(ethers.formatEther(amount));
  } else if (typeof amount === 'string') {
    num = parseFloat(amount);
  } else {
    num = amount;
  }
  
  if (isNaN(num) || num === 0) {
    return `0.${'0'.repeat(decimals)} MC`;
  }
  
  return `${num.toFixed(decimals)} MC`;
}

/**
 * 格式化 JBC 金额
 * @param amount - 金额（可以是 BigInt, string, number）
 * @param decimals - 小数位数，默认 4
 * @returns 格式化后的字符串，例如 "123.4567 JBC"
 */
export function formatJBC(amount: bigint | string | number, decimals: number = 4): string {
  let num: number;
  
  if (typeof amount === 'bigint') {
    num = parseFloat(ethers.formatEther(amount));
  } else if (typeof amount === 'string') {
    num = parseFloat(amount);
  } else {
    num = amount;
  }
  
  if (isNaN(num) || num === 0) {
    return `0.${'0'.repeat(decimals)} JBC`;
  }
  
  return `${num.toFixed(decimals)} JBC`;
}

/**
 * 格式化价格（用于 JBC 价格等需要更高精度的场景）
 * @param price - 价格
 * @param decimals - 小数位数，默认 6
 * @returns 格式化后的字符串
 */
export function formatPrice(price: number | string, decimals: number = 6): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(num) || num === 0) {
    return `0.${'0'.repeat(decimals)}`;
  }
  
  return num.toFixed(decimals);
}

/**
 * 格式化金额（不带单位，用于计算）
 * @param amount - 金额
 * @param decimals - 小数位数，默认 4
 * @returns 格式化后的数字字符串
 */
export function formatAmount(amount: bigint | string | number, decimals: number = 4): string {
  let num: number;
  
  if (typeof amount === 'bigint') {
    num = parseFloat(ethers.formatEther(amount));
  } else if (typeof amount === 'string') {
    num = parseFloat(amount);
  } else {
    num = amount;
  }
  
  if (isNaN(num) || num === 0) {
    return `0.${'0'.repeat(decimals)}`;
  }
  
  return num.toFixed(decimals);
}

/**
 * 格式化百分比
 * @param value - 百分比值（0-100）
 * @param decimals - 小数位数，默认 2
 * @returns 格式化后的字符串，例如 "12.34%"
 */
export function formatPercent(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return '0.00%';
  }
  
  return `${num.toFixed(decimals)}%`;
}

/**
 * 格式化地址（显示前6位和后4位）
 * @param address - 地址
 * @returns 格式化后的地址，例如 "0x1234...5678"
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 格式化交易哈希（显示前6位和后4位）
 * @param hash - 交易哈希
 * @returns 格式化后的哈希
 */
export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 10) {
    return hash;
  }
  
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * 格式化日期时间
 * @param timestamp - Unix 时间戳（秒）
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * 格式化日期（仅日期部分）
 * @param timestamp - Unix 时间戳（秒）
 * @returns 格式化后的日期字符串
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * 从 BigInt 或 string 转换为数字
 * @param value - 值
 * @returns 数字
 */
export function parseTokenAmount(value: bigint | string): number {
  if (typeof value === 'bigint') {
    return parseFloat(ethers.formatEther(value));
  }
  
  if (typeof value === 'string') {
    return parseFloat(value);
  }
  
  return value;
}

/**
 * 计算总价值（MC + JBC * JBC价格）
 * @param mcAmount - MC 金额
 * @param jbcAmount - JBC 金额
 * @param jbcPrice - JBC 价格（MC）
 * @param decimals - 小数位数，默认 4
 * @returns 格式化后的总价值字符串
 */
export function formatTotalValue(
  mcAmount: bigint | string | number,
  jbcAmount: bigint | string | number,
  jbcPrice: number,
  decimals: number = 4
): string {
  const mc = parseTokenAmount(mcAmount);
  const jbc = parseTokenAmount(jbcAmount);
  const total = mc + (jbc * jbcPrice);
  
  return `${total.toFixed(decimals)} MC`;
}

/**
 * 格式化区块号
 * @param blockNumber - 区块号
 * @returns 格式化后的区块号字符串
 */
export function formatBlockNumber(blockNumber: number | bigint): string {
  const num = typeof blockNumber === 'bigint' ? Number(blockNumber) : blockNumber;
  return num.toLocaleString();
}

