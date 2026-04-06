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
  }
};
