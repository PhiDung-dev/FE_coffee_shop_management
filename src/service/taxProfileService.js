import axiosClient from '../config/axiosClient';

const taxProfileService = {
  createTaxProfile: (data) => {
    return axiosClient.post('/api/tax-profiles', data);
  },

  getAllTaxProfiles: (params = {}) => {
    // params hỗ trợ: { accountId, keyword, page, size, sortBy, sortDir }
    return axiosClient.get('/api/tax-profiles', { params });
  },

  getTaxProfileById: (id) => {
    return axiosClient.get(`/api/tax-profiles/${id}`);
  },

  getTaxProfilesByAccountId: (accountId) => {
    return axiosClient.get(`/api/tax-profiles/account/${accountId}`);
  },

  updateTaxProfile: (id, data) => {
    return axiosClient.put(`/api/tax-profiles/${id}`, data);
  },

  deleteTaxProfile: (id) => {
    return axiosClient.delete(`/api/tax-profiles/${id}`);
  },
};

export default taxProfileService;