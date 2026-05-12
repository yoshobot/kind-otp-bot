export default async function handler(req, res) {
  // Hanya menerima metode POST dari webhook Telegram
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { body } = req;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const FASTBIT_API_KEY = process.env.FASTBIT_API_KEY; // "5HxiNMjDTaXfbxtbK60IBx6eEe22RHV1"
  
  // URL Firebase Kamu
  const FIREBASE_URL = "https://db-kind-otp-default-rtdb.asia-southeast1.firebasedatabase.app";

  // Fungsi Helper Telegram
  const sendTelegram = async (method, data) => {
    return fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  };

  // Fungsi Helper Firebase
  const dbGet = async (path) => {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`);
    return res.json();
  };
  const dbPut = async (path, data) => {
    await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  };
  const dbDelete = async (path) => {
    await fetch(`${FIREBASE_URL}/${path}.json`, { method: "DELETE" });
  };

  // Fungsi Helper Fastbit
  const fastbitApi = async (endpoint) => {
    const res = await fetch(`https://fastbit.co.id/api${endpoint}`, {
      headers: { "X-API-KEY": FASTBIT_API_KEY }
    });
    return res.json();
  };

  try {
    // ==========================================
    // 1. PENANGANAN PESAN TEKS (COMMAND)
    // ==========================================
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text;
      const username = body.message.chat.username || body.message.chat.first_name || "User";

      if (text === "/start") {
        // Cek user di database
        let user = await dbGet(`users/${chatId}`);
        if (!user) {
          user = { username: username, saldo: 0 };
          await dbPut(`users/${chatId}`, user);
        }

        const keyboard = {
          inline_keyboard: [
            [{ text: "👤 Profil", callback_data: "menu_profil" }, { text: "💰 Isi Saldo", callback_data: "menu_deposit" }],
            [{ text: "🛒 Beli Nomor (OTP)", callback_data: "menu_beli" }]
          ]
        };

        await sendTelegram("sendMessage", {
          chat_id: chatId,
          text: `Halo <b>${username}</b>! Selamat datang di Layanan OTP Zione Cell 🚀\n\nSilakan pilih menu di bawah ini:`,
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      }
    }

    // ==========================================
    // 2. PENANGANAN TOMBOL (CALLBACK QUERY)
    // ==========================================
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;
      const data = body.callback_query.data;
      const callbackId = body.callback_query.id;

      // Jawab callback agar loading tombol hilang
      await sendTelegram("answerCallbackQuery", { callback_query_id: callbackId });

      let user = await dbGet(`users/${chatId}`);

      // --- MENU PROFIL ---
      if (data === "menu_profil") {
        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>👤 PROFIL AKUN</b>\n\n🆔 ID: <code>${chatId}</code>\n👤 Nama: ${user.username}\n💰 Saldo: <b>Rp ${user.saldo.toLocaleString("id-ID")}</b>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "menu_utama" }]] }
        });
      }

      // --- MENU DEPOSIT ---
      if (data === "menu_deposit") {
        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>💰 ISI SALDO</b>\n\nUntuk mengisi saldo, silakan hubungi Admin di @KontakAdminZione\n\n<i>Sistem otomatis deposit QRIS sedang dalam pengembangan.</i>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "menu_utama" }]] }
        });
      }

      // --- KEMBALI KE MENU UTAMA ---
      if (data === "menu_utama") {
        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `Silakan pilih menu di bawah ini:`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 Profil", callback_data: "menu_profil" }, { text: "💰 Isi Saldo", callback_data: "menu_deposit" }],
              [{ text: "🛒 Beli Nomor (OTP)", callback_data: "menu_beli" }]
            ]
          }
        });
      }

      // --- MENU BELI NOMOR ---
      if (data === "menu_beli") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (activeOrder) {
          return sendTelegram("sendMessage", {
            chat_id: chatId,
            text: "⚠️ <b>Kamu masih memiliki pesanan aktif!</b>\nSilakan selesaikan atau batalkan pesanan sebelumnya.",
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "Cek Pesanan Aktif", callback_data: "cek_pesanan" }]] }
          });
        }

        // Tampilkan List Layanan (Contoh: ID Fastbit & Harga di-hardcode untuk keamanan performa)
        // Format callback: buy_IDLAYANAN_HARGA_NAMALAYANAN
        const layananKeyboard = {
          inline_keyboard: [
            [{ text: "WhatsApp (Rp 3.500)", callback_data: "buy_139382_3500_WhatsApp" }], // Ganti 139382 dengan ID asli WA Fastbit
            [{ text: "Telegram (Rp 2.500)", callback_data: "buy_12345_2500_Telegram" }], // Ganti ID
            [{ text: "🔙 Kembali", callback_data: "menu_utama" }]
          ]
        };

        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>🛒 BELI NOMOR OTP (INDONESIA)</b>\n\nSaldo Anda: Rp ${user.saldo.toLocaleString("id-ID")}\nPilih layanan aplikasi yang ingin dibeli:`,
          parse_mode: "HTML",
          reply_markup: layananKeyboard
        });
      }

      // --- PROSES PEMBELIAN (ORDER KE FASTBIT) ---
      if (data.startsWith("buy_")) {
        const [_, serviceId, priceStr, serviceName] = data.split("_");
        const price = parseInt(priceStr);

        if (user.saldo < price) {
          return sendTelegram("sendMessage", { chat_id: chatId, text: "❌ Saldo kamu tidak mencukupi untuk membeli layanan ini." });
        }

        await sendTelegram("sendMessage", { chat_id: chatId, text: "⏳ Sedang memproses pesanan ke server..." });

        // Request ke Fastbit
        const fbRes = await fastbitApi(`/virtual-number/generate-order-v2?otp_service_id=${serviceId}&quantity=1`);
        
        if (fbRes.success) {
          const orderUuid = fbRes.data.results[0].order_uuid;
          const number = fbRes.data.results[0].number || "Menunggu Nomor..."; // Sesuaikan jika nomor lgsg muncul

          // Potong Saldo User
          user.saldo -= price;
          await dbPut(`users/${chatId}`, user);

          // Simpan ke pesanan aktif
          await dbPut(`active_orders/${chatId}`, {
            order_uuid: orderUuid,
            service_name: serviceName,
            price: price,
            number: number
          });

          const orderMarkup = {
            inline_keyboard: [
              [{ text: "📩 Cek Pesan SMS (OTP)", callback_data: "cek_pesanan" }],
              [{ text: "❌ Batalkan Pesanan", callback_data: "batal_pesanan" }]
            ]
          };

          await sendTelegram("sendMessage", {
            chat_id: chatId,
            text: `✅ <b>PESANAN BERHASIL</b>\n\nLayanan: ${serviceName}\nNomor HP: <code>${number}</code>\n\n<i>Klik nomor di atas untuk menyalin. Setelah OTP masuk, segera klik Cek Pesan.</i>`,
            parse_mode: "HTML",
            reply_markup: orderMarkup
          });
        } else {
           await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Gagal order: ${fbRes.message || "Stok habis / Server penuh."}` });
        }
      }

      // --- CEK OTP (MENARIK SMS DARI FASTBIT) ---
      if (data === "cek_pesanan") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (!activeOrder) return sendTelegram("sendMessage", { chat_id: chatId, text: "Tidak ada pesanan aktif." });

        const fbRes = await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}`);

        if (fbRes.success && fbRes.data) {
           const smsList = fbRes.data.sms; // Menyesuaikan array SMS Fastbit
           
           if (smsList && smsList.length > 0) {
             const kodeOtp = smsList[0]; // Ambil SMS pertama
             
             // Panggil endpoint finish
             await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}/finish`);
             
             // Hapus dari active_orders
             await dbDelete(`active_orders/${chatId}`);

             await sendTelegram("sendMessage", {
               chat_id: chatId,
               text: `🔔 <b>KODE OTP MASUK!</b>\n\nLayanan: ${activeOrder.service_name}\nNomor: <code>${fbRes.data.formatted_number || fbRes.data.number}</code>\nPesan/Kode: \n\n<code>${kodeOtp}</code>\n\n<i>Transaksi selesai. Terima kasih!</i>`,
               parse_mode: "HTML"
             });
           } else {
             await sendTelegram("sendMessage", { chat_id: chatId, text: "⏳ Belum ada SMS/OTP yang masuk. Silakan tunggu beberapa detik dan klik cek lagi." });
           }
        }
      }

      // --- BATALKAN PESANAN (CANCEL & REFUND) ---
      if (data === "batal_pesanan") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (!activeOrder) return sendTelegram("sendMessage", { chat_id: chatId, text: "Tidak ada pesanan aktif." });

        const fbRes = await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}/cancel`);

        if (fbRes.success) {
          // Kembalikan saldo (Refund)
          user.saldo += activeOrder.price;
          await dbPut(`users/${chatId}`, user);
          
          // Hapus dari active_orders
          await dbDelete(`active_orders/${chatId}`);

          await sendTelegram("sendMessage", { chat_id: chatId, text: "✅ Pesanan berhasil dibatalkan. Saldo telah dikembalikan utuh ke akun kamu." });
        } else {
          await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Gagal membatalkan: ${fbRes.message || "Tunggu minimal 3 menit setelah order sebelum membatalkan."}` });
        }
      }
    }

  } catch (error) {
    console.error("Error:", error);
  }

  // Vercel Serverless wajib mengembalikan respon HTTP 200 agar webhook tidak di-retry terus oleh Telegram
  return res.status(200).send('OK');
}
