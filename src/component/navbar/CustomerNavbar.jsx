import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Coffee, User, LogOut, Menu, X } from 'lucide-react';
import useAuth from '../../hook/useAuth';

const CUSTOMER_LINKS = [
  { label: 'Trang chủ', path: '/', end: true },
  { label: 'Thực đơn', path: '/menu' },
  { label: 'Đặt bàn', path: '/reservations' },
  { label: 'Ưu đãi', path: '/vouchers' },
  { label: 'Đơn hàng của tôi', path: '/my-orders' },
];

const CustomerNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-amber-50 text-amber-800 font-semibold'
        : 'text-stone-600 hover:text-amber-800 hover:bg-stone-50'
    }`;

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-amber-800 font-bold text-xl shrink-0">
          <Coffee className="w-6 h-6" />
          <span>CoffeeHouse</span>
        </Link>

        {/* Menu điều hướng Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {CUSTOMER_LINKS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Tài khoản & Đăng xuất */}
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <User className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="max-w-[140px] truncate">{user?.fullName || user?.username}</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-2 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Mở menu"
            className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu điều hướng Mobile */}
      {mobileOpen && (
        <nav className="md:hidden px-4 pb-4 pt-2 border-t border-stone-100 flex flex-col gap-1">
          {CUSTOMER_LINKS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={linkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};

export default CustomerNavbar;