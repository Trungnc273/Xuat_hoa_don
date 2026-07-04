import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu gieo dữ liệu mẫu (seeding)...');

  // 1. Tạo các Quyền (Permissions)
  const permissionsData = [
    // Khách hàng (Customer)
    { action: 'ALL', subject: 'Customer', description: 'Toàn quyền quản lý khách hàng' },
    { action: 'READ', subject: 'Customer', description: 'Xem thông tin khách hàng' },
    { action: 'CREATE', subject: 'Customer', description: 'Thêm mới khách hàng' },
    { action: 'UPDATE', subject: 'Customer', description: 'Cập nhật khách hàng' },
    { action: 'DELETE', subject: 'Customer', description: 'Xóa khách hàng' },

    // Nhà cung cấp (Supplier)
    { action: 'ALL', subject: 'Supplier', description: 'Toàn quyền quản lý nhà cung cấp' },
    { action: 'READ', subject: 'Supplier', description: 'Xem thông tin nhà cung cấp' },
    { action: 'CREATE', subject: 'Supplier', description: 'Thêm mới nhà cung cấp' },
    { action: 'UPDATE', subject: 'Supplier', description: 'Cập nhật nhà cung cấp' },
    { action: 'DELETE', subject: 'Supplier', description: 'Xóa nhà cung cấp' },

    // Sản phẩm (Product)
    { action: 'ALL', subject: 'Product', description: 'Toàn quyền quản lý sản phẩm' },
    { action: 'READ', subject: 'Product', description: 'Xem danh sách sản phẩm' },
    { action: 'CREATE', subject: 'Product', description: 'Thêm mới sản phẩm' },
    { action: 'UPDATE', subject: 'Product', description: 'Cập nhật sản phẩm' },
    { action: 'DELETE', subject: 'Product', description: 'Xóa sản phẩm' },

    // Báo giá (Quotation)
    { action: 'ALL', subject: 'Quotation', description: 'Toàn quyền quản lý báo giá' },
    { action: 'READ', subject: 'Quotation', description: 'Xem báo giá' },
    { action: 'CREATE', subject: 'Quotation', description: 'Tạo báo giá' },
    { action: 'UPDATE', subject: 'Quotation', description: 'Sửa báo giá' },
    { action: 'DELETE', subject: 'Quotation', description: 'Xóa báo giá' },

    // Hóa đơn (Invoice)
    { action: 'ALL', subject: 'Invoice', description: 'Toàn quyền quản lý hóa đơn' },
    { action: 'READ', subject: 'Invoice', description: 'Xem hóa đơn' },
    { action: 'CREATE', subject: 'Invoice', description: 'Tạo hóa đơn' },
    { action: 'UPDATE', subject: 'Invoice', description: 'Sửa hóa đơn' },
    { action: 'DELETE', subject: 'Invoice', description: 'Xóa hóa đơn' },

    // Phiếu thu (Receipt)
    { action: 'ALL', subject: 'Receipt', description: 'Toàn quyền quản lý phiếu thu' },
    { action: 'READ', subject: 'Receipt', description: 'Xem phiếu thu' },
    { action: 'CREATE', subject: 'Receipt', description: 'Tạo phiếu thu' },

    // Phiếu chi (Payment)
    { action: 'ALL', subject: 'Payment', description: 'Toàn quyền quản lý phiếu chi' },
    { action: 'READ', subject: 'Payment', description: 'Xem phiếu chi' },
    { action: 'CREATE', subject: 'Payment', description: 'Tạo phiếu chi' },

    // Chi phí (Expense)
    { action: 'ALL', subject: 'Expense', description: 'Toàn quyền quản lý chi phí' },
    { action: 'READ', subject: 'Expense', description: 'Xem chi phí khác' },
    { action: 'CREATE', subject: 'Expense', description: 'Tạo chi phí khác' },

    // Kho hàng (Warehouse)
    { action: 'ALL', subject: 'Warehouse', description: 'Toàn quyền quản lý kho' },
    { action: 'READ', subject: 'Warehouse', description: 'Xem tồn kho và dịch chuyển kho' },
    { action: 'ADJUST', subject: 'Warehouse', description: 'Điều chỉnh kho hàng' },

    // Cài đặt (Setting)
    { action: 'ALL', subject: 'Setting', description: 'Thay đổi cài đặt hệ thống doanh nghiệp' },

    // Nhật ký hoạt động (ActivityLog)
    { action: 'READ', subject: 'ActivityLog', description: 'Xem nhật ký hoạt động hệ thống' },
  ];

  console.log('Đang khởi tạo các quyền...');
  const permissions: any[] = [];
  for (const item of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: {
        id: `${item.action}_${item.subject}` // ID tạm để tránh trùng lặp
      },
      update: {},
      create: {
        id: `${item.action}_${item.subject}`,
        action: item.action,
        subject: item.subject,
        description: item.description,
      },
    });
    permissions.push(perm);
  }

  // 2. Tạo các Vai trò (Roles)
  console.log('Đang khởi tạo các vai trò...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Quản trị viên toàn quyền hệ thống' },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Quản lý vận hành (Khách hàng, Sản phẩm, Kho, Chứng từ)' },
  });

  const accountantRole = await prisma.role.upsert({
    where: { name: 'ACCOUNTANT' },
    update: {},
    create: { name: 'ACCOUNTANT', description: 'Kế toán (Quản lý hóa đơn, công nợ, thu chi, báo cáo tài chính)' },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: { name: 'STAFF', description: 'Nhân viên kinh doanh (Xem sản phẩm, khách hàng, tạo báo giá)' },
  });

  // 3. Liên kết quyền cho Vai trò (Role permissions)
  console.log('Đang liên kết quyền cho các vai trò...');
  
  // ADMIN lấy tất cả quyền
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // MANAGER: Quản lý khách hàng, nhà cung cấp, sản phẩm, báo giá, hóa đơn, kho hàng
  const managerPerms = permissions.filter(p => 
    ['Customer', 'Supplier', 'Product', 'Quotation', 'Invoice', 'Warehouse'].includes(p.subject)
  );
  for (const perm of managerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: managerRole.id, permissionId: perm.id },
    });
  }

  // ACCOUNTANT: Quản lý hóa đơn, phiếu thu, phiếu chi, chi phí và xem khách hàng, nhà cung cấp
  const accountantPerms = permissions.filter(p => 
    ['Invoice', 'Receipt', 'Payment', 'Expense'].includes(p.subject) ||
    (['Customer', 'Supplier'].includes(p.subject) && p.action === 'READ')
  );
  for (const perm of accountantPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: accountantRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: accountantRole.id, permissionId: perm.id },
    });
  }

  // STAFF: Xem sản phẩm, khách hàng. Tạo/sửa/xem báo giá. Xem/tạo hóa đơn.
  const staffPerms = permissions.filter(p => 
    (['Customer', 'Product'].includes(p.subject) && ['READ', 'CREATE', 'UPDATE'].includes(p.action)) ||
    (p.subject === 'Quotation' && ['READ', 'CREATE', 'UPDATE'].includes(p.action)) ||
    (p.subject === 'Invoice' && ['READ', 'CREATE'].includes(p.action))
  );
  for (const perm of staffPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: perm.id },
    });
  }

  // 4. Tạo tài khoản người dùng mặc định
  console.log('Đang khởi tạo tài khoản người dùng...');
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('admin123', saltRounds);
  const managerPasswordHash = await bcrypt.hash('manager123', saltRounds);
  const accountantPasswordHash = await bcrypt.hash('accountant123', saltRounds);
  const staffPasswordHash = await bcrypt.hash('staff123', saltRounds);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: adminPasswordHash, roleId: adminRole.id },
    create: {
      username: 'admin',
      email: 'admin@company.com',
      password: adminPasswordHash,
      roleId: adminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'manager' },
    update: { password: managerPasswordHash, roleId: managerRole.id },
    create: {
      username: 'manager',
      email: 'manager@company.com',
      password: managerPasswordHash,
      roleId: managerRole.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'accountant' },
    update: { password: accountantPasswordHash, roleId: accountantRole.id },
    create: {
      username: 'accountant',
      email: 'accountant@company.com',
      password: accountantPasswordHash,
      roleId: accountantRole.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'staff' },
    update: { password: staffPasswordHash, roleId: staffRole.id },
    create: {
      username: 'staff',
      email: 'staff@company.com',
      password: staffPasswordHash,
      roleId: staffRole.id,
    },
  });

  // 5. Cài đặt công ty mặc định
  console.log('Đang khởi tạo cấu hình công ty...');
  const existingSetting = await prisma.setting.findFirst();
  if (!existingSetting) {
    await prisma.setting.create({
      data: {
        companyName: 'Công ty Cổ phần Giải pháp Công nghệ Việt Nam',
        taxCode: '0101234567',
        address: 'Số 123 Đường Trần Hưng Đạo, Quận Hoàn Kiếm, Hà Nội',
        email: 'info@soltech.com.vn',
        phone: '024 3999 8888',
        website: 'https://soltech.com.vn',
        bankAccount: 'VCB - 1012999999 - CONG TY CP GIAI PHAP CONG NGHE VIET NAM',
        representative: 'Nguyễn Văn A - Giám đốc',
      },
    });
  }

  // 6. Danh mục sản phẩm (Categories)
  console.log('Đang khởi tạo danh mục sản phẩm...');
  const catElectronics = await prisma.category.upsert({
    where: { name: 'Thiết bị điện tử' },
    update: {},
    create: { name: 'Thiết bị điện tử', description: 'Máy tính, điện thoại, phụ kiện' },
  });

  const catOffice = await prisma.category.upsert({
    where: { name: 'Văn phòng phẩm' },
    update: {},
    create: { name: 'Văn phòng phẩm', description: 'Giấy in, bút viết, bìa hồ sơ' },
  });

  const catSoftware = await prisma.category.upsert({
    where: { name: 'Dịch vụ phần mềm' },
    update: {},
    create: { name: 'Dịch vụ phần mềm', description: 'Hosting, Domain, Phần mềm SaaS' },
  });

  // 7. Kho hàng (Warehouses)
  console.log('Đang khởi tạo nhà kho...');
  const whMain = await prisma.warehouse.upsert({
    where: { code: 'KHO000001' },
    update: {},
    create: { code: 'KHO000001', name: 'Kho trung tâm', address: 'Khu công nghiệp Từ Liêm, Hà Nội', description: 'Kho chứa sản phẩm chính' },
  });

  const whSub = await prisma.warehouse.upsert({
    where: { code: 'KHO000002' },
    update: {},
    create: { code: 'KHO000002', name: 'Kho phụ miền Nam', address: 'Quận 12, TP. Hồ Chí Minh', description: 'Kho trung chuyển phía Nam' },
  });

  // 8. Sản phẩm mẫu (Products)
  console.log('Đang khởi tạo sản phẩm...');
  const p1 = await prisma.product.upsert({
    where: { code: 'SP000001' },
    update: {},
    create: {
      code: 'SP000001',
      sku: 'LAP-DELL-5520',
      barcode: '8936012345671',
      name: 'Laptop Dell Latitude 5520 i5',
      categoryId: catElectronics.id,
      importPrice: 12500000,
      salePrice: 16800000,
      vatRate: 10,
      unit: 'Chiếc',
      stock: 15,
      description: 'Laptop Dell văn phòng cao cấp, RAM 8GB, SSD 256GB',
    },
  });

  const p2 = await prisma.product.upsert({
    where: { code: 'SP000002' },
    update: {},
    create: {
      code: 'SP000002',
      sku: 'PAP-DoubleA-A4',
      barcode: '8936012345672',
      name: 'Giấy Double A A4 70gsm',
      categoryId: catOffice.id,
      importPrice: 55000,
      salePrice: 75000,
      vatRate: 10,
      unit: 'Ram',
      stock: 120,
      description: 'Giấy in văn phòng chất lượng cao Thái Lan',
    },
  });

  const p3 = await prisma.product.upsert({
    where: { code: 'SP000003' },
    update: {},
    create: {
      code: 'SP000003',
      sku: 'SWS-HOST-PRO',
      barcode: '8936012345673',
      name: 'Dịch vụ Web Hosting Pro 1 Năm',
      categoryId: catSoftware.id,
      importPrice: 800000,
      salePrice: 1200000,
      vatRate: 10,
      unit: 'Gói',
      stock: 9999, // Dịch vụ phần mềm không giới hạn kho thực tế nhưng set số lớn
      description: 'Gói Web Hosting cao cấp 10GB dung lượng SSD cho doanh nghiệp',
    },
  });

  // 9. Khách hàng mẫu (Customers)
  console.log('Đang khởi tạo khách hàng mẫu...');
  const c1 = await prisma.customer.upsert({
    where: { code: 'KH000001' },
    update: {},
    create: {
      code: 'KH000001',
      name: 'Nguyễn Trần Khánh Anh',
      company: 'Công ty TNHH Thương mại Dịch vụ Nam Á',
      taxCode: '0315482619',
      address: 'Số 45 Đường CMT8, Quận 3, TP. Hồ Chí Minh',
      email: 'khanhanh.namaservice@gmail.com',
      phone: '0909123456',
      contactPerson: 'Ms. Khánh Anh',
      note: 'Khách hàng thân thiết khu vực phía Nam',
    },
  });

  const c2 = await prisma.customer.upsert({
    where: { code: 'KH000002' },
    update: {},
    create: {
      code: 'KH000002',
      name: 'Trần Minh Hoàng',
      company: 'Tập đoàn Đầu tư & Xây dựng Việt Phát',
      taxCode: '0109283746',
      address: 'Khu đô thị Trung Hòa - Nhân Chính, Cầu Giấy, Hà Nội',
      email: 'hoangtm.vietphatgroup@gmail.com',
      phone: '0987654321',
      contactPerson: 'Mr. Trần Minh Hoàng',
      note: 'Khách hàng lớn mua thiết bị văn phòng',
    },
  });

  // 10. Nhà cung cấp mẫu (Suppliers)
  console.log('Đang khởi tạo nhà cung cấp mẫu...');
  const s1 = await prisma.supplier.upsert({
    where: { code: 'NCC000001' },
    update: {},
    create: {
      code: 'NCC000001',
      name: 'Công ty Cổ phần Máy tính Dell Việt Nam',
      company: 'Dell Vietnam Joint Stock Company',
      taxCode: '0102938475',
      address: 'Tòa nhà Landmark 81, Bình Thạnh, TP. Hồ Chí Minh',
      email: 'support@dell.com.vn',
      phone: '1800 4268',
      contactPerson: 'Mr. Hoàng Lâm (Kinh doanh)',
      note: 'Nhà cung cấp máy tính xách tay Dell chính hãng',
    },
  });

  const s2 = await prisma.supplier.upsert({
    where: { code: 'NCC000002' },
    update: {},
    create: {
      code: 'NCC000002',
      name: 'Tổng kho Văn phòng phẩm Hà Nội',
      company: 'Hanoi Stationary Depot',
      taxCode: '0103847562',
      address: 'Số 99 Đường Láng, Đống Đa, Hà Nội',
      email: 'kho.vpphanoi@gmail.com',
      phone: '024 3512 8888',
      contactPerson: 'Mrs. Thanh Mai',
      note: 'Cung cấp sỉ giấy in và dụng cụ văn phòng phẩm',
    },
  });

  // Ghi nhận lịch sử di chuyển kho ban đầu cho Laptop và Giấy in
  console.log('Ghi nhận tồn kho ban đầu...');
  await prisma.stockMovement.create({
    data: {
      type: 'IN',
      productId: p1.id,
      quantity: 15,
      prevStock: 0,
      newStock: 15,
      warehouseId: whMain.id,
      reason: 'Nhập kho tồn đầu kỳ',
      createdBy: 'admin',
    },
  });

  await prisma.stockMovement.create({
    data: {
      type: 'IN',
      productId: p2.id,
      quantity: 120,
      prevStock: 0,
      newStock: 120,
      warehouseId: whMain.id,
      reason: 'Nhập kho tồn đầu kỳ',
      createdBy: 'admin',
    },
  });

  // Đồng bộ lại bộ đếm mã chứng từ (document_counters) theo mã LỚN NHẤT thực tế sau khi seed.
  // Bắt buộc phải làm bước này: seed tạo sản phẩm/khách hàng/NCC/kho với mã CỨNG (SP000001...),
  // trong khi migration khởi tạo document_counters TRƯỚC khi seed chạy (DB rỗng lúc đó → đếm = 0).
  // Không đồng bộ lại thì lần đầu tạo mới qua UI sẽ sinh trùng mã với dữ liệu mẫu (lỗi P2002).
  console.log('Đồng bộ lại bộ đếm mã chứng từ...');
  const resyncCounter = async (prefix: string, table: string, codeLength: number) => {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "document_counters" ("prefix", "lastNumber")
      VALUES ($1, COALESCE((
        SELECT MAX(CAST(SUBSTRING("code" FROM ${codeLength + 1}) AS INT))
        FROM "${table}" WHERE "code" ~ '^${prefix}[0-9]+$'
      ), 0))
      ON CONFLICT ("prefix") DO UPDATE SET "lastNumber" = GREATEST("document_counters"."lastNumber", EXCLUDED."lastNumber")
    `, prefix);
  };
  await resyncCounter('SP', 'products', 2);
  await resyncCounter('KH', 'customers', 2);
  await resyncCounter('NCC', 'suppliers', 3);
  await resyncCounter('KHO', 'warehouses', 3);
  await resyncCounter('HD', 'invoices', 2);
  await resyncCounter('BG', 'quotations', 2);
  await resyncCounter('PT', 'receipts', 2);
  await resyncCounter('PC', 'payments', 2);
  await resyncCounter('CP', 'expenses', 2);

  console.log('Gieo dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
