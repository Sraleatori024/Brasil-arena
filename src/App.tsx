import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  CheckCircle2, Settings, RefreshCw, Trash2, 
  TrendingUp, TrendingDown, Target, Zap, 
  Ticket, ArrowUpRight, BarChart3, Users,
  Globe, ShieldCheck, Lock, LogOut,
  FileText, DollarSign, Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface Option {
  id: 'left' | 'right';
  name: string;
  image: string;
  description: string;
  price: number;
  totalPurchases: number;
  recentGrowth: number;
}

interface AppSettings {
  mainTitle: string;
  subTitle: string;
  leftName: string;
  rightName: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  mainTitle: 'Arena de Decisões',
  subTitle: 'Participe da maior arena de tendências do Brasil',
  leftName: 'Opção A',
  rightName: 'Opção B'
};

const DEFAULT_OPTIONS: Record<'left' | 'right', Option> = {
  left: {
    id: 'left',
    name: 'Carregando...',
    image: 'https://picsum.photos/seed/praia/800/800',
    description: 'Buscando dados do servidor...',
    price: 0,
    totalPurchases: 0,
    recentGrowth: 0
  },
  right: {
    id: 'right',
    name: 'Carregando...',
    image: 'https://picsum.photos/seed/chapada/800/800',
    description: 'Buscando dados do servidor...',
    price: 0,
    totalPurchases: 0,
    recentGrowth: 0
  }
};

interface Purchase {
  id: string;
  side: 'left' | 'right';
  code: string;
  amount: number;
  timestamp: number;
  position: number;
  status: string;
}

