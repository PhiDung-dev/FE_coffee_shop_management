import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coffee,
  Sparkles,
  CalendarCheck,
  MessageSquare,
  ArrowRight,
  X,
  AlertCircle,
  Ticket,
  Clock,
  Award,
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

const SafeImage = ({ src, alt, className, fallbackClassName, iconClassName = 'w-12 h-12' }) => {
  const [hasError, setHasError] = useState(false);

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

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Danh mục hoạt động (GET /api/categories/active)
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // 4 món nổi bật / mới nhất (GET /api/products)
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoadingCategories(true);
      setLoadingProducts(true);
      setError('');

      try {
        const [catRes, prodRes] = await Promise.all([
          categoryService.getActiveCategories(),
          productService.getAllProducts({
            page: 0,
            size: 4,
            sortBy: 'createdAt',
            sortDir: 'desc',
            isAvailable: true,
          }),
        ]);

        const rawCategories = Array.isArray(catRes?.result) ? catRes.result : [];
        const sortedCategories = [...rawCategories].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
        setCategories(sortedCategories);

        const pageData = prodRes?.result;
        setFeaturedProducts(Array.isArray(pageData?.content) ? pageData.content : []);
      } catch (err) {
        setError(err?.message || 'Không thể tải dữ liệu giới thiệu từ máy chủ.');
      } finally {
        setLoadingCategories(false);
        setLoadingProducts(false);
      }
    };

    fetchHomeData();
  }, []);

  const handleOpenChat = (customMessage) => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: { message: 'Vui lòng đăng nhập để trò chuyện với trợ lý AI.' },
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent(
        'open-coffee-chat',
        customMessage ? { detail: { message: customMessage } } : undefined
      )
    );
  };

  const handleAskAiAboutProduct = (product) => {
    setSelectedProduct(null);
    handleOpenChat(
      `Tư vấn giúp mình về món "${product.name}" (${formatPrice(product.basePrice)}) của quán nhé!`
    );
  };

  return (
    <div className="space-y-12 pb-10">
      {/* 1. Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white p-8 sm:p-12 lg:p-14 shadow-md">
        <div className="max-w-2xl space-y-5 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
            <Coffee className="w-3.5 h-3.5" />
            Hương vị nguyên bản mỗi ngày
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Thưởng thức cà phê đậm đà & không gian thư giãn
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Từ cà phê phin rang xay truyền thống, trà trái cây tươi mát đến bánh ngọt thủ công mỗi sáng. Đặt bàn trước để giữ chỗ đẹp hoặc nhờ trợ lý AI gợi ý món đúng gu của bạn.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <span>Khám phá thực đơn</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to={isAuthenticated ? '/reservations' : '/login'}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              <CalendarCheck className="w-4 h-4 text-amber-300" />
              <span>Đặt bàn ngay</span>
            </Link>

            <button
              type="button"
              onClick={() => handleOpenChat()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-400/40 text-amber-300 hover:bg-amber-500/10 text-sm font-medium transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hỏi trợ lý AI</span>
            </button>
          </div>
        </div>

        <Coffee className="hidden lg:block w-80 h-80 text-amber-500/10 absolute -right-10 -bottom-12 rotate-12 pointer-events-none" />
      </section>

      {/* 2. Điểm nổi bật của quán */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-800">Nguyên liệu tuyển chọn</h2>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Hạt cà phê rang mộc chuẩn vị cùng trà và trái cây tươi pha chế ngay khi gọi món.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-800">Đặt bàn & Giữ chỗ nhanh</h2>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Chủ động chọn khu vực yên tĩnh hoặc bàn nhóm trước giờ đến chỉ trong vài bước.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-4 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-800">Trợ lý AI gợi ý theo gu</h2>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Tư vấn đồ uống ít ngọt, ít caffeine hoặc kiểm tra nhanh các ưu đãi đang áp dụng.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Khám phá theo danh mục (bấm để chuyển sang /menu?categoryId=...) */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Danh mục thức uống</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Chọn nhóm món yêu thích để xem chi tiết trong thực đơn
            </p>
          </div>

          <Link
            to="/menu"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800 shrink-0"
          >
            <span>Tất cả danh mục</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingCategories ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="h-20 rounded-2xl bg-white border border-stone-200 animate-pulse"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-sm text-stone-500">
            Hiện chưa có danh mục nào được kích hoạt.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/menu?categoryId=${cat.id}`}
                className="group bg-white rounded-2xl border border-stone-200 hover:border-amber-400 p-4 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                  <SafeImage
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallbackClassName="w-full h-full flex items-center justify-center bg-amber-50 text-amber-800"
                    iconClassName="w-5 h-5"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-stone-800 group-hover:text-amber-800 transition-colors truncate">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-stone-500 truncate mt-0.5">
                    {cat.description || 'Xem các món trong nhóm'}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Món mới & Nổi bật (chỉ hiển thị 4 món tiêu biểu, tách biệt với trang /menu) */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Món mới & Nổi bật</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Những hương vị được yêu thích nhất tại CoffeeHouse
            </p>
          </div>

          <Link
            to="/menu"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold transition-colors"
          >
            <span>Xem toàn bộ thực đơn</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-stone-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 bg-stone-200 rounded w-1/3" />
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-200 rounded w-full" />
                  <div className="h-5 bg-stone-200 rounded w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 py-14 px-4 text-center">
            <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-800">Chưa có sản phẩm nổi bật</h3>
            <p className="text-sm text-stone-500 mt-1">
              Bạn có thể xem toàn bộ đồ uống tại trang Thực đơn.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col cursor-pointer"
              >
                <div className="relative h-48 bg-stone-100 overflow-hidden">
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-700/90 text-white shadow-2xs">
                    Nổi bật
                  </span>
                </div>

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
            ))}
          </div>
        )}
      </section>

      {/* 5. Hai khối điều hướng nhanh: Ưu đãi / Đặt bàn & Trợ lý AI */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-800 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-700" />
              <span>Ưu đãi thành viên & Đặt bàn trước</span>
            </h3>
            <p className="text-sm text-stone-500">
              Lưu mã giảm giá đang mở và đặt trước bàn yêu thích cho buổi gặp mặt của bạn.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/vouchers"
              className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors"
            >
              Xem ưu đãi
            </Link>
            <Link
              to={isAuthenticated ? '/reservations' : '/login'}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition-colors"
            >
              Đặt bàn
            </Link>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-700" />
              <span>Chưa biết hôm nay uống gì?</span>
            </h3>
            <p className="text-sm text-amber-900/80">
              Chia sẻ khẩu vị của bạn, trợ lý AI sẽ gợi ý món phù hợp nhất trong thực đơn.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChat()}
            className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors shrink-0 cursor-pointer"
          >
            Trò chuyện ngay
          </button>
        </div>
      </section>

      {/* Modal xem nhanh món nổi bật */}
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
                  to="/menu"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors text-center"
                >
                  Xem trong thực đơn
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