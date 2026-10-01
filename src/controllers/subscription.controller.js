import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { snap } from '../services/midtrans.service.js';
import { generateToken } from '../lib/jwt.js';

// Struktur Harga Resmi Langganan OmniPOS
const PLAN_PRICING = {
  PLUS: {
    monthly: 25000,
    yearly: 240000, // Rp 20.000 / bln x 12
  },
  PRO: {
    monthly: 60000,
    yearly: 600000, // Rp 50.000 / bln x 12
  },
};

/**
 * Controller: Membuat Transaksi Pembayaran Midtrans Snap Resmi
 * POST /api/subscriptions/create-transaction (Protected: requireAuth)
 */
export const createTransaction = async (req, res) => {
  try {
    const { plan, billingCycle = 'yearly' } = req.body;
    const { tenant, user } = req;

    // 1. Validasi Input Plan & Billing Cycle
    if (!plan || !['PLUS', 'PRO'].includes(plan.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Paket yang dipilih harus PLUS atau PRO.',
      });
    }

    const normalizedPlan = plan.toUpperCase();
    const cycle = billingCycle === 'monthly' ? 'monthly' : 'yearly';
    const grossAmount = PLAN_PRICING[normalizedPlan][cycle];

    // 2. Buat Order ID Unik (maksimal 50 karakter sesuai spesifikasi Midtrans)
    // Format: SUB-<tenantId_16char>-<unixTimestamp>
    const tenantShortId = (tenant.id || '').replace(/-/g, '').slice(0, 16);
    const orderId = `SUB-${tenantShortId}-${Math.floor(Date.now() / 1000)}`;

    // 3. Siapkan Parameter Transaksi Midtrans Snap
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(grossAmount),
      },
      customer_details: {
        first_name: user.name || tenant.name || 'Pelanggan',
        email: user.email,
      },
      item_details: [
        {
          id: `${normalizedPlan}-${cycle}`,
          price: Math.round(grossAmount),
          quantity: 1,
          name: `Paket ${normalizedPlan} (${cycle === 'yearly' ? 'Tahunan' : 'Bulanan'})`,
        },
      ],
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/upgrade?status=success`,
      },
    };

    // 4. Panggil SDK resmi Midtrans Snap (Tanpa dummy/simulasi token)
    const transaction = await snap.createTransaction(parameter);

    if (!transaction || !transaction.token) {
      throw new Error('Midtrans Snap tidak mengembalikan token transaksi yang valid.');
    }

    // 5. Simpan Catatan Pembayaran ke Database PostgreSQL dengan Status PENDING
    await prisma.subscriptionPayment.create({
      data: {
        orderId,
        tenantId: tenant.id,
        plan: normalizedPlan,
        billingCycle: cycle,
        amount: Math.round(grossAmount),
        status: 'PENDING',
        snapToken: transaction.token,
        snapRedirectUrl: transaction.redirect_url,
      },
    });

    // 6. Kembalikan Response Sukses ke Frontend
    return res.status(200).json({
      success: true,
      data: {
        snapToken: transaction.token,
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId,
      },
    });
  } catch (error) {
    console.error('[Subscription] Error creating transaction:', error);

    return res.status(500).json({
      success: false,
      message: 'Gagal memproses transaksi Midtrans Snap.',
    });
  }
};

/**
 * Controller: Verifikasi Pembayaran Transaksi Midtrans
 * POST /api/subscriptions/verify-payment & POST /api/subscriptions/verify (Protected: requireAuth)
 */
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, plan } = req.body;
    const { tenant, user, activeBranchId } = req;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Parameter orderId wajib disertakan.',
      });
    }

    // 1. Cari data payment terlebih dahulu di database
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Data transaksi pembayaran tidak ditemukan.',
      });
    }

    // 2. Kunci Celah IDOR: Wajib Validasi Kepemilikan Transaksi
    if (payment.tenantId !== tenant.id) {
      return res.status(403).json({
        success: false,
        message: 'Order ID bukan milik toko Anda.',
      });
    }

    // 3. Idempoten: Jika status transaksi sudah SETTLEMENT, jangan perpanjang berulang
    if (payment.status === 'SETTLEMENT') {
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });

      const token = generateToken({
        userId: user.id,
        tenantId: currentTenant.id,
        tenantSlug: currentTenant.slug,
        role: user.role?.name || (user.isOwner ? 'OWNER' : 'KASIR'),
        activeBranchId: activeBranchId || null,
        plan: currentTenant.plan,
      });

      return res.status(200).json({
        success: true,
        message: 'Pembayaran sudah terverifikasi sebelumnya dan paket langganan aktif.',
        data: {
          token,
          tenant: {
            id: currentTenant.id,
            name: currentTenant.name,
            slug: currentTenant.slug,
            plan: currentTenant.plan,
            planStatus: currentTenant.planStatus,
            billingCycle: currentTenant.billingCycle,
            subscriptionExpiresAt: currentTenant.subscriptionExpiresAt,
            proJoinedAt: currentTenant.proJoinedAt,
            createdAt: currentTenant.createdAt,
            updatedAt: currentTenant.updatedAt,
          },
          payment: {
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            paidAt: payment.paidAt,
          },
        },
      });
    }

    // 4. Cek Status Transaksi Langsung ke Midtrans API
    const statusResponse = await snap.transaction.status(orderId);
    const { transaction_status, fraud_status, payment_type } = statusResponse;

    // 5. Evaluasi Status Pembayaran
    const isSettled =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    if (isSettled) {
      const targetPlan = (plan || payment.plan || 'PLUS').toUpperCase();
      const cycle = payment.billingCycle || 'yearly';

      // Hitung masa aktif langganan: jika monthly (+30 hari), jika yearly (+365 hari)
      const expiryDays = cycle === 'yearly' ? 365 : 30;
      const calculatedExpiryDate = new Date();
      calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() + expiryDays);

      // Cari tenant saat ini untuk cek status proJoinedAt
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });

      const tenantUpdateData = {
        plan: targetPlan,
        planStatus: 'ACTIVE',
        billingCycle: cycle,
        subscriptionExpiresAt: calculatedExpiryDate,
      };

      // Jika paket adalah PRO dan proJoinedAt masih null/kosong, catat tanggal pertama kali upgrade PRO
      if (targetPlan === 'PRO' && !currentTenant?.proJoinedAt) {
        tenantUpdateData.proJoinedAt = new Date();
      }

      // Update Database secara Atomic Transaction
      const [updatedPayment, updatedTenant] = await prisma.$transaction([
        prisma.subscriptionPayment.update({
          where: { orderId },
          data: {
            status: 'SETTLEMENT',
            paidAt: new Date(),
            paymentType: payment_type || 'midtrans',
            rawResponse: statusResponse,
          },
        }),
        prisma.tenant.update({
          where: { id: tenant.id },
          data: tenantUpdateData,
        }),
      ]);

      // Generate JWT Token baru dengan plan yang terupdate
      const newToken = generateToken({
        userId: user.id,
        tenantId: updatedTenant.id,
        tenantSlug: updatedTenant.slug,
        role: user.role?.name || (user.isOwner ? 'OWNER' : 'KASIR'),
        activeBranchId: activeBranchId || null,
        plan: updatedTenant.plan,
      });

      return res.status(200).json({
        success: true,
        message: 'Pembayaran berhasil diverifikasi dan paket langganan telah aktif.',
        data: {
          token: newToken,
          tenant: {
            id: updatedTenant.id,
            name: updatedTenant.name,
            slug: updatedTenant.slug,
            plan: updatedTenant.plan,
            planStatus: updatedTenant.planStatus,
            billingCycle: updatedTenant.billingCycle,
            subscriptionExpiresAt: updatedTenant.subscriptionExpiresAt,
            proJoinedAt: updatedTenant.proJoinedAt,
            createdAt: updatedTenant.createdAt,
            updatedAt: updatedTenant.updatedAt,
          },
          payment: {
            orderId: updatedPayment.orderId,
            status: updatedPayment.status,
            amount: updatedPayment.amount,
            paidAt: updatedPayment.paidAt,
          },
        },
      });
    }

    // Jika status masih pending
    if (transaction_status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Pembayaran belum diselesaikan. Silakan selesaikan pembayaran Anda di gerbang Midtrans.',
        status: transaction_status,
      });
    }

    // Status lainnya (expire, cancel, deny, failure)
    return res.status(400).json({
      success: false,
      message: `Status transaksi saat ini: ${transaction_status}. Pembayaran tidak berhasil.`,
      status: transaction_status,
    });
  } catch (error) {
    console.error('[Subscription] Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memverifikasi status pembayaran ke Midtrans.',
    });
  }
};

/**
 * Controller: Handler HTTP Webhook Midtrans
 * POST /api/subscriptions/webhook (Public Route)
 */
export const handleWebhook = async (req, res) => {
  try {
    const notification = req.body;
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
    } = notification;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id wajib disertakan.',
      });
    }

    // 1. Validasi Keberadaan Signature Key (Tolak langsung jika tidak ada)
    if (!signature_key) {
      return res.status(401).json({
        success: false,
        message: 'Signature Key wajib disertakan.',
      });
    }

    // 2. Verifikasi Signature Hash SHA512 Menggunakan crypto.timingSafeEqual
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    const rawSignaturePayload = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(rawSignaturePayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(signature_key, 'utf-8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Signature Key tidak valid.',
      });
    }

    // 3. Cari Data Pembayaran di Database
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { orderId: order_id },
      include: { tenant: true },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Data transaksi pembayaran tidak ditemukan.',
      });
    }

    // 4. Idempoten: Jika status transaksi sudah SETTLEMENT, jangan proses ulang
    if (payment.status === 'SETTLEMENT') {
      return res.status(200).json({
        success: true,
        message: 'Transaksi sudah terverifikasi sebelumnya.',
      });
    }

    let paymentStatus = payment.status;
    let shouldActivatePlan = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept' || !fraud_status) {
        paymentStatus = 'SETTLEMENT';
        shouldActivatePlan = true;
      }
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'SETTLEMENT';
      shouldActivatePlan = true;
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      paymentStatus = 'CANCEL';
    } else if (transaction_status === 'expire') {
      paymentStatus = 'EXPIRE';
    } else if (transaction_status === 'pending') {
      paymentStatus = 'PENDING';
    }

    if (shouldActivatePlan) {
      const expiryDays = payment.billingCycle === 'yearly' ? 365 : 30;
      const calculatedExpiryDate = new Date();
      calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() + expiryDays);

      const tenantUpdateData = {
        plan: payment.plan,
        planStatus: 'ACTIVE',
        billingCycle: payment.billingCycle,
        subscriptionExpiresAt: calculatedExpiryDate,
      };

      // Jika paket adalah PRO dan proJoinedAt masih null, catat tanggal pertama kali upgrade PRO
      if (payment.plan === 'PRO' && !payment.tenant?.proJoinedAt) {
        tenantUpdateData.proJoinedAt = new Date();
      }

      await prisma.$transaction([
        prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: paymentStatus,
            paidAt: new Date(),
            paymentType: payment_type || payment.paymentType,
            rawResponse: notification,
          },
        }),
        prisma.tenant.update({
          where: { id: payment.tenantId },
          data: tenantUpdateData,
        }),
      ]);
    } else {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          paymentType: payment_type || payment.paymentType,
          rawResponse: notification,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook Midtrans berhasil diproses.',
    });
  } catch (error) {
    console.error('[Subscription] Error handling webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses webhook Midtrans.',
    });
  }
};

/**
 * Controller: Mendapatkan Informasi Langganan Aktif Toko
 * GET /api/subscriptions/status (Protected: requireAuth)
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const { tenant } = req;

    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        planStatus: true,
        billingCycle: true,
        subscriptionExpiresAt: true,
        proJoinedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const payments = await prisma.subscriptionPayment.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.status(200).json({
      success: true,
      data: {
        plan: currentTenant.plan,
        planStatus: currentTenant.planStatus,
        billingCycle: currentTenant.billingCycle,
        subscriptionExpiresAt: currentTenant.subscriptionExpiresAt,
        payments,
      },
    });
  } catch (error) {
    console.error('[Subscription] Error getting subscription status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mendapatkan status langganan.',
    });
  }
};

export default {
  createTransaction,
  verifyPayment,
  handleWebhook,
  getSubscriptionStatus,
};
