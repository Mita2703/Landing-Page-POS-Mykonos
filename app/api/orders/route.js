import pool from '@/lib/db';
import { generateOrderCode } from '@/lib/utils';

export async function POST(request) {
  let conn;
  try {
    const body = await request.json();
    const { customer_name, phone, address, city, payment_method, notes, items, total } = body;

    if (!customer_name || !phone || !address || !payment_method || !items?.length) {
      return Response.json({ success: false, error: 'Data tidak lengkap' }, { status: 400 });
    }

    const orderCode = generateOrderCode();

    // Gunakan satu koneksi agar SET FOREIGN_KEY_CHECKS berlaku pada session yang sama
    conn = await pool.getConnection();

    // Insert order — sesuai struktur tabel DB yang sebenarnya:
    // order_number: UNIQUE NOT NULL — pakai orderCode supaya unik tiap transaksi
    // customer_email: NOT NULL — form tidak ada field email, kirim string kosong
    // customer_phone, customer_address, total_amount (bukan phone, address, total)
    const [result] = await conn.execute(
      `INSERT INTO orders (order_code, order_number, customer_name, customer_email, customer_phone, customer_address, payment_method, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderCode, orderCode, customer_name, '', phone, address + (city ? `, ${city}` : ''), payment_method, total, notes || '']
    );

    const orderId = result.insertId;

    if (!orderId) {
      throw new Error('Gagal mendapatkan ID pesanan setelah insert');
    }

    // Disable FK check pada koneksi yang sama agar product_id tidak perlu ada di tabel products
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const item of items) {
      // order_items: kolom qty di DB bernama "quantity"
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.id, item.name, item.qty, item.price, item.price * item.qty]
      );
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();

    return Response.json({
      success: true,
      data: { id: orderId, order_code: orderCode, payment_method },
    });
  } catch (error) {
    if (conn) conn.release();
    console.error('Order Error:', error.message, error.code, error.sqlMessage);
    return Response.json(
      { success: false, error: 'Gagal membuat pesanan', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, GROUP_CONCAT(oi.product_name SEPARATOR ', ') as products
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );

    const mappedOrders = orders.map(order => ({
      ...order,
      phone: order.customer_phone || order.phone || '',
      address: order.customer_address || order.address || '',
      total: order.total_amount !== undefined ? Number(order.total_amount) : (order.total !== undefined ? Number(order.total) : 0),
      order_status: order.status || order.order_status || 'pending',
      payment_status: order.payment_status || (order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'paid' : 'pending'),
    }));

    return Response.json({ success: true, data: mappedOrders });
  } catch (error) {
    console.error('DB Error:', error);
    return Response.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}
