import prisma from '../lib/prisma.js';

const DEFAULT_RECEIPT_SETTINGS = {
  paperSize: '58mm',
  headerText: null,
  footerText: 'Terima kasih atas kunjungan Anda!',
  showCashierName: true,
  showCustomerName: true,
  showTableNumber: true,
  showStoreLogo: false,
  logoUrl: null,
};

/**
 * Mengambil pengaturan cetak struk kasir milik tenant
 * GET /api/receipt-settings
 */
export const getReceiptSetting = async (req, res) => {
  try {
    const setting = await prisma.receiptSetting.findUnique({
      where: { tenantId: req.tenantId },
    });

    return res.status(200).json({
      success: true,
      data: setting || { tenantId: req.tenantId, ...DEFAULT_RECEIPT_SETTINGS },
    });
  } catch (error) {
    console.error('Error getReceiptSetting:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat pengaturan struk kasir.',
      error: error.message,
    });
  }
};

/**
 * Menyimpan / memperbarui pengaturan cetak struk kasir (Upsert)
 * PUT /api/receipt-settings
 */
export const updateReceiptSetting = async (req, res) => {
  try {
    const {
      paperSize = '58mm',
      headerText,
      footerText,
      showCashierName = true,
      showCustomerName = true,
      showTableNumber = true,
      showStoreLogo = false,
      logoUrl,
    } = req.body;

    const updated = await prisma.receiptSetting.upsert({
      where: { tenantId: req.tenantId },
      update: {
        paperSize: paperSize === '80mm' ? '80mm' : '58mm',
        headerText: headerText !== undefined ? headerText : null,
        footerText: footerText !== undefined ? footerText : 'Terima kasih atas kunjungan Anda!',
        showCashierName: Boolean(showCashierName),
        showCustomerName: Boolean(showCustomerName),
        showTableNumber: Boolean(showTableNumber),
        showStoreLogo: Boolean(showStoreLogo),
        logoUrl: logoUrl || null,
      },
      create: {
        tenantId: req.tenantId,
        paperSize: paperSize === '80mm' ? '80mm' : '58mm',
        headerText: headerText || null,
        footerText: footerText || 'Terima kasih atas kunjungan Anda!',
        showCashierName: Boolean(showCashierName),
        showCustomerName: Boolean(showCustomerName),
        showTableNumber: Boolean(showTableNumber),
        showStoreLogo: Boolean(showStoreLogo),
        logoUrl: logoUrl || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Format struk kasir berhasil disimpan.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updateReceiptSetting:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan pengaturan struk kasir.',
      error: error.message,
    });
  }
};
