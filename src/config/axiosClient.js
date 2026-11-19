import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Đính kèm JWT Bearer token và xử lý header khi upload file
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tự động gỡ Content-Type mặc định nếu gửi FormData (dùng khi upload ảnh Product)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Trả thẳng body ApiResponse<T> và bắt lỗi tập trung
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const { response, config } = error;

    // Token hết hạn hoặc không hợp lệ -> xóa session và đẩy về trang đăng nhập
    if (response?.status === 401 && !config?.url?.includes('/api/auth/login')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Chuẩn hóa lỗi trả về từ GlobalExceptionHandler / ErrorCode của Spring Boot
    const normalizedError = response?.data || {
      code: response?.status || 500,
      message: error.message || 'Lỗi kết nối đến máy chủ',
    };

    return Promise.reject(normalizedError);
  }
);

export default axiosClient;