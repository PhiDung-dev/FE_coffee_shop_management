import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coffee,
  Search,
  Sparkles,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MessageSquare,
  ArrowRight,
  X,
  AlertCircle,
} from 'lucide-react';
import categoryService from '../../service/categoryService';
import productService from '../../service/productService';
import useAuth from '../../hook/useAuth';

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Danh mục (GET /api/categories/active)
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Sản phẩm (GET /api/products)
  const [products, setProducts] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [sortOption, setSortOption] = useState('createdAt,desc');
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState({
    totalPages: 0,
    totalElements: 0,
    first: true,
    last: true,
  });

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // 1. Lấy danh sách danh mục đang hoạt động
  useEffect(() => {
    const fetchActiveCategories = async () => {
      setLoadingCategories(true);
      try {
        const res = await categoryService.getActiveCategories();
        const list = Array.isArray(res?.result) ? res.result : [];
        const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCategories(sorted);
      } catch (err) {
        console.error('Lỗi tải danh mục:', err);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchActiveCategories();
  }, []);

  // 2. Lấy danh sách sản phẩm phân trang & lọc
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    setError('');

    const [sortBy, sortDir] = sortOption.split(',');
    const params = {
      page,
      size: 8,
      sortBy,
      sortDir,
    };

    if (keyword.trim()) params.keyword = keyword.trim();
    if (selectedCategoryId) params.categoryId = selectedCategoryId;
    if (onlyAvailable) params.isAvailable = true;

    try {
      const res = await productService.getAllProducts(params);
      const pageData = res?.result;

      setProducts(pageData?.content || []);
      setPageInfo({
        totalPages: pageData?.totalPages ?? 0,
        totalElements: pageData?.totalElements ?? 0,
        first: pageData?.first ?? true,
        last: pageData?.last ?? true,
      });
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoadingProducts(false);
    }
  }, [page, keyword, selectedCategoryId, onlyAvailable, sortOption]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setPage(0);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setKeyword(keywordInput);
    setPage(0);
  };

  const handleAskAiAboutProduct = (product) => {
    setSelectedProduct(null);
    if (!isAuthenticated) {
      navigate('/login', {
        state: { message: 'Vui lòng đăng nhập để trò chuyện với trợ lý AI.' },
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent('open-coffee-chat', {
        detail: {
          message: `Tư vấn giúp mình về món "${product.name}" (${formatPrice(product.basePrice)}) của quán nhé!`,
        },
      })
    );
  };

  const handleOpenChat = () => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: { message: 'Vui lòng đăng nhập để trò chuyện với trợ lý AI.' },
      });
      return;
    }

    window.dispatchEvent(new CustomEvent('open-coffee-chat'));
  };

  return (
    <div className="space-y-10 pb-8">
      {/* 1. Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white p-8 sm:p-12 shadow-md">
        <div className="max-w-2xl space-y-5 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
            <Coffee className="w-3.5 h-3.5" />
            Hương vị nguyên bản mỗi ngày
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Thưởng thức cà phê đậm đà & không gian thư giãn
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Khám phá thực đơn đa dạng từ cà phê rang xay truyền thống, trà trái cây tươi mát đến các món bánh ngọt thủ công. Đặt bàn trước hoặc trò chuyện cùng trợ lý AI để chọn món hợp gu ngay.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#menu-section"
              className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Khám phá thực đơn
            </a>

            <Link
              to={isAuthenticated ? '/reservations' : '/login'}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              <CalendarCheck className="w-4 h-4 text-amber-300" />
              <span>Đặt bàn ngay</span>
            </Link>

            <button
              type="button"
              onClick={handleOpenChat}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-400/40 text-amber-300 hover:bg-amber-500/10 text-sm font-medium transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hỏi trợ lý AI</span>
            </button>
          </div>
        </div>

        <Coffee className="hidden lg:block w-72 h-72 text-amber-500/10 absolute -right-8 -bottom-10 rotate-12 pointer-events-none" />
      </section>

      {/* 2. Danh mục đồ uống (GET /api/categories/active) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Danh mục đồ uống</h2>
            <p className="text-sm text-stone-500">Chọn nhóm thức uống bạn yêu thích</p>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800"
          >
            <span>Xem trang thực đơn</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingCategories ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-11 w-32 rounded-2xl bg-stone-200 animate-pulse shrink-0"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => handleSelectCategory(null)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategoryId === null
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:border-amber-400 hover:text-amber-800'
              }`}
            >
              Tất cả món
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-700 text-white shadow-sm'
                      : 'bg-white text-stone-700 border border-stone-200 hover:border-amber-400 hover:text-amber-800'
                  }`}
                >
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  )}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Sản phẩm nổi bật (GET /api/products) */}
      <section id="menu-section" className="space-y-5 scroll-mt-20">
        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Tìm tên đồ uống, bánh ngọt..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Tìm kiếm
            </button>
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeywordInput('');
                  setKeyword('');
                  setPage(0);
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => {
                  setOnlyAvailable(e.target.checked);
                  setPage(0);
                }}
                className="rounded border-stone-300 text-amber-700 focus:ring-amber-600"
              />
              <span>Chỉ hiện món còn hàng</span>
            </label>

            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-stone-400" />
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setPage(0);
                }}
                className="px-3 py-2 rounded-xl border border-stone-300 text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                <option value="createdAt,desc">Mới nhất</option>
                <option value="basePrice,asc">Giá thấp đến cao</option>
                <option value="basePrice,desc">Giá cao đến thấp</option>
                <option value="name,asc">Tên A - Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lưới sản phẩm */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-stone-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-200 rounded w-full" />
                  <div className="h-5 bg-stone-200 rounded w-1/3 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center">
            <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-800">Không tìm thấy sản phẩm nào</h3>
            <p className="text-sm text-stone-500 mt-1">
              Thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác nhé.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((product) => {
              const available = Boolean(product.isAvailable);

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col cursor-pointer"
                >
                  {/* Ảnh sản phẩm */}
                  <div className="relative h-48 bg-stone-100 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300">
                        <Coffee className="w-14 h-14" />
                      </div>
                    )}

                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm ${
                        available
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-800/85 text-stone-200'
                      }`}
                    >
                      {available ? 'Còn hàng' : 'Tạm hết'}
                    </span>
                  </div>

                  {/* Nội dung thẻ */}
                  <div className="p-4 flex-1 flex flex-col">
                    {product.categoryName && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                        {product.categoryName}
                      </span>
                    )}

                    <h3 className="text-base font-bold text-stone-800 group-hover:text-amber-800 transition-colors line-clamp-1">
                      {product.name}
                    </h3>

                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 flex-1">
                      {product.description || 'Thức uống pha chế tươi mới mỗi ngày tại CoffeeHouse.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-base font-extrabold text-amber-800">
                        {formatPrice(product.basePrice)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAskAiAboutProduct(product);
                        }}
                        title="Hỏi AI về món này"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Hỏi AI</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Điều hướng phân trang */}
        {pageInfo.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-stone-500">
              Hiển thị trang <span className="font-semibold text-stone-800">{page + 1}</span> /{' '}
              <span className="font-semibold text-stone-800">{pageInfo.totalPages}</span> (tổng{' '}
              {pageInfo.totalElements} món)
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageInfo.first}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>

              <button
                type="button"
                disabled={pageInfo.last}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <span>Sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Banner gợi ý tương tác với Trợ lý AI */}
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-700" />
            <span>Chưa biết hôm nay uống gì?</span>
          </h3>
          <p className="text-sm text-amber-900/80">
            Hãy nói sở thích của bạn (ít ngọt, nhiều sữa, không caffeine...), trợ lý AI sẽ gợi ý món phù hợp nhất trong thực đơn.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenChat}
          className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors shrink-0 cursor-pointer"
        >
          Trò chuyện ngay
        </button>
      </section>

      {/* Modal chi tiết sản phẩm */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="relative h-60 bg-stone-100">
              {selectedProduct.imageUrl ? (
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <Coffee className="w-16 h-16" />
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {selectedProduct.categoryName && (
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                      {selectedProduct.categoryName}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-stone-800">{selectedProduct.name}</h3>
                  <p className="text-lg font-extrabold text-amber-800 mt-1">
                    {formatPrice(selectedProduct.basePrice)}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    selectedProduct.isAvailable
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {selectedProduct.isAvailable ? 'Đang phục vụ' : 'Tạm hết hàng'}
                </span>
              </div>

              <p className="text-sm text-stone-600 leading-relaxed">
                {selectedProduct.description ||
                  'Thức uống được pha chế từ nguyên liệu chọn lọc mỗi ngày tại CoffeeHouse.'}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleAskAiAboutProduct(selectedProduct)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Hỏi AI về món này</span>
                </button>

                <Link
                  to={isAuthenticated ? '/reservations' : '/login'}
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors text-center"
                >
                  Đặt bàn thưởng thức
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;