import axiosClient from '../config/axiosClient';

const accountService = {
  createCustomerAccount: (data) => {
    return axiosClient.post('/api/accounts/customer', data);
  },

  createStaffAccount: (data) => {
    return axiosClient.post('/api/accounts/staff', data);
  },

  getAccountById: (id) => {
    return axiosClient.get(`/api/accounts/${id}`);
  },

  getAllAccounts: () => {
    return axiosClient.get('/api/accounts');
  },

  updateAccount: (id, data) => {
    return axiosClient.put(`/api/accounts/${id}`, data);
  },

  deleteAccount: (id) => {
    return axiosClient.delete(`/api/accounts/${id}`);
  },
};

export default accountService;