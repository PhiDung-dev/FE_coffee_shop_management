import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Coffee, Menu, X } from 'lucide-react';

const GUEST_LINKS = [
  { label: 'Trang chủ', path: '/', end: true },
  { label: 'Thực đơn', path: '/menu' },
  { label: 'Ưu đãi', path: '/vouchers' },
];

const GuestNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {GUEST_LINKS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Nút Login & Sign up */}
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-stone-700 hover:text-amber-800 rounded-xl hover:bg-stone-100 transition-colors"
          >
            Đăng nhập
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 text-sm font-medium bg-amber-700 text-white rounded-xl hover:bg-amber-800 transition-colors shadow-sm"
          >
            Đăng ký
          </Link>

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
          {GUEST_LINKS.map((item) => (
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

export default GuestNavbar;