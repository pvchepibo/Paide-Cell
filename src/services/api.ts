import axios from 'axios';

export const api = {
  createCashTransaction: async (data: { customerId: string; product: any }) => {
    const response = await axios.post('/api/transaction/cash', data);
    return response.data;
  },
  createQrisTransaction: async (data: { customerId: string; product: any }) => {
    const response = await axios.post('/api/transaction/qris', data);
    return response.data;
  },
  checkStatus: async (transactionId: string) => {
    const response = await axios.get(`/api/transaction/status/${transactionId}`);
    return response.data;
  },
  simulateSuccess: async (transactionId: string) => {
    const response = await axios.post(`/api/transaction/simulate-success/${transactionId}`);
    return response.data;
  },
  getSupplierBalance: async () => {
    const response = await axios.get('/api/supplier/balance');
    return response.data;
  },
  getInventory: async () => {
    const response = await axios.get('/api/inventory');
    return response.data;
  },
  addInventory: async (product: any) => {
    const response = await axios.post('/api/inventory', product);
    return response.data;
  },
  updateInventory: async (sku: string, updates: any) => {
    const response = await axios.put(`/api/inventory/${sku}`, updates);
    return response.data;
  },
  deleteInventory: async (sku: string) => {
    const response = await axios.delete(`/api/inventory/${sku}`);
    return response.data;
  },
  getSettings: async () => {
    const response = await axios.get('/api/settings');
    return response.data;
  },
  updateSettings: async (settings: any) => {
    const response = await axios.post('/api/settings', settings);
    return response.data;
  },
  getReports: async () => {
    const response = await axios.get('/api/reports');
    return response.data;
  }
};
