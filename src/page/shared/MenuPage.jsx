import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Coffee,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MessageSquare,
  X,
  AlertCircle,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  CalendarCheck,
  RotateCcw,
} from 'lucide-react';
import categoryService from '../../service/categoryService';
import productService from '../../service/productService';
import useAuth from '../../hook/useAuth';

const CART_STORAGE_KEY = 'cf_menu_selection';
const QUICK_NOTES = ['Ít đá', 'Ít đường', 'Không đường', 'Nhiều sữa', 'Đá riêng'];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const SafeImage = ({ src, alt, className, fallbackClassName, iconClassName = 'w-12 h-12' }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={
          fallbackClassName ||
          'w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 text-amber-800/40'
        }
      >
        <Coffee className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

const loadInitialCart = () => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const MenuPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('categoryId');
  const selectedCategoryId =
    categoryParam && !isNaN(Number(categoryParam)) ? Number(categoryParam) : null;

  // Danh mục (GET /api/categories/active)
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Sản phẩm & bộ lọc (GET /api/products)
  const [products, setProducts] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
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

  // Modal chi tiết & tùy chỉnh món
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNote, setModalNote] = useState('');

  // Khay chọn món (giỏ tạm tính)
  const [cartItems, setCartItems] = useState(loadInitialCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Bỏ qua nếu bộ nhớ trình duyệt đầy
    }
  }, [cartItems]);

  // 1. Lấy danh sách danh mục hoạt động
  useEffect(() => {
    const fetchCategories = async () => {
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

    fetchCategories();
  }, []);

  // 2. Lấy danh sách sản phẩm phân trang & lọc
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    setError('');

    const [sortBy, sortDir] = sortOption.split(',');
    const params = {
      page,
      size: 12,
      sortBy,
      sortDir,
    };

    if (keyword.trim()) params.keyword = keyword.trim();
    if (selectedCategoryId) params.categoryId = selectedCategoryId;
    if (onlyAvailable) params.isAvailable = true;

    try {
      const res = await productService.getAllProducts(params);
      const pageData = res?.result;

      setProducts(Array.isArray(pageData?.content) ? pageData.content : []);
      setPageInfo({
        totalPages: pageData?.totalPages ?? 0,
        totalElements: pageData?.totalElements ?? 0,
        first: pageData?.first ?? true,
        last: pageData?.last ?? true,
      });
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách thực đơn.');
    } finally {
      setLoadingProducts(false);
    }
  }, [page, keyword, selectedCategoryId, onlyAvailable, sortOption]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSelectCategory = (categoryId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (categoryId) {
      nextParams.set('categoryId', String(categoryId));
    } else {
      nextParams.delete('categoryId');
    }
    setSearchParams(nextParams);
    setPage(0);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setKeyword(keywordInput);
    setPage(0);
  };

  const handleResetFilters = () => {
    setKeywordInput('');
    setKeyword('');
    setOnlyAvailable(false);
    setSortOption('createdAt,desc');
    setSearchParams({});
    setPage(0);
  };

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setModalQty(1);
    setModalNote('');
  };

  const addToCart = (product, quantity = 1, note = '') => {
    if (!product?.isAvailable) return;
    const cleanNote = note.trim();
    const itemKey = `${product.id}__${cleanNote}`;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.key === itemKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          key: itemKey,
          productId: product.id,
          name: product.name,
          basePrice: Number(product.basePrice) || 0,
          imageUrl: product.imageUrl || '',
          categoryName: product.categoryName || '',
          quantity,
          note: cleanNote,
        },
      ];
    });
  };

  const updateCartQuantity = (key, delta) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (key) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cartItems.reduce(
    (sum, item) => sum + item.basePrice * item.quantity,
    0
  );

  const handleAskAi = (message) => {
    setSelectedProduct(null);
    setIsCartOpen(false);

    if (!isAuthenticated) {
      navigate('/login', {
        state: { message: 'Vui lòng đăng nhập để trò chuyện với trợ lý AI.' },
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent('open-coffee-chat', {
        detail: { message },
      })
    );
  };

  const handleAskAiAboutCart = () => {
    if (cartItems.length === 0) return;
    const summary = cartItems
      .map(
        (item) =>
          `${item.quantity}x ${item.name}${item.note ? ` (${item.note})` : ''}`
      )
      .join(', ');

    handleAskAi(
      `Mình đang chọn các món sau: ${summary} (tạm tính ${formatPrice(
        totalCartAmount
      )}). Tư vấn giúp mình xem kết hợp vậy hợp lý chưa hoặc có ưu đãi nào áp dụng được không nhé!`
    );
  };

  const hasActiveFilters =
    Boolean(keyword.trim()) || selectedCategoryId !== null || onlyAvailable;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Đầu trang Thực đơn */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full mb-2">
            <Coffee className="w-3.5 h-3.5" />
            <span>Thực đơn CoffeeHouse</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
            Khám phá đồ uống & bánh ngọt
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Lọc nhanh theo nhóm món, tùy chỉnh ghi chú pha chế và lưu danh sách món yêu thích
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition-colors shrink-0 cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Khay chọn món</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white">
            {totalCartCount}
          </span>
        </button>
      </div>

      {/* 2. Thanh lọc Danh mục (GET /api/categories/active) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {loadingCategories ? (
          [...Array(5)].map((_, idx) => (
            <div
              key={idx}
              className="h-10 w-28 rounded-xl bg-stone-200 animate-pulse shrink-0"
            />
          ))
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleSelectCategory(null)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategoryId === null
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'bg-white text-stone-700 border border-stone-200 hover:border-amber-400 hover:text-amber-800'
              }`}
            >
              Tất cả ({pageInfo.totalElements})
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-white text-stone-700 border border-stone-200 hover:border-amber-400 hover:text-amber-800'
                  }`}
                >
                  {cat.imageUrl && (
                    <span className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                      <SafeImage
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                        iconClassName="w-3 h-3"
                      />
                    </span>
                  )}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* 3. Thanh tìm kiếm, lọc trạng thái & sắp xếp */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
            Tìm
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-4">
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

      {/* 4. Lưới toàn bộ sản phẩm */}
      {loadingProducts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"
            >
              <div className="h-48 bg-stone-200" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 bg-stone-200 rounded w-1/3" />
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-200 rounded w-full" />
                <div className="h-8 bg-stone-200 rounded w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center">
          <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-stone-800">Không tìm thấy món phù hợp</h3>
          <p className="text-sm text-stone-500 mt-1">
            Thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ thực đơn.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Xem tất cả món
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((product) => {
            const available = Boolean(product.isAvailable);

            return (
              <div
                key={product.id}
                onClick={() => openProductModal(product)}
                className={`group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col cursor-pointer ${
                  available ? 'hover:border-amber-300' : 'opacity-80'
                }`}
              >
                {/* Ảnh sản phẩm */}
                <div className="relative h-48 bg-stone-100 overflow-hidden">
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  <span
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-2xs ${
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

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAskAi(
                            `Tư vấn giúp mình về món "${product.name}" (${formatPrice(
                              product.basePrice
                            )}) của quán nhé!`
                          );
                        }}
                        title="Hỏi AI về món này"
                        className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={!available}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product, 1, '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Chọn</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Phân trang */}
      {pageInfo.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-stone-500">
            Trang <span className="font-semibold text-stone-800">{page + 1}</span> /{' '}
            <span className="font-semibold text-stone-800">{pageInfo.totalPages}</span> (tổng{' '}
            {pageInfo.totalElements} món)
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pageInfo.first}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>

            <button
              type="button"
              disabled={pageInfo.last}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <span>Sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Thanh nổi tóm tắt dưới đáy khi có món trong khay */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-white rounded-2xl shadow-xl border border-stone-700 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {totalCartCount}
            </div>
            <div>
              <p className="text-xs text-stone-400">Tạm tính khay chọn món</p>
              <p className="text-base font-extrabold text-amber-300">
                {formatPrice(totalCartAmount)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Xem khay món
          </button>
        </div>
      )}

      {/* Modal chi tiết & tùy chỉnh món */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="relative h-56 bg-stone-100">
              <SafeImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
                iconClassName="w-16 h-16"
              />

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

              {/* Ghi chú pha chế */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Ghi chú pha chế (tùy chọn)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_NOTES.map((noteItem) => {
                    const active = modalNote.includes(noteItem);
                    return (
                      <button
                        key={noteItem}
                        type="button"
                        onClick={() =>
                          setModalNote((prev) =>
                            prev.includes(noteItem)
                              ? prev
                                  .split(', ')
                                  .filter((n) => n !== noteItem)
                                  .join(', ')
                              : prev
                                ? `${prev}, ${noteItem}`
                                : noteItem
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-50 border-amber-400 text-amber-900'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {noteItem}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Nhập thêm yêu cầu riêng (ví dụ: 50% đường, mang về...)"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>

              {/* Số lượng & Nút thêm */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-xl border border-stone-300 bg-stone-50">
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-bold text-stone-800">{modalQty}</span>
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => q + 1)}
                    className="p-2.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!selectedProduct.isAvailable}
                  onClick={() => {
                    addToCart(selectedProduct, modalQty, modalNote);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {selectedProduct.isAvailable
                    ? `Thêm vào khay • ${formatPrice(
                        (Number(selectedProduct.basePrice) || 0) * modalQty
                      )}`
                    : 'Món tạm hết hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Khay chọn món */}
      {isCartOpen && (
        <div
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 flex justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-800">Khay chọn món</h2>
                  <p className="text-xs text-stone-500">{totalCartCount} món đang chọn</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartItems.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-700">Khay chọn món đang trống</p>
                  <p className="text-xs text-stone-500">
                    Bấm nút <strong>Chọn</strong> trên từng đồ uống để thêm vào danh sách dự kiến.
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.key}
                    className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 flex items-start gap-3"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        iconClassName="w-6 h-6"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-stone-800 truncate">{item.name}</h4>
                      {item.note && (
                        <p className="text-xs text-amber-800 mt-0.5 line-clamp-1">
                          Ghi chú: {item.note}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-stone-600 mt-1">
                        {formatPrice(item.basePrice * item.quantity)}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, -1)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-stone-800">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, 1)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCartItem(item.key)}
                          title="Xóa món"
                          className="p-1.5 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Tạm tính ({totalCartCount} món)</span>
                  <span className="text-lg font-extrabold text-amber-800">
                    {formatPrice(totalCartAmount)}
                  </span>
                </div>

                <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">Tạm tính ({totalCartCount} món)</span>
                    <span className="text-lg font-extrabold text-amber-800">
                    {formatPrice(totalCartAmount)}
                    </span>
                </div>

                {/* 2 nút Đặt chính: Đặt bàn & Đặt giao hàng (nhập địa chỉ) */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                    type="button"
                    onClick={() => {
                        setIsCartOpen(false);
                        navigate(isAuthenticated ? '/reservations' : '/login', {
                        state: { preselectedItems: cartItems, redirectTo: '/reservations' },
                        });
                    }}
                    className="py-2.5 px-3 rounded-xl border border-amber-700 text-amber-800 hover:bg-amber-50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                    <CalendarCheck className="w-4 h-4" />
                    <span>Đặt bàn</span>
                    </button>

                    <button
                    type="button"
                    onClick={() => {
                        setIsCartOpen(false);
                        navigate(isAuthenticated ? '/checkout' : '/login', {
                        state: { preselectedItems: cartItems, redirectTo: '/checkout' },
                        });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Đặt giao hàng</span>
                    </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <button
                    type="button"
                    onClick={handleAskAiAboutCart}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900 cursor-pointer"
                    >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nhờ AI tư vấn khay món</span>
                    </button>

                    <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-medium text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
                    >
                    Xóa khay món
                    </button>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;