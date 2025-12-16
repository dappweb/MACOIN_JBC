import React from 'react';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  image?: string;
}

const MC_TOKEN: TokenConfig = {
  address: '0x71D6D3A4CbC35b8Cc6e81E46E69D57B36B25Df2f',
  symbol: 'MC',
  decimals: 18,
};

const JBC_TOKEN: TokenConfig = {
  address: '0xD59e16aaD8CE5D9aa1E8B61a4E4faa3bf2e0B350',
  symbol: 'JBC',
  decimals: 18,
};

interface AddTokenHelperProps {
  className?: string;
}

const AddTokenHelper: React.FC<AddTokenHelperProps> = ({ className = '' }) => {

  const addTokenToWallet = async (token: TokenConfig) => {
    try {
      // 检查是否支持 MetaMask
      if (!window.ethereum) {
        toast.error('请先安装 MetaMask 钱包');
        return;
      }

      // 请求添加代币
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            image: token.image,
          },
        },
      });

      if (wasAdded) {
        toast.success(`${token.symbol} 代币已成功添加到钱包！`);
      } else {
        toast.error('用户取消了添加操作');
      }
    } catch (error: any) {
      console.error('添加代币失败:', error);
      toast.error(`添加失败: ${error.message}`);
    }
  };

  return (
    <div className={`glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-slate-200 ${className}`}>
      <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-slate-800 flex items-center gap-2">
        <PlusCircle className="text-macoin-600" size={20} />
        添加代币到钱包
      </h3>

      <p className="text-sm text-slate-500 mb-4">
        点击下方按钮，一键将项目代币添加到您的 MetaMask 钱包中
      </p>

      <div className="space-y-3">
        {/* MC Token */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <div className="font-bold text-slate-900">MC Token</div>
            <div className="text-xs text-slate-500 font-mono">
              {MC_TOKEN.address.slice(0, 6)}...{MC_TOKEN.address.slice(-4)}
            </div>
          </div>
          <button
            onClick={() => addTokenToWallet(MC_TOKEN)}
            className="px-4 py-2 bg-macoin-500 hover:bg-macoin-600 text-white font-bold rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
          >
            添加 MC
          </button>
        </div>

        {/* JBC Token */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <div className="font-bold text-slate-900">JBC Token</div>
            <div className="text-xs text-slate-500 font-mono">
              {JBC_TOKEN.address.slice(0, 6)}...{JBC_TOKEN.address.slice(-4)}
            </div>
          </div>
          <button
            onClick={() => addTokenToWallet(JBC_TOKEN)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
          >
            添加 JBC
          </button>
        </div>
      </div>

      {/* 手动添加说明 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-900 font-bold mb-2">💡 手动添加方法：</div>
        <ol className="text-xs text-blue-800 space-y-1 list-decimal pl-4">
          <li>打开 MetaMask，点击"资产"标签</li>
          <li>滚动到底部，点击"导入代币"</li>
          <li>选择"自定义代币"</li>
          <li>复制粘贴上方的合约地址</li>
          <li>代币符号和小数位数会自动填充</li>
        </ol>
      </div>

      {/* 合约地址卡片 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 bg-gradient-to-br from-macoin-50 to-macoin-100 rounded-lg border border-macoin-200">
          <div className="text-xs text-slate-500 mb-1">MC Token 合约</div>
          <div className="text-xs font-mono text-slate-900 break-all">
            {MC_TOKEN.address}
          </div>
        </div>
        <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
          <div className="text-xs text-slate-500 mb-1">JBC Token 合约</div>
          <div className="text-xs font-mono text-slate-900 break-all">
            {JBC_TOKEN.address}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTokenHelper;
