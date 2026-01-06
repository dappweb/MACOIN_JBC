import React, { useState, useEffect } from 'react';
import { useWeb3, CONTRACT_ADDRESSES } from '../src/Web3Context';
import { useGlobalRefresh, useEventRefresh } from '../hooks/useGlobalRefresh';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { RotateCw, Plus, Minus, Info, TrendingUp } from 'lucide-react';
import { decodeContractError } from '../utils/contractErrorDecoder';

const AdminLiquidityPanel: React.FC = () => {
  const { jbcContract, protocolContract, account, isConnected, isOwner, mcBalance, refreshMcBalance, provider } = useWeb3();
  
  // 使用全局刷新机制
  const { balances, onTransactionSuccess } = useGlobalRefresh();
  
  const [mcAmount, setMcAmount] = useState('');
  const [jbcAmount, setJbcAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [poolMC, setPoolMC] = useState<string>('0.0');
  const [poolJBC, setPoolJBC] = useState<string>('0.0');
  const [previousPoolMC, setPreviousPoolMC] = useState<string>('0.0');
  const [previousPoolJBC, setPreviousPoolJBC] = useState<string>('0.0');
  const [showProgress, setShowProgress] = useState(false);

  // 从全局状态获取余额
  const balanceMC = ethers.formatEther(mcBalance || 0n);
  const balanceJBC = balances.jbc;

  // 监听池子数据变化事件
  useEventRefresh('poolDataChanged', () => {
    console.log('🏊 [AdminLiquidityPanel] 池子数据变化，刷新显示');
    fetchPoolData();
  });

  // 获取池子数据
  const fetchPoolData = async () => {
    if (!protocolContract) return;

    try {
      const [poolMcBal, poolJbcBal] = await Promise.all([
        protocolContract.swapReserveMC(),
        protocolContract.swapReserveJBC()
      ]);

      // 保存之前的值用于比较
      setPreviousPoolMC(poolMC);
      setPreviousPoolJBC(poolJBC);

      const newPoolMC = ethers.formatEther(poolMcBal);
      const newPoolJBC = ethers.formatEther(poolJbcBal);

      setPoolMC(newPoolMC);
      setPoolJBC(newPoolJBC);

      // 如果数值发生变化，显示进度动画
      if (newPoolMC !== poolMC || newPoolJBC !== poolJBC) {
        setShowProgress(true);
        setTimeout(() => setShowProgress(false), 3000);
      }
    } catch (error) {
      console.error('获取池子数据失败:', error);
    }
  };

  // 获取数据
  const fetchData = async () => {
    await fetchPoolData();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchPoolData, 30000); // 只刷新池子数据，余额由全局状态管理
    return () => clearInterval(interval);
  }, [protocolContract]);

  // 添加流动性
  const handleAddLiquidity = async () => {
    console.log('🚀 [AdminLiquidityPanel] 开始添加流动性流程');
    
    if (!protocolContract || !jbcContract) {
      console.error('❌ [AdminLiquidityPanel] 合约未连接');
      toast.error('合约未连接，请检查网络连接');
      return;
    }
    
    if (!account) {
      console.error('❌ [AdminLiquidityPanel] 账户未连接');
      toast.error('请先连接钱包');
      return;
    }
    
    // 前置检查：权限
    if (!isOwner) {
      console.error('❌ [AdminLiquidityPanel] 权限检查失败 - isOwner:', isOwner);
      // 尝试从链上再次检查权限
      try {
        const owner = await protocolContract.owner();
        const isOwnerOnChain = owner.toLowerCase() === account.toLowerCase();
        console.log('   [链上检查] 合约Owner:', owner);
        console.log('   [链上检查] 当前账户:', account);
        console.log('   [链上检查] 是否Owner:', isOwnerOnChain);
        if (!isOwnerOnChain) {
          toast.error(`权限错误：您不是合约拥有者。合约Owner: ${owner.slice(0, 6)}...${owner.slice(-4)}`);
        } else {
          console.warn('⚠️ [AdminLiquidityPanel] 前端isOwner状态可能未更新，但链上检查通过');
        }
      } catch (error) {
        console.error('   [链上检查] 检查Owner失败:', error);
      }
      return;
    }
    
    console.log('✅ [AdminLiquidityPanel] 权限检查通过');
    
    // 确保输入值是有效的数字字符串
    const mcAmountStr = mcAmount?.trim() || '0';
    const jbcAmountStr = jbcAmount?.trim() || '0';
    
    // 验证输入格式
    if (mcAmountStr && isNaN(parseFloat(mcAmountStr))) {
      toast.error('MC数量格式无效');
      return;
    }
    if (jbcAmountStr && isNaN(parseFloat(jbcAmountStr))) {
      toast.error('JBC数量格式无效');
      return;
    }
    
    const mcAmountWei = mcAmountStr !== '0' ? ethers.parseEther(mcAmountStr) : 0n;
    const jbcAmountWei = jbcAmountStr !== '0' ? ethers.parseEther(jbcAmountStr) : 0n;
    
    if (mcAmountWei === 0n && jbcAmountWei === 0n) {
      toast.error('请输入要添加的流动性数量');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 [AdminLiquidityPanel] 开始添加流动性');
      console.log('   账户地址:', account);
      console.log('   MC 数量:', mcAmountStr, 'Wei:', mcAmountWei.toString());
      console.log('   JBC 数量:', jbcAmountStr, 'Wei:', jbcAmountWei.toString());
      console.log('   合约地址:', CONTRACT_ADDRESSES.PROTOCOL);
      
      // 检查原生MC余额（包括Gas费用预留）
      if (mcAmountWei > 0n) {
        const currentMcBalance = mcBalance || 0n;
        console.log('   MC 当前余额:', ethers.formatEther(currentMcBalance));
        
        // 预留一些MC用于Gas费用（约0.01 MC）
        const gasReserve = ethers.parseEther('0.01');
        const requiredTotal = mcAmountWei + gasReserve;
        
        if (currentMcBalance < requiredTotal) {
          toast.error(`MC余额不足，需要 ${ethers.formatEther(requiredTotal)} MC（包括Gas费用）`);
          setIsLoading(false);
          return;
        }
        
        if (currentMcBalance < mcAmountWei) {
          toast.error(`MC余额不足，需要 ${ethers.formatEther(mcAmountWei)} MC`);
          setIsLoading(false);
          return;
        }
      } else {
        // 即使不添加MC，也需要一些MC用于Gas费用
        const currentMcBalance = mcBalance || 0n;
        const minGasReserve = ethers.parseEther('0.001');
        if (currentMcBalance < minGasReserve) {
          toast.error(`MC余额不足，需要至少 ${ethers.formatEther(minGasReserve)} MC 用于支付Gas费用`);
          setIsLoading(false);
          return;
        }
      }
      
      // 检查JBC余额
      if (jbcAmountWei > 0n) {
        const jbcBalance = await jbcContract.balanceOf(account);
        console.log('   JBC 当前余额:', ethers.formatEther(jbcBalance));
        if (jbcBalance < jbcAmountWei) {
          toast.error(`JBC余额不足，需要 ${ethers.formatEther(jbcAmountWei)} JBC`);
          setIsLoading(false);
          return;
        }
      }

      // 检查并授权JBC代币
      if (jbcAmountWei > 0n) {
        let jbcAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
        console.log('   JBC 当前授权:', ethers.formatEther(jbcAllowance));
        console.log('   需要授权:', ethers.formatEther(jbcAmountWei));
        
        if (jbcAllowance < jbcAmountWei) {
          toast.loading('正在授权JBC代币...', { id: 'approve-jbc' });
          try {
            const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
            console.log('📝 [AdminLiquidityPanel] 授权交易哈希:', approveTx.hash);
            
            // 等待交易确认
            const receipt = await approveTx.wait();
            console.log('✅ [AdminLiquidityPanel] JBC授权交易已确认，区块:', receipt.blockNumber);
            
            // 等待一个区块，确保状态更新
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新检查授权额度，确保授权生效
            let retryCount = 0;
            const maxRetries = 5;
            while (retryCount < maxRetries) {
              jbcAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
              console.log(`   [重试 ${retryCount + 1}/${maxRetries}] 重新检查授权额度:`, ethers.formatEther(jbcAllowance));
              
              if (jbcAllowance >= jbcAmountWei) {
                console.log('✅ [AdminLiquidityPanel] JBC授权已生效');
                toast.success('JBC代币授权成功', { id: 'approve-jbc' });
                break;
              }
              
              if (retryCount === maxRetries - 1) {
                // 最后一次重试失败
                console.warn('⚠️ [AdminLiquidityPanel] 授权交易已确认，但授权额度仍未更新');
                toast.error('JBC授权可能未完全生效，请稍后重试或检查交易状态', { id: 'approve-jbc', duration: 8000 });
                setIsLoading(false);
                return;
              }
              
              // 等待一段时间后重试
              await new Promise(resolve => setTimeout(resolve, 2000));
              retryCount++;
            }
          } catch (approveError: any) {
            toast.dismiss('approve-jbc');
            console.error('❌ [AdminLiquidityPanel] JBC授权失败:', approveError);
            if (approveError.message?.includes('user rejected') || approveError.message?.includes('User denied')) {
              toast.error('用户取消了JBC授权');
            } else {
              toast.error(`JBC授权失败: ${approveError.message || approveError.reason || '未知错误'}`);
            }
            setIsLoading(false);
            return;
          }
        } else {
          console.log('✅ [AdminLiquidityPanel] JBC已授权，无需重复授权');
          console.log('   当前授权额度:', ethers.formatEther(jbcAllowance));
          console.log('   需要数量:', ethers.formatEther(jbcAmountWei));
        }
        
        // 最终检查：确保授权足够
        console.log('🔍 [AdminLiquidityPanel] 执行最终授权检查...');
        const finalAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
        const finalAllowanceFormatted = ethers.formatEther(finalAllowance);
        const requiredFormatted = ethers.formatEther(jbcAmountWei);
        console.log('   最终授权额度:', finalAllowanceFormatted, 'JBC');
        console.log('   需要数量:', requiredFormatted, 'JBC');
        console.log('   授权是否足够:', finalAllowance >= jbcAmountWei);
        
        if (finalAllowance < jbcAmountWei) {
          const shortfall = ethers.formatEther(jbcAmountWei - finalAllowance);
          console.error('   ❌ JBC授权不足，缺少:', shortfall, 'JBC');
          toast.error(`JBC授权不足：当前授权 ${finalAllowanceFormatted} JBC，需要 ${requiredFormatted} JBC，缺少 ${shortfall} JBC`);
          setIsLoading(false);
          return;
        }
        console.log('   ✅ JBC授权充足');
      }

      // 重要：授权JBC后，重新检查MC余额（因为授权交易消耗了Gas）
      // 直接从链上获取最新余额，而不是依赖状态（状态更新可能有延迟）
      let updatedMcBalance = 0n;
      if (provider && account) {
        updatedMcBalance = await provider.getBalance(account);
        console.log('   [授权后] 从链上获取MC余额:', ethers.formatEther(updatedMcBalance));
        // 同时更新状态（用于UI显示）
        await refreshMcBalance();
      } else {
        // 如果无法获取provider，使用状态中的余额
        updatedMcBalance = mcBalance || 0n;
        console.log('   [授权后] 使用状态中的MC余额:', ethers.formatEther(updatedMcBalance));
      }
      
      // 重新检查MC余额是否足够
      if (mcAmountWei > 0n) {
        // 预留Gas费用（约0.01 MC）
        const gasReserve = ethers.parseEther('0.01');
        const requiredTotal = mcAmountWei + gasReserve;
        
        if (updatedMcBalance < requiredTotal) {
          toast.error(`MC余额不足：授权后余额为 ${ethers.formatEther(updatedMcBalance)} MC，需要 ${ethers.formatEther(requiredTotal)} MC（包括Gas费用）`);
          setIsLoading(false);
          return;
        }
        
        if (updatedMcBalance < mcAmountWei) {
          toast.error(`MC余额不足：授权后余额为 ${ethers.formatEther(updatedMcBalance)} MC，需要 ${ethers.formatEther(mcAmountWei)} MC`);
          setIsLoading(false);
          return;
        }
        
        console.log('   ✅ [授权后] MC余额充足:', ethers.formatEther(updatedMcBalance));
      } else {
        // 即使不添加MC，也需要足够的MC用于Gas费用
        const minGasReserve = ethers.parseEther('0.001');
        if (updatedMcBalance < minGasReserve) {
          toast.error(`MC余额不足：授权后余额为 ${ethers.formatEther(updatedMcBalance)} MC，需要至少 ${ethers.formatEther(minGasReserve)} MC 用于支付Gas费用`);
          setIsLoading(false);
          return;
        }
        console.log('   ✅ [授权后] MC余额充足（用于Gas）:', ethers.formatEther(updatedMcBalance));
      }

      // 添加流动性 - 原生MC版本
      console.log('💧 [AdminLiquidityPanel] 调用 addLiquidity');
      console.log('   参数: jbcAmount =', jbcAmountWei.toString());
      console.log('   value: mcAmount =', mcAmountWei.toString());
      console.log('   当前MC余额:', ethers.formatEther(updatedMcBalance));
      
      toast.loading('正在添加流动性...', { id: 'add-liquidity' });
      
      // 构建交易参数
      const txParams: any = {};
      if (mcAmountWei > 0n) {
        txParams.value = mcAmountWei;
      }
      
      // 先尝试静态调用（模拟执行，不会真正改变状态）
      try {
        console.log('🧪 [AdminLiquidityPanel] 执行静态调用测试...');
        await protocolContract.addLiquidity.staticCall(jbcAmountWei, txParams);
        console.log('✅ [AdminLiquidityPanel] 静态调用成功，可以执行交易');
      } catch (staticError: any) {
        console.error('❌ [AdminLiquidityPanel] 静态调用失败:', staticError);
        
        // 尝试解码静态调用的错误 - 处理嵌套的RPC错误结构
        let decodedError: string | null = null;
        let staticErrorData: string | null = null;
        
        // 检查嵌套的错误数据结构（MetaMask RPC错误）
        if (staticError.data?.data) {
          // 错误数据在 staticError.data.data 中
          staticErrorData = staticError.data.data;
          console.log('   [静态调用错误结构] 检测到嵌套错误数据:', staticErrorData);
        } else if (staticError.data) {
          // 错误数据直接在 staticError.data 中
          staticErrorData = staticError.data;
        }
        
        if (staticErrorData) {
          decodedError = decodeContractError(staticErrorData);
          console.log('   解码的错误:', decodedError);
          console.log('   错误数据:', staticErrorData);
          
          // 检查是否是TransferFromFailedLowLevel错误
          if (staticErrorData === '0x82a6e09c' || staticErrorData.startsWith('0x82a6e09c')) {
            console.log('   ⚠️  [静态调用] 检测到TransferFromFailedLowLevel错误 - JBC转账失败');
          }
        }
        
        // 提供详细的错误信息
        let staticErrorMessage = '交易预检查失败';
        if (decodedError === 'OwnableUnauthorizedAccount' || 
            staticError.message?.includes('OwnableUnauthorizedAccount')) {
          staticErrorMessage = '权限错误：静态调用检查发现您不是合约拥有者';
        } else if (decodedError === 'TransferFromFailedLowLevel' || 
                   decodedError === 'TransferFromFailed' ||
                   staticErrorData === '0x82a6e09c' ||
                   staticErrorData?.startsWith('0x82a6e09c') ||
                   staticErrorData === '0x87a26b75' ||
                   staticErrorData?.startsWith('0x87a26b75') ||
                   (staticError.data?.data === '0x82a6e09c') ||
                   (staticError.data?.data?.startsWith('0x82a6e09c')) ||
                   staticError.message?.includes('TransferFromFailed')) {
          // TransferFromFailed错误 - JBC转账失败
          staticErrorMessage = 'JBC代币转账失败（预检查）';
          
          // 重新检查授权和余额
          if (jbcAmountWei > 0n && jbcContract && account) {
            try {
              const currentAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
              const currentBalance = await jbcContract.balanceOf(account);
              console.log('   [静态调用失败] 当前JBC授权:', ethers.formatEther(currentAllowance));
              console.log('   [静态调用失败] 当前JBC余额:', ethers.formatEther(currentBalance));
              console.log('   [静态调用失败] 需要数量:', ethers.formatEther(jbcAmountWei));
              
              if (currentAllowance < jbcAmountWei) {
                staticErrorMessage = `JBC授权不足：当前授权 ${ethers.formatEther(currentAllowance)}，需要 ${ethers.formatEther(jbcAmountWei)}。请先授权JBC代币。`;
              } else if (currentBalance < jbcAmountWei) {
                staticErrorMessage = `JBC余额不足：当前余额 ${ethers.formatEther(currentBalance)}，需要 ${ethers.formatEther(jbcAmountWei)}。请充值JBC代币。`;
              } else {
                staticErrorMessage = 'JBC授权和余额都足够，可能是授权未完全生效，请等待几秒后重试';
              }
            } catch (checkError) {
              console.error('   [静态调用失败] 检查授权和余额失败:', checkError);
              staticErrorMessage = 'JBC授权或余额检查失败，请确认已正确授权JBC代币且余额充足';
            }
          } else {
            staticErrorMessage = 'JBC转账失败，请检查授权和余额';
          }
        } else if (decodedError === 'ERC20InsufficientAllowance' ||
                   staticError.message?.includes('insufficient allowance')) {
          // 重新检查授权额度
          if (jbcAmountWei > 0n) {
            try {
              const currentAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
              console.log('   [静态调用失败] 当前JBC授权:', ethers.formatEther(currentAllowance));
              console.log('   [静态调用失败] 需要数量:', ethers.formatEther(jbcAmountWei));
              
              if (currentAllowance < jbcAmountWei) {
                staticErrorMessage = `JBC授权不足：当前授权 ${ethers.formatEther(currentAllowance)}，需要 ${ethers.formatEther(jbcAmountWei)}。请先授权JBC代币。`;
              } else {
                staticErrorMessage = 'JBC授权可能未完全生效，请等待几秒后重试';
              }
            } catch (checkError) {
              staticErrorMessage = 'JBC授权检查失败，请确认已正确授权JBC代币';
            }
          } else {
            staticErrorMessage = '授权不足（即使已授权，可能授权交易未确认）';
          }
        } else if (decodedError === 'ERC20InsufficientBalance' ||
                   staticError.message?.includes('insufficient balance')) {
          staticErrorMessage = '余额不足（可能余额在检查后发生了变化）';
        } else if (staticError.reason) {
          staticErrorMessage = `预检查失败: ${staticError.reason}`;
        } else if (staticError.message) {
          staticErrorMessage = `预检查失败: ${staticError.message}`;
        }
        
        // 显示详细的错误信息
        if (decodedError === 'TransferFromFailedLowLevel' || 
            decodedError === 'TransferFromFailed' ||
            staticError.data === '0x82a6e09c' ||
            staticError.data?.startsWith('0x82a6e09c')) {
          // TransferFromFailed错误，显示更详细的提示
          toast.error(`${staticErrorMessage}\n💡 请检查JBC授权和余额，然后重试`, { 
            duration: 10000 
          });
        } else {
          toast.error(staticErrorMessage, { duration: 6000 });
        }
        setIsLoading(false);
        return;
      }
      
      // 执行交易 - 原生MC作为value发送，JBC作为参数
      console.log('📤 [AdminLiquidityPanel] 准备发送交易...');
      let tx;
      try {
        tx = await protocolContract.addLiquidity(jbcAmountWei, txParams);
        console.log('📝 [AdminLiquidityPanel] 交易已发送，哈希:', tx.hash);
        console.log('   可以在区块浏览器查看: https://explorer.mcchain.io/tx/' + tx.hash);
      } catch (txError: any) {
        console.error('❌ [AdminLiquidityPanel] 交易发送失败:', txError);
        toast.dismiss('add-liquidity');
        
        let txErrorMessage = '交易发送失败';
        if (txError.message?.includes('user rejected') || txError.message?.includes('User denied')) {
          txErrorMessage = '用户取消了交易';
        } else if (txError.message?.includes('insufficient funds')) {
          txErrorMessage = 'Gas费用不足，请确保有足够的MC用于支付Gas费用';
        } else if (txError.reason) {
          txErrorMessage = `交易发送失败: ${txError.reason}`;
        } else if (txError.message) {
          txErrorMessage = `交易发送失败: ${txError.message}`;
        }
        
        toast.error(txErrorMessage, { id: 'add-liquidity', duration: 8000 });
        setIsLoading(false);
        return;
      }
      
      // 等待交易确认，添加超时处理
      console.log('⏳ [AdminLiquidityPanel] 等待交易确认...');
      try {
        // 设置超时（5分钟）
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('交易确认超时（5分钟）')), 5 * 60 * 1000);
        });
        
        const receipt = await Promise.race([
          tx.wait(),
          timeoutPromise
        ]) as any;
        
        console.log('✅ [AdminLiquidityPanel] 交易已确认');
        console.log('   区块号:', receipt.blockNumber);
        console.log('   Gas使用:', receipt.gasUsed?.toString());
        
        toast.success('流动性添加成功！', { id: 'add-liquidity' });
      } catch (waitError: any) {
        console.error('❌ [AdminLiquidityPanel] 交易确认失败:', waitError);
        toast.dismiss('add-liquidity');
        
        let waitErrorMessage = '交易确认失败';
        if (waitError.message?.includes('超时')) {
          waitErrorMessage = '交易确认超时，请检查交易状态。交易哈希: ' + tx.hash.slice(0, 10) + '...';
          console.log('💡 提示：交易可能仍在处理中，可以在区块浏览器查看状态');
        } else if (waitError.message) {
          waitErrorMessage = `交易确认失败: ${waitError.message}`;
        }
        
        toast.error(waitErrorMessage, { id: 'add-liquidity', duration: 10000 });
        setIsLoading(false);
        return;
      }
      
      // 清空输入
      setMcAmount('');
      setJbcAmount('');
      
      // 使用全局刷新机制
      await onTransactionSuccess('liquidity_stake');
      
      // 刷新原生MC余额
      await refreshMcBalance();
      
      // 立即刷新池子数据
      await fetchPoolData();
      
      // 显示进度动画
      setShowProgress(true);
      setTimeout(() => setShowProgress(false), 3000);
      
    } catch (error: any) {
      console.error('❌ [AdminLiquidityPanel] 添加流动性失败:', error);
      console.error('   错误详情:', {
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data
      });
      
      // 尝试解码错误 - 处理嵌套的RPC错误结构
      let decodedError: string | null = null;
      let errorData: string | null = null;
      
      // 检查嵌套的错误数据结构（MetaMask RPC错误）
      if (error.data?.data) {
        // 错误数据在 error.data.data 中
        errorData = error.data.data;
        console.log('   [错误结构] 检测到嵌套错误数据:', errorData);
      } else if (error.data) {
        // 错误数据直接在 error.data 中
        errorData = error.data;
      }
      
      if (errorData) {
        decodedError = decodeContractError(errorData);
        console.log('   解码的错误:', decodedError);
        console.log('   错误数据:', errorData);
        
        // 如果是0x82a6e09c，这是TransferFromFailedLowLevel
        if (errorData === '0x82a6e09c' || errorData.startsWith('0x82a6e09c')) {
          console.log('   ⚠️  检测到TransferFromFailedLowLevel错误 - JBC转账失败');
          console.log('   💡 可能原因：JBC授权不足或JBC余额不足');
        }
      }
      
      // 检查错误消息中是否包含execution reverted
      if (error.message?.includes('execution reverted') || error.message?.includes('Internal JSON-RPC error')) {
        console.log('   ⚠️  检测到execution reverted或Internal JSON-RPC error');
        if (errorData) {
          console.log('   错误选择器:', errorData.slice(0, 10));
        }
      }
      
      let errorMessage = '添加流动性失败';
      let suggestion = '';
      
      // 根据错误类型提供详细的错误信息和建议
      if (decodedError === 'OwnableUnauthorizedAccount' || 
          error.message?.includes('OwnableUnauthorizedAccount') ||
          error.message?.includes('Ownable: caller is not the owner')) {
        errorMessage = '权限错误：您不是合约拥有者';
        suggestion = '请确认：1) 使用正确的钱包地址（必须是合约Owner） 2) 检查网络连接 3) 刷新页面重新检查权限';
      } else if (decodedError === 'TransferFromFailedLowLevel' || 
                 decodedError === 'TransferFromFailed' ||
                 errorData === '0x82a6e09c' ||
                 errorData?.startsWith('0x82a6e09c') ||
                 errorData === '0x87a26b75' ||
                 errorData?.startsWith('0x87a26b75') ||
                 (error.data?.data === '0x82a6e09c') ||
                 (error.data?.data?.startsWith('0x82a6e09c'))) {
        // TransferFromFailed错误 - JBC转账失败
        errorMessage = 'JBC代币转账失败';
        suggestion = '可能原因：1) JBC授权不足 - 请先授权JBC代币 2) JBC余额不足 - 请检查JBC余额 3) 授权未生效 - 等待几秒后重试';
        
        // 重新检查授权和余额
        if (jbcAmountWei > 0n && jbcContract && account) {
          try {
            const currentAllowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
            const currentBalance = await jbcContract.balanceOf(account);
            console.log('   [错误后检查] JBC授权:', ethers.formatEther(currentAllowance));
            console.log('   [错误后检查] JBC余额:', ethers.formatEther(currentBalance));
            console.log('   [错误后检查] 需要数量:', ethers.formatEther(jbcAmountWei));
            
            if (currentAllowance < jbcAmountWei) {
              suggestion = `JBC授权不足：当前授权 ${ethers.formatEther(currentAllowance)}，需要 ${ethers.formatEther(jbcAmountWei)}。请先授权JBC代币。`;
            } else if (currentBalance < jbcAmountWei) {
              suggestion = `JBC余额不足：当前余额 ${ethers.formatEther(currentBalance)}，需要 ${ethers.formatEther(jbcAmountWei)}。请充值JBC代币。`;
            } else {
              suggestion = 'JBC授权和余额都足够，可能是授权未完全生效，请等待几秒后重试';
            }
          } catch (checkError) {
            console.error('   [错误后检查] 检查失败:', checkError);
          }
        }
      } else if (decodedError === 'ERC20InsufficientAllowance' ||
                 error.message?.includes('insufficient allowance')) {
        errorMessage = 'JBC代币授权不足';
        suggestion = '请先授权JBC代币。如果已授权，请检查授权额度是否足够';
      } else if (decodedError === 'ERC20InsufficientBalance' ||
                 error.message?.includes('insufficient balance') ||
                 error.message?.includes('InsufficientBalance')) {
        if (jbcAmountWei > 0n) {
          errorMessage = 'JBC代币余额不足';
          suggestion = '请确保钱包中有足够的JBC代币';
        } else {
          errorMessage = 'MC余额不足';
          suggestion = '请确保钱包中有足够的原生MC代币（用于添加流动性或支付Gas费用）';
        }
      } else if (error.message?.includes('invalid BigNumberish value')) {
        errorMessage = '参数格式错误，请检查输入的数量';
        suggestion = '请确保输入的是有效的数字，且大于0';
      } else if (error.reason) {
        errorMessage = `失败原因: ${error.reason}`;
        suggestion = '请查看浏览器控制台获取更多详细信息';
      } else if (error.message) {
        errorMessage = error.message;
        if (error.message.includes('user rejected') || error.message.includes('User denied')) {
          errorMessage = '用户取消了交易';
          suggestion = '';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Gas费用不足';
          suggestion = '请确保钱包中有足够的MC用于支付Gas费用';
        }
      }
      
      // 显示错误信息
      if (suggestion) {
        toast.error(`${errorMessage}\n💡 ${suggestion}`, { 
          id: 'add-liquidity',
          duration: 6000 
        });
      } else {
        toast.error(errorMessage, { id: 'add-liquidity' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 如果不是管理员，不显示面板
  if (!isConnected || !isOwner) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-4 glass-panel p-6 rounded-2xl relative animate-fade-in bg-gray-900/40 border border-gray-700 backdrop-blur-sm">
      {/* 增强背景效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10 blur-2xl rounded-2xl"></div>
      <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full animate-pulse"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-lg flex items-center justify-center backdrop-blur-sm border border-blue-400/20">
            <Plus className="w-4 h-4 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold text-white">管理员 - 流动性管理</h2>
        </div>

        {/* 当前池子状态 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-400">当前池子储备</span>
            {showProgress && (
              <div className="flex items-center gap-1 ml-auto">
                <TrendingUp className="w-3 h-3 text-green-400 animate-bounce" />
                <span className="text-xs text-green-400 animate-pulse">已更新</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
              <div className={`text-2xl font-bold text-white transition-all duration-500 ${showProgress ? 'scale-110 text-green-400' : ''}`}>
                {parseFloat(poolMC).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">MC</div>
              {showProgress && parseFloat(poolMC) > parseFloat(previousPoolMC) && (
                <div className="text-xs text-green-400 animate-pulse">
                  +{(parseFloat(poolMC) - parseFloat(previousPoolMC)).toFixed(2)}
                </div>
              )}
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
              <div className={`text-2xl font-bold text-white transition-all duration-500 ${showProgress ? 'scale-110 text-green-400' : ''}`}>
                {parseFloat(poolJBC).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">JBC</div>
              {showProgress && parseFloat(poolJBC) > parseFloat(previousPoolJBC) && (
                <div className="text-xs text-green-400 animate-pulse">
                  +{(parseFloat(poolJBC) - parseFloat(previousPoolJBC)).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MC 输入 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-3 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>添加 MC</span>
            <span>余额: {balanceMC} MC</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={mcAmount}
              onChange={(e) => setMcAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-xl font-bold focus:outline-none w-full text-white placeholder-gray-600 focus:text-blue-300 transition-colors"
            />
            <button
              onClick={() => setMcAmount(balanceMC)}
              className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
            >
              最大
            </button>
          </div>
        </div>

        {/* JBC 输入 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 rounded-xl border border-gray-600/50 mb-4 backdrop-blur-sm hover:border-amber-500/30 transition-all duration-300">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>添加 JBC</span>
            <span>余额: {balanceJBC} JBC</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={jbcAmount}
              onChange={(e) => setJbcAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-xl font-bold focus:outline-none w-full text-white placeholder-gray-600 focus:text-amber-300 transition-colors"
            />
            <button
              onClick={() => setJbcAmount(balanceJBC)}
              className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
            >
              最大
            </button>
          </div>
        </div>

        {/* 提示信息 - 增强视觉效果 */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/40 p-3 rounded-lg text-xs text-blue-300 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3 h-3" />
            <span className="font-bold">管理员权限</span>
          </div>
          <p>只有合约拥有者可以添加流动性。您可以添加MC、JBC或两者。添加后将自动刷新显示。</p>
        </div>

        {/* 添加按钮 - 增强视觉效果 */}
        <button
          onClick={handleAddLiquidity}
          disabled={isLoading || (!mcAmount && !jbcAmount)}
          className="w-full py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:from-blue-400 hover:via-purple-400 hover:to-cyan-400 text-white font-bold text-lg rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105 transform"
        >
          {isLoading && <RotateCw className="animate-spin" size={20} />}
          {isLoading ? '添加中...' : '添加流动性'}
        </button>
      </div>
    </div>
  );
};

export default AdminLiquidityPanel;