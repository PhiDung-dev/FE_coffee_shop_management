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
  Flame,
  TrendingUp,
} from 'lucide-react';
import categoryService from '../../service/categoryService';
import productService from '../../service/productService';
import useAuth from '../../hook/useAuth';

const MAX_TOP_ITEMS = 4;

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const getSoldMetric = (item) => {
  const candidates = [
    item?.soldCount,
    item?.totalSold,
    item?.orderCount,
    item?.salesCount,
    item?.popularity,
  ];
  for (const val of candidates) {
    if (val != null && !isNaN(Number(val))) {
      return Number(val);
    }
  }
  return null;
};

const sortBestSelling = (items, fallbackOrderField) => {
  const arr = [...items];
  const hasSoldData = arr.some((item) => getSoldMetric(item) !== null);

  if (hasSoldData) {
    return arr.sort((a, b) => (getSoldMetric(b) ?? -1) - (getSoldMetric(a) ?? -1));
  }

  if (fallbackOrderField === 'sortOrder') {
    return arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  return arr;
};

const SafeImage = ({ src, alt, className, fallbackClassName, iconClassName = 'w-12 h-12' }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={
          fallbackClassName ||
          'w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100/60 text-amber-800/45'
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

  // Tối đa 4 danh mục bán chạy
  const [topCategories, setTopCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Tối đa 4 sản phẩm bán chạy
  const [topProducts, setTopProducts] = useState([]);
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
            size: 20,
            sortBy: 'createdAt',
            sortDir: 'desc',
            isAvailable: true,
          }),
        ]);

        const rawCategories = Array.isArray(catRes?.result) ? catRes.result : [];
        const bestCategories = sortBestSelling(rawCategories, 'sortOrder').slice(
          0,
          MAX_TOP_ITEMS
        );
        setTopCategories(bestCategories);

        const pageData = prodRes?.result;
        const rawProducts = Array.isArray(pageData?.content) ? pageData.content : [];
        const availableProducts = rawProducts.filter((p) => p.isAvailable !== false);
        const bestProducts = sortBestSelling(availableProducts, 'createdAt').slice(
          0,
          MAX_TOP_ITEMS
        );
        setTopProducts(bestProducts);
      } catch (err) {
        setError(err?.message || 'Không thể tải dữ liệu trang chủ từ máy chủ.');
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
      `Tư vấn giúp mình về món bán chạy "${product.name}" (${formatPrice(product.basePrice)}) của quán nhé!`
    );
  };

  const heroHighlightProduct = topProducts[0] || null;

  return (
    <div className="space-y-14 pb-12">
      {/* 1. Hero Banner hiện đại */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-7 sm:p-11 lg:p-14 shadow-lg border border-stone-800/80">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-300 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Cà phê rang mộc & Trà thủ công mỗi ngày</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]">
              Khởi đầu ngày mới cùng{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300">
                hương vị cà phê nguyên bản
              </span>
            </h1>

            <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-xl">
              Tận hưởng không gian thư giãn, chọn nhanh những nhóm thức uống và món bán chạy
              được yêu thích nhất, đặt bàn giữ chỗ trước hoặc nhờ trợ lý AI gợi ý món hợp gu.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold transition-all shadow-md shadow-amber-950/40"
              >
                <span>Khám phá thực đơn</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>

              <Link
                to={isAuthenticated ? '/reservations' : '/login'}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-semibold transition-colors"
              >
                <CalendarCheck className="w-4 h-4 text-amber-300" />
                <span>Đặt bàn ngay</span>
              </Link>

              <button
                type="button"
                onClick={() => handleOpenChat()}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl border border-amber-400/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Gợi ý với AI</span>
              </button>
            </div>
          </div>

          {/* Thẻ nổi bật bên phải Hero */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white/8 backdrop-blur-md border border-white/12 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                  <TrendingUp className="w-4 h-4" />
                  <span>Best Seller Quán</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/20">
                  Đang phục vụ
                </span>
              </div>

              {heroHighlightProduct ? (
                <div
                  onClick={() => setSelectedProduct(heroHighlightProduct)}
                  className="group flex items-center gap-4 p-3 rounded-xl bg-stone-900/70 hover:bg-stone-900 border border-white/10 transition-all cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-stone-800">
                    <SafeImage
                      src={heroHighlightProduct.imageUrl}
                      alt={heroHighlightProduct.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      iconClassName="w-8 h-8"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-400">
                      {heroHighlightProduct.categoryName || 'Món bán chạy #1'}
                    </p>
                    <h2 className="text-base font-bold text-white truncate mt-0.5">
                      {heroHighlightProduct.name}
                    </h2>
                    <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                      {heroHighlightProduct.description || 'Hương vị được khách chọn nhiều nhất'}
                    </p>
                    <p className="text-sm font-extrabold text-amber-300 mt-1.5">
                      {formatPrice(heroHighlightProduct.basePrice)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-stone-900/60 border border-white/10 flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
                    <Coffee className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Pha chế chuẩn vị mỗi ngày</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Mở cửa phục vụ tại bàn, mang đi và đặt chỗ trước.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-2">
                  <p className="text-sm font-extrabold text-amber-300">100%</p>
                  <p className="text-[11px] text-stone-300 mt-0.5">Rang xay mới</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-2">
                  <p className="text-sm font-extrabold text-amber-300">Top 4</p>
                  <p className="text-[11px] text-stone-300 mt-0.5">Món hút khách</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-2">
                  <p className="text-sm font-extrabold text-amber-300">AI 24/7</p>
                  <p className="text-[11px] text-stone-300 mt-0.5">Tư vấn đồ uống</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Giá trị trải nghiệm */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 flex items-start gap-4 shadow-2xs hover:border-amber-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-800">Nguyên liệu tuyển chọn</h2>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Hạt cà phê rang mộc chuẩn vị cùng trà và nguyên liệu tươi pha chế ngay khi gọi món.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 flex items-start gap-4 shadow-2xs hover:border-amber-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-800">Đặt bàn & Giữ chỗ nhanh</h2>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Chủ động chọn khu vực yên tĩnh hoặc bàn nhóm trước giờ đến chỉ trong vài bước.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 flex items-start gap-4 shadow-2xs hover:border-amber-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
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

      {/* 3. Top 4 Danh mục bán chạy */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
              <Flame className="w-3.5 h-3.5" />
              <span>Danh mục được ưa chuộng</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-800 tracking-tight">
              Top 4 Danh mục bán chạy
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Chọn nhóm thức uống bán chạy nhất để lọc nhanh trong thực đơn
            </p>
          </div>

          <Link
            to="/menu"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800 shrink-0"
          >
            <span>Xem thực đơn</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingCategories ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(MAX_TOP_ITEMS)].map((_, idx) => (
              <div
                key={idx}
                className="h-44 rounded-2xl bg-white border border-stone-200 animate-pulse"
              />
            ))}
          </div>
        ) : topCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
            Hiện chưa có danh mục bán chạy nào được kích hoạt.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {topCategories.map((cat, index) => (
              <Link
                key={cat.id}
                to={`/menu?categoryId=${cat.id}`}
                className="group relative overflow-hidden rounded-2xl bg-white border border-stone-200/90 hover:border-amber-400 p-5 flex flex-col justify-between min-h-[168px] shadow-2xs hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-stone-100 shadow-2xs">
                    <SafeImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      fallbackClassName="w-full h-full flex items-center justify-center bg-amber-50 text-amber-800"
                      iconClassName="w-6 h-6"
                    />
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                    Top #{index + 1}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-stone-800 group-hover:text-amber-800 transition-colors truncate">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                    {cat.description || 'Khám phá các thức uống bán chạy thuộc danh mục này.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-amber-700">
                  <span>Khám phá ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Top 4 Sản phẩm bán chạy */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Được gọi nhiều nhất</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-800 tracking-tight">
              Top 4 Sản phẩm bán chạy
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Những mónsignature đắt khách nhất tại CoffeeHouse
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
            {[...Array(MAX_TOP_ITEMS)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"
              >
                <div className="h-52 bg-stone-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 bg-stone-200 rounded w-1/3" />
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-200 rounded w-full" />
                  <div className="h-5 bg-stone-200 rounded w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 py-14 px-4 text-center">
            <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-800">Chưa có sản phẩm bán chạy</h3>
            <p className="text-sm text-stone-500 mt-1">
              Bạn có thể xem toàn bộ đồ uống tại trang Thực đơn.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {topProducts.map((product, index) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-2xs hover:shadow-lg hover:border-amber-300 transition-all flex flex-col cursor-pointer"
              >
                <div className="relative h-52 bg-stone-100 overflow-hidden">
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-900/85 text-amber-300 backdrop-blur-xs">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Bán chạy #{index + 1}</span>
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  {product.categoryName && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                      {product.categoryName}
                    </span>
                  )}

                  <h3 className="text-base font-bold text-stone-800 group-hover:text-amber-800 transition-colors line-clamp-1">
                    {product.name}
                  </h3>

                  <p className="text-xs text-stone-500 mt-1 line-clamp-2 flex-1 leading-relaxed">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
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
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
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

        <div className="bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200/90 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
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
            className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
          >
            Trò chuyện ngay
          </button>
        </div>
      </section>

      {/* Modal xem nhanh sản phẩm bán chạy */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
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
                className="absolute top-3 right-3 p-2 rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {selectedProduct.categoryName && (
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
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
                    selectedProduct.isAvailable !== false
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {selectedProduct.isAvailable !== false ? 'Đang phục vụ' : 'Tạm hết hàng'}
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