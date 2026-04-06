export interface Denomination {
  id: string;
  name: string;
  amount: number;
  price: number;
  category: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  productName: string;
  amount: number;
  price: number;
  method: 'CASH' | 'QRIS';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  timestamp: string;
  qrUrl?: string;
  reference?: string;
}

export type Category = 'PULSA' | 'DATA' | 'TOKEN' | 'GAME' | 'E-WALLET';
