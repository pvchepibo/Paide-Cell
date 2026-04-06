import axios from 'axios';

export const api = {
  createTransaction: async (data: { customerId: string; product: any; method: string }) => {
    const response = await axios.post('/api/transactions/create', data);
    return response.data;
  },
  executeOrder: async (transactionId: string) => {
    const response = await axios.post('/api/supplier/order', { transactionId });
    return response.data;
  },
  checkStatus: async (transactionId: string) => {
    const response = await axios.get(`/api/transactions/status/${transactionId}`);
    return response.data;
  }
};
