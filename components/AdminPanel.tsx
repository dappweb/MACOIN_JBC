import React, { useState } from 'react';
import { useWeb3 } from '../Web3Context';
import { Settings, Save, AlertTriangle } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const { protocolContract } = useWeb3();
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

  const updateDistribution = async () => {
    if (!protocolContract) return;
    setLoading(true);
    try {
      const tx = await protocolContract.setDistributionPercents(
        direct, level, marketing, buyback, lp, treasury
      );
      await tx.wait();
      alert("Distribution updated!");
    } catch (err: any) {
      alert("Error: " + (err.reason || err.message));
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
      alert("Swap Taxes updated!");
    } catch (err: any) {
      alert("Error: " + (err.reason || err.message));
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
      alert("Redemption Fee updated!");
    } catch (err: any) {
      alert("Error: " + (err.reason || err.message));
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
            alert("All wallet addresses required");
            return;
        }
      const tx = await protocolContract.setWallets(marketingWallet, treasuryWallet, lpWallet, buybackWallet);
      await tx.wait();
      alert("Wallets updated!");
    } catch (err: any) {
      alert("Error: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Settings className="text-red-600" /> Admin Control Panel
        </h2>
        <p className="text-slate-500">Only accessible by contract owner</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Distribution Settings */}
          <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-xl font-bold mb-4 text-slate-800">Distribution (%)</h3>
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <label>Direct Reward</label>
                      <input type="number" value={direct} onChange={e => setDirect(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>Level Reward</label>
                      <input type="number" value={level} onChange={e => setLevel(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>Marketing</label>
                      <input type="number" value={marketing} onChange={e => setMarketing(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>Buyback</label>
                      <input type="number" value={buyback} onChange={e => setBuyback(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>LP Injection</label>
                      <input type="number" value={lp} onChange={e => setLp(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>Treasury</label>
                      <input type="number" value={treasury} onChange={e => setTreasury(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="pt-2 border-t text-sm text-slate-500">
                      Total: {Number(direct)+Number(level)+Number(marketing)+Number(buyback)+Number(lp)+Number(treasury)}% (Must be 100)
                  </div>
                  <button onClick={updateDistribution} disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800">
                      Update Distribution
                  </button>
              </div>
          </div>

          {/* Swap Taxes */}
          <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200">
              <h3 className="text-xl font-bold mb-4 text-slate-800">Swap Taxes (%)</h3>
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <label>Buy Tax (Burn)</label>
                      <input type="number" value={buyTax} onChange={e => setBuyTax(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                      <label>Sell Tax (Burn)</label>
                      <input type="number" value={sellTax} onChange={e => setSellTax(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <button onClick={updateSwapTaxes} disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800">
                      Update Taxes
                  </button>
              </div>

              <h3 className="text-xl font-bold mt-8 mb-4 text-slate-800">Redemption Fee (%)</h3>
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <label>Fee</label>
                      <input type="number" value={redeemFee} onChange={e => setRedeemFee(e.target.value)} className="w-20 p-2 border rounded" />
                  </div>
                  <button onClick={updateRedeemFee} disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800">
                      Update Fee
                  </button>
              </div>
          </div>
      </div>

      {/* Wallet Addresses */}
      <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200">
          <h3 className="text-xl font-bold mb-4 text-slate-800">Protocol Wallets</h3>
          <div className="space-y-4">
              <div>
                  <label className="block text-sm text-slate-500 mb-1">Marketing Wallet</label>
                  <input type="text" value={marketingWallet} onChange={e => setMarketingWallet(e.target.value)} className="w-full p-2 border rounded text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-sm text-slate-500 mb-1">Treasury Wallet</label>
                  <input type="text" value={treasuryWallet} onChange={e => setTreasuryWallet(e.target.value)} className="w-full p-2 border rounded text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-sm text-slate-500 mb-1">LP Injection Wallet</label>
                  <input type="text" value={lpWallet} onChange={e => setLpWallet(e.target.value)} className="w-full p-2 border rounded text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                  <label className="block text-sm text-slate-500 mb-1">Buyback Wallet</label>
                  <input type="text" value={buybackWallet} onChange={e => setBuybackWallet(e.target.value)} className="w-full p-2 border rounded text-sm font-mono" placeholder="0x..." />
              </div>
              <button onClick={updateWallets} disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg mt-2 hover:bg-slate-800">
                  Update Wallets
              </button>
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;