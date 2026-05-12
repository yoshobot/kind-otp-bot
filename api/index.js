export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { body } = req;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const FASTBIT_API_KEY = process.env.FASTBIT_API_KEY; 
  const FIREBASE_URL = process.env.FIREBASE_URL || "https://db-kind-otp-default-rtdb.asia-southeast1.firebasedatabase.app";

  const sendTelegram = async (method, data) => {
    return fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  };

  const dbGet = async (path) => {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`);
    return response.json();
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

  const fastbitApi = async (endpoint) => {
    const response = await fetch(`https://fastbit.co.id/api${endpoint}`, {
      headers: { "X-API-KEY": FASTBIT_API_KEY }
    });
    const textData = await response.text();
    try {
      return JSON.parse(textData);
    } catch (e) {
      throw new Error(`Respon Fastbit bukan JSON! Isinya: ${textData.substring(0, 50)}...`);
    }
  };

  try {
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text;
      const username = body.message.chat.username || body.message.chat.first_name || "User";

      if (text === "/start") {
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
        return res.status(200).send('OK');
      }
    }

    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;
      const data = body.callback_query.data;
      const callbackId = body.callback_query.id;

      await sendTelegram("answerCallbackQuery", { callback_query_id: callbackId });

      let user = await dbGet(`users/${chatId}`);
      if (!user) {
        user = { username: "User", saldo: 0 };
        await dbPut(`users/${chatId}`, user);
      }
      const userSaldo = Number(user.saldo) || 0;

      if (data === "menu_profil") {
        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>👤 PROFIL AKUN</b>\n\n🆔 ID: <code>${chatId}</code>\n👤 Nama: ${user.username}\n💰 Saldo: <b>Rp ${userSaldo.toLocaleString("id-ID")}</b>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "menu_utama" }]] }
        });
      }

      if (data === "menu_deposit") {
        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>💰 ISI SALDO</b>\n\nUntuk mengisi saldo, silakan hubungi Admin di @KontakAdminZione\n\n<i>Sistem otomatis deposit QRIS sedang dalam pengembangan.</i>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "menu_utama" }]] }
        });
      }

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

      // --- RENCANA B: DAFTAR APLIKASI FAVORIT ---
      if (data === "menu_beli") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (activeOrder) {
          await sendTelegram("sendMessage", {
            chat_id: chatId,
            text: "⚠️ <b>Kamu masih memiliki pesanan aktif!</b>\nSilakan selesaikan atau batalkan pesanan sebelumnya.",
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "Cek Pesanan Aktif", callback_data: "cek_pesanan" }]] }
          });
          return res.status(200).send('OK');
        }

        // DATABASE ID APLIKASI FASTBIT
        const layananFavorit = [
          { id: "1213", name: "WhatsApp" }, // <-- Menggunakan asumsi ID 1213 dari dokumen Fastbit!
          { id: "1224", name: "Telegram" }, // <-- Ini tebakan, tolong cari ID aslinya di browser nanti!
          { id: "786", name: "Instagram" }, // Sesuai dokumentasi
          { id: "544", name: "Facebook" }   // Sesuai dokumentasi
        ];

        const rows = layananFavorit.map(item => {
          return [{ text: item.name, callback_data: `list_country_${item.id}_${item.name}` }];
        });
        rows.push([{ text: "🔙 Kembali", callback_data: "menu_utama" }]);

        await sendTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `<b>🛒 PILIH APLIKASI</b>\n\nSaldo Anda: Rp ${userSaldo.toLocaleString("id-ID")}\nPilih aplikasi yang ingin dibeli:`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: rows }
        });
      }

      // --- MENCARI NEGARA (SESUAI GAMBAR 2: Get Countries) ---
      if (data.startsWith("list_country_")) {
        const parts = data.split("_");
        const appId = parts[2];
        const appName = parts[3];
        
        await sendTelegram("sendMessage", { chat_id: chatId, text: `⏳ Mencari negara & harga untuk ${appName}...` });

        // Tembak endpoint Get Countries
        const fbCountries = await fastbitApi(`/services/countries?application_id=${appId}`);
        
        if (fbCountries.status === "success" && Array.isArray(fbCountries.countries)) {
          const availableCountries = fbCountries.countries.filter(c => Number(c.stock) > 0).slice(0, 10);

          if (availableCountries.length === 0) {
            await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Maaf, stok nomor ${appName} sedang kosong di semua negara.` });
            return res.status(200).send('OK');
          }

          const rows = availableCountries.map(c => {
            return [{ 
              text: `${c.name} (${c.price_formatted}) - Stok: ${c.stock}`, 
              callback_data: `buy_${c.id}_${c.price}_${appName}` // c.id di sini adalah otp_service_id!
            }];
          });

          rows.push([{ text: "🔙 Ganti Aplikasi", callback_data: "menu_beli" }]);

          await sendTelegram("sendMessage", {
            chat_id: chatId,
            text: `<b>🌍 PILIH NEGARA (${appName})</b>\n\nSilakan pilih negara penyedia nomor:`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: rows }
          });
        } else {
          await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Gagal mengambil data negara. (Mungkin ID Aplikasi ${appId} salah/tidak valid di server Fastbit).` });
        }
      }

      // --- EKSEKUSI PEMBELIAN (SESUAI GAMBAR 5: Generate Order) ---
      if (data.startsWith("buy_")) {
        const parts = data.split("_");
        const otpServiceId = parts[1]; 
        const price = parseInt(parts[2]);
        const serviceName = parts[3];

        if (userSaldo < price) {
          await sendTelegram("sendMessage", { chat_id: chatId, text: "❌ Saldo kamu tidak mencukupi untuk membeli layanan ini." });
          return res.status(200).send('OK');
        }

        await sendTelegram("sendMessage", { chat_id: chatId, text: "⏳ Memproses pembelian nomor ke Fastbit..." });

        const fbRes = await fastbitApi(`/virtual-number/generate-order-v2?otp_service_id=${otpServiceId}&quantity=1`);
        
        if (fbRes.success) {
          const orderUuid = fbRes.data.results[0].order_uuid;
          const number = fbRes.data.results[0].number || "Menunggu Nomor..."; 

          user.saldo = userSaldo - price;
          await dbPut(`users/${chatId}`, user);

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
            text: `✅ <b>PESANAN BERHASIL</b>\n\nLayanan: ${serviceName}\nNomor HP: <code>${number}</code>\n\n<i>Klik nomor di atas untuk menyalin. Setelah OTP masuk ke nomor tersebut, segera klik tombol Cek Pesan.</i>`,
            parse_mode: "HTML",
            reply_markup: orderMarkup
          });
        } else {
           await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Gagal order: ${fbRes.message || "Stok habis / Server penuh."}` });
        }
      }

      // --- CEK OTP MASUK (SESUAI GAMBAR 6: Get Order Details) ---
      if (data === "cek_pesanan") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (!activeOrder) {
          await sendTelegram("sendMessage", { chat_id: chatId, text: "Tidak ada pesanan aktif yang sedang berjalan." });
          return res.status(200).send('OK');
        }

        const fbRes = await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}`);

        if (fbRes.success && fbRes.data) {
           const smsList = fbRes.data.sms; 
           
           if (smsList && smsList.length > 0) {
             const kodeOtp = smsList[0]; 
             
             // SESUAI GAMBAR 8: Finish Order
             await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}/finish`);
             await dbDelete(`active_orders/${chatId}`);

             await sendTelegram("sendMessage", {
               chat_id: chatId,
               text: `🔔 <b>KODE OTP MASUK!</b>\n\nLayanan: ${activeOrder.service_name}\nNomor: <code>${fbRes.data.formatted_number || fbRes.data.number}</code>\nPesan/Kode:\n\n<code>${kodeOtp}</code>\n\n<i>Transaksi selesai. Terima kasih!</i>`,
               parse_mode: "HTML"
             });
           } else {
             await sendTelegram("sendMessage", { chat_id: chatId, text: "⏳ Belum ada SMS/OTP yang masuk. Tunggu beberapa detik lalu klik cek lagi." });
           }
        } else {
           await sendTelegram("sendMessage", { chat_id: chatId, text: "⏳ Sedang memproses ke server Fastbit, silahkan klik cek lagi..." });
        }
      }

      // --- BATALKAN PESANAN (SESUAI GAMBAR 7: Cancel Order) ---
      if (data === "batal_pesanan") {
        const activeOrder = await dbGet(`active_orders/${chatId}`);
        if (!activeOrder) {
          await sendTelegram("sendMessage", { chat_id: chatId, text: "Tidak ada pesanan aktif." });
          return res.status(200).send('OK');
        }

        const fbRes = await fastbitApi(`/virtual-number/orders/${activeOrder.order_uuid}/cancel`);

        if (fbRes.success) {
          user.saldo = userSaldo + activeOrder.price;
          await dbPut(`users/${chatId}`, user);
          await dbDelete(`active_orders/${chatId}`);

          await sendTelegram("sendMessage", { chat_id: chatId, text: "✅ Pesanan berhasil dibatalkan. Saldo telah dikembalikan utuh ke akun kamu." });
        } else {
          await sendTelegram("sendMessage", { chat_id: chatId, text: `❌ Gagal membatalkan: ${fbRes.message || "Pastikan sudah lewat 3 menit setelah order sebelum membatalkan."}` });
        }
      }
    }

  } catch (error) {
    console.error("Error Sistem:", error);
    const targetChatId = body?.callback_query?.message?.chat?.id || body?.message?.chat?.id;
    if (targetChatId) {
      await sendTelegram("sendMessage", { 
        chat_id: targetChatId, 
        text: `🚨 <b>SISTEM CRASH DETECTED!</b>\n\nPesan Error:\n<code>${error.message}</code>`, 
        parse_mode: "HTML" 
      });
    }
  }

  return res.status(200).send('OK');
}
