import { Outlet, Link } from 'react-router-dom';
import { Coffee } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-amber-800 hover:text-amber-700">
          <div className="p-2.5 bg-amber-800 text-white rounded-xl shadow-sm">
            <Coffee className="w-7 h-7" />
          </div>
          <span className="text-2xl font-bold tracking-tight">CoffeeHouse</span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-stone-200 sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;