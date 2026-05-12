export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { body } = req;
    
    // Memastikan ada pesan teks yang masuk dari Telegram
    if (body && body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const pesan = body.message.text;
      const token = "8288745014:AAEVCvN8CBMTaz6UaCNYGD-Q2amvtl648-8";
      let balasan = "Maaf, perintah tidak dikenali. Silakan ketik /start.";

      // Logika balasan bot Zione Cell
      if (pesan === "/start") {
        balasan = "Halo! Selamat datang di layanan OTP otomatis Zione Cell 🚀\n\nKetik /otp untuk mendapatkan kode verifikasi baru.";
      } else if (pesan === "/otp") {
        const otp = Math.floor(100000 + Math.random() * 900000);
        balasan = `Kode OTP kamu adalah: *${otp}*\n\n_Kode ini rahasia, jangan berikan kepada siapapun, termasuk admin._`;
      }

      // Eksekusi kirim pesan ke Telegram
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: balasan,
          parse_mode: "Markdown"
        })
      });
    }
  }
  // Respons standar Vercel
  res.status(200).send("Bot Zione Cell Aktif di Vercel!");
}
