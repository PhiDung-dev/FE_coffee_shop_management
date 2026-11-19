import axiosClient from '../config/axiosClient';

const passwordResetService = {
  forgotPassword: (data) => {
    // data: { email } theo ForgotPasswordRequest
    return axiosClient.post('/api/auth/forgot-password', data);
  },

  resetPassword: (data) => {
    // data: { token, newPassword } theo ResetPasswordRequest
    return axiosClient.post('/api/auth/reset-password', data);
  },
};

export default passwordResetService;