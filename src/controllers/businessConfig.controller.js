import prisma from '../lib/prisma.js';

export const BUSINESS_PRESETS = {
  FNB: {
    name: 'Kuliner & Minuman (F&B)',
    description: 'Cocok untuk Restoran, Kafe, Kedai Kopi, Warung Makan, Bakery, dan Food Court.',
    config: {
      enableTableManagement: true,
      enableQueueNumber: true,
      enableKitchenTicket: true,
      enableModifiers: true,
      enableMultiUnit: false,
      enableServiceTracking: false,
      enableCustomerDebt: false,
      enableTierPricing: false,
      enableBarcodeFastScan: false,
      enableBatchExpiry: false,
      enableStaffCommission: false,
      enableBookingSlot: false,
    },
  },
  RETAIL: {
    name: 'Toko Ritel & Kelontong',
    description: 'Cocok untuk Toko Kelontong, Minimarket, Fashion, Toko Bangunan, dan Grosir.',
    config: {
      enableTableManagement: false,
      enableQueueNumber: false,
      enableKitchenTicket: false,
      enableModifiers: false,
      enableMultiUnit: true,
      enableTierPricing: true,
      enableBarcodeFastScan: true,
      enableCustomerDebt: true,
      enableServiceTracking: false,
      enableBatchExpiry: false,
      enableStaffCommission: false,
      enableBookingSlot: false,
    },
  },
  SERVICE: {
    name: 'Laundry & Jasa Pengerjaan',
    description: 'Cocok untuk Jasa Laundry Kiloan/Satuan, Servis Elektronik, Cuci Sepatu/Tas, dan Bengkel.',
    config: {
      enableTableManagement: false,
      enableQueueNumber: true,
      enableKitchenTicket: false,
      enableModifiers: false,
      enableMultiUnit: false,
      enableServiceTracking: true,
      enableEstimatedPickupDate: true,
      enableCustomerDebt: true,
      enableTierPricing: false,
      enableBarcodeFastScan: false,
      enableBatchExpiry: false,
      enableStaffCommission: false,
      enableBookingSlot: false,
    },
  },
  BOOKING: {
    name: 'Barbershop & Salon (Jasa Waktu)',
    description: 'Cocok untuk Barbershop, Salon Kecantikan, Spa/Refleksi, Pet Care & Grooming, dan Studio.',
    config: {
      enableTableManagement: false,
      enableQueueNumber: true,
      enableKitchenTicket: false,
      enableModifiers: true,
      enableMultiUnit: false,
      enableServiceTracking: true,
      enableStaffCommission: true,
      enableBookingSlot: true,
      enableCustomerDebt: false,
      enableTierPricing: false,
      enableBarcodeFastScan: false,
      enableBatchExpiry: false,
    },
  },
  PHARMACY: {
    name: 'Apotek & Toko Obat',
    description: 'Cocok untuk Apotek, Klinik Pratama, Toko Herbal, dan Depot Obat.',
    config: {
      enableTableManagement: false,
      enableQueueNumber: true,
      enableKitchenTicket: false,
      enableModifiers: false,
      enableMultiUnit: true,
      enableTierPricing: false,
      enableBarcodeFastScan: true,
      enableBatchExpiry: true,
      enableCustomerDebt: true,
      enableServiceTracking: false,
      enableStaffCommission: false,
      enableBookingSlot: false,
    },
  },
  CUSTOM: {
    name: 'Kustom Penuh (Bebas)',
    description: 'Pilih bebas semua fitur sesuai kebutuhan unik dan spesifik usaha Anda.',
    config: {
      enableTableManagement: false,
      enableQueueNumber: false,
      enableKitchenTicket: false,
      enableModifiers: true,
      enableMultiUnit: true,
      enableTierPricing: false,
      enableBarcodeFastScan: false,
      enableServiceTracking: false,
      enableCustomerDebt: true,
      enableBatchExpiry: false,
      enableStaffCommission: false,
      enableBookingSlot: false,
    },
  },
};

/**
 * Mendapatkan daftar 6 preset model bisnis standar beserta nilai default feature flags
 */
export const getBusinessPresets = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        businessPreset: true,
        businessConfig: true,
        isOnboardingCompleted: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        presets: BUSINESS_PRESETS,
        currentPreset: tenant?.businessPreset || 'RETAIL',
        currentConfig: tenant?.businessConfig || BUSINESS_PRESETS.RETAIL.config,
        isOnboardingCompleted: tenant?.isOnboardingCompleted || false,
      },
    });
  } catch (error) {
    console.error('Error getBusinessPresets:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat preset model bisnis.',
      error: error.message,
    });
  }
};

/**
 * Memperbarui preset dan konfigurasi feature flags bisnis tenant
 */
export const updateBusinessConfig = async (req, res) => {
  try {
    const { businessPreset, businessConfig, isOnboardingCompleted } = req.body;

    const validPresets = Object.keys(BUSINESS_PRESETS);
    if (businessPreset && !validPresets.includes(businessPreset)) {
      return res.status(400).json({
        success: false,
        message: `Preset bisnis tidak valid. Pilihan: ${validPresets.join(', ')}`,
      });
    }

    const currentTenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { businessConfig: true, businessPreset: true },
    });

    let mergedConfig = businessConfig;
    if (!mergedConfig && businessPreset) {
      mergedConfig = BUSINESS_PRESETS[businessPreset]?.config || {};
    } else if (businessConfig && typeof businessConfig === 'object') {
      const existingConfig = currentTenant?.businessConfig && typeof currentTenant.businessConfig === 'object'
        ? currentTenant.businessConfig
        : {};
      mergedConfig = { ...existingConfig, ...businessConfig };
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        ...(businessPreset && { businessPreset }),
        ...(mergedConfig && { businessConfig: mergedConfig }),
        ...(typeof isOnboardingCompleted === 'boolean' && { isOnboardingCompleted }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        businessPreset: true,
        businessConfig: true,
        isOnboardingCompleted: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Konfigurasi model usaha berhasil diperbarui.',
      data: updatedTenant,
    });
  } catch (error) {
    console.error('Error updateBusinessConfig:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui konfigurasi bisnis.',
      error: error.message,
    });
  }
};
