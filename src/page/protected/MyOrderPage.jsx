import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  CreditCard,
  Banknote,
  RefreshCw,
  Eye,
  X,
  Coffee,
  Ticket,
  AlertCircle,
  PackageCheck,
  ChefHat,
  FileText,
  Building2,
  Printer,
  ReceiptText,
} from 'lucide-react';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';
import invoiceService from '../../service/invoiceService';
import taxProfileService from '../../service/taxProfileService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const ORDER_STATUS_META = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: CheckCircle2,
  },
  PREPARING: {
    label: 'Đang pha chế',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: ChefHat,
  },
  DELIVERING: {
    label: 'Đang giao hàng',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Truck,
  },
  COMPLETED: {
    label: 'Hoàn tất',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: PackageCheck,
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: XCircle,
  },
};

const ORDER_TYPE_LABEL = {
  DELIVERY: 'Giao tận nơi',
  DINE_IN: 'Dùng tại quán',
  TAKEAWAY: 'Mang về',
};

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'ACTIVE', label: 'Đang thực hiện' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const isPaymentSuccessful = (payment) => {
  const st = (payment?.status || '').toUpperCase();
  return st === 'SUCCESS' || st === 'PAID' || st === 'COMPLETED';
};

// Mở cửa sổ in / lưu PDF hóa đơn điện tử cho khách hàng
const handlePrintCustomerInvoice = (invoice, order, payment) => {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px dashed #ddd;">
          <strong>${item.productName}</strong>
          ${item.selectedOptions ? `<div style="font-size: 11px; color: #666;">${item.selectedOptions}</div>` : ''}
        </td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px dashed #ddd;">${item.quantity}</td>
        <td style="padding: 6px 0; text-align: right; border-bottom: 1px dashed #ddd;">${formatPrice(
          item.subtotal ?? Number(item.unitPrice) * item.quantity
        )}</td>
      </tr>
    `
    )
    .join('');

  const vatBlockHtml = invoice.companyName
    ? `
      <div style="margin: 12px 0; padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Thông tin xuất hóa đơn VAT</div>
        <div><strong>Đơn vị:</strong> ${invoice.companyName}</div>
        <div><strong>Mã số thuế:</strong> ${invoice.taxCode || '—'}</div>
        <div><strong>Địa chỉ:</strong> ${invoice.companyAddress || '—'}</div>
      </div>
    `
    : `<div style="margin: 10px 0; font-size: 12px; color: #555;">Khách hàng: <strong>Khách lẻ</strong></div>`;

  const printWin = window.open('', '_blank', 'width=480,height=720');
  if (!printWin) return;

  printWin.document.write(`
    <html>
      <head>
        <title>Hóa đơn ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1c1917; max-width: 400px; margin: 0 auto; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #a8a29e; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0; font-size: 18px;">COFFEE SHOP MANAGEMENT</h2>
          <p style="margin: 4px 0; font-size: 12px; color: #57534e;">HÓA ĐƠN GIÁ TRỊ GIA TĂNG / BIÊN LAI</p>
          <p style="margin: 4px 0; font-size: 13px;">Số HĐ: <strong>${invoice.invoiceNumber}</strong></p>
          <p style="margin: 2px 0; font-size: 12px; color: #57534e;">Ngày xuất: ${formatDateTime(invoice.issuedAt)}</p>
        </div>
        <div class="divider"></div>
        <div style="font-size: 12px; line-height: 1.6;">
          <div>Mã đơn hàng: <strong>${invoice.orderCode || `#${invoice.orderId}`}</strong></div>
          ${order?.tableNumber ? `<div>Vị trí phục vụ: <strong>${order.tableNumber}</strong></div>` : ''}
          <div>Thanh toán: <strong>${
            payment?.paymentGateway === 'VNPAY'
              ? 'Chuyển khoản VNPay'
              : payment
                ? 'Tiền mặt'
                : 'Đã ghi nhận'
          }</strong></div>
        </div>
        ${vatBlockHtml}
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #444; font-size: 12px;">
              <th style="text-align: left; padding-bottom: 6px;">Món</th>
              <th style="text-align: center; padding-bottom: 6px;">SL</th>
              <th style="text-align: right; padding-bottom: 6px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="margin-top: 12px; font-size: 13px; line-height: 1.7;">
          ${
            order?.subtotal != null
              ? `<div style="display:flex; justify-content:space-between;"><span>Tạm tính:</span><span>${formatPrice(order.subtotal)}</span></div>`
              : ''
          }
          ${
            Number(order?.discountAmount) > 0
              ? `<div style="display:flex; justify-content:space-between; color:#047857;"><span>Giảm giá (${order.appliedVoucherCode || ''}):</span><span>- ${formatPrice(order.discountAmount)}</span></div>`
              : ''
          }
          <div style="display:flex; justify-content:space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #444; padding-top: 6px; margin-top: 6px;">
            <span>TỔNG CỘNG:</span>
            <span>${formatPrice(invoice.orderFinalAmount ?? order?.finalAmount ?? 0)}</span>
          </div>
        </div>
        <div class="divider"></div>
        <p class="center" style="font-size: 12px; color: #57534e;">Cảm ơn quý khách và hẹn gặp lại!</p>
        <script>window.onload = function() { window.print(); window.close(); };</script>
      </body>
    </html>
  `);
  printWin.document.close();
};

const MyOrdersPage = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  const [orders, setOrders] = useState([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [retryingOrderId, setRetryingOrderId] = useState(null);
  const [error, setError] = useState('');
  const [bannerMessage, setBannerMessage] = useState(() => location.state?.message || '');

  // Modal xem chi tiết đơn hàng
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Modal xem / xuất hóa đơn VAT cho đơn hàng
  const [invoiceModal, setInvoiceModal] = useState({
    open: false,
    order: null,
    payment: null,
    invoice: null,
    taxProfiles: [],
    selectedTaxId: '',
    newTaxForm: { companyName: '', taxCode: '', companyAddress: '' },
    loading: false,
    issuing: false,
    modalError: '',
  });

  const fetchMyOrders = useCallback(async () => {
    if (!accountId) {
      setError('Không xác định được tài khoản người dùng.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await orderService.getAllOrders({
        customerAccountId: Number(accountId),
        page: 0,
        size: 50,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });

      const rawResult = res?.result;
      const list = Array.isArray(rawResult?.content)
        ? rawResult.content
        : Array.isArray(rawResult)
          ? rawResult
          : [];

      setOrders(list);

      // Lấy thông tin thanh toán cho từng đơn hàng (ưu tiên giao dịch SUCCESS nếu có)
      const paymentEntries = await Promise.all(
        list.map(async (ord) => {
          try {
            const pRes = await paymentService.getPaymentsByOrderId(ord.id);
            const pList = Array.isArray(pRes?.result) ? pRes.result : [];
            const latestPayment =
              pList.find((p) => isPaymentSuccessful(p)) || pList[0] || null;
            return [ord.id, latestPayment];
          } catch {
            return [ord.id, null];
          }
        })
      );

      setPaymentsByOrder(Object.fromEntries(paymentEntries));
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách đơn hàng của bạn.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const st = (ord.status || 'PENDING').toUpperCase();
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') {
        return st === 'CONFIRMED' || st === 'PREPARING' || st === 'DELIVERING';
      }
      return st === statusFilter;
    });
  }, [orders, statusFilter]);

  const handleCancelOrder = async (order) => {
    setCancellingId(order.id);
    setError('');
    try {
      await orderService.updateOrder(order.id, {
        orderType: order.orderType || 'DELIVERY',
        status: 'CANCELLED',
        tableId: order.tableId || null,
        customerAccountId: Number(accountId),
      });
      await fetchMyOrders();
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null);
      }
    } catch (err) {
      setError(err?.message || 'Không thể hủy đơn hàng này.');
    } finally {
      setCancellingId(null);
    }
  };

  // Tạo bản ghi Payment mới để có paymentId (vnp_TxnRef) mới, tránh lỗi trùng mã giao dịch code=01 bên VNPay
  const handleRetryVnpay = async (order) => {
    setRetryingOrderId(order.id);
    setError('');
    try {
      const createRes = await paymentService.createPayment({
        orderId: Number(order.id),
        amount: order.finalAmount ?? order.subtotal ?? 0,
        paymentGateway: 'VNPAY',
        paymentMethod: 'VNPAY',
      });
      const newPayment = createRes?.result || null;

      const params = new URLSearchParams({ orderId: String(order.id) });
      if (newPayment?.id) {
        params.set('paymentId', String(newPayment.id));
      }

      navigate(`/payment?${params.toString()}`, {
        state: { order, payment: newPayment },
      });
    } catch (err) {
      setError(err?.message || 'Không thể khởi tạo giao dịch thanh toán mới.');
    } finally {
      setRetryingOrderId(null);
    }
  };

  // Mở modal xem hoặc xuất hóa đơn cho đơn hàng
  const handleOpenOrderInvoice = async (order) => {
    const orderPayment = paymentsByOrder[order.id] || null;
    setInvoiceModal({
      open: true,
      order,
      payment: orderPayment,
      invoice: null,
      taxProfiles: [],
      selectedTaxId: '',
      newTaxForm: { companyName: '', taxCode: '', companyAddress: '' },
      loading: true,
      issuing: false,
      modalError: '',
    });

    try {
      const [invRes, taxRes] = await Promise.all([
        invoiceService.getInvoiceByOrderId(order.id).catch(() => null),
        accountId
          ? taxProfileService.getTaxProfilesByAccountId(accountId).catch(() => null)
          : null,
      ]);

      const existingInvoice = invRes?.result || null;
      const profiles = Array.isArray(taxRes?.result) ? taxRes.result : [];

      setInvoiceModal((prev) => ({
        ...prev,
        invoice: existingInvoice,
        taxProfiles: profiles,
        selectedTaxId: profiles.length > 0 ? String(profiles[0].id) : '',
        loading: false,
      }));
    } catch {
      setInvoiceModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Khách hàng tự yêu cầu xuất hóa đơn (kèm thông tin VAT công ty nếu chọn)
  const handleCustomerIssueInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceModal.order) return;

    setInvoiceModal((prev) => ({ ...prev, issuing: true, modalError: '' }));

    try {
      let finalTaxProfileId = null;

      if (invoiceModal.selectedTaxId === 'NEW') {
        const { companyName, taxCode, companyAddress } = invoiceModal.newTaxForm;
        if (!companyName.trim() || !taxCode.trim()) {
          setInvoiceModal((prev) => ({
            ...prev,
            issuing: false,
            modalError: 'Vui lòng nhập đầy đủ Tên công ty và Mã số thuế.',
          }));
          return;
        }

        const taxCreateRes = await taxProfileService.createTaxProfile({
          companyName: companyName.trim(),
          taxCode: taxCode.trim(),
          companyAddress: companyAddress.trim() || null,
          accountId: accountId ? Number(accountId) : null,
        });
        finalTaxProfileId = taxCreateRes?.result?.id ?? null;
      } else if (invoiceModal.selectedTaxId) {
        finalTaxProfileId = Number(invoiceModal.selectedTaxId);
      }

      const res = await invoiceService.createInvoice({
        orderId: Number(invoiceModal.order.id),
        taxProfileId: finalTaxProfileId,
      });

      setInvoiceModal((prev) => ({
        ...prev,
        invoice: res?.result || null,
        issuing: false,
      }));
      setBannerMessage(
        `Đã xuất hóa đơn ${res?.result?.invoiceNumber || ''} cho đơn ${
          invoiceModal.order.orderCode || `#${invoiceModal.order.id}`
        }.`
      );
    } catch (err) {
      setInvoiceModal((prev) => ({
        ...prev,
        issuing: false,
        modalError:
          err?.message ||
          'Chưa thể xuất hóa đơn. Đơn hàng cần được thanh toán thành công trước khi xuất hóa đơn.',
      }));
    }
  };

  const closeInvoiceModal = () => {
    setInvoiceModal((prev) => ({ ...prev, open: false }));
  };

  return (
    <div className="w-full mx-auto space-y-6 pb-12">
      {/* Header nổi bật đồng bộ với các trang khác */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 shadow-md border border-stone-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/25 px-3 py-1 rounded-full">
            <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
            <span>Lịch sử đơn hàng CoffeeHouse</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Đơn hàng của tôi
          </h1>
          <p className="text-sm text-stone-300 max-w-2xl">
            Theo dõi trạng thái pha chế, giao hàng, thanh toán và xuất hóa đơn VAT
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={fetchMyOrders}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-stone-700 bg-stone-900/80 hover:bg-stone-800 text-xs sm:text-sm font-semibold text-stone-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <Link
            to="/menu"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors"
          >
            <Coffee className="w-4 h-4" />
            <span>Đặt món mới</span>
          </Link>
        </div>
      </div>

      {bannerMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage('')}
            className="p-1 text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs lọc trạng thái */}
      <div className="bg-white rounded-2xl border border-stone-200 p-2 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-amber-700 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Danh sách đơn hàng */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center space-y-3">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
          <h2 className="text-base font-bold text-stone-800">Chưa có đơn hàng nào</h2>
          <p className="text-sm text-stone-500">
            Hãy khám phá thực đơn và thưởng thức đồ uống yêu thích của bạn nhé.
          </p>
          <div className="pt-2">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold"
            >
              <span>Xem thực đơn</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusKey = (order.status || 'PENDING').toUpperCase();
            const meta = ORDER_STATUS_META[statusKey] || ORDER_STATUS_META.PENDING;
            const StatusIcon = meta.icon;

            const payment = paymentsByOrder[order.id];
            const isVnpay =
              payment?.paymentGateway === 'VNPAY' || payment?.paymentMethod === 'VNPAY';
            const isPaid = isPaymentSuccessful(payment);
            const canRetryVnpay = isVnpay && !isPaid && statusKey !== 'CANCELLED';
            const canCancel = statusKey === 'PENDING' && !isPaid;
            const canViewInvoice = statusKey !== 'CANCELLED';

            const items = Array.isArray(order.orderItems) ? order.orderItems : [];

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden"
              >
                {/* Dòng đầu thẻ đơn */}
                <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-extrabold text-amber-800">
                      {order.orderCode || `#${order.id}`}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-stone-200/70 text-stone-700 text-xs font-semibold">
                      {ORDER_TYPE_LABEL[order.orderType] || order.orderType}
                      {order.tableNumber ? ` • ${order.tableNumber}` : ''}
                    </span>
                    <span className="text-xs text-stone-500">
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{meta.label}</span>
                  </span>
                </div>

                {/* Danh sách món tóm tắt */}
                <div className="p-5 space-y-3">
                  {items.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-800 truncate">
                            {item.productName}{' '}
                            <span className="text-stone-500 font-normal">x{item.quantity}</span>
                          </p>
                          {item.selectedOptions && (
                            <p className="text-xs text-stone-500 truncate">
                              {item.selectedOptions}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-semibold text-stone-700 shrink-0">
                        {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                      </span>
                    </div>
                  ))}

                  {items.length > 2 && (
                    <p className="text-xs text-stone-500 pl-10">
                      + {items.length - 2} món khác...
                    </p>
                  )}
                </div>

                {/* Chân thẻ: Trạng thái thanh toán, tổng tiền & nút thao tác */}
                <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isVnpay ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {isPaid ? 'Đã thanh toán VNPay' : 'Chưa thanh toán VNPay'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-semibold">
                        <Banknote className="w-3.5 h-3.5" />
                        <span>{isPaid ? 'Đã thanh toán tiền mặt' : 'Tiền mặt (COD)'}</span>
                      </span>
                    )}

                    {order.appliedVoucherCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-semibold">
                        <Ticket className="w-3 h-3" />
                        <span>{order.appliedVoucherCode}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
                    <div className="text-right">
                      <span className="text-xs text-stone-500 mr-1.5">Tổng cộng:</span>
                      <span className="text-base font-extrabold text-amber-800">
                        {formatPrice(order.finalAmount ?? order.subtotal)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canRetryVnpay && (
                        <button
                          type="button"
                          disabled={retryingOrderId === order.id}
                          onClick={() => handleRetryVnpay(order)}
                          className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {retryingOrderId === order.id
                            ? 'Đang tạo giao dịch...'
                            : 'Thanh toán VNPay'}
                        </button>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingId === order.id}
                          onClick={() => handleCancelOrder(order)}
                          className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {cancellingId === order.id ? 'Đang hủy...' : 'Hủy đơn'}
                        </button>
                      )}

                      {canViewInvoice && (
                        <button
                          type="button"
                          onClick={() => handleOpenOrderInvoice(order)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Hóa đơn</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Chi tiết</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Chi tiết đơn hàng */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">
                  Chi tiết đơn {selectedOrder.orderCode || `#${selectedOrder.id}`}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Đặt lúc {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div className="space-y-2.5">
                {(selectedOrder.orderItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-stone-800">
                        {item.productName} <span className="text-stone-500">x{item.quantity}</span>
                      </p>
                      {item.selectedOptions && (
                        <p className="text-xs text-stone-500 mt-0.5">{item.selectedOptions}</p>
                      )}
                    </div>
                    <span className="font-semibold text-stone-800 shrink-0">
                      {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Tạm tính</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá ({selectedOrder.appliedVoucherCode})</span>
                    <span>- {formatPrice(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-100 flex justify-between font-bold text-base">
                  <span className="text-stone-800">Tổng thanh toán</span>
                  <span className="text-amber-800">
                    {formatPrice(selectedOrder.finalAmount ?? selectedOrder.subtotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Xem / Xuất hóa đơn VAT cho đơn hàng */}
      {invoiceModal.open && invoiceModal.order && (
        <div
          onClick={closeInvoiceModal}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-stone-800">
                    Hóa đơn đơn hàng {invoiceModal.order.orderCode || `#${invoiceModal.order.id}`}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {invoiceModal.invoice
                      ? `Số hóa đơn: ${invoiceModal.invoice.invoiceNumber}`
                      : 'Chứng từ thanh toán & hóa đơn VAT doanh nghiệp'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeInvoiceModal}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {invoiceModal.loading ? (
                <div className="space-y-3">
                  <div className="h-20 rounded-xl bg-stone-100 animate-pulse" />
                  <div className="h-28 rounded-xl bg-stone-100 animate-pulse" />
                </div>
              ) : invoiceModal.invoice ? (
                <>
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">
                        Số HĐ: {invoiceModal.invoice.invoiceNumber}
                      </span>
                      <span className="text-emerald-700">
                        Ngày xuất: {formatDateTime(invoiceModal.invoice.issuedAt)}
                      </span>
                    </div>
                    <p className="text-emerald-800">
                      Tổng giá trị thanh toán:{' '}
                      <strong>
                        {formatPrice(
                          invoiceModal.invoice.orderFinalAmount ?? invoiceModal.order.finalAmount
                        )}
                      </strong>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs">
                    <p className="font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-sky-700" />
                      <span>Thông tin xuất hóa đơn VAT</span>
                    </p>
                    {invoiceModal.invoice.companyName ? (
                      <div className="space-y-1 text-stone-700 pt-1">
                        <p className="font-bold text-stone-900">
                          {invoiceModal.invoice.companyName}
                        </p>
                        <p className="font-mono">MST: {invoiceModal.invoice.taxCode || '—'}</p>
                        <p>Địa chỉ: {invoiceModal.invoice.companyAddress || '—'}</p>
                      </div>
                    ) : (
                      <p className="text-stone-500 pt-0.5">
                        Hóa đơn bán lẻ cá nhân (Không gắn MST công ty). Nếu cần bổ sung MST công ty,
                        vui lòng báo nhân viên tại quầy.
                      </p>
                    )}
                  </div>

                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                    {(invoiceModal.order.orderItems || []).map((item) => (
                      <div
                        key={item.id}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-white"
                      >
                        <span>
                          <strong>{item.productName}</strong> x{item.quantity}
                        </span>
                        <span className="font-semibold">
                          {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <form onSubmit={handleCustomerIssueInvoice} className="space-y-4">
                  {!isPaymentSuccessful(invoiceModal.payment) && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Đơn hàng này chưa ghi nhận thanh toán hoàn tất. Bạn cần thanh toán xong
                        trước khi hệ thống phát hành hóa đơn.
                      </span>
                    </div>
                  )}

                  {invoiceModal.modalError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{invoiceModal.modalError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Chọn thông tin xuất hóa đơn VAT
                    </label>
                    <select
                      value={invoiceModal.selectedTaxId}
                      onChange={(e) =>
                        setInvoiceModal((prev) => ({
                          ...prev,
                          selectedTaxId: e.target.value,
                          modalError: '',
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      <option value="">Hóa đơn bán lẻ (Cá nhân)</option>
                      {invoiceModal.taxProfiles.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          [MST: {tp.taxCode}] {tp.companyName}
                        </option>
                      ))}
                      <option value="NEW">+ Nhập thông tin công ty / MST mới...</option>
                    </select>
                    <p className="text-[11px] text-stone-400 mt-1">
                      Bạn có thể quản lý danh sách MST công ty trong mục Hồ sơ cá nhân → Hóa đơn VAT
                      & MST.
                    </p>
                  </div>

                  {invoiceModal.selectedTaxId === 'NEW' && (
                    <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Tên công ty / Đơn vị <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={invoiceModal.newTaxForm.companyName}
                          onChange={(e) =>
                            setInvoiceModal((prev) => ({
                              ...prev,
                              newTaxForm: { ...prev.newTaxForm, companyName: e.target.value },
                            }))
                          }
                          placeholder="Công ty TNHH ABC..."
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Mã số thuế (MST) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={invoiceModal.newTaxForm.taxCode}
                          onChange={(e) =>
                            setInvoiceModal((prev) => ({
                              ...prev,
                              newTaxForm: { ...prev.newTaxForm, taxCode: e.target.value },
                            }))
                          }
                          placeholder="0101234567"
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Địa chỉ công ty
                        </label>
                        <input
                          type="text"
                          value={invoiceModal.newTaxForm.companyAddress}
                          onChange={(e) =>
                            setInvoiceModal((prev) => ({
                              ...prev,
                              newTaxForm: { ...prev.newTaxForm, companyAddress: e.target.value },
                            }))
                          }
                          placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeInvoiceModal}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={invoiceModal.issuing || !isPaymentSuccessful(invoiceModal.payment)}
                      className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                    >
                      {invoiceModal.issuing ? 'Đang xuất hóa đơn...' : 'Xuất hóa đơn'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {invoiceModal.invoice && (
              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handlePrintCustomerInvoice(
                      invoiceModal.invoice,
                      invoiceModal.order,
                      invoiceModal.payment
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In / Tải PDF hóa đơn</span>
                </button>

                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;