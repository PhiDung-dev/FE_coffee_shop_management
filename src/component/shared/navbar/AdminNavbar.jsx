import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Coffee, ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import useAuth from '../../../hook/useAuth';

const ADMIN_LINKS = [
  { label: 'Sản phẩm', path: '/admin/products' },
  { label: 'Danh mục', path: '/admin/categories' },
  { label: 'Khu vực', path: '/admin/areas' },
  { label: 'Bàn', path: '/admin/tables' },
  { label: 'Voucher', path: '/admin/vouchers' },
  { label: 'Tài khoản', path: '/admin/accounts' },
  { label: 'Đơn hàng', path: '/admin/orders' },
  { label: 'Hóa đơn', path: '/admin/invoices' },
  { label: 'Thống kê', path: '/admin/dashboard' },
];

const AdminNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-amber-600 text-white shadow-sm'
        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
    }`;

  return (
    <header className="bg-stone-900 text-white border-b border-stone-800 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/admin" className="flex items-center gap-2 text-amber-400 font-bold text-lg shrink-0">
          <Coffee className="w-6 h-6" />
          <span>CoffeeHouse</span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
            ADMIN
          </span>
        </Link>

        {/* Menu điều hướng Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          {ADMIN_LINKS.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Thông tin cá nhân Admin & Đăng xuất */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/profile"
            title="Thông tin cá nhân"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="max-w-[140px] truncate">{user?.fullName || user?.username}</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-2 rounded-lg text-stone-300 hover:text-red-400 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Mở menu"
            className="lg:hidden p-2 rounded-lg text-stone-300 hover:bg-stone-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu điều hướng Mobile */}
      {mobileOpen && (
        <nav className="lg:hidden px-4 pb-4 pt-2 border-t border-stone-800 flex flex-col gap-1">
          {ADMIN_LINKS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={linkClass}
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="mt-1 px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Thông tin cá nhân ({user?.fullName || user?.username})</span>
          </Link>
        </nav>
      )}
    </header>
  );
};

export default AdminNavbar;