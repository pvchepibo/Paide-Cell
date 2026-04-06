import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory store for demo purposes (In production use a database like Firestore)
  const transactions: Record<string, any> = {};

  // --- API ROUTES ---

  // 1. CASH Transaction (Direct to Digiflazz)
  app.post("/api/transaction/cash", async (req, res) => {
    const { customerId, product } = req.body;
    const transactionId = `CASH-${Date.now()}`;

    try {
      const username = process.env.DIGIFLAZZ_USERNAME || "dummy_sementara";
      const apiKey = process.env.DIGIFLAZZ_API_KEY || "dummy_sementara";
      
      // Digiflazz Signature: md5(username + api_key + ref_id)
      const sign = crypto.createHash('md5').update(`${username}${apiKey}${transactionId}`).digest('hex');

      const payload = {
        username,
        buyer_sku_code: product.id,
        customer_no: customerId,
        ref_id: transactionId,
        sign: sign
      };

      console.log("Calling Digiflazz (CASH) with:", payload);
      
      // In real scenario: 
      // const response = await axios.post('https://api.digiflazz.com/v1/transaction', payload);
      // if (response.data.data.status === 'Gagal') throw new Error(response.data.data.message);

      transactions[transactionId] = {
        id: transactionId,
        customerId,
        product,
        method: "CASH",
        status: "SUCCESS",
        timestamp: new Date().toISOString()
      };

      return res.json({ success: true, transactionId, message: "Transaksi Berhasil" });
    } catch (error: any) {
      console.error("Digiflazz Error:", error.message);
      return res.status(500).json({ success: false, message: error.message || "Gagal memproses ke supplier" });
    }
  });

  // 2. QRIS Transaction (Duitku Inquiry)
  app.post("/api/transaction/qris", async (req, res) => {
    const { customerId, product } = req.body;
    const transactionId = `QRIS-${Date.now()}`;

    try {
      const merchantCode = process.env.DUITKU_MERCHANT_CODE || "DS29393";
      const apiKey = process.env.DUITKU_API_KEY || "9b9b83b59d344945500389e2759bc010";
      const amount = product.price;
      
      // Duitku Signature: md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
      const signature = crypto
        .createHash("md5")
        .update(merchantCode + transactionId + amount + apiKey)
        .digest("hex");

      const payload = {
        merchantCode,
        paymentAmount: amount,
        merchantOrderId: transactionId,
        productDetails: product.name,
        email: "customer@marturia.com",
        paymentMethod: "LQ", // LQ for QRIS
        signature,
        callbackUrl: `${process.env.APP_URL}/api/webhooks/duitku`,
        returnUrl: `${process.env.APP_URL}/payment-success`,
      };

      console.log("Calling Duitku Inquiry with:", payload);
      
      // In real scenario:
      // const response = await axios.post('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', payload);
      // const qrString = response.data.qrString;
      
      // Mocking Duitku Response
      const mockQrString = `00020101021126670016ID.CO.DUITKU.WWW01189360044700000000000215${transactionId}5204000053033605405${amount}5802ID5914MARTURIA_ABASI6006PAPUA6105999996304ABCD`;
      
      transactions[transactionId] = {
        id: transactionId,
        customerId,
        product,
        method: "QRIS",
        status: "PENDING",
        qrString: mockQrString,
        timestamp: new Date().toISOString()
      };

      return res.json({
        success: true,
        transactionId,
        qrString: mockQrString,
      });
    } catch (error: any) {
      console.error("Duitku Error:", error.message);
      return res.status(500).json({ success: false, message: "Gagal membuat transaksi Duitku" });
    }
  });

  // 3. Check Status & Execute Digiflazz if Paid
  app.get("/api/transaction/status/:id", async (req, res) => {
    const transactionId = req.params.id;
    const transaction = transactions[transactionId];

    if (!transaction) {
      console.log(`Status Check: Transaction ${transactionId} not found`);
      return res.status(404).json({ message: "Transaksi tidak ditemukan" });
    }

    // If already success, just return
    if (transaction.status === "SUCCESS") return res.json({ status: "SUCCESS" });

    try {
      // For Demo: Simulate payment success after 15 seconds
      const elapsed = (Date.now() - new Date(transaction.timestamp).getTime()) / 1000;
      if (elapsed > 15 && transaction.status === "PENDING") {
        console.log(`Auto-Simulating Payment success for ${transactionId} after 15s`);
        transaction.status = "SUCCESS";
      }

      res.json({ status: transaction.status });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengecek status" });
    }
  });

  // 4. Force Success (For Testing)
  app.post("/api/transaction/simulate-success/:id", (req, res) => {
    const transactionId = req.params.id;
    const transaction = transactions[transactionId];

    if (!transaction) return res.status(404).json({ message: "Not found" });

    console.log(`Manual Simulation: Forcing SUCCESS for ${transactionId}`);
    transaction.status = "SUCCESS";
    res.json({ success: true, status: "SUCCESS" });
  });

  // 5. Digiflazz Balance
  app.get("/api/supplier/balance", async (req, res) => {
    try {
      const username = process.env.DIGIFLAZZ_USERNAME || "dummy_sementara";
      const apiKey = process.env.DIGIFLAZZ_API_KEY || "dummy_sementara";
      const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');

      const payload = {
        username,
        key: apiKey,
        sign: sign
      };

      console.log("Checking Digiflazz Balance with:", payload);
      // In real scenario: const response = await axios.post('https://api.digiflazz.com/v1/cek-saldo', payload);
      
      return res.json({ success: true, balance: 1250000 }); // Mock balance
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal cek saldo" });
    }
  });

  // 6. Duitku Webhook (Real-world use)
  app.post("/api/webhooks/duitku", async (req, res) => {
    const { merchantCode, amount, merchantOrderId, signature, resultCode } = req.body;
    const apiKey = process.env.DUITKU_API_KEY || "9b9b83b59d344945500389e2759bc010";

    // Verify signature: md5(merchantCode + amount + merchantOrderId + apiKey)
    const calcSignature = crypto
      .createHash("md5")
      .update(merchantCode + amount + merchantOrderId + apiKey)
      .digest("hex");

    if (signature === calcSignature && resultCode === "00") {
      const transaction = transactions[merchantOrderId];
      if (transaction && transaction.status === "PENDING") {
        console.log(`Duitku Payment received for ${merchantOrderId}. Executing order...`);
        transaction.status = "PAID";
        
        // Simulate calling Digiflazz
        setTimeout(() => {
           transaction.status = "SUCCESS";
        }, 2000);
      }
    }

    res.send("OK");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
