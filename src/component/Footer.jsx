import { Coffee } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-stone-900 text-stone-400 py-6 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-stone-200 font-semibold">
          <Coffee className="w-5 h-5 text-amber-500" />
          <span>CoffeeHouse Management</span>
        </div>
        <p className="text-xs text-stone-400">
          © {new Date().getFullYear()} CoffeeHouse. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;