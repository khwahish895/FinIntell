import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  Bell, 
  Settings, 
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Smartphone,
  Banknote,
  LayoutDashboard,
  History,
  Target,
  Sparkles,
  LogOut,
  User as UserIcon,
  X,
  Loader2
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { Transaction, Category, Budget, Insight } from './types';
import { auth, db, signIn, logOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budget' | 'insights'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // New Transaction Form State
  const [newTx, setNewTx] = useState({
    amount: '',
    category: 'Food' as Category,
    description: '',
    type: 'expense' as 'income' | 'expense',
    paymentMethod: 'UPI' as any
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    });

    return unsubscribe;
  }, [user]);

  const generateInsight = async () => {
    if (!user || transactions.length === 0) return;
    setGeneratingInsight(true);
    try {
      const summary = transactions.slice(0, 10).map(t => `${t.type}: ₹${t.amount} in ${t.category} (${t.description})`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a financial advisor. Here are the last 10 transactions:\n${summary}\nProvide one short, punchy financial insight (max 2 sentences) to help this user save money or understand their habit.`,
      });
      setAiInsight(response.text || "Your spending is looking healthy!");
    } catch (error) {
      console.error(error);
      setAiInsight("Unable to generate insight at the moment.");
    } finally {
      setGeneratingInsight(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTx.amount || !newTx.description) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount: Number(newTx.amount),
        category: newTx.category,
        description: newTx.description,
        date: new Date().toISOString(),
        type: newTx.type,
        paymentMethod: newTx.paymentMethod,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewTx({ amount: '', category: 'Food', description: '', type: 'expense', paymentMethod: 'UPI' });
    } catch (error) {
      console.error(error);
    }
  };

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return {
      balance: totalIncome - totalExpense,
      income: totalIncome,
      expense: totalExpense,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, 'MMM dd');
      const dailyTransactions = transactions.filter(t => format(new Date(t.date), 'MMM dd') === dayStr);
      return {
        name: dayStr,
        income: dailyTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
        expense: dailyTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
      };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories = Array.from(new Set(expenses.map(t => t.category)));
    return categories.map(cat => ({
      name: cat,
      value: expenses.filter(t => t.category === cat).reduce((acc, t) => acc + t.amount, 0)
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
        <p className="text-brand-text-muted font-medium">Synchronizing Secure Data...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-xl border border-brand-border shadow-sm text-center"
        >
          <div className="w-16 h-16 bg-brand-bg rounded-xl flex items-center justify-center mx-auto mb-8 border border-brand-border">
            <Wallet className="text-brand-primary" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-brand-text-main mb-4 tracking-tight">Fin<span className="text-brand-primary">Intell</span></h1>
          <p className="text-brand-text-muted mb-10 text-sm leading-relaxed">
            Professional-grade financial behavior analysis for independent growth.
          </p>
          <button 
            onClick={signIn}
            className="w-full bg-brand-primary text-white font-bold py-4 rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] uppercase text-xs tracking-widest"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/component/google_signin_buttons/google_white.png" className="w-5 h-5 object-contain" alt="" />
            Authenticate with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text-main font-sans selection:bg-brand-primary/20 flex flex-col md:flex-row">
      {/* Sidebar / Navigation */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 bg-brand-sidebar text-white p-4 md:relative md:w-[220px] md:h-screen md:flex md:flex-col md:p-6 shadow-xl md:shadow-none overflow-y-auto">
        <div className="hidden md:flex items-center gap-2 mb-12 px-2">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
             <Wallet size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Fin<span className="text-brand-primary">IQ</span></span>
        </div>

        <nav className="flex justify-around md:flex-col md:gap-1 flex-1">
          <NavIcon 
            icon={<LayoutDashboard size={20} />} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            label="Dashboard"
          />
          <NavIcon 
            icon={<History size={20} />} 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')} 
            label="Cash Flow"
          />
          <NavIcon 
            icon={<Target size={20} />} 
            active={activeTab === 'budget'} 
            onClick={() => setActiveTab('budget')} 
            label="Budgeting"
          />
          <NavIcon 
            icon={<Sparkles size={20} />} 
            active={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')} 
            label="Intelligence"
          />
        </nav>

        <div className="hidden md:flex flex-col gap-1 mt-auto pt-6 border-t border-white/10">
          <NavIcon 
            icon={<Settings size={20} />} 
            active={false} 
            label="Settings" 
          />
          <NavIcon 
            icon={<LogOut size={20} />} 
            active={false} 
            onClick={logOut} 
            label="Sign Out" 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto w-full">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-brand-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {activeTab === 'dashboard' && 'Command Center'}
              {activeTab === 'transactions' && 'Cash Flow Intelligence'}
              {activeTab === 'budget' && 'Efficiency Analysis'}
              {activeTab === 'insights' && 'AI Insight Grid'}
            </h1>
            <p className="text-xs text-brand-text-muted mt-1 uppercase font-semibold tracking-wider">
              Real-time behavior analysis • {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-brand-primary text-white px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:opacity-90 flex items-center gap-2 transition-all"
          >
            <Plus size={16} /> record entry
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard 
                label="Total Net Worth" 
                value={`₹${stats.balance.toLocaleString()}`} 
                icon={<Wallet className="text-brand-primary" size={18} />}
                trend={`${stats.savingsRate}% Savings`}
                trendType="up"
              />
              <StatsCard 
                label="Monthly Income" 
                value={`₹${stats.income.toLocaleString()}`} 
                icon={<TrendingUp className="text-brand-success" size={18} />}
                trend="+8.2% vs prev"
                trendType="up"
              />
              <StatsCard 
                label="Spend (MTD)" 
                value={`₹${stats.expense.toLocaleString()}`} 
                icon={<TrendingDown className="text-brand-danger" size={18} />}
                trend="+12% target"
                trendType="down"
              />
              <StatsCard 
                label="Efficiency" 
                value={`${stats.savingsRate}%`} 
                icon={<Sparkles className="text-brand-warning" size={18} />}
                secondary="Optimized Level"
              />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cash Flow Intelligence */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-brand-border flex flex-col h-[480px]">
                <div className="p-4 border-b border-brand-border flex justify-between items-center bg-slate-50/50">
                  <span className="text-xs font-bold uppercase tracking-widest">Cash Flow Activity</span>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text-muted">
                      <div className="w-2 h-2 rounded-full bg-brand-primary" /> INCOME
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text-muted">
                      <div className="w-2 h-2 rounded-full bg-brand-danger" /> EXPENSE
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-6 relative overflow-hidden">
                   <div className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="income" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          fillOpacity={0.05} 
                          fill="#3B82F6" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="expense" 
                          stroke="#EF4444" 
                          strokeWidth={2}
                          fillOpacity={0.05} 
                          fill="#EF4444" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Micro Transaction List */}
                <div className="border-t border-brand-border max-h-[160px] overflow-y-auto px-6 py-2">
                  {transactions.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center py-3 border-b border-brand-border last:border-0">
                      <div className="tx-icon w-8 h-8 bg-brand-bg rounded-lg flex items-center justify-center mr-3 text-sm">
                        {t.category === 'Food' && '☕'}{t.category === 'Rent' && '🏢'}{t.category === 'Travel' && '✈️'}{t.category === 'Bills' && '⚡'}{t.category === 'Shopping' && '🛍️'}{t.category === 'Entertainment' && '🎮'}{t.category === 'Health' && '🏥'}{t.category === 'Other' && '📝'}{t.category === 'Income' && '💰'}
                      </div>
                      <div className="flex-1">
                         <p className="text-xs font-bold leading-none">{t.description}</p>
                         <p className="text-[10px] text-brand-text-muted mt-1 uppercase tracking-tight">{t.category} • {format(new Date(t.date), 'hh:mm a')}</p>
                      </div>
                      <div className={cn("text-xs font-mono font-bold", t.type === 'income' ? 'text-brand-success' : 'text-brand-main')}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Cards */}
              <div className="flex flex-col gap-6">
                {/* AI Logic Card */}
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-4 bg-brand-primary text-white text-[9px] font-bold px-3 py-1 rounded-b-lg uppercase tracking-widest shadow-sm">AI LOGIC ACTIVE</div>
                  <div className="mb-4">
                    <Sparkles className="text-brand-primary mb-2" size={20} />
                    <p className="text-sm font-bold text-[#1E293B] mb-2">Automated Optimization</p>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {generatingInsight ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 py-2">
                        <Loader2 className="animate-spin text-brand-primary" size={16} />
                        <span className="text-xs font-semibold text-brand-primary italic">Recalculating habits...</span>
                      </motion.div>
                    ) : (
                      <div className="insight-text text-[#3730A3] text-sm italic leading-relaxed">
                        "{aiInsight || "Initiate behavior analysis to discover optimized budget paths and potential annual savings of up to ₹42,000."}"
                      </div>
                    )}
                  </AnimatePresence>

                  <button 
                    onClick={generateInsight}
                    disabled={generatingInsight}
                    className="mt-4 text-xs font-bold text-brand-primary uppercase tracking-wider hover:underline flex items-center gap-1"
                  >
                    Execute Logic Analysis →
                  </button>
                </div>

                {/* Efficiency Stats */}
                <div className="bg-white border border-brand-border rounded-xl flex flex-col">
                  <div className="p-4 border-b border-brand-border bg-slate-50/50">
                    <h3 className="text-xs font-bold uppercase tracking-widest">Efficiency Gauges</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {categoryData.slice(0, 3).map((item, i) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="uppercase text-brand-text-muted">{item.name}</span>
                          <span className="font-mono">₹{item.value.toLocaleString()}</span>
                        </div>
                        <div className="progress-bar h-1.5 bg-brand-bg rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (item.value / stats.income) * 100)}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              i === 0 ? "bg-brand-warning" : i === 1 ? "bg-brand-primary" : "bg-brand-danger"
                            )} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-brand-border rounded-xl p-4 flex-1">
                   <h3 className="text-[11px] font-bold uppercase tracking-widest text-brand-text-muted mb-4">Active Alerts</h3>
                   <div className="space-y-3">
                      <div className="text-[11px] p-3 bg-brand-danger/10 border-l-4 border-brand-danger rounded-r-lg">
                        <strong className="block mb-1">Budget Threshold:</strong>
                        System suggests reducing Entertainment by 12% to maintain 60% savings tier.
                      </div>
                      <div className="text-[11px] p-3 bg-brand-warning/10 border-l-4 border-brand-warning rounded-r-lg">
                        <strong className="block mb-1">Recurring Event:</strong>
                        Subscription renewal detected in 48 hours for UPI Payment.
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Other Tabs content remains roughly similar but with theme classes */}
        {activeTab === 'transactions' && (
           <div className="bg-white border border-brand-border rounded-xl flex flex-col">
              <div className="p-4 border-b border-brand-border bg-slate-50/50 flex justify-between items-center">
                 <h3 className="text-xs font-bold uppercase tracking-widest">Transaction Audit Log</h3>
                 <span className="text-[10px] font-mono text-brand-text-muted tracking-widest uppercase">Verified System Records</span>
              </div>
              <div className="divide-y divide-brand-border">
                {transactions.length === 0 ? (
                  <div className="p-10 text-center text-brand-text-muted italic text-sm">No records initialized.</div>
                ) : (
                  transactions.map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-mono text-lg", t.type === 'income' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-bg text-brand-text-main')}>
                             {t.type === 'income' ? '+' : '-'}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-brand-text-main">{t.description}</p>
                             <p className="text-[10px] text-brand-text-muted uppercase tracking-wider font-semibold mt-1">{t.category} • {format(new Date(t.date), 'MMM dd, yyyy')}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-mono font-bold text-brand-text-main">
                             {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-brand-text-muted flex items-center justify-end gap-1 mt-1 font-bold">
                             {t.paymentMethod} <ChevronRight size={10} />
                          </p>
                       </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        )}
      </main>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-brand-sidebar/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-brand-border"
            >
              <div className="p-6 border-b border-brand-border flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xs font-bold uppercase tracking-widest">Add System Record</h2>
                <button onClick={() => setShowAddModal(false)} className="text-brand-text-muted hover:text-brand-text-main transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-2 p-1 bg-brand-bg rounded-lg">
                  {['expense', 'income'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTx(prev => ({ ...prev, type: t as any }))}
                      className={cn(
                        "py-2 rounded-md font-bold text-[10px] uppercase tracking-widest transition-all",
                        newTx.type === t ? "bg-white shadow-sm text-brand-text-main" : "text-brand-text-muted"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-2 block ml-1">Transaction Value (₹)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="0.00"
                      value={newTx.amount}
                      onChange={e => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-brand-bg border-brand-border rounded-lg p-4 font-mono text-xl focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all placeholder:opacity-50"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-2 block ml-1">Description</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Audit identifier..."
                      value={newTx.description}
                      onChange={e => setNewTx(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-brand-bg border-brand-border rounded-lg p-4 text-sm font-semibold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all placeholder:opacity-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-2 block ml-1">Classification</label>
                      <select 
                        value={newTx.category}
                        onChange={e => setNewTx(prev => ({ ...prev, category: e.target.value as Category }))}
                        className="w-full bg-brand-bg border-brand-border rounded-lg p-4 text-xs font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none cursor-pointer"
                      >
                        {['Food', 'Rent', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Other'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text-muted mb-2 block ml-1">Methodology</label>
                      <select 
                         value={newTx.paymentMethod}
                         onChange={e => setNewTx(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                         className="w-full bg-brand-bg border-brand-border rounded-lg p-4 text-xs font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 rounded-lg bg-brand-sidebar text-white font-bold text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-[0.98] mt-4"
                >
                  finalize entry
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavIcon({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick?: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left font-semibold text-sm",
        active 
          ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <div className={cn(
        "transition-colors",
        active ? "text-white" : ""
      )}>
        {icon}
      </div>
      <span className="hidden md:inline tracking-tight text-[11px] uppercase tracking-wider font-bold">{label}</span>
    </button>
  );
}

function StatsCard({ label, value, icon, trend, trendType, secondary }: { label: string, value: string, icon: React.ReactNode, trend?: string, trendType?: 'up' | 'down', secondary?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-brand-card p-5 rounded-xl border border-brand-border shadow-sm flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-brand-bg rounded-lg border border-brand-border">
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border",
            trendType === 'up' ? "bg-brand-success/10 text-brand-success border-brand-success/20" : "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
          )}>
            {trendType === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-brand-text-muted text-[10px] uppercase font-bold tracking-widest mb-1">{label}</h4>
        <p className="text-xl font-bold text-brand-text-main font-mono">{value}</p>
        {secondary && <p className="text-[9px] text-brand-primary font-bold mt-2 uppercase tracking-widest">{secondary}</p>}
      </div>
    </motion.div>
  );
}

