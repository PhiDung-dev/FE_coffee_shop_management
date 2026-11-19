import axiosClient from '../config/axiosClient';

const productService = {
  createProduct: (data) => {
    return axiosClient.post('/api/products', data);
  },

  getAllProducts: (params = {}) => {
    // params hỗ trợ: { keyword, categoryId, isAvailable, page, size, sortBy, sortDir }
    return axiosClient.get('/api/products', { params });
  },

  getProductById: (id) => {
    return axiosClient.get(`/api/products/${id}`);
  },

  getProductBySlug: (slug) => {
    return axiosClient.get(`/api/products/slug/${slug}`);
  },

  updateProduct: (id, data) => {
    return axiosClient.put(`/api/products/${id}`, data);
  },

  deleteProduct: (id) => {
    return axiosClient.delete(`/api/products/${id}`);
  },
};

export default productService;