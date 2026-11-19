import { Outlet } from 'react-router-dom';
import GuestNavbar from '../component/navbar/GuestNavbar';
import CustomerNavbar from '../component/navbar/CustomerNavbar';
import StaffNavbar from '../component/navbar/StaffNavbar';
import AdminNavbar from '../component/navbar/AdminNavbar';
import Footer from '../component/Footer';
import useAuth from '../hook/useAuth';

const MainLayout = () => {
  const { isAuthenticated, user } = useAuth();

  const renderNavbar = () => {
    if (!isAuthenticated || !user?.role) {
      return <GuestNavbar />;
    }

    switch (user.role.toUpperCase()) {
      case 'ADMIN':
        return <AdminNavbar />;
      case 'STAFF':
        return <StaffNavbar />;
      case 'CUSTOMER':
        return <CustomerNavbar />;
      default:
        return <GuestNavbar />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* 1. Thanh Navbar riêng theo từng role / khách vãng lai */}
      {renderNavbar()}

      {/* 2. Nội dung thay đổi theo từng trang */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* 3. Footer dùng chung cho toàn hệ thống */}
      <Footer />
    </div>
  );
};

export default MainLayout;