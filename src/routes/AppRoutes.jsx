import { Routes, Route, Navigate, Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';
import LoginPage from '../page/auth/LoginPage';
import RegisterPage from '../page/auth/RegisterPage';
import ForgotPasswordPage from '../page/auth/ForgotPasswordPage';
import ResetPasswordPage from '../page/auth/ResetPasswordPage';

const PlaceholderPage = ({ title, description = 'Trang đang được xây dựng.' }) => (
  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
    <h1 className="text-xl font-bold text-stone-800">{title}</h1>
    <p className="text-sm text-stone-500 mt-1">{description}</p>
  </div>
);

const UnauthorizedPage = () => (
  <div className="py-20 flex flex-col items-center justify-center text-center">
    <h1 className="text-6xl font-extrabold text-amber-800">403</h1>
    <p className="mt-3 text-lg font-semibold text-stone-800">Không có quyền truy cập</p>
    <p className="mt-1 text-sm text-stone-500">
      Tài khoản của bạn không được phép truy cập vào khu vực này.
    </p>
    <Link
      to="/"
      className="mt-6 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors"
    >
      Quay về trang chủ
    </Link>
  </div>
);

const NotFoundPage = () => (
  <div className="py-20 flex flex-col items-center justify-center text-center">
    <h1 className="text-6xl font-extrabold text-stone-800">404</h1>
    <p className="mt-3 text-lg font-semibold text-stone-800">Không tìm thấy trang</p>
    <p className="mt-1 text-sm text-stone-500">
      Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi.
    </p>
    <Link
      to="/"
      className="mt-6 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors"
    >
      Quay về trang chủ
    </Link>
  </div>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 1. Khu vực Công khai (Khách vãng lai & Customer) */}
        <Route path="/" element={<PlaceholderPage title="Trang chủ CoffeeHouse" />} />
        <Route path="/menu" element={<PlaceholderPage title="Thực đơn đồ uống" />} />
        <Route path="/vouchers" element={<PlaceholderPage title="Ưu đãi & Voucher" />} />

        {/* 2. Khu vực Xác thực (Chỉ dành cho khách chưa đăng nhập) */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* 3. Khu vực riêng của Customer */}
        <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
          <Route path="/reservations" element={<PlaceholderPage title="Đặt bàn trực tuyến" />} />
          <Route path="/my-orders" element={<PlaceholderPage title="Đơn hàng của tôi" />} />
          <Route path="/profile" element={<PlaceholderPage title="Thông tin cá nhân" />} />
        </Route>

        {/* 4. Khu vực riêng của Staff */}
        <Route element={<ProtectedRoute allowedRoles={['STAFF']} />}>
          <Route path="/staff" element={<Navigate to="/staff/pos" replace />} />
          <Route path="/staff/pos" element={<PlaceholderPage title="Bán hàng tại quầy (POS)" />} />
          <Route path="/staff/orders" element={<PlaceholderPage title="Quản lý đơn hàng" />} />
          <Route path="/staff/tables" element={<PlaceholderPage title="Sơ đồ & Trạng thái bàn" />} />
          <Route path="/staff/reservations" element={<PlaceholderPage title="Quản lý đặt bàn" />} />
          <Route path="/staff/invoices" element={<PlaceholderPage title="Tra cứu hóa đơn" />} />
        </Route>

        {/* 5. Khu vực riêng của Admin */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<Navigate to="/admin/products" replace />} />
          <Route path="/admin/products" element={<PlaceholderPage title="Quản lý sản phẩm" />} />
          <Route path="/admin/categories" element={<PlaceholderPage title="Quản lý danh mục" />} />
          <Route path="/admin/areas" element={<PlaceholderPage title="Quản lý khu vực" />} />
          <Route path="/admin/tables" element={<PlaceholderPage title="Quản lý bàn" />} />
          <Route path="/admin/vouchers" element={<PlaceholderPage title="Quản lý Voucher" />} />
          <Route path="/admin/accounts" element={<PlaceholderPage title="Quản lý tài khoản" />} />
          <Route path="/admin/orders" element={<PlaceholderPage title="Quản lý đơn hàng" />} />
          <Route path="/admin/invoices" element={<PlaceholderPage title="Quản lý hóa đơn" />} />
        </Route>

        {/* 6. Trang báo lỗi hệ thống */}
        <Route path="/403" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;