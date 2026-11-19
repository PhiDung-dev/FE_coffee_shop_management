import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Coffee, BadgeCheck, LogOut, Menu, X } from 'lucide-react';
import useAuth from '../../hook/useAuth';

const STAFF_LINKS = [
  { label: 'Bán hàng (POS)', path: '/staff/pos' },
  { label: 'Đơn hàng', path: '/staff/orders' },
  { label: 'Sơ đồ bàn', path: '/staff/tables' },
  { label: 'Đặt bàn', path: '/staff/reservations' },
  { label: 'Hóa đơn', path: '/staff/invoices' },
];

const StaffNavbar = () => {
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
        ? 'bg-amber-700 text-white shadow-sm'
        : 'text-stone-600 hover:bg-amber-50 hover:text-amber-800'
    }`;

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/staff" className="flex items-center gap-2 text-amber-800 font-bold text-lg shrink-0">
          <Coffee className="w-6 h-6" />
          <span>CoffeeHouse</span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
            STAFF
          </span>
        </Link>

        {/* Menu điều hướng Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {STAFF_LINKS.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Thông tin nhân viên & Đăng xuất */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-stone-700">
            <BadgeCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="max-w-[140px] truncate">{user?.fullName || user?.username}</span>
          </div>

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
          {STAFF_LINKS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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

export default StaffNavbar;