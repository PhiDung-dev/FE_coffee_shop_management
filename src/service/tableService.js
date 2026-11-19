import axiosClient from '../config/axiosClient';

const tableService = {
  createTable: (data) => {
    return axiosClient.post('/api/tables', data);
  },

  getTableById: (id) => {
    return axiosClient.get(`/api/tables/${id}`);
  },

  getTableByNumber: (tableNumber) => {
    return axiosClient.get(`/api/tables/number/${tableNumber}`);
  },

  getAllTables: () => {
    return axiosClient.get('/api/tables');
  },

  getTablesByArea: (areaId) => {
    return axiosClient.get(`/api/tables/area/${areaId}`);
  },

  getTablesByStatus: (status) => {
    return axiosClient.get(`/api/tables/status/${status}`);
  },

  updateTable: (id, data) => {
    return axiosClient.put(`/api/tables/${id}`, data);
  },

  updateTableStatus: (id, status) => {
    // Truyền null ở body để Axios gửi status dưới dạng query param (?status=...)
    return axiosClient.patch(`/api/tables/${id}/status`, null, {
      params: { status },
    });
  },

  deleteTable: (id) => {
    return axiosClient.delete(`/api/tables/${id}`);
  },
};

export default tableService;