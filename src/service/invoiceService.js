import axiosClient from '../config/axiosClient';

const invoiceService = {
  createInvoice: (data) => {
    return axiosClient.post('/api/invoices', data);
  },

  getAllInvoices: (params = {}) => {
    // params hỗ trợ: { orderId, taxProfileId, fromDate, toDate, keyword, page, size, sortBy, sortDir }
    // Lưu ý: fromDate, toDate truyền dạng ISO LocalDateTime (VD: '2026-11-19T00:00:00')
    return axiosClient.get('/api/invoices', { params });
  },

  getInvoiceById: (id) => {
    return axiosClient.get(`/api/invoices/${id}`);
  },

  getInvoiceByOrderId: (orderId) => {
    return axiosClient.get(`/api/invoices/order/${orderId}`);
  },

  getInvoiceByNumber: (invoiceNumber) => {
    return axiosClient.get(`/api/invoices/number/${invoiceNumber}`);
  },

  updateInvoice: (id, data) => {
    return axiosClient.put(`/api/invoices/${id}`, data);
  },

  deleteInvoice: (id) => {
    return axiosClient.delete(`/api/invoices/${id}`);
  },
};

export default invoiceService;