import axiosClient from '../config/axiosClient';

const orderItemService = {
  createOrderItem: (data) => {
    return axiosClient.post('/api/order-items', data);
  },

  getAllOrderItems: (params = {}) => {
    // params hỗ trợ: { orderId, productId, page, size, sortBy, sortDir }
    return axiosClient.get('/api/order-items', { params });
  },

  getOrderItemById: (id) => {
    return axiosClient.get(`/api/order-items/${id}`);
  },

  getOrderItemsByOrderId: (orderId) => {
    return axiosClient.get(`/api/order-items/order/${orderId}`);
  },

  updateOrderItem: (id, data) => {
    return axiosClient.put(`/api/order-items/${id}`, data);
  },

  deleteOrderItem: (id) => {
    return axiosClient.delete(`/api/order-items/${id}`);
  },
};

export default orderItemService;