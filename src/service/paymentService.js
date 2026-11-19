import axiosClient from '../config/axiosClient';

const paymentService = {
  createPayment: (data) => {
    return axiosClient.post('/api/payments', data);
  },

  getAllPayments: (params = {}) => {
    // params hỗ trợ: { orderId, status, paymentMethod, paymentGateway, keyword, page, size, sortBy, sortDir }
    return axiosClient.get('/api/payments', { params });
  },

  getPaymentById: (id) => {
    return axiosClient.get(`/api/payments/${id}`);
  },

  getPaymentsByOrderId: (orderId) => {
    return axiosClient.get(`/api/payments/order/${orderId}`);
  },

  updatePayment: (id, data) => {
    return axiosClient.put(`/api/payments/${id}`, data);
  },

  deletePayment: (id) => {
    return axiosClient.delete(`/api/payments/${id}`);
  },
};

export default paymentService;