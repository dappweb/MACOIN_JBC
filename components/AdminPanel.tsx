import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../Web3Context';
import { Settings, Save, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../constants';

const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, isConnected, account, provider } = useWeb3();
  const [loading, setLoading] = useState(false);

  // Distribution Percents
  const [direct, setDirect] = useState('25');
  const [level, setLevel] = useState('15');
  const [marketing, setMarketing] = useState('5');
  const [buyback, setBuyback] = useState('5');
  const [lp, setLp] = useState('25');
  const [treasury, setTreasury] = useState('25');

  // Swap Taxes
  const [buyTax, setBuyTax] = useState('50');
  const [sellTax, setSellTax] = useState('25');

  // Redemption Fee
  const [redeemFee, setRedeemFee] = useState('1');

  // Wallets
  const [marketingWallet, setMarketingWallet] = useState('');
  const [treasuryWallet, setTreasuryWallet] = useState('');
  const [lpWallet, setLpWallet] = useState('');
  const [buybackWallet, setBuybackWallet] = useState('');

  // User Management
  const [targetUser, setTargetUser] = useState('');
  const [newReferrer, setNewReferrer] = useState('');
  const [activeDirects, setActiveDirects] = useState('');
  const [teamCount, setTeamCount] = useState('');

  // Announcement Management
  const [announceLang, setAnnounceLang] = useState('en');
  const [announceContent, setAnnounceContent] = useState('');

  // Liquidity Management
  const [mcLiquidityAmount, setMcLiquidityAmount] = useState('');
  const [jbcLiquidityAmount, setJbcLiquidityAmount] = useState('');

  const updateDistribution = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setDistributionPercents(
        direct, level, marketing, buyback, lp, treasury
      );
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateSwapTaxes = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setSwapTaxes(buyTax, sellTax);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateRedeemFee = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setRedemptionFee(redeemFee);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateWallets = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
        // Simple check
        if (!marketingWallet || !treasuryWallet || !lpWallet || !buybackWallet) {
            toast.error(t.admin.required);
            return;
        }
      const tx = await protocolContract.setWallets(marketingWallet, treasuryWallet, lpWallet, buybackWallet);
      await tx.wait();
      toast.success(t.admin.success);
    } catch (err: any) {
      toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateUserStats = async () => {
    if (!protocolContract || !targetUser) return;
    setLoading(true);
    try {
        const tx = await protocolContract.adminSetUserStats(targetUser, activeDirects, teamCount);
        await tx.wait();
        toast.success(t.admin.success);
    } catch (err: any) {
        toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
        setLoading(false);
    }
  };

  const updateReferrer = async () => {
    if (!protocolContract || !targetUser || !newReferrer) return;
    setLoading(true);
    try {
        const tx = await protocolContract.adminSetReferrer(targetUser, newReferrer);
        await tx.wait();
        toast.success(t.admin.success);
    } catch (err: any) {
        toast.error(t.admin.failed + (err.reason || err.message));
    } finally {
        setLoading(false);
    }
  };

  const updateAnnouncement = async () => {
    if (!announceContent) return;
    setLoading(true);
    try {
        // Sign the message to prove admin ownership
        // In real scenario, we should sign a structured message (EIP-712) or specific payload
        // For this demo, we sign the content directly
        if (!isConnected || !account || !provider) {
             toast.error("Connect wallet first");
             setLoading(false);
             return;
        }

        const signer = await provider.getSigner();
        const signature = await signer.signMessage(`Update Announcement: ${announceContent}`);

        // Post to Worker
        const res = await fetch(`${API_BASE_URL}/announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: announceLang,
                content: announceContent,
                signature,
                adminAddress: account,
                timestamp: Date.now()
            })
        });

        if (res.ok) {
            toast.success("Announcement updated on D1!");
        } else {
            const errText = await res.text();
            throw new Error(errText);
        }
    } catch (err: any) {
        toast.error("Update failed: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const addLiquidity = async (tokenType: 'MC' | 'JBC') => {
    if (!isConnected || !provider) {
        toast.error("Connect wallet first");
        return;
    }
    
    setLoading(true);
    try {
        const { mcContract, jbcContract, CONTRACT_ADDRESSES } = await import('../Web3Context');
        const signer = await provider.getSigner();
        
        if (tokenType === 'MC' && mcLiquidityAmount) {
            const amount = ethers.parseEther(mcLiquidityAmount);
            const mcTokenContract = mcContract;
            
            if (!mcTokenContract) {
                toast.error("MC contract not found");
                return;
            }
            
            // Transfer MC to protocol contract
            const tx = await mcTokenContract.connect(signer).transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
            await tx.wait();
            toast.success(`Added ${mcLiquidityAmount} MC to pool!`);
            setMcLiquidityAmount('');
        } else if (tokenType === 'JBC' && jbcLiquidityAmount) {
            const amount = ethers.parseEther(jbcLiquidityAmount);
            const jbcTokenContract = jbcContract;
            
            if (!jbcTokenContract) {
                toast.error("JBC contract not found");
                return;
            }
            
            // Transfer JBC to protocol contract
            const tx = await jbcTokenContract.connect(signer).transfer(CONTRACT_ADDRESSES.PROTOCOL, amount);
            await tx.wait();
            toast.success(`Added ${jbcLiquidityAmount} JBC to pool!`);
            setJbcLiquidityAmount('');
        }
    } catch (err: any) {
        console.error(err);
        toast.error("Failed: " + (err.reason || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in pb-20">
      <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Settings className="text-red-600" size={24} className="md:w-7 md:h-7" /> {t.admin.title}
        </h2>
        <p className="text-sm md:text-base text-slate-500">{t.admin.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Distribution Settings */}
          <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-slate-200">
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-slate-800">{t.admin.distSettings}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.direct}</label>
                      <input type="number" value={direct} onChange={e => setDirect(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.level}</label>
                      <input type="number" value={level} onChange={e => setLevel(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.marketing}</label>
                      <input type="number" value={marketing} onChange={e => setMarketing(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.buyback}</label>
                      <input type="number" value={buyback} onChange={e => setBuyback(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.lp}</label>
                      <input type="number" value={lp} onChange={e => setLp(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.treasury}</label>
                      <input type="number" value={treasury} onChange={e => setTreasury(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="pt-2 border-t text-xs md:text-sm text-slate-500">
                      {t.admin.total}: {Number(direct)+Number(level)+Number(marketing)+Number(buyback)+Number(lp)+Number(treasury)}% (Must be 100)
                  </div>
                  <button onClick={updateDistribution} disabled={loading} className="w-full py-2 md:py-2.5 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800 disabled:opacity-50 text-sm md:text-base">
                      {t.admin.updateDist}
                  </button>
              </div>
          </div>

          {/* Swap Taxes */}
          <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-slate-200">
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-slate-800">{t.admin.swapTaxes}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.buyTax}</label>
                      <input type="number" value={buyTax} onChange={e => setBuyTax(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.sellTax}</label>
                      <input type="number" value={sellTax} onChange={e => setSellTax(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <button onClick={updateSwapTaxes} disabled={loading} className="w-full py-2 md:py-2.5 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800 disabled:opacity-50 text-sm md:text-base">
                      {t.admin.updateTaxes}
                  </button>
              </div>

              <h3 className="text-lg md:text-xl font-bold mt-6 md:mt-8 mb-3 md:mb-4 text-slate-800">{t.admin.redeemFee}</h3>
              <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                      <label className="text-sm md:text-base">{t.admin.fee}</label>
                      <input type="number" value={redeemFee} onChange={e => setRedeemFee(e.target.value)} className="w-16 md:w-20 p-1.5 md:p-2 border rounded text-sm md:text-base" />
                  </div>
                  <button onClick={updateRedeemFee} disabled={loading} className="w-full py-2 md:py-2.5 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800 disabled:opacity-50 text-sm md:text-base">
                      {t.admin.updateFee}
                  </button>
              </div>
          </div>
      </div>

      {/* Wallet Addresses */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-slate-200">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-slate-800">{t.admin.wallets}</h3>
          <div className="space-y-3 md:space-y-4">
              <div>
                  <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.marketingWallet}</label>
                  <input type="text" value={marketingWallet} onChange={e => setMarketingWallet(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.treasuryWallet}</label>
                  <input type="text" value={treasuryWallet} onChange={e => setTreasuryWallet(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.lpWallet}</label>
                  <input type="text" value={lpWallet} onChange={e => setLpWallet(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.buybackWallet}</label>
                  <input type="text" value={buybackWallet} onChange={e => setBuybackWallet(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
              </div>
              <button onClick={updateWallets} disabled={loading} className="w-full py-2 md:py-2.5 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800 disabled:opacity-50 text-sm md:text-base">
                  {t.admin.updateWallets}
              </button>
          </div>
      </div>

      {/* User Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-slate-200">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-slate-800">{t.admin.userMgmt}</h3>
          <div className="space-y-3 md:space-y-4">
              <div>
                  <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.userAddr}</label>
                  <input type="text" value={targetUser} onChange={e => setTargetUser(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 border-t pt-3 md:pt-4">
                  <div>
                      <label className="block text-xs md:text-sm text-slate-500 mb-1">{t.admin.newReferrer}</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                          <input type="text" value={newReferrer} onChange={e => setNewReferrer(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm font-mono" placeholder="0x..." />
                          <button onClick={updateReferrer} disabled={loading} className="px-3 md:px-4 py-2 md:py-2.5 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 text-xs md:text-sm whitespace-nowrap">
                              {t.admin.updateReferrer}
                          </button>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                          <label className="text-xs md:text-sm text-slate-500 w-20 md:w-24">{t.admin.activeDirects}</label>
                          <input type="number" value={activeDirects} onChange={e => setActiveDirects(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm" />
                      </div>
                      <div className="flex gap-2 items-center">
                          <label className="text-xs md:text-sm text-slate-500 w-20 md:w-24">{t.admin.teamCount}</label>
                          <input type="number" value={teamCount} onChange={e => setTeamCount(e.target.value)} className="w-full p-2 md:p-2.5 border rounded text-xs md:text-sm" />
                      </div>
                      <button onClick={updateUserStats} disabled={loading} className="w-full py-2 md:py-2.5 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 text-xs md:text-sm">
                          {t.admin.updateUser}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Liquidity Management */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white border border-red-200">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
              <AlertTriangle className="text-red-600" size={20} />
              <h3 className="text-lg md:text-xl font-bold text-slate-800">Add Pool Liquidity (Admin Only)</h3>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mb-4">Transfer tokens from your wallet to the protocol contract to add liquidity for swaps.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Add MC Liquidity</label>
                  <input 
                      type="number" 
                      value={mcLiquidityAmount} 
                      onChange={e => setMcLiquidityAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border rounded text-sm"
                      placeholder="Amount in MC"
                  />
                  <button 
                      onClick={() => addLiquidity('MC')} 
                      disabled={loading || !mcLiquidityAmount}
                      className="w-full py-2 md:py-2.5 bg-macoin-500 text-white rounded-lg hover:bg-macoin-600 disabled:opacity-50 text-sm md:text-base"
                  >
                      Add MC to Pool
                  </button>
              </div>
              
              <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Add JBC Liquidity</label>
                  <input 
                      type="number" 
                      value={jbcLiquidityAmount} 
                      onChange={e => setJbcLiquidityAmount(e.target.value)} 
                      className="w-full p-2 md:p-2.5 border rounded text-sm"
                      placeholder="Amount in JBC"
                  />
                  <button 
                      onClick={() => addLiquidity('JBC')} 
                      disabled={loading || !jbcLiquidityAmount}
                      className="w-full py-2 md:py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm md:text-base"
                  >
                      Add JBC to Pool
                  </button>
              </div>
          </div>
      </div>

      {/* Announcement Management */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200">
          <h3 className="text-xl font-bold mb-4 text-slate-800">Announcement Management</h3>
          <div className="space-y-4">
              <div>
                  <label className="block text-sm text-slate-500 mb-1">Language Code</label>
                  <select 
                    value={announceLang} 
                    onChange={e => setAnnounceLang(e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                  >
                      <option value="en">English (en)</option>
                      <option value="zh">Chinese (zh)</option>
                      <option value="zh-TW">Traditional Chinese (zh-TW)</option>
                      <option value="ja">Japanese (ja)</option>
                      <option value="ko">Korean (ko)</option>
                      <option value="ar">Arabic (ar)</option>
                      <option value="ru">Russian (ru)</option>
                      <option value="es">Spanish (es)</option>
                  </select>
              </div>
              <div>
                  <label className="block text-sm text-slate-500 mb-1">Content</label>
                  <textarea 
                    value={announceContent} 
                    onChange={e => setAnnounceContent(e.target.value)} 
                    className="w-full p-2 border rounded text-sm h-24"
                    placeholder="Enter announcement text..."
                  />
              </div>
              <button onClick={updateAnnouncement} disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                  Update Announcement
              </button>
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;