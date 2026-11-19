import axiosClient from '../config/axiosClient';

const areaService = {
  createArea: (data) => {
    return axiosClient.post('/api/areas', data);
  },

  getAllAreas: (params = {}) => {
    // params hỗ trợ: { keyword, page, size, sortBy, sortDir }
    return axiosClient.get('/api/areas', { params });
  },

  getAllAreasList: () => {
    return axiosClient.get('/api/areas/all');
  },

  getAreaById: (id) => {
    return axiosClient.get(`/api/areas/${id}`);
  },

  updateArea: (id, data) => {
    return axiosClient.put(`/api/areas/${id}`, data);
  },

  deleteArea: (id) => {
    return axiosClient.delete(`/api/areas/${id}`);
  },
};

export default areaService;