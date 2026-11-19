import axiosClient from '../config/axiosClient';

const orderService = {
  createOrder: (data) => {
    return axiosClient.post('/api/orders', data);
  },

  getAllOrders: (params = {}) => {
    // params hỗ trợ: { status, orderType, tableId, customerAccountId, staffAccountId, fromDate, toDate, keyword, page, size, sortBy, sortDir }
    // Lưu ý: fromDate, toDate truyền dạng ISO LocalDateTime (VD: '2026-11-19T00:00:00')
    return axiosClient.get('/api/orders', { params });
  },

  getOrderById: (id) => {
    return axiosClient.get(`/api/orders/${id}`);
  },

  getOrderByCode: (orderCode) => {
    return axiosClient.get(`/api/orders/code/${orderCode}`);
  },

  updateOrder: (id, data) => {
    return axiosClient.put(`/api/orders/${id}`, data);
  },

  deleteOrder: (id) => {
    return axiosClient.delete(`/api/orders/${id}`);
  },
};

export default orderService;