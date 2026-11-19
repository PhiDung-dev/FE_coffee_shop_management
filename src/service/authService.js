import axiosClient from '../config/axiosClient';

const authService = {
  login: (credentials) => {
    // credentials: { username/email, password } theo LoginRequest
    return axiosClient.post('/api/auth/login', credentials);
  },
};

export default authService;