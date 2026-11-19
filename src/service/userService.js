import axiosClient from '../config/axiosClient';

const userService = {
  createUser: (data) => {
    return axiosClient.post('/api/users', data);
  },

  getUserById: (id) => {
    return axiosClient.get(`/api/users/${id}`);
  },

  getAllUsers: () => {
    return axiosClient.get('/api/users');
  },

  updateUser: (id, data) => {
    return axiosClient.put(`/api/users/${id}`, data);
  },

  deleteUser: (id) => {
    return axiosClient.delete(`/api/users/${id}`);
  },
};

export default userService;