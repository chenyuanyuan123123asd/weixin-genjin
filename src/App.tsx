/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Trash2, 
  CheckCircle2, 
  Copy,
  Zap,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: string;
  contact: string;
  status: string;
  updatedAt: number;
  completed: boolean;
}

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('wechat-followup-data');
    return saved ? JSON.parse(saved) : [];
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFloatingStats, setShowFloatingStats] = useState(false);
  
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 监听滚动，展示左边浮窗
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 150) {
        setShowFloatingStats(true);
      } else {
        setShowFloatingStats(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动保存
  useEffect(() => {
    localStorage.setItem('wechat-followup-data', JSON.stringify(customers));
  }, [customers]);

  const handlePasteImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    const newCustomers: Customer[] = lines
      .map(line => {
        const parts = line.split('\t');
        if (parts.length < 1 || !parts[0].trim()) return null;
        return {
          id: Math.random().toString(36).substring(2, 9),
          contact: parts[0].trim(),
          status: parts[1] ? parts[1].trim() : '',
          updatedAt: Date.now(),
          completed: !!(parts[1] && parts[1].trim()) 
        };
      })
      .filter((c): c is Customer => c !== null);

    setCustomers([...newCustomers, ...customers]);
    setImportText('');
    setIsImporting(false);
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const clearAll = () => {
    if (window.confirm("确定要清空所有联系人资料吗？此操作不可撤销。")) {
      setCustomers([]);
      setActiveId(null);
    }
  };

  const updateStatus = (id: string, status: string) => {
    setCustomers(prev => prev.map(c => 
      c.id === id ? { ...c, status, updatedAt: Date.now(), completed: !!status } : c
    ));
  };

  const copyAndFocus = async (contact: string, id: string) => {
    try {
      await navigator.clipboard.writeText(contact);
      setLastCopied(id);
      setActiveId(id);
      setTimeout(() => {
        inputRefs.current[id]?.focus();
        setLastCopied(null);
      }, 400);
    } catch (err) {
      console.error(err);
    }
  };

  // 敲击回车时：即使空白也视为已处理（完成），然后跳到下一个待办
  const submitAndNext = (currentId: string) => {
    setCustomers(prev => prev.map(c => 
      c.id === currentId ? { ...c, completed: true } : c
    ));

    const currentIndex = filteredCustomers.findIndex(c => c.id === currentId);
    const nextPending = filteredCustomers.slice(currentIndex + 1).find(c => !c.completed);
    if (nextPending) {
      copyAndFocus(nextPending.contact, nextPending.id);
      inputRefs.current[nextPending.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const exportToCSV = () => {
    const header = "\uFEFF联系方式,跟进状态\n";
    const rows = customers.map(c => `"${c.contact}","${c.status}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `跟进结果_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.contact.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return filter === 'pending' ? matchesSearch && !c.completed : matchesSearch && c.completed;
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <nav className="sticky top-0 z-50 bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-800 uppercase tracking-tighter">weixin-genjin</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium">Auto Follow-up Engine</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                const results = customers.map(c => c.status || "").join("\n");
                await navigator.clipboard.writeText(results);
                setLastCopied("all");
                setTimeout(() => setLastCopied(null), 2000);
              }}
              className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold active:scale-95 transition-all outline-none"
            >
              复制所有状态
            </button>
            <button 
              onClick={clearAll}
              className="px-4 py-2 border border-rose-200 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold active:scale-95 transition-all outline-none"
            >
              清空名单
            </button>
            <button onClick={() => setIsImporting(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all">导入名单</button>
          </div>
        </div>
      </nav>

      {/* 滚动时生成的左侧悬浮窗 */}
      <AnimatePresence>
        {showFloatingStats && (
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="fixed left-4 top-24 z-40 w-44 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl p-4 shadow-xl hidden lg:flex flex-col gap-3"
          >
            <div className="border-b border-zinc-100 pb-1.5">
              <h4 className="font-bold text-[11px] text-zinc-400 uppercase tracking-wider">跟进简报</h4>
            </div>
            <div className="space-y-2 text-xs font-bold">
              <div className="flex justify-between items-center bg-zinc-50 p-2 rounded-lg text-zinc-700">
                <span className="text-zinc-500 font-normal">总客户数</span>
                <span className="font-mono text-zinc-950">{customers.length}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-2 rounded-lg">
                <span className="font-normal text-emerald-600">已处理</span>
                <span className="font-mono">{customers.filter(c => c.completed).length}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 text-amber-800 p-2 rounded-lg">
                <span className="font-normal text-amber-600">待跟进</span>
                <span className="font-mono">{customers.filter(c => !c.completed).length}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-zinc-100">
              <button 
                onClick={async () => {
                  const results = customers.map(c => c.status || "").join("\n");
                  await navigator.clipboard.writeText(results);
                  setLastCopied("all");
                  setTimeout(() => setLastCopied(null), 2000);
                }}
                className="w-full text-center py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold transition-all"
              >
                复制状态列表
              </button>
              <button 
                onClick={clearAll}
                className="w-full text-center py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition-all"
              >
                清空名单
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="总数" value={customers.length} color="zinc" />
          <StatCard label="已办" value={customers.filter(c => c.completed).length} color="emerald" />
          <StatCard label="待办" value={customers.filter(c => !c.completed).length} color="amber" />
          <div className="bg-emerald-600 rounded-2xl p-4 text-white text-xs font-bold flex flex-col justify-center">
            <p className="opacity-70 uppercase tracking-tighter">快速捷径</p>
            <p>填完反馈点回车 = 下一位</p>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
            {(['all', 'pending', 'completed'] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)} className={`px-6 py-2 rounded-lg text-sm font-bold ${filter === t ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                {t === 'all' ? '全部' : t === 'pending' ? '待跟进' : '已完成'}
              </button>
            ))}
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
            <input type="text" placeholder="搜索联系人..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"/>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 italic">
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400 w-16">✔</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400">联系人 (点我要复制)</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400">最新情况 (填完敲回车)</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400 w-16 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className={`group ${activeId === customer.id ? 'bg-emerald-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <button onClick={() => updateStatus(customer.id, customer.completed ? '' : '已处理')} className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${customer.completed ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'border-zinc-200 hover:border-emerald-300'}`}>
                      {customer.completed && <CheckCircle2 size={16} />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => copyAndFocus(customer.contact, customer.id)} className="flex items-center gap-2 text-sm font-bold font-mono tracking-tighter">
                      <span className={customer.completed ? 'text-zinc-400 line-through' : 'text-zinc-800'}>{customer.contact}</span>
                      <Copy size={12} className="text-zinc-300 opacity-0 group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      ref={el => inputRefs.current[customer.id] = el}
                      type="text"
                      className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none"
                      placeholder="等待填写..."
                      value={customer.status}
                      onChange={e => updateStatus(customer.id, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitAndNext(customer.id)}
                      onFocus={() => setActiveId(customer.id)}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => deleteCustomer(customer.id)}
                      className="text-zinc-300 hover:text-rose-500 transition-colors p-1"
                      title="删除此行"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && <tr><td colSpan={3} className="py-24 text-center text-zinc-300 text-sm font-medium">暂无名单，请点击右上角导入</td></tr>}
            </tbody>
          </table>
        </div>
      </main>

      <AnimatePresence>
        {isImporting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImporting(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-8 w-full max-w-lg relative shadow-2xl">
              <h3 className="text-xl font-bold mb-4">从 Excel 粘贴</h3>
              <textarea
                className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                placeholder="直接在 Excel 里选好两列粘贴在这里..."
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsImporting(false)} className="flex-1 py-3 font-bold text-zinc-500">取消</button>
                <button onClick={handlePasteImport} className="flex-[2] py-3 bg-zinc-900 text-white rounded-2xl font-bold">开始识别数据</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastCopied && (
          <motion.div initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }} className="fixed bottom-6 left-1/2 bg-zinc-900 text-white px-6 py-3 rounded-2xl shadow-xl z-[200] font-bold text-sm">
            {lastCopied === 'all' ? '✅ 已成功复制所有状态（按行排列）' : `已成功复制：${customers.find(c => c.id === lastCopied)?.contact}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={`p-4 rounded-2xl border border-zinc-200 bg-white shadow-sm flex items-center gap-4`}>
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-50 text-zinc-400'}`}>{label[0]}</div>
       <div><p className="text-[10px] uppercase font-black text-zinc-400 leading-none mb-1">{label}</p><p className="text-xl font-black">{value}</p></div>
    </div>
  );
}
