import axiosClient from '../config/axiosClient';

const voucherService = {
  createVoucher: (data) => {
    return axiosClient.post('/api/vouchers', data);
  },

  getVoucherById: (id) => {
    return axiosClient.get(`/api/vouchers/${id}`);
  },

  getVoucherByCode: (code) => {
    return axiosClient.get(`/api/vouchers/code/${code}`);
  },

  getAllVouchers: () => {
    return axiosClient.get('/api/vouchers');
  },

  getActiveVouchers: () => {
    return axiosClient.get('/api/vouchers/active');
  },

  updateVoucher: (id, data) => {
    return axiosClient.put(`/api/vouchers/${id}`, data);
  },

  deleteVoucher: (id) => {
    return axiosClient.delete(`/api/vouchers/${id}`);
  },
};

export default voucherService;