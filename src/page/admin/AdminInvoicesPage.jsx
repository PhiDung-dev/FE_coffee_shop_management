import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  Printer,
  Building2,
  User,
  Eye,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard,
  Banknote,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import invoiceService from '../../service/invoiceService';
import taxProfileService from '../../service/taxProfileService';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';

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

const toInputDateString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isPaymentSuccessful = (payment) => {
  const st = (payment?.status || '').toUpperCase();
  return st === 'SUCCESS' || st === 'PAID' || st === 'COMPLETED';
};

// Mở cửa sổ in hóa đơn khổ A5/K80 chuẩn
const handlePrintInvoiceWindow = (invoice, order, payment) => {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px dashed #ddd;">
          <strong>${escapeHtml(item.productName)}</strong>
          ${
            item.selectedOptions
              ? `<div style="font-size: 11px; color: #666;">${escapeHtml(item.selectedOptions)}</div>`
              : ''
          }
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
        <div><strong>Đơn vị:</strong> ${escapeHtml(invoice.companyName)}</div>
        <div><strong>Mã số thuế:</strong> ${escapeHtml(invoice.taxCode || '—')}</div>
        <div><strong>Địa chỉ:</strong> ${escapeHtml(invoice.companyAddress || '—')}</div>
      </div>
    `
    : `<div style="margin: 10px 0; font-size: 12px; color: #555;">Khách hàng: <strong>Khách lẻ</strong></div>`;

  const printWin = window.open('', '_blank', 'width=480,height=720');
  if (!printWin) return;

  printWin.document.write(`
    <html>
      <head>
        <title>Hóa đơn ${escapeHtml(invoice.invoiceNumber)}</title>
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
          <p style="margin: 4px 0; font-size: 13px;">Số HĐ: <strong>${escapeHtml(invoice.invoiceNumber)}</strong></p>
          <p style="margin: 2px 0; font-size: 12px; color: #57534e;">Ngày xuất: ${escapeHtml(formatDateTime(invoice.issuedAt))}</p>
        </div>
        <div class="divider"></div>
        <div style="font-size: 12px; line-height: 1.6;">
          <div>Mã đơn hàng: <strong>${escapeHtml(invoice.orderCode || `#${invoice.orderId}`)}</strong></div>
          ${
            order?.tableNumber
              ? `<div>Vị trí phục vụ: <strong>${escapeHtml(order.tableNumber)}</strong></div>`
              : ''
          }
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
              ? `<div style="display:flex; justify-content:space-between; color:#047857;"><span>Giảm giá (${escapeHtml(order.appliedVoucherCode || '')}):</span><span>- ${formatPrice(order.discountAmount)}</span></div>`
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

const AdminInvoicesPage = () => {
  // Danh sách hóa đơn phân trang
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Bộ lọc tìm kiếm
  const [keyword, setKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('ALL'); // 'ALL' | 'VAT' | 'RETAIL'

  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const feedbackTimerRef = useRef(null);

  // Modal Xuất hóa đơn mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [customerTaxProfiles, setCustomerTaxProfiles] = useState([]);
  const [selectedTaxProfileId, setSelectedTaxProfileId] = useState('');
  const [newTaxForm, setNewTaxForm] = useState({
    companyName: '',
    taxCode: '',
    companyAddress: '',
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Modal Xem chi tiết / In / Cập nhật VAT hóa đơn
  const [detailModal, setDetailModal] = useState({
    open: false,
    invoice: null,
    order: null,
    payment: null,
    loading: false,
  });
  const [editingVat, setEditingVat] = useState(false);
  const [editTaxProfiles, setEditTaxProfiles] = useState([]);
  const [editSelectedTaxId, setEditSelectedTaxId] = useState('');
  const [editNewTaxForm, setEditNewTaxForm] = useState({
    companyName: '',
    taxCode: '',
    companyAddress: '',
  });
  const [updatingVat, setUpdatingVat] = useState(false);

  // Modal xác nhận xóa hóa đơn (Quyền riêng của Admin)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showFeedback = useCallback((type, message) => {
    setFeedback({ type, message });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        size: 10,
        sortBy: 'issuedAt',
        sortDir: 'desc',
      };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (fromDate) params.fromDate = `${fromDate}T00:00:00`;
      if (toDate) params.toDate = `${toDate}T23:59:59`;

      const res = await invoiceService.getAllInvoices(params);
      const pageData = res?.result;

      if (Array.isArray(pageData?.content)) {
        setInvoices(pageData.content);
        setTotalPages(Math.max(1, pageData.totalPages || 1));
        setTotalElements(pageData.totalElements ?? pageData.content.length);
      } else if (Array.isArray(pageData)) {
        setInvoices(pageData);
        setTotalPages(1);
        setTotalElements(pageData.length);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      showFeedback('error', err?.message || 'Không thể tải danh sách hóa đơn.');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, fromDate, toDate, showFeedback]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const displayedInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invoiceTypeFilter === 'VAT') return Boolean(inv.taxProfileId || inv.companyName);
      if (invoiceTypeFilter === 'RETAIL') return !inv.taxProfileId && !inv.companyName;
      return true;
    });
  }, [invoices, invoiceTypeFilter]);

  const invoiceSummary = useMemo(() => {
    const vatCount = displayedInvoices.filter((inv) =>
      Boolean(inv.taxProfileId || inv.companyName)
    ).length;
    const retailCount = displayedInvoices.length - vatCount;
    const totalAmount = displayedInvoices.reduce(
      (sum, inv) => sum + Number(inv.orderFinalAmount || 0),
      0
    );
    return { vatCount, retailCount, totalAmount };
  }, [displayedInvoices]);

  // Mở modal xuất hóa đơn -> tải các đơn hàng hợp lệ chưa xuất hóa đơn
  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);
    setSelectedOrderId('');
    setCustomerTaxProfiles([]);
    setSelectedTaxProfileId('');
    setNewTaxForm({ companyName: '', taxCode: '', companyAddress: '' });
    setLoadingOrders(true);

    try {
      const [ordersRes, allInvRes] = await Promise.all([
        orderService.getAllOrders({
          page: 0,
          size: 100,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
        invoiceService.getAllInvoices({ page: 0, size: 200 }).catch(() => null),
      ]);

      const allOrders = Array.isArray(ordersRes?.result?.content)
        ? ordersRes.result.content
        : Array.isArray(ordersRes?.result)
          ? ordersRes.result
          : [];

      const existingInvoices = Array.isArray(allInvRes?.result?.content)
        ? allInvRes.result.content
        : Array.isArray(allInvRes?.result)
          ? allInvRes.result
          : [];

      const invoicedOrderIds = new Set(existingInvoices.map((i) => Number(i.orderId)));

      const candidates = allOrders.filter(
        (o) =>
          (o.status || '').toUpperCase() !== 'CANCELLED' &&
          !invoicedOrderIds.has(Number(o.id))
      );

      setEligibleOrders(candidates);
    } catch (err) {
      showFeedback(
        'error',
        err?.message || 'Không thể tải danh sách đơn hàng chờ xuất hóa đơn.'
      );
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSelectOrderForInvoice = async (orderIdStr) => {
    setSelectedOrderId(orderIdStr);
    setCustomerTaxProfiles([]);
    setSelectedTaxProfileId('');

    const chosenOrder = eligibleOrders.find((o) => String(o.id) === String(orderIdStr));
    if (chosenOrder?.customerAccountId) {
      try {
        const taxRes = await taxProfileService.getTaxProfilesByAccountId(
          chosenOrder.customerAccountId
        );
        const list = Array.isArray(taxRes?.result) ? taxRes.result : [];
        setCustomerTaxProfiles(list);
      } catch {
        setCustomerTaxProfiles([]);
      }
    }
  };

  const handleSubmitCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      showFeedback('error', 'Vui lòng chọn đơn hàng cần xuất hóa đơn.');
      return;
    }

    const chosenOrder = eligibleOrders.find((o) => String(o.id) === String(selectedOrderId));
    setCreatingInvoice(true);

    try {
      let finalTaxProfileId = null;

      if (selectedTaxProfileId === 'NEW') {
        if (!newTaxForm.companyName.trim() || !newTaxForm.taxCode.trim()) {
          showFeedback('error', 'Vui lòng nhập đầy đủ Tên công ty và Mã số thuế.');
          setCreatingInvoice(false);
          return;
        }

        const taxCreateRes = await taxProfileService.createTaxProfile({
          companyName: newTaxForm.companyName.trim(),
          taxCode: newTaxForm.taxCode.trim(),
          companyAddress: newTaxForm.companyAddress.trim() || null,
          accountId: chosenOrder?.customerAccountId
            ? Number(chosenOrder.customerAccountId)
            : null,
        });
        finalTaxProfileId = taxCreateRes?.result?.id ?? null;
      } else if (selectedTaxProfileId) {
        finalTaxProfileId = Number(selectedTaxProfileId);
      }

      const invRes = await invoiceService.createInvoice({
        orderId: Number(selectedOrderId),
        taxProfileId: finalTaxProfileId,
      });

      const createdInvoice = invRes?.result;
      setShowCreateModal(false);
      await fetchInvoices();

      showFeedback(
        'success',
        `Đã xuất hóa đơn ${createdInvoice?.invoiceNumber || ''} thành công!`
      );
    } catch (err) {
      showFeedback(
        'error',
        err?.message || 'Không thể xuất hóa đơn. Kiểm tra trạng thái thanh toán của đơn.'
      );
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleOpenInvoiceDetail = async (invoice) => {
    setEditingVat(false);
    setDetailModal({
      open: true,
      invoice,
      order: null,
      payment: null,
      loading: true,
    });

    try {
      const [orderRes, payRes] = await Promise.all([
        invoice.orderId ? orderService.getOrderById(invoice.orderId).catch(() => null) : null,
        invoice.orderId
          ? paymentService.getPaymentsByOrderId(invoice.orderId).catch(() => null)
          : null,
      ]);

      const orderData = orderRes?.result || null;
      const payList = Array.isArray(payRes?.result) ? payRes.result : [];
      const paidPayment = payList.find((p) => isPaymentSuccessful(p)) || payList[0] || null;

      setDetailModal({
        open: true,
        invoice,
        order: orderData,
        payment: paidPayment,
        loading: false,
      });
    } catch {
      setDetailModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleQuickPrintInvoice = async (invoice) => {
    setPrintingId(invoice.id);
    try {
      const [orderRes, payRes] = await Promise.all([
        invoice.orderId ? orderService.getOrderById(invoice.orderId).catch(() => null) : null,
        invoice.orderId
          ? paymentService.getPaymentsByOrderId(invoice.orderId).catch(() => null)
          : null,
      ]);
      const orderData = orderRes?.result || null;
      const payList = Array.isArray(payRes?.result) ? payRes.result : [];
      const paidPayment = payList.find((p) => isPaymentSuccessful(p)) || payList[0] || null;
      handlePrintInvoiceWindow(invoice, orderData, paidPayment);
    } finally {
      setPrintingId(null);
    }
  };

  const handleStartEditVat = async () => {
    setEditingVat(true);
    setEditSelectedTaxId(
      detailModal.invoice?.taxProfileId ? String(detailModal.invoice.taxProfileId) : ''
    );
    setEditNewTaxForm({ companyName: '', taxCode: '', companyAddress: '' });

    const custId = detailModal.order?.customerAccountId;
    if (custId) {
      try {
        const res = await taxProfileService.getTaxProfilesByAccountId(custId);
        setEditTaxProfiles(Array.isArray(res?.result) ? res.result : []);
      } catch {
        setEditTaxProfiles([]);
      }
    } else {
      setEditTaxProfiles([]);
    }
  };

  const handleSaveVatUpdate = async () => {
    if (!detailModal.invoice) return;
    setUpdatingVat(true);

    try {
      let targetTaxId = null;

      if (editSelectedTaxId === 'NEW') {
        if (!editNewTaxForm.companyName.trim() || !editNewTaxForm.taxCode.trim()) {
          showFeedback('error', 'Vui lòng nhập Tên công ty và Mã số thuế.');
          setUpdatingVat(false);
          return;
        }
        const createdTax = await taxProfileService.createTaxProfile({
          companyName: editNewTaxForm.companyName.trim(),
          taxCode: editNewTaxForm.taxCode.trim(),
          companyAddress: editNewTaxForm.companyAddress.trim() || null,
          accountId: detailModal.order?.customerAccountId
            ? Number(detailModal.order.customerAccountId)
            : null,
        });
        targetTaxId = createdTax?.result?.id ?? null;
      } else if (editSelectedTaxId) {
        targetTaxId = Number(editSelectedTaxId);
      }

      const updateRes = await invoiceService.updateInvoice(detailModal.invoice.id, {
        taxProfileId: targetTaxId,
      });
      const updatedInvoice = updateRes?.result || detailModal.invoice;

      setDetailModal((prev) => ({ ...prev, invoice: updatedInvoice }));
      setEditingVat(false);
      await fetchInvoices();
      showFeedback(
        'success',
        `Đã cập nhật thông tin VAT cho hóa đơn ${updatedInvoice.invoiceNumber}.`
      );
    } catch (err) {
      showFeedback(
        'error',
        err?.message || 'Không thể cập nhật thông tin thuế cho hóa đơn.'
      );
    } finally {
      setUpdatingVat(false);
    }
  };

  // Xác nhận xóa hóa đơn (Chỉ Admin)
  const handleConfirmDeleteInvoice = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await invoiceService.deleteInvoice(deleteTarget.id);
      const deletedNumber = deleteTarget.invoiceNumber;
      setDeleteTarget(null);
      if (detailModal.open && detailModal.invoice?.id === deleteTarget.id) {
        setDetailModal((prev) => ({ ...prev, open: false }));
      }
      await fetchInvoices();
      showFeedback('success', `Đã xóa hóa đơn ${deletedNumber}.`);
    } catch (err) {
      showFeedback('error', err?.message || 'Không thể xóa hóa đơn này.');
    } finally {
      setDeleting(false);
    }
  };

  // Xuất sổ hóa đơn ra file Excel (.xls UTF-8)
  const handleExportInvoicesExcel = () => {
    if (displayedInvoices.length === 0) {
      showFeedback('error', 'Không có hóa đơn nào trong danh sách hiện tại để xuất Excel.');
      return;
    }

    setExporting(true);
    try {
      const exportedAt = formatDateTime(new Date().toISOString());
      const rowsHtml = displayedInvoices
        .map((inv, idx) => {
          const hasVat = Boolean(inv.taxProfileId || inv.companyName);
          return `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td>${escapeHtml(inv.invoiceNumber)}</td>
              <td>${escapeHtml(inv.orderCode || `#${inv.orderId}`)}</td>
              <td>${hasVat ? 'VAT Công ty' : 'Bán lẻ'}</td>
              <td>${escapeHtml(hasVat ? inv.companyName : 'Khách lẻ')}</td>
              <td>${escapeHtml(inv.taxCode || '—')}</td>
              <td>${escapeHtml(inv.companyAddress || '—')}</td>
              <td>${escapeHtml(formatDateTime(inv.issuedAt))}</td>
              <td style="text-align:right;font-weight:bold;">${Number(
                inv.orderFinalAmount || 0
              )}</td>
            </tr>
          `;
        })
        .join('');

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1c1917; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
            th, td { border: 1px solid #d6d3d1; padding: 6px 10px; vertical-align: middle; }
            th { background-color: #78350f; color: #ffffff; font-weight: bold; text-align: left; }
            .title { font-size: 16px; font-weight: bold; color: #78350f; border: none; padding: 4px 0; }
            .meta { border: none; padding: 2px 0; color: #44403c; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="9" class="title">SỔ QUẢN LÝ HÓA ĐƠN BÁN HÀNG & VAT - CF SHOP (ADMIN)</td></tr>
            <tr><td colspan="9" class="meta"><strong>Thời điểm xuất:</strong> ${escapeHtml(
              exportedAt
            )} &nbsp;|&nbsp; <strong>Số hóa đơn xuất:</strong> ${
        displayedInvoices.length
      } &nbsp;|&nbsp; <strong>Tổng giá trị:</strong> ${
        invoiceSummary.totalAmount
      } VNĐ</td></tr>
          </table>
          <table>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Số hóa đơn</th>
              <th>Mã đơn hàng</th>
              <th>Loại HĐ</th>
              <th>Tên công ty / Khách</th>
              <th>Mã số thuế</th>
              <th>Địa chỉ VAT</th>
              <th>Ngày phát hành</th>
              <th style="text-align:right;">Thành tiền (VNĐ)</th>
            </tr>
            ${rowsHtml}
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF', htmlContent], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SoHoaDon_CFShop_${toInputDateString(new Date())}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showFeedback(
        'success',
        `Đã xuất file Excel sổ hóa đơn (${displayedInvoices.length} chứng từ).`
      );
    } catch {
      showFeedback('error', 'Không thể xuất file Excel, vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Admin */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-7 shadow-sm">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Quản trị viên • Toàn quyền quản lý, sửa VAT & xóa hóa đơn</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Quản lý Hóa đơn & Chứng từ VAT
            </h1>
            <p className="text-sm text-stone-300 max-w-2xl">
              Kiểm soát toàn bộ hóa đơn bán lẻ và VAT doanh nghiệp, xuất sổ kế toán Excel,
              điều chỉnh thông tin thuế hoặc xóa chứng từ sai lệch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              disabled={loading || exporting || displayedInvoices.length === 0}
              onClick={handleExportInvoicesExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-400 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            <button
              type="button"
              onClick={fetchInvoices}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Xuất hóa đơn mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Thẻ thống kê nhanh hóa đơn */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Tổng hóa đơn (trang / lọc)
          </span>
          <p className="text-2xl font-extrabold text-stone-800 mt-1">
            {displayedInvoices.length}{' '}
            <span className="text-xs font-semibold text-stone-400">
              / {totalElements} tổng hệ thống
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Phân loại VAT vs Bán lẻ
          </span>
          <p className="text-xl font-extrabold text-sky-800 mt-1">
            {invoiceSummary.vatCount} VAT{' '}
            <span className="text-xs font-semibold text-stone-500">
              • {invoiceSummary.retailCount} bán lẻ
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Tổng giá trị danh sách
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {formatPrice(invoiceSummary.totalAmount)}
          </p>
        </div>
      </div>

      {/* Thanh bộ lọc tìm kiếm */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-stone-500 mb-1">
              Tìm kiếm hóa đơn
            </label>
            <div className="relative">
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(0);
                }}
                placeholder="Số hóa đơn, mã đơn, tên công ty, MST..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-stone-500 mb-1">Từ ngày</label>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-stone-500 mb-1">Đến ngày</label>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-1">
            {(keyword || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setFromDate('');
                  setToDate('');
                  setPage(0);
                }}
                className="w-full py-2 px-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Phân loại hóa đơn lẻ vs VAT công ty */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'Tất cả hóa đơn' },
              { key: 'VAT', label: 'Hóa đơn VAT (Doanh nghiệp)' },
              { key: 'RETAIL', label: 'Hóa đơn bán lẻ' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setInvoiceTypeFilter(t.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  invoiceTypeFilter === t.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-stone-500">
            Tổng cộng: <strong className="text-stone-800">{totalElements}</strong> hóa đơn
          </span>
        </div>
      </div>

      {/* Bảng danh sách hóa đơn */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Receipt className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-base font-bold text-stone-800">Chưa có hóa đơn nào</p>
            <p className="text-sm text-stone-500">
              Bấm &ldquo;Xuất hóa đơn mới&rdquo; để lập chứng từ cho đơn hàng đã thanh toán.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-5">Số hóa đơn</th>
                  <th className="py-3.5 px-4">Mã đơn hàng</th>
                  <th className="py-3.5 px-4">Đối tượng / Thông tin VAT</th>
                  <th className="py-3.5 px-4">Ngày phát hành</th>
                  <th className="py-3.5 px-4 text-right">Tổng tiền</th>
                  <th className="py-3.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedInvoices.map((inv) => {
                  const hasVat = Boolean(inv.taxProfileId || inv.companyName);
                  return (
                    <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-amber-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-stone-700">
                        {inv.orderCode || `#${inv.orderId}`}
                      </td>
                      <td className="py-3.5 px-4">
                        {hasVat ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span>{inv.companyName}</span>
                            </span>
                            {inv.taxCode && (
                              <p className="text-xs font-mono text-stone-500">
                                MST: {inv.taxCode}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium">
                            <User className="w-3 h-3" />
                            <span>Khách lẻ</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        {formatDateTime(inv.issuedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-stone-800">
                        {formatPrice(inv.orderFinalAmount)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceDetail(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white hover:border-amber-400 hover:bg-amber-50/50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết / VAT</span>
                          </button>

                          <button
                            type="button"
                            disabled={printingId === inv.id}
                            onClick={() => handleQuickPrintInvoice(inv)}
                            title="In hóa đơn ngay"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{printingId === inv.id ? '...' : 'In'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(inv)}
                            title="Xóa hóa đơn"
                            className="p-1.5 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Trang <strong>{page + 1}</strong> / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Xuất hóa đơn mới */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-stone-800">
                Xuất hóa đơn bán hàng
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitCreateInvoice}
              className="p-5 overflow-y-auto space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  1. Chọn đơn hàng cần xuất hóa đơn <span className="text-red-500">*</span>
                </label>

                {loadingOrders ? (
                  <div className="h-10 rounded-xl bg-stone-100 animate-pulse" />
                ) : eligibleOrders.length === 0 ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Tất cả đơn hàng hợp lệ hiện tại đều đã được xuất hóa đơn.
                  </p>
                ) : (
                  <select
                    value={selectedOrderId}
                    onChange={(e) => handleSelectOrderForInvoice(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">-- Chọn mã đơn hàng --</option>
                    {eligibleOrders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderCode || `#${ord.id}`} • {formatPrice(ord.finalAmount)} (
                        {ord.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedOrderId && (
                <div className="space-y-3 pt-2 border-t border-stone-100">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                    2. Thông tin xuất hóa đơn VAT (Tùy chọn)
                  </label>

                  <select
                    value={selectedTaxProfileId}
                    onChange={(e) => setSelectedTaxProfileId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">Khách lẻ (Không xuất VAT doanh nghiệp)</option>
                    {customerTaxProfiles.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        [MST: {tp.taxCode}] {tp.companyName}
                      </option>
                    ))}
                    <option value="NEW">+ Nhập thông tin công ty / MST mới...</option>
                  </select>

                  {selectedTaxProfileId === 'NEW' && (
                    <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Tên công ty / Đơn vị <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newTaxForm.companyName}
                          onChange={(e) =>
                            setNewTaxForm({ ...newTaxForm, companyName: e.target.value })
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
                          value={newTaxForm.taxCode}
                          onChange={(e) =>
                            setNewTaxForm({ ...newTaxForm, taxCode: e.target.value })
                          }
                          placeholder="0101234567"
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Địa chỉ xuất hóa đơn
                        </label>
                        <input
                          type="text"
                          value={newTaxForm.companyAddress}
                          onChange={(e) =>
                            setNewTaxForm({ ...newTaxForm, companyAddress: e.target.value })
                          }
                          placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingInvoice || !selectedOrderId}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {creatingInvoice ? 'Đang xuất...' : 'Xác nhận xuất hóa đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Xem chi tiết, cập nhật VAT, In & Xóa hóa đơn */}
      {detailModal.open && detailModal.invoice && (
        <div
          onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-stone-800">
                    Hóa đơn {detailModal.invoice.invoiceNumber}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Phát hành: {formatDateTime(detailModal.invoice.issuedAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {/* Khối thông tin thuế VAT */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Thông tin xuất hóa đơn VAT
                  </span>
                  {!editingVat && (
                    <button
                      type="button"
                      onClick={handleStartEditVat}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Đổi / Bổ sung MST</span>
                    </button>
                  )}
                </div>

                {!editingVat ? (
                  detailModal.invoice.companyName ? (
                    <div className="text-xs space-y-1 text-stone-700">
                      <p className="font-bold text-stone-900">
                        {detailModal.invoice.companyName}
                      </p>
                      <p className="font-mono">MST: {detailModal.invoice.taxCode || '—'}</p>
                      <p>Địa chỉ: {detailModal.invoice.companyAddress || '—'}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">
                      Hóa đơn bán lẻ (Chưa gắn MST công ty)
                    </p>
                  )
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <select
                      value={editSelectedTaxId}
                      onChange={(e) => setEditSelectedTaxId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    >
                      <option value="">Khách lẻ (Gỡ thông tin VAT)</option>
                      {editTaxProfiles.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          [MST: {tp.taxCode}] {tp.companyName}
                        </option>
                      ))}
                      <option value="NEW">+ Nhập công ty / MST mới...</option>
                    </select>

                    {editSelectedTaxId === 'NEW' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editNewTaxForm.companyName}
                          onChange={(e) =>
                            setEditNewTaxForm({
                              ...editNewTaxForm,
                              companyName: e.target.value,
                            })
                          }
                          placeholder="Tên công ty *"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={editNewTaxForm.taxCode}
                          onChange={(e) =>
                            setEditNewTaxForm({ ...editNewTaxForm, taxCode: e.target.value })
                          }
                          placeholder="Mã số thuế *"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={editNewTaxForm.companyAddress}
                          onChange={(e) =>
                            setEditNewTaxForm({
                              ...editNewTaxForm,
                              companyAddress: e.target.value,
                            })
                          }
                          placeholder="Địa chỉ công ty"
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingVat(false)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={updatingVat}
                        onClick={handleSaveVatUpdate}
                        className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        {updatingVat ? 'Đang lưu...' : 'Lưu thông tin VAT'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chi tiết món từ Order */}
              {detailModal.loading ? (
                <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
              ) : (
                detailModal.order && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>
                        Đơn hàng:{' '}
                        <strong className="font-mono text-stone-800">
                          {detailModal.order.orderCode}
                        </strong>
                      </span>
                      {detailModal.payment && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          {detailModal.payment.paymentGateway === 'VNPAY' ? (
                            <CreditCard className="w-3.5 h-3.5" />
                          ) : (
                            <Banknote className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {detailModal.payment.paymentGateway === 'VNPAY'
                              ? 'VNPay'
                              : 'Tiền mặt'}{' '}
                            ({detailModal.payment.status})
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                      {(detailModal.order.orderItems || []).map((item) => (
                        <div
                          key={item.id}
                          className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-white"
                        >
                          <span>
                            <strong>{item.productName}</strong> x{item.quantity}
                          </span>
                          <span className="font-semibold">
                            {formatPrice(
                              item.subtotal ?? Number(item.unitPrice) * item.quantity
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-800">Tổng thanh toán hóa đơn</span>
                <span className="text-xl font-extrabold text-amber-800">
                  {formatPrice(detailModal.invoice.orderFinalAmount)}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handlePrintInvoiceWindow(
                      detailModal.invoice,
                      detailModal.order,
                      detailModal.payment
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In hóa đơn</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(detailModal.invoice)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa hóa đơn</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Xác nhận xóa hóa đơn */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-extrabold">Xác nhận xóa hóa đơn</h3>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-stone-600">
              <p>
                Bạn có chắc chắn muốn xóa vĩnh viễn hóa đơn{' '}
                <strong className="font-mono text-stone-900">
                  {deleteTarget.invoiceNumber}
                </strong>{' '}
                (Đơn hàng{' '}
                <strong className="font-mono text-stone-900">
                  {deleteTarget.orderCode || `#${deleteTarget.orderId}`}
                </strong>
                )?
              </p>
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                Thao tác này chỉ dành cho Quản trị viên và không thể hoàn tác sau khi xóa.
              </p>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteInvoice}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo nổi */}
      {feedback.message && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-2xl border shadow-lg text-sm flex items-center gap-2.5 ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="font-medium leading-snug">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminInvoicesPage;