import { useState, useEffect, useCallback } from 'react';
import { 
  Phone, 
  Signal, 
  Zap, 
  Gamepad2, 
  Wallet, 
  Store, 
  Plus, 
  History, 
  LogOut, 
  RefreshCw, 
  Bell, 
  QrCode, 
  Contact, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  X,
  Timer,
  LayoutDashboard,
  Package,
  FileText,
  Settings as SettingsIcon,
  Search,
  Filter,
  Download,
  Eye,
  EyeOff,
  Save,
  Trash2,
  ChevronRight,
  TrendingUp,
  DollarSign,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from './services/api';
import { Category, Denomination, Transaction } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DENOMINATIONS: Denomination[] = [
  { id: 'pulsa10', name: 'PULSA REGULER 10.000', amount: 10000, price: 12000, category: 'PULSA' },
  { id: 'pulsa20', name: 'PULSA REGULER 20.000', amount: 20000, price: 22000, category: 'PULSA' },
  { id: 'pulsa50', name: 'PULSA REGULER 50.000', amount: 50000, price: 51500, category: 'PULSA' },
  { id: 'pulsa100', name: 'PULSA REGULER 100.000', amount: 100000, price: 101000, category: 'PULSA' },
  { id: 'pulsa200', name: 'PULSA REGULER 200.000', amount: 200000, price: 200500, category: 'PULSA' },
];

// Mock Data for Inventory
const MOCK_INVENTORY = [
  { sku: 'PULSA5', name: 'Pulsa 5.000', category: 'PULSA', costPrice: 5100, sellingPrice: 7000, isActive: true },
  { sku: 'PULSA10', name: 'Pulsa 10.000', category: 'PULSA', costPrice: 10100, sellingPrice: 12000, isActive: true },
  { sku: 'DATA1GB', name: 'Data 1GB', category: 'DATA', costPrice: 15000, sellingPrice: 18000, isActive: true },
  { sku: 'TOKEN20', name: 'Token PLN 20rb', category: 'TOKEN', costPrice: 20000, sellingPrice: 22000, isActive: true },
  { sku: 'GAME50', name: 'Diamond FF 50', category: 'GAME', costPrice: 7500, sellingPrice: 10000, isActive: true },
];

// Mock Data for Reports
const MOCK_REPORTS = [
  { id: 'TX001', time: '10:30', product: 'Pulsa 10.000', target: '08123456789', cost: 10100, sell: 12000, profit: 1900, method: 'CASH', status: 'SUCCESS' },
  { id: 'TX002', time: '11:15', product: 'Data 1GB', target: '08123456789', cost: 15000, sell: 18000, profit: 3000, method: 'QRIS', status: 'SUCCESS' },
  { id: 'TX003', time: '12:00', product: 'Token PLN 20rb', target: '1234567890', cost: 20000, sell: 22000, profit: 2000, method: 'CASH', status: 'SUCCESS' },
  { id: 'TX004', time: '14:20', product: 'Pulsa 5.000', target: '08123456789', cost: 5100, sell: 7000, profit: 1900, method: 'QRIS', status: 'FAILED' },
];

type Tab = 'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS';

export default function App() {
  // State Management
  const [currentTab, setCurrentTab] = useState<Tab>('DASHBOARD');
  const [customerId, setCustomerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('PULSA');
  const [selectedDenom, setSelectedDenom] = useState<Denomination | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'CONFIRM_CASH' | 'QRIS_PAY' | null>(null);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [balance, setBalance] = useState<number>(0);

  // Settings State
  const [storeSettings, setStoreSettings] = useState({
    name: 'GPDPB Marturia Abasi',
    logoUrl: 'https://picsum.photos/seed/store/200',
    duitkuMerchantCode: 'DS29393',
    duitkuApiKey: '9b9b83b59d344945500389e2759bc010',
    digiflazzUsername: '',
    digiflazzApiKey: ''
  });
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Fetch Balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await api.getSupplierBalance();
        if (res.success) setBalance(res.balance);
      } catch (err) {
        console.error("Failed to fetch balance", err);
      }
    };
    fetchBalance();
  }, []);

  const resetForm = useCallback(() => {
    setCustomerId('');
    setSelectedDenom(null);
    setActiveTransactionId(null);
    setQrString(null);
  }, []);

  const handleTransactionSuccess = useCallback(() => {
    if (!activeTransactionId || !selectedDenom) return;

    const newTx: Transaction = {
      id: activeTransactionId,
      customerId,
      productName: selectedDenom.name,
      amount: selectedDenom.amount,
      price: selectedDenom.price,
      method: paymentMethod,
      status: 'SUCCESS',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHistory(prev => [newTx, ...prev]);
    setNotification({ 
      message: paymentMethod === 'CASH' ? "Transaksi Berhasil" : "Pembayaran Diterima & Produk Diproses!", 
      type: 'success' 
    });
    
    // Close modal first to stop polling
    setIsModalOpen(false);
    setModalType(null);
    
    // Then reset form
    resetForm();
  }, [activeTransactionId, customerId, selectedDenom, paymentMethod, resetForm]);

  // Polling for QRIS
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (modalType === 'QRIS_PAY' && activeTransactionId) {
      console.log(`Starting polling for ${activeTransactionId}`);
      interval = setInterval(async () => {
        try {
          const res = await api.checkStatus(activeTransactionId);
          console.log(`Polling status for ${activeTransactionId}: ${res.status}`);
          if (res.status === 'SUCCESS') {
            handleTransactionSuccess();
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => {
      if (interval) {
        console.log(`Stopping polling for ${activeTransactionId}`);
        clearInterval(interval);
      }
    };
  }, [modalType, activeTransactionId, handleTransactionSuccess]);

  const handleProcessTransaction = async () => {
    if (!customerId || !selectedDenom) {
      setNotification({ message: "Lengkapi data transaksi", type: 'error' });
      return;
    }

    if (paymentMethod === 'CASH') {
      setModalType('CONFIRM_CASH');
      setIsModalOpen(true);
    } else {
      setIsProcessing(true);
      try {
        const res = await api.createQrisTransaction({
          customerId,
          product: selectedDenom
        });

        if (res.success) {
          setActiveTransactionId(res.transactionId);
          setQrString(res.qrString);
          setModalType('QRIS_PAY');
          setIsModalOpen(true);
        }
      } catch (err: any) {
        setNotification({ message: err.response?.data?.message || "Gagal membuat QRIS", type: 'error' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCashConfirm = async () => {
    setIsProcessing(true);
    try {
      const res = await api.createCashTransaction({
        customerId,
        product: selectedDenom
      });

      if (res.success) {
        setActiveTransactionId(res.transactionId);
        handleTransactionSuccess();
      }
    } catch (err: any) {
      setNotification({ message: err.response?.data?.message || "Gagal memproses transaksi", type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkStatusManual = async () => {
    if (!activeTransactionId) return;
    try {
      const res = await api.checkStatus(activeTransactionId);
      if (res.status === 'SUCCESS') {
        handleTransactionSuccess();
      } else {
        setNotification({ message: "Pembayaran belum diterima", type: 'error' });
      }
    } catch (err) {
      setNotification({ message: "Gagal mengecek status", type: 'error' });
    }
  };

  const handleSimulateSuccess = async () => {
    if (!activeTransactionId) return;
    try {
      await api.simulateSuccess(activeTransactionId);
      handleTransactionSuccess();
    } catch (err) {
      setNotification({ message: "Gagal simulasi bayar", type: 'error' });
    }
  };

  return (
    <div className="bg-surface text-on-surface overflow-hidden h-screen flex flex-col font-body">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full flex justify-between items-center px-6 h-16 bg-slate-50/80 backdrop-blur-md shadow-sm z-50">
        <div className="flex items-center gap-4">
          <span className="text-xl font-extrabold tracking-tight text-teal-950 font-headline">{storeSettings.name}</span>
          <nav className="hidden md:flex ml-10 space-x-8">
            <button 
              onClick={() => setCurrentTab('DASHBOARD')}
              className={cn("font-medium transition-colors", currentTab === 'DASHBOARD' ? "text-teal-700 border-b-2 border-teal-700 pb-1" : "text-slate-500 hover:text-teal-600")}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentTab('INVENTORY')}
              className={cn("font-medium transition-colors", currentTab === 'INVENTORY' ? "text-teal-700 border-b-2 border-teal-700 pb-1" : "text-slate-500 hover:text-teal-600")}
            >
              Inventory
            </button>
            <button 
              onClick={() => setCurrentTab('REPORTS')}
              className={cn("font-medium transition-colors", currentTab === 'REPORTS' ? "text-teal-700 border-b-2 border-teal-700 pb-1" : "text-slate-500 hover:text-teal-600")}
            >
              Reports
            </button>
            <button 
              onClick={() => setCurrentTab('SETTINGS')}
              className={cn("font-medium transition-colors", currentTab === 'SETTINGS' ? "text-teal-700 border-b-2 border-teal-700 pb-1" : "text-slate-500 hover:text-teal-600")}
            >
              Settings
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-teal-50 rounded-full border border-teal-100">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Saldo Pusat</span>
            <span className="text-sm font-bold text-teal-900">Rp {balance.toLocaleString()}</span>
          </div>
          <button className="p-2 text-teal-900 hover:text-teal-600 transition-colors"><RefreshCw size={20} /></button>
          <button className="p-2 text-teal-900 hover:text-teal-600 transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <div className="w-8 h-8 rounded-full ml-2 border border-outline-variant bg-slate-200 overflow-hidden">
             <img src={storeSettings.logoUrl} alt="Store Logo" referrerPolicy="no-referrer" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* SideNavBar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col py-4 bg-slate-100 w-64 border-r-0 z-40 hidden md:flex">
          <div className="px-6 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Store className="text-on-primary" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-teal-900 leading-tight">Marturia Abasi</h2>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Terminal POS</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            <button 
              onClick={() => setCurrentTab('DASHBOARD')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg w-[calc(100%-1rem)] text-sm font-semibold transition-all",
                currentTab === 'DASHBOARD' ? "bg-teal-100 text-teal-900" : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentTab('INVENTORY')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg w-[calc(100%-1rem)] text-sm font-semibold transition-all",
                currentTab === 'INVENTORY' ? "bg-teal-100 text-teal-900" : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <Package size={20} />
              Inventory
            </button>
            <button 
              onClick={() => setCurrentTab('REPORTS')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg w-[calc(100%-1rem)] text-sm font-semibold transition-all",
                currentTab === 'REPORTS' ? "bg-teal-100 text-teal-900" : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <FileText size={20} />
              Reports
            </button>
            <button 
              onClick={() => setCurrentTab('SETTINGS')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg w-[calc(100%-1rem)] text-sm font-semibold transition-all",
                currentTab === 'SETTINGS' ? "bg-teal-100 text-teal-900" : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <SettingsIcon size={20} />
              Settings
            </button>
          </nav>
          <div className="mt-auto px-4 space-y-4">
            <button onClick={resetForm} className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
              <Plus size={18} /> New Transaction
            </button>
            <div className="border-t border-slate-200 pt-4 pb-2">
              <button className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-200 w-full rounded-lg text-sm font-semibold transition-all">
                <History size={18} /> History
              </button>
              <button className="flex items-center gap-3 px-4 py-2 text-error hover:bg-error-container w-full rounded-lg text-sm font-semibold transition-all mt-1">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 flex overflow-hidden">
          {currentTab === 'DASHBOARD' && (
            <>
              {/* Transaction Area */}
              <section className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
                <div className="max-w-4xl mx-auto space-y-8">
                  <header>
                    <h1 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Main Transaction</h1>
                    <p className="text-on-surface-variant font-medium">Input transaction details to begin</p>
                  </header>

                  {/* Input Area */}
                  <div className="bg-surface-container-lowest p-8 rounded-full shadow-sm">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Customer ID / Nomor HP</label>
                    <div className="relative">
                      <input 
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-5 px-6 text-2xl font-bold placeholder:text-outline-variant focus:ring-2 focus:ring-surface-tint focus:bg-surface-container-lowest transition-all" 
                        placeholder="08xx xxxx xxxx" 
                        type="text"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                        <button className="p-2 text-on-secondary-container hover:bg-secondary-container rounded-lg"><Contact size={24} /></button>
                        <button className="p-2 text-on-secondary-container hover:bg-secondary-container rounded-lg"><QrCode size={24} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Category Tabs */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { id: 'PULSA', label: 'Pulsa', icon: Phone },
                      { id: 'DATA', label: 'Data', icon: Signal },
                      { id: 'TOKEN', label: 'Token', icon: Zap },
                      { id: 'GAME', label: 'Game', icon: Gamepad2 },
                      { id: 'E-WALLET', label: 'E-Wallet', icon: Wallet },
                    ].map((cat) => (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id as Category)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",
                          selectedCategory === cat.id 
                            ? "bg-primary-container text-on-primary-container scale-95 ring-2 ring-primary" 
                            : "bg-surface-container-lowest text-on-surface hover:bg-secondary-container"
                        )}
                      >
                        <cat.icon size={28} />
                        <span className="text-xs font-bold uppercase tracking-wide">{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Denomination Grid */}
                  <div>
                    <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-4">Select Denomination</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {DENOMINATIONS.filter(d => d.category === selectedCategory).map((denom) => (
                        <button 
                          key={denom.id}
                          onClick={() => setSelectedDenom(denom)}
                          className={cn(
                            "group flex flex-col items-start p-6 rounded-xl transition-all border border-transparent",
                            selectedDenom?.id === denom.id 
                              ? "bg-primary-fixed ring-2 ring-primary" 
                              : "bg-surface-container-lowest hover:bg-primary-fixed hover:border-surface-tint"
                          )}
                        >
                          <span className="text-xs font-bold text-on-surface-variant uppercase">{denom.category} REGULER</span>
                          <span className="text-2xl font-extrabold text-primary">{denom.amount.toLocaleString()}</span>
                          <span className="text-sm font-semibold text-on-surface-variant mt-2">Rp {denom.price.toLocaleString()}</span>
                        </button>
                      ))}
                      <div className="flex items-center justify-center p-6 bg-surface-container-high rounded-xl border border-dashed border-outline-variant">
                        <button className="text-on-surface-variant font-bold text-sm hover:text-primary transition-colors flex items-center gap-1">
                          <Plus size={18} /> Custom Amt
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Sidebar */}
              <aside className="w-96 bg-surface-container border-l border-outline-variant/10 hidden xl:flex flex-col">
                <div className="p-6 border-b border-outline-variant/10 bg-surface-container-low">
                  <h2 className="text-lg font-bold text-primary font-headline">Summary</h2>
                  <p className="text-xs text-on-surface-variant font-semibold">Active Checkout</p>
                </div>
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  {selectedDenom ? (
                    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 relative">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-on-surface-variant uppercase">Produk</span>
                          <span className="text-sm font-bold text-on-surface">{selectedDenom.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-on-surface-variant uppercase">Customer</span>
                          <span className="text-sm font-bold text-on-surface">{customerId || '-'}</span>
                        </div>
                        <div className="border-t border-dashed border-outline-variant py-4 mt-4">
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-on-surface-variant uppercase">Total Tagihan</span>
                            <span className="text-3xl font-extrabold text-primary tracking-tighter">Rp {selectedDenom.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-on-surface-variant opacity-50">
                      <AlertCircle className="mx-auto mb-2" />
                      <p className="text-sm font-medium">Belum ada item dipilih</p>
                    </div>
                  )}

                  {/* Payment & CTA moved to sidebar */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Payment Method</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setPaymentMethod('CASH')}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 py-4 font-bold rounded-xl transition-all border",
                          paymentMethod === 'CASH' 
                            ? "bg-primary-container text-on-primary-container border-primary ring-1 ring-primary" 
                            : "bg-surface-container-lowest text-on-surface border-outline-variant/20 hover:bg-slate-50"
                        )}
                      >
                        <Wallet size={20} />
                        <span className="text-xs">CASH</span>
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('QRIS')}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 py-4 font-bold rounded-xl transition-all border",
                          paymentMethod === 'QRIS' 
                            ? "bg-primary-container text-on-primary-container border-primary ring-1 ring-primary" 
                            : "bg-surface-container-lowest text-on-surface border-outline-variant/20 hover:bg-slate-50"
                        )}
                      >
                        <QrCode size={20} />
                        <span className="text-xs">QRIS</span>
                      </button>
                    </div>
                    <button 
                      onClick={handleProcessTransaction}
                      disabled={isProcessing}
                      className="w-full py-5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-extrabold text-lg tracking-tight shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Proses Transaksi
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Riwayat Singkat</h3>
                      <button className="text-xs font-bold text-surface-tint hover:underline">View All</button>
                    </div>
                    <div className="space-y-3">
                      {history.map((tx) => (
                        <div key={tx.id} className="p-3 bg-surface-container-lowest rounded-lg border-l-4 border-primary flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-on-surface">{tx.productName}</p>
                            <p className="text-[10px] font-semibold text-on-surface-variant">{tx.timestamp} • {tx.status}</p>
                          </div>
                          <span className="text-sm font-bold text-primary">Rp {tx.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-primary text-on-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                      <TrendingUp className="text-on-primary-container" size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold opacity-80">Daily Volume</p>
                      <p className="text-lg font-extrabold">Rp 1.450.000</p>
                    </div>
                  </div>
                </div>
              </aside>
            </>
          )}

          {currentTab === 'INVENTORY' && (
            <section className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
              <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Inventory</h1>
                    <p className="text-on-surface-variant font-medium">Manage your digital products and margins</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <input type="text" placeholder="Search product..." className="pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors">
                      <Filter size={18} /> Filter
                    </button>
                  </div>
                </header>

                <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high border-b border-outline-variant/10">
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">SKU</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Product Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Category</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Cost Price</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Selling Price</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Margin</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {MOCK_INVENTORY.map((item) => (
                        <tr key={item.sku} className="hover:bg-surface-container-low transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-primary">{item.sku}</td>
                          <td className="px-6 py-4 font-bold text-on-surface">{item.name}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-black rounded uppercase">{item.category}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-on-surface-variant">Rp {item.costPrice.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-on-surface-variant">Rp</span>
                              <input 
                                type="number" 
                                defaultValue={item.sellingPrice} 
                                className="w-24 bg-surface-container-high border-none rounded px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-teal-600">Rp {(item.sellingPrice - item.costPrice).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className={cn(
                              "w-10 h-5 rounded-full relative transition-colors",
                              item.isActive ? "bg-teal-500" : "bg-slate-300"
                            )}>
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                item.isActive ? "right-1" : "left-1"
                              )}></div>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {currentTab === 'REPORTS' && (
            <section className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
              <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Sales Reports</h1>
                    <p className="text-on-surface-variant font-medium">Track your performance and earnings</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-lg hover:shadow-primary/20 transition-all">
                      <Download size={18} /> Export CSV
                    </button>
                  </div>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-teal-50 text-teal-600 rounded-xl"><TrendingUp size={24} /></div>
                      <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">+12.5%</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Total Revenue</p>
                    <h3 className="text-2xl font-black text-on-surface mt-1">Rp 4.250.000</h3>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-primary-container/10 text-primary rounded-xl"><DollarSign size={24} /></div>
                      <span className="text-[10px] font-bold text-primary bg-primary-container/10 px-2 py-1 rounded-full">+8.2%</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Gross Profit</p>
                    <h3 className="text-2xl font-black text-on-surface mt-1">Rp 845.000</h3>
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-secondary-container/10 text-secondary rounded-xl"><ShoppingCart size={24} /></div>
                      <span className="text-[10px] font-bold text-secondary bg-secondary-container/10 px-2 py-1 rounded-full">142 Tx</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Successful Tx</p>
                    <h3 className="text-2xl font-black text-on-surface mt-1">128</h3>
                  </div>
                </div>

                {/* Transaction Table */}
                <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                    <h3 className="font-bold text-on-surface">Recent Transactions</h3>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-xs font-bold bg-surface-container-high rounded-md">Today</button>
                      <button className="px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high rounded-md">This Week</button>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high/50 border-b border-outline-variant/10">
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Time</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Product</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Target</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Sell Price</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Profit</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Method</th>
                        <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {MOCK_REPORTS.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{tx.time}</td>
                          <td className="px-6 py-4 font-bold text-on-surface">{tx.product}</td>
                          <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">{tx.target}</td>
                          <td className="px-6 py-4 font-bold text-on-surface">Rp {tx.sell.toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-teal-600">Rp {tx.profit.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-black rounded uppercase">{tx.method}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 text-[10px] font-black rounded uppercase",
                              tx.status === 'SUCCESS' ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700"
                            )}>{tx.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {currentTab === 'SETTINGS' && (
            <section className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
              <div className="max-w-4xl mx-auto space-y-8">
                <header>
                  <h1 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Settings</h1>
                  <p className="text-on-surface-variant font-medium">Configure your store and API integrations</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Store Profile */}
                  <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/10 space-y-6">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                      <Store size={20} /> Store Profile
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Store Name</label>
                        <input 
                          type="text" 
                          value={storeSettings.name}
                          onChange={(e) => setStoreSettings({...storeSettings, name: e.target.value})}
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Logo URL</label>
                        <input 
                          type="text" 
                          value={storeSettings.logoUrl}
                          onChange={(e) => setStoreSettings({...storeSettings, logoUrl: e.target.value})}
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="pt-4">
                        <button className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                          <Save size={18} /> Save Profile
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* API Integrations */}
                  <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/10 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                        <Zap size={20} /> API Integrations
                      </h3>
                      <button 
                        onClick={() => setShowApiKeys(!showApiKeys)}
                        className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors"
                      >
                        {showApiKeys ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Duitku Merchant Code</label>
                        <input 
                          type="text" 
                          value={storeSettings.duitkuMerchantCode}
                          readOnly
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Duitku API Key</label>
                        <input 
                          type={showApiKeys ? "text" : "password"} 
                          value={storeSettings.duitkuApiKey}
                          readOnly
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="pt-4 border-t border-outline-variant/10">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Digiflazz Username</label>
                        <input 
                          type="text" 
                          placeholder="Enter username"
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Digiflazz API Key</label>
                        <input 
                          type={showApiKeys ? "text" : "password"} 
                          placeholder="Enter API key"
                          className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-background/60 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container-lowest w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col items-center relative"
            >
              {modalType === 'CONFIRM_CASH' && (
                <>
                  <div className="pt-10 px-8 pb-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-container/10 rounded-full mb-6">
                      <Wallet className="text-primary" size={32} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Terima Uang Tunai?</h2>
                    <p className="text-on-surface-variant mt-2 text-sm">Apakah Anda sudah menerima uang tunai dari pelanggan?</p>
                  </div>
                  <div className="px-8 pb-8 w-full">
                    <div className="bg-surface-container-low rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <h3 className="text-sm font-bold text-on-surface leading-snug">{selectedDenom?.name}</h3>
                          <p className="text-xs text-on-surface-variant mt-0.5">ID: {customerId}</p>
                        </div>
                        <div className="text-sm font-bold text-on-surface">1x</div>
                      </div>
                      <div className="pt-4 border-t border-outline-variant/30">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-semibold text-on-surface-variant">Total Tagihan</span>
                          <span className="text-2xl font-extrabold text-primary tracking-tighter">Rp {selectedDenom?.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-8 pb-10 w-full flex flex-col gap-3">
                    <button 
                      onClick={handleCashConfirm}
                      disabled={isProcessing}
                      className="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-lg rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />} Sudah Terima
                    </button>
                    <button onClick={() => setIsModalOpen(false)} className="w-full h-12 text-tertiary font-semibold text-sm rounded-xl">Batal</button>
                  </div>
                </>
              )}

              {modalType === 'QRIS_PAY' && (
                <>
                  <div className="w-full bg-primary py-4 px-8 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <QrCode className="text-primary-fixed" size={20} />
                      <span className="text-on-primary font-bold tracking-wide">QRIS DYNAMIC PAYMENT</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary-container rounded-full border border-on-primary-container/20">
                      <div className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse"></div>
                      <span className="text-[10px] text-on-primary-container font-bold uppercase tracking-widest">Live Sync</span>
                    </div>
                  </div>
                  <div className="w-full p-8 flex flex-col items-center text-center">
                    <div className="mb-6">
                      <p className="text-on-surface-variant font-medium text-sm mb-1">Total Bayar</p>
                      <h2 className="text-4xl font-extrabold text-primary tracking-tight">
                        <span className="text-2xl font-bold opacity-50 mr-1">Rp</span>{selectedDenom?.price.toLocaleString()}
                      </h2>
                    </div>
                    <div className="relative bg-white p-4 rounded-xl shadow-inner border border-outline-variant/30">
                      {qrString ? (
                        <QRCodeSVG value={qrString} size={224} />
                      ) : (
                        <div className="w-56 h-56 flex items-center justify-center bg-slate-100"><RefreshCw className="animate-spin" /></div>
                      )}
                    </div>
                    <div className="mt-8 w-full max-w-xs">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-bold text-lg">
                          <Timer size={18} /> <span>04:59</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Batas Waktu Pembayaran</p>
                      </div>
                      <div className="mt-8 p-4 bg-surface-container-low rounded-full border border-surface-variant flex items-center justify-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-sm font-semibold text-on-surface-variant">Menunggu Pelanggan Scan...</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full grid grid-cols-2 gap-4 px-8 pb-4">
                    <button onClick={handleSimulateSuccess} className="col-span-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
                      <Zap size={18} /> Simulasi Bayar (Demo)
                    </button>
                    <button onClick={() => setIsModalOpen(false)} className="flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold text-tertiary bg-surface-container-high">
                      <XCircle size={20} /> Batalkan
                    </button>
                    <button onClick={checkStatusManual} className="flex items-center justify-center gap-2 px-6 py-4 rounded-full font-bold text-on-primary bg-gradient-to-r from-primary to-primary-container shadow-lg">
                      <RefreshCw size={20} /> Cek Status
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-5 rounded-2xl shadow-2xl z-[999] flex items-center gap-4 text-white font-black text-lg min-w-[320px] justify-between",
              notification.type === 'success' ? "bg-teal-600" : "bg-red-600"
            )}
          >
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
