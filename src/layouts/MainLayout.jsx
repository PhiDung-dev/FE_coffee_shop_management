import { Outlet } from 'react-router-dom';
import GuestNavbar from '../component/shared/navbar/GuestNavbar';
import CustomerNavbar from '../component/shared/navbar/CustomerNavbar';
import StaffNavbar from '../component/shared/navbar/StaffNavbar';
import AdminNavbar from '../component/shared/navbar/AdminNavbar';
import Footer from '../component/shared/Footer';
import ChatWidget from '../component/protected/ChatWidget';
import useAuth from '../hook/useAuth';

const MainLayout = () => {
  const { isAuthenticated, user } = useAuth();
  const role = user?.role?.toUpperCase();

  const renderNavbar = () => {
    if (!isAuthenticated || !role) {
      return <GuestNavbar />;
    }

    switch (role) {
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
      {renderNavbar()}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Chỉ hiển thị Chatbot AI sau khi đã đăng nhập */}
      {isAuthenticated && <ChatWidget />}

      <Footer />
    </div>
  );
};

export default MainLayout;