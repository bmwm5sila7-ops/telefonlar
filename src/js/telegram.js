const TELEGRAM_BOT_TOKEN = '8822047657:AAHCv6mUM1By67S-X03TAUYWRzTI-lXLRew';
const TELEGRAM_CHANNEL_ID = '-1004334235880';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(amount) {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

export function buildOrderMessage(order) {
  const lines = [
    `<b>YANGI BUYURTMA #${escapeHtml(order.orderId)}</b>`,
    `<i>Samo Mobile — 3D Smartfonlar Do'koni</i>`,
    '',
    `<b>Mijoz:</b> ${escapeHtml(order.customerName)}`,
    `<b>Telefon:</b> <code>${escapeHtml(order.phone)}</code>`,
    `<b>Hudud:</b> ${escapeHtml(order.region)}`,
    `<b>Manzil:</b> ${escapeHtml(order.address)}`,
    `<b>To'lov turi:</b> ${escapeHtml(order.paymentMethod)}`,
    ''
  ];

  lines.push('<b>Buyurtma tarkibi:</b>');
  order.items.forEach((item, index) => {
    const subtotal = item.price * item.qty;
    lines.push(
      `${index + 1}. <b>${escapeHtml(item.name)}</b> (${escapeHtml(item.storage)}, ${escapeHtml(item.colorName)}) — ${item.qty} dona × ${formatPrice(item.price)} = <b>${formatPrice(subtotal)}</b>`
    );
  });

  lines.push('');
  lines.push(`<b>Jami summa:</b> <code>${formatPrice(order.totalAmount)}</code>`);

  if (order.note && order.note.trim()) {
    lines.push(`<b>Izoh:</b> ${escapeHtml(order.note.trim())}`);
  }

  lines.push('');
  lines.push(`<i>Vaqt: ${escapeHtml(order.timestamp)}</i>`);

  return lines.join('\n');
}

export async function sendOrderToTelegram(order) {
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const text = buildOrderMessage(order);

  const body = new URLSearchParams({
    chat_id: TELEGRAM_CHANNEL_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: 'true'
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    body
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || !data.ok) {
    const reason =
      (data && data.description) ||
      `Telegram server xatosi (${response.status || 'tarmoq xatosi'})`;
    throw new Error(reason);
  }

  return data.result;
}