// --- App Component ---
export default function App() {
  const [options, setOptions] = useState<Record<'left' | 'right', Option>>(DEFAULT_OPTIONS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuth, setAdminAuth] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);

  // Local Admin Draft State
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [localOptions, setLocalOptions] = useState<Record<'left', Option> & Record<'right', Option> | null>(null);

  useEffect(() => {
    if (isAdminLoggedIn && settings && options) {
      setLocalSettings(settings);
      setLocalOptions(options);
    }
  }, [isAdminLoggedIn, settings, options]);

  const [syncError, setSyncError] = useState(false);

  const safeJson = async (res: Response) => {
    try {
      const text = await res.text();
      if (!text || text === 'undefined' || text.trim() === '') {
        console.error(`Received invalid JSON body from ${res.url}`);
        return null;
      }
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse response from ${res.url}:`, e);
      return null;
    }
  };

  const fetchState = () => {
    console.log('Tentando sincronizar com o servidor local...');
    window.fetch('/api/state')
      .then(safeJson)
      .then(data => {
        if (data && data.options && data.settings) {
          setOptions(data.options);
          setSettings(data.settings);
          setTotalPurchases(data.totalPurchases);
          setIsLoaded(true);
          setSyncError(false);
          console.log('✅ Arena sincronizada!');
        }
      })
      .catch(err => {
        console.warn('⚠️ Servidor ainda não respondeu, usando modo offline.');
        setSyncError(true);
      });
  };

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3
    });

    socket.on('connect', () => {
      console.log('✅ Socket conectado');
      setSyncError(false);
    });

    socket.on('state_update', (data) => {
      if (!data) return;
      if (data.options) setOptions(data.options);
      if (data.settings) setSettings(data.settings);
      if (typeof data.totalPurchases === 'number') setTotalPurchases(data.totalPurchases);
      setIsLoaded(true);
      setSyncError(false);
    });

    fetchState();

    // Se em 3 segundos não carregar, apenas mostramos o que temos
    const timeout = setTimeout(() => setIsLoaded(true), 3000);

    return () => {
      clearTimeout(timeout);
      socket.disconnect();
    };
  }, []);

  const handlePurchase = async (side: 'left' | 'right') => {
    setIsProcessing(side);
    // Simulate payment process
    setTimeout(async () => {
      try {
        const res = await window.fetch('/api/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side })
        });
        const data = await safeJson(res);
        if (data && data.purchase) {
          setSuccessData(data.purchase);
          setUserPosition(data.purchase.position);
        }
      } catch (err) {
        console.error('Purchase error:', err);
      } finally {
        setIsProcessing(null);
      }
    }, 1500);
  };

  const loginAdmin = (isDemo = false) => {
    if (isDemo) {
      setIsAdminLoggedIn(true);
      setAdminData({
        purchases: [
          { id: '1', side: 'left', code: 'BR-DEMO01', amount: 99, timestamp: Date.now() - 100000, position: 1 },
          { id: '2', side: 'right', code: 'BR-DEMO02', amount: 120, timestamp: Date.now() - 500000, position: 2 }
        ],
        options,
        settings
      });
      return;
    }

    window.fetch('/api/admin/data', {
      headers: { 'Authorization': `Bearer ${adminAuth}` }
    })
    .then(res => {
      if (res.ok) {
        setIsAdminLoggedIn(true);
        return safeJson(res);
      }
      if (adminAuth === '8888') { // Chave mestra local
         setIsAdminLoggedIn(true);
         setAdminData({ purchases: [], options, settings });
         return null;
      }
      throw new Error('Unauthorized');
    })
    .then(data => {
      if (data) setAdminData(data);
    })
    .catch((err) => {
      console.error('Admin login error:', err);
      alert('Acesso negado. Use a chave padrão do servidor ou 8888 para modo teste.');
    });
  };

  const adminAction = async (endpoint: string, body: any) => {
    try {
      const res = await window.fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminAuth}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
         loginAdmin();
         alert('Alteração salva com sucesso! 🎉');
      } else {
        const err = await safeJson(res);
        alert(`Erro: ${err?.error || 'Ação falhou'}`);
      }
    } catch (e) {
      console.error('Admin action error:', e);
      alert('Erro de conexão com o servidor.');
    }
  };

  // Derived Values
  const rankings = useMemo(() => {
    if (!options) return { left: 1, right: 1 };
    return options.left.totalPurchases >= options.right.totalPurchases 
      ? { left: 1, right: 2 } 
      : { left: 2, right: 1 };
  }, [options]);

  const trends = useMemo(() => {
    if (!options) return { left: 'up', right: 'up' };
    return {
      left: options.left.recentGrowth > options.right.recentGrowth ? 'up' : 'down',
      right: options.right.recentGrowth > options.left.recentGrowth ? 'up' : 'down'
    };
  }, [options]);

  if (!isLoaded) return (
    <div className="min-h-screen bg-br-green flex flex-col items-center justify-center font-black italic text-white p-6">
      <div className="text-3xl animate-pulse uppercase tracking-tighter">SINCRONIZANDO ARENA...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-br-green text-white font-sans selection:bg-br-yellow selection:text-br-green">
      
      {/* Navbar Stats */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-br-green/80 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-br-yellow" />
            <span className="font-black italic tracking-tighter uppercase text-xl">Brasil Trends</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setShowAdmin(true)} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-4 max-w-7xl mx-auto space-y-6">
        
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-br-blue rounded-[32px] border-2 border-br-yellow p-6 md:p-10 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="space-y-6 max-w-2xl relative z-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <span className="bg-br-yellow text-br-blue px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                🇧🇷 Tendência em Tempo Real
              </span>
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
              {settings.mainTitle}
            </h1>
            <p className="text-lg font-medium opacity-80 leading-relaxed">
              {settings.subTitle}
            </p>
          </div>
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-br-yellow/5 blur-[100px] -z-0" />
        </section>

        {/* Comparison Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start relative">
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden lg:flex w-20 h-20 bg-br-yellow border-[10px] border-br-green rounded-full items-center justify-center font-black italic text-3xl text-br-blue shadow-2xl">
            VS
          </div>

          {(['left', 'right'] as const).map(id => (
            <motion.div 
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              {/* Trend & Info Header */}
              <div className="flex justify-between items-end px-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">Opção {id === 'left' ? 'Esquerda' : 'Direita'}</span>
                  <h3 className="text-2xl font-black italic uppercase text-br-yellow leading-none">{id === 'left' ? settings.leftName : settings.rightName}</h3>
                </div>
                <div className="flex gap-3">
                  <div className={cn(
                    "px-4 py-2 rounded-2xl flex items-center gap-2 font-black italic text-xs uppercase",
                    trends[id] === 'up' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  )}>
                    {trends[id] === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {trends[id] === 'up' ? 'Subindo' : 'Descendo'}
                  </div>
                  <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 font-black italic text-xs uppercase text-white/60">
                    Ranking #{rankings[id]}
                  </div>
                </div>
              </div>

              {/* Main Card */}
              <div className={cn(
                "group relative bg-br-blue rounded-[40px] overflow-hidden p-2 border-4 transition-all duration-700 shadow-2xl",
                rankings[id] === 1 ? "border-br-yellow shadow-[0_0_45px_rgba(254,209,0,0.3)] scale-[1.01]" : "border-white/5 hover:border-white/20"
              )}>
                <div className="aspect-[3/2] md:aspect-[16/10] xl:aspect-video relative rounded-[28px] overflow-hidden max-h-[220px] md:max-h-[280px]">
                  <img src={options[id].image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000" />
                  <div className="absolute inset-0 bg-gradient-to-t from-br-blue/90 via-transparent to-transparent p-6 md:p-10 flex flex-col justify-end">
                    <h4 className="text-2xl md:text-4xl font-black italic uppercase leading-none mb-2 drop-shadow-xl">{options[id].name}</h4>
                    <p className="text-xs md:text-sm font-medium opacity-70 mb-4 max-w-xs line-clamp-2 md:line-clamp-none">{options[id].description}</p>
                  </div>
                  {rankings[id] === 1 && (
                    <div className="absolute top-4 left-4 bg-br-yellow text-br-blue px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse shadow-xl">
                      ⭐ Lote Extra
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => handlePurchase(id)}
                disabled={isProcessing !== null}
                className={cn(
                  "w-full py-4 md:py-6 rounded-[24px] text-lg md:text-xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 disabled:opacity-50",
                  id === 'left' ? "bg-white text-br-blue hover:bg-br-yellow" : "bg-br-yellow text-br-blue hover:bg-white"
                )}
              >
                {isProcessing === id ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Ticket className="w-6 h-6" />}
                {isProcessing === id ? 'Confirmando...' : 'Comprar Ingresso'}
              </button>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Success Modal */}
      <AnimatePresence>
        {successData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-br-blue/90 backdrop-blur-2xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-white rounded-[60px] p-12 text-center text-br-blue space-y-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-4 bg-br-yellow" />
              <div className="w-20 h-20 bg-br-green rounded-full flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Registro Concluído!</h3>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Código Único de Identificação</p>
              </div>
              <div className="bg-gray-50 border-4 border-dashed border-gray-100 p-8 rounded-[40px]">
                <p className="text-4xl font-black tracking-widest text-br-green">{successData.code}</p>
              </div>
              <button onClick={() => setSuccessData(null)} className="w-full bg-br-blue text-white py-6 rounded-[30px] font-black uppercase tracking-widest hover:bg-br-green transition-all shadow-xl">
                Voltar à Arena
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdmin && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-5xl w-full my-auto bg-white rounded-[56px] p-8 md:p-14 text-br-blue shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAdmin(false)}
                className="absolute top-10 right-10 w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-black transition-all"
              >✕</button>

              {!isAdminLoggedIn ? (
                <div className="max-w-sm mx-auto py-12 space-y-10">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-br-blue rounded-[30px] flex items-center justify-center mx-auto shadow-2xl">
                       <Lock className="w-10 h-10 text-white" />
                    </div>
                    <div>
                       <h2 className="text-3xl font-black italic uppercase tracking-tighter">Gestão da Arena</h2>
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Autenticação Necessária</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input 
                       type="password" 
                       value={adminAuth}
                       onChange={(e) => setAdminAuth(e.target.value)}
                       placeholder="Chave Administrativa"
                       className="w-full border-4 border-gray-50 rounded-[30px] p-6 text-xl font-black text-center focus:border-br-yellow outline-none transition-all"
                       onKeyDown={(e) => e.key === 'Enter' && loginAdmin()}
                    />
                    <button 
                       onClick={() => loginAdmin()}
                       className="w-full bg-br-blue text-white py-6 rounded-[30px] font-black uppercase tracking-widest hover:bg-br-green transition-all shadow-xl"
                    >Entrar no Painel</button>
                    
                    <button 
                       onClick={() => loginAdmin(true)}
                       className="w-full bg-gray-50 text-gray-400 py-3 rounded-[20px] font-bold uppercase text-[10px] tracking-widest hover:text-br-blue transition-all"
                    >Acesso Rápido (Visualização)</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  
          <div className="flex items-center gap-6 border-b border-gray-100 pb-8">
            <div className="space-y-1">
               <h2 className="text-4xl font-black italic uppercase tracking-tighter">Painel de <span className="text-br-green">Controle</span></h2>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-br-green" /> Administrador Conectado
                   <span className="mx-2 opacity-20">|</span>
                   <Users className="w-4 h-4 text-br-blue" /> <span className="text-br-blue font-black">{totalPurchases}</span> Registros Totais
               </p>
            </div>
            <div className="flex-grow md:flex-initial flex gap-4 ml-auto">
               <button 
                  onClick={() => adminAction('bulk-update', { settings: localSettings, options: localOptions })}
                  className="px-8 py-3 bg-br-blue text-white font-black uppercase text-xs rounded-2xl hover:bg-br-green hover:scale-105 transition-all shadow-lg flex items-center gap-2"
               >
                  <RefreshCw className="w-4 h-4" /> Salvar Tudo
               </button>
               <button onClick={() => adminAction('reset', {})} className="px-6 py-3 rounded-2xl bg-red-50 text-red-500 font-bold text-xs uppercase flex items-center gap-2 hover:bg-red-100 transition-all">
                  <Trash2 className="w-4 h-4" /> Reset
               </button>
               <button onClick={() => setIsAdminLoggedIn(false)} className="px-6 py-3 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs uppercase flex items-center gap-2 hover:bg-gray-200 transition-all">
                  <LogOut className="w-4 h-4" /> Sair
               </button>
            </div>
          </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     {/* Settings */}
                     <div className="space-y-8">
                        <div className="flex items-center gap-3 text-br-blue font-black uppercase text-xs tracking-widest border-b-2 border-br-yellow pb-4">
                           <Layout className="w-4 h-4" /> Conteúdo Principal
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] uppercase font-black text-gray-400 px-4">Título Principal</label>
                              <input 
                                 className="w-full bg-gray-50 rounded-[24px] p-5 font-bold outline-none focus:ring-4 focus:ring-br-yellow/20"
                                 value={localSettings?.mainTitle || ''}
                                 onChange={(e) => setLocalSettings(prev => prev ? { ...prev, mainTitle: e.target.value } : null)}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] uppercase font-black text-gray-400 px-4">Subtítulo/Descrição</label>
                              <textarea 
                                 className="w-full bg-gray-50 rounded-[24px] p-5 font-bold outline-none focus:ring-4 focus:ring-br-yellow/20 min-h-[100px]"
                                 value={localSettings?.subTitle || ''}
                                 onChange={(e) => setLocalSettings(prev => prev ? { ...prev, subTitle: e.target.value } : null)}
                              />
                           </div>
                        </div>

                        <div className="flex items-center justify-between border-b-2 border-br-yellow pb-4 mt-12">
                           <div className="flex items-center gap-3 text-br-blue font-black uppercase text-xs tracking-widest">
                              <ArrowUpRight className="w-4 h-4" /> Nomes das Colunas
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <input 
                              placeholder="Nome Esquerda"
                              className="bg-gray-50 rounded-[24px] p-5 font-bold outline-none"
                              value={localSettings?.leftName || ''}
                              onChange={(e) => setLocalSettings(prev => prev ? { ...prev, leftName: e.target.value } : null)}
                           />
                           <input 
                              placeholder="Nome Direita"
                              className="bg-gray-50 rounded-[24px] p-5 font-bold outline-none"
                              value={localSettings?.rightName || ''}
                              onChange={(e) => setLocalSettings(prev => prev ? { ...prev, rightName: e.target.value } : null)}
                           />
                        </div>
                     </div>

                     {/* Option Cards */}
                     <div className="space-y-8">
                        <div className="flex items-center gap-3 text-br-blue font-black uppercase text-xs tracking-widest border-b-2 border-br-yellow pb-4">
                           <BarChart3 className="w-4 h-4" /> Edição de Cards
                        </div>
                        <div className="grid grid-cols-1 gap-8">
                           {(['left', 'right'] as const).map(id => (
                              <div key={id} className="bg-gray-50 rounded-[40px] p-8 space-y-6">
                                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-40">
                                    <span>Lado {id === 'left' ? 'Esquerdo' : 'Direito'}</span>
                                 </div>
                                 <div className="space-y-4">
                                    <div className="flex gap-4">
                                       <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-200 flex-shrink-0">
                                          <img src={localOptions?.[id].image || ''} className="w-full h-full object-cover" />
                                       </div>
                                       <div className="flex-grow space-y-2">
                                          <input 
                                             placeholder="Link da Imagem"
                                             className="w-full bg-white rounded-xl p-3 text-xs font-bold outline-none border border-gray-100"
                                             value={localOptions?.[id].image || ''}
                                             onChange={(e) => setLocalOptions(prev => prev ? { ...prev, [id]: { ...prev[id], image: e.target.value } } : null)}
                                          />
                                          <input 
                                             placeholder="Nome do Item"
                                             className="w-full bg-white rounded-xl p-3 text-xs font-bold outline-none border border-gray-100"
                                             value={localOptions?.[id].name || ''}
                                             onChange={(e) => setLocalOptions(prev => prev ? { ...prev, [id]: { ...prev[id], name: e.target.value } } : null)}
                                          />
                                       </div>
                                    </div>
                                    <textarea 
                                       placeholder="Descrição Curta"
                                       className="w-full bg-white rounded-xl p-4 text-xs font-bold outline-none border border-gray-100 min-h-[80px]"
                                       value={localOptions?.[id].description || ''}
                                       onChange={(e) => setLocalOptions(prev => prev ? { ...prev, [id]: { ...prev[id], description: e.target.value } } : null)}
                                    />
                                    <div className="flex gap-4 items-center">
                                       <div className="flex-grow flex items-center bg-white rounded-xl px-4 border border-gray-100">
                                          <DollarSign className="w-4 h-4 text-gray-300" />
                                          <input 
                                             type="number"
                                             placeholder="Valor"
                                             className="w-full p-3 text-xs font-black outline-none"
                                             value={localOptions?.[id].price || 0}
                                             onChange={(e) => setLocalOptions(prev => prev ? { ...prev, [id]: { ...prev[id], price: Number(e.target.value) } } : null)}
                                          />
                                       </div>
                                       <button 
                                          onClick={() => adminAction('adjust-count', { id, count: localOptions?.[id].totalPurchases })}
                                          className="bg-br-yellow/20 text-br-yellow p-3 rounded-xl hover:bg-br-yellow/40 transition-all font-black"
                                       >
                                          Reset/Ajuste
                                       </button>
                                       <div className="flex-grow flex items-center bg-white rounded-xl px-4 border border-gray-100">
                                          <Users className="w-4 h-4 text-gray-300" />
                                          <input 
                                             type="number"
                                             placeholder="Contagem Manual"
                                             className="w-full p-3 text-xs font-black outline-none"
                                             value={localOptions?.[id].totalPurchases || 0}
                                             onChange={(e) => setLocalOptions(prev => prev ? { ...prev, [id]: { ...prev[id], totalPurchases: Number(e.target.value) } } : null)}
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Codes List */}
                  <div className="space-y-8">
                     <div className="flex items-center gap-3 text-br-blue font-black uppercase text-xs tracking-widest border-b-2 border-br-yellow pb-4">
                        <FileText className="w-4 h-4" /> Registro de Códigos Gerados
                     </div>
                     <div className="bg-gray-50 rounded-[40px] overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                           <table className="w-full text-left border-collapse">
                              <thead className="bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400 sticky top-0">
                                 <tr>
                                    <th className="px-8 py-4">Código</th>
                                    <th className="px-8 py-4">Lado</th>
                                    <th className="px-8 py-4">Valor</th>
                                    <th className="px-8 py-4">Data/Hora</th>
                                    <th className="px-8 py-4">Status</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                 {adminData?.purchases?.slice().reverse().map((p: any) => (
                                    <tr key={p.id} className="text-sm font-bold hover:bg-white transition-colors">
                                       <td className="px-8 py-4 text-br-green font-black">{p.code}</td>
                                       <td className="px-8 py-4 uppercase text-xs italic">{p.side === 'left' ? 'Esquerda' : 'Direita'}</td>
                                       <td className="px-8 py-4">R$ {p.amount.toFixed(2)}</td>
                                       <td className="px-8 py-4 text-gray-400 font-mono text-[10px]">
                                          {new Date(p.timestamp).toLocaleString()}
                                       </td>
                                       <td className="px-8 py-4">
                                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] uppercase font-black">
                                             {p.status || 'Confirmado'}
                                          </span>
                                       </td>
                                    </tr>
                                 ))}
                                 {(!adminData?.purchases || adminData.purchases.length === 0) && (
                                    <tr>
                                       <td colSpan={5} className="px-8 py-12 text-center text-gray-300 font-black uppercase italic tracking-widest">Nenhum registro encontrado</td>
                                    </tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-br-blue/40 border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-br-yellow" />
            <span className="font-black italic uppercase tracking-tighter text-lg">Brasil Trends v3.0</span>
          </div>
          <div className="flex gap-12 font-bold uppercase text-[10px] tracking-widest opacity-40">
             <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Transmissão Global</span>
             <span className="flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Dados Criptografados</span>
          </div>
          <div className="text-[10px] font-medium opacity-20 uppercase tracking-widest">
             © 2026 Arena de Tendências Brasil
          </div>
        </div>
      </footer>
    </div>
  );
}
