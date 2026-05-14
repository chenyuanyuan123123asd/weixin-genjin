/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Search, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileUp, 
  Users,
  Copy,
  Zap,
  MousePointer2,
  Keyboard,
  ArrowRight,
  Save,
  Scan,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// 初始化 AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const [isScanning, setIsScanning] = useState(false);
  const [importText, setImportText] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const handleNext = (currentId: string) => {
    const currentIndex = filteredCustomers.findIndex(c => c.id === currentId);
    const nextPending = filteredCustomers.slice(currentIndex + 1).find(c => !c.completed);
    if (nextPending) {
      copyAndFocus(nextPending.contact, nextPending.id);
      inputRefs.current[nextPending.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleScreenScan = async () => {
    setIsScanning(true);
    setScanError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const response = await model.generateContent({
        contents: [
          { role: "user", parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: "Identify the current WeChat contact/customer name and their latest message or follow-up summary. Return as JSON: { \"contact\": string, \"status\": string }. Return ONLY JSON." }
          ]}
        ],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.response.text());
      if (result && result.contact) {
        const existing = customers.find(c => c.contact === result.contact);
        if (existing) {
          updateStatus(existing.id, result.status);
          setActiveId(existing.id);
        } else {
          setCustomers([{ id: Math.random().toString(36).substring(2), contact: result.contact, status: result.status, updatedAt: Date.now(), completed: true }, ...customers]);
        }
      } else {
        setScanError("未识别到联系人，请确保微信窗口清晰可见。");
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') setScanError("识别出错: " + err.message);
    } finally {
      stream?.getTracks().forEach(t => t.stop());
      setIsScanning(false);
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
              <h1 className="font-bold text-lg text-zinc-800">微信跟进助手</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium">Auto Follow-up Engine</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleScreenScan} disabled={isScanning} className="flex gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold disabled:opacity-50 transition-all active:scale-95">
              {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />} 
              AI 扫屏识别
            </button>
            <button onClick={() => setIsImporting(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all">导入名单</button>
          </div>
        </div>
      </nav>

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

        <AnimatePresence>{scanError && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm border border-rose-100 flex items-center justify-between"><span>{scanError}</span><button onClick={() => setScanError(null)} className="font-bold px-2">×</button></motion.div>}</AnimatePresence>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 italic">
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400 w-16">✔</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400">联系人 (点我要复制)</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-400">最新情况 (填完敲回车)</th>
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
                      onKeyDown={e => e.key === 'Enter' && handleNext(customer.id)}
                      onFocus={() => setActiveId(customer.id)}
                    />
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
            已成功复制：{customers.find(c => c.id === lastCopied)?.contact}
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
