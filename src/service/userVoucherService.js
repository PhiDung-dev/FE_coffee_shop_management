import axiosClient from '../config/axiosClient';

const userVoucherService = {
  createUserVoucher: (data) => {
    return axiosClient.post('/api/user-vouchers', data);
  },

  getAllUserVouchers: (params = {}) => {
    // params hỗ trợ: { accountId, voucherId, isUsed, page, size, sortBy, sortDir }
    return axiosClient.get('/api/user-vouchers', { params });
  },

  getUserVoucherById: (id) => {
    return axiosClient.get(`/api/user-vouchers/${id}`);
  },

  getUserVouchersByAccountId: (accountId) => {
    return axiosClient.get(`/api/user-vouchers/account/${accountId}`);
  },

  updateUserVoucher: (id, data) => {
    return axiosClient.put(`/api/user-vouchers/${id}`, data);
  },

  deleteUserVoucher: (id) => {
    return axiosClient.delete(`/api/user-vouchers/${id}`);
  },
};

export default userVoucherService;