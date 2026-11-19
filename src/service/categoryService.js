import axiosClient from '../config/axiosClient';

const categoryService = {
  createCategory: (data) => {
    return axiosClient.post('/api/categories', data);
  },

  getCategoryById: (id) => {
    return axiosClient.get(`/api/categories/${id}`);
  },

  getCategoryBySlug: (slug) => {
    return axiosClient.get(`/api/categories/slug/${slug}`);
  },

  getAllCategories: () => {
    return axiosClient.get('/api/categories');
  },

  getActiveCategories: () => {
    return axiosClient.get('/api/categories/active');
  },

  updateCategory: (id, data) => {
    return axiosClient.put(`/api/categories/${id}`, data);
  },

  deleteCategory: (id) => {
    return axiosClient.delete(`/api/categories/${id}`);
  },
};

export default categoryService;