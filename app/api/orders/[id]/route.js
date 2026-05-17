import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const orders = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return Response.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    const order = orders[0];
    // Map fields for backward compatibility and frontend expectations
    const mappedOrder = {
      ...order,
      phone: order.customer_phone || order.phone || '',
      address: order.customer_address || order.address || '',
      total: order.total_amount !== undefined ? Number(order.total_amount) : (order.total !== undefined ? Number(order.total) : 0),
      order_status: order.status || order.order_status || 'pending',
      payment_status: order.payment_status || (order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'paid' : 'pending'),
    };

    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [id]);
    const mappedItems = items.map(item => ({
      ...item,
      qty: item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 1),
      subtotal: item.subtotal !== undefined ? Number(item.subtotal) : (item.price * (item.quantity || item.qty || 1))
    }));

    return Response.json({ success: true, data: { ...mappedOrder, items: mappedItems } });
  } catch (error) {
    console.error('GET Order Error:', error);
    return Response.json({ success: false, error: 'Failed to retrieve order' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { order_status, payment_status } = await request.json();
    
    // In our actual database, order_status is 'status', and payment_status is not a column.
    // We update the 'status' column.
    await query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [order_status, id]
    );
    return Response.json({ success: true });
  } catch (error) {
    console.error('PUT Order Error:', error);
    return Response.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

