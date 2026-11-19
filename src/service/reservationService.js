import axiosClient from '../config/axiosClient';

const reservationService = {
  createReservation: (data) => {
    return axiosClient.post('/api/reservations', data);
  },

  getReservationById: (id) => {
    return axiosClient.get(`/api/reservations/${id}`);
  },

  getAllReservations: () => {
    return axiosClient.get('/api/reservations');
  },

  getReservationsByAccount: (accountId) => {
    return axiosClient.get(`/api/reservations/account/${accountId}`);
  },

  getReservationsByStatus: (status) => {
    return axiosClient.get(`/api/reservations/status/${status}`);
  },

  updateReservation: (id, data) => {
    return axiosClient.put(`/api/reservations/${id}`, data);
  },

  updateReservationStatus: (id, status) => {
    // Truyền null ở body để Axios gửi status dưới dạng query param (?status=...)
    return axiosClient.patch(`/api/reservations/${id}/status`, null, {
      params: { status },
    });
  },

  deleteReservation: (id) => {
    return axiosClient.delete(`/api/reservations/${id}`);
  },
};

export default reservationService;