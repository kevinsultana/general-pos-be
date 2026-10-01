/**
 * Middleware untuk validasi paket langganan (Subscription Plan)
 * @param {'PLUS' | 'PRO'} minPlan - Batas minimum paket yang dibutuhkan
 */
export const requirePlan = (minPlan) => {
  return (req, res, next) => {
    const tenantPlan = req.tenant?.plan || 'FREE';

    // Rencana tier: FREE < PLUS < PRO
    const planHierarchy = {
      FREE: 1,
      PLUS: 2,
      PRO: 3,
    };

    const currentLevel = planHierarchy[tenantPlan] || 1;
    const requiredLevel = planHierarchy[minPlan] || 2;

    if (currentLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_RESTRICTED',
        message:
          'Fitur multi-user dan kelola staf hanya tersedia untuk paket PLUS dan PRO.',
      });
    }

    next();
  };
};

/**
 * Middleware untuk validasi hak akses spesifik (Permissions)
 * @param {string} permissionKey - Contoh: 'users:view', 'users:manage'
 */
export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Otentikasi diperlukan.',
      });
    }

    // 1. Bypass otomatis jika user adalah Owner toko
    if (user.isOwner) {
      return next();
    }

    // 2. Ambil permissions dari role user
    let permissions = user.role?.permissions;

    if (!permissions) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki izin akses untuk tindakan ini.',
      });
    }

    // Jika permissions tersimpan sebagai JSON string / array
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch {
        permissions = [permissions];
      }
    }

    if (!Array.isArray(permissions)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki izin akses untuk tindakan ini.',
      });
    }

    // 3. Cek apakah ada wildcard superadmin ("*")
    if (permissions.includes('*')) {
      return next();
    }

    // 4. Cek apakah ada exact match (contoh: "users:view")
    if (permissions.includes(permissionKey)) {
      return next();
    }

    // 5. Cek apakah ada prefix wildcard (contoh: "users:*" untuk "users:view")
    const [domain] = permissionKey.split(':');
    if (domain && permissions.includes(`${domain}:*`)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Anda tidak memiliki izin akses untuk tindakan ini.',
    });
  };
};
