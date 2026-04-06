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

  // 1. Create Transaction
  app.post("/api/transactions/create", async (req, res) => {
    const { customerId, product, method } = req.body;
    const transactionId = `TXN-${Date.now()}`;

    if (method === "QRIS") {
      try {
        // Duitku Create Transaction Logic
        const merchantCode = process.env.DUITKU_MERCHANT_CODE || "DS29393";
        const apiKey = process.env.DUITKU_API_KEY || "9b9b83b59d344945500389e2759bc010";
        const amount = product.price;
        const merchantOrderId = transactionId;
        
        // Duitku Signature: md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
        const signature = crypto
          .createHash("md5")
          .update(merchantCode + merchantOrderId + amount + apiKey)
          .digest("hex");

        const payload = {
          merchantCode,
          paymentAmount: amount,
          merchantOrderId,
          productDetails: product.name,
          email: "customer@marturia.com",
          paymentMethod: "SP", // SP is usually for ShopeePay/QRIS in Duitku
          signature,
          callbackUrl: `${process.env.APP_URL}/api/webhooks/duitku`,
          returnUrl: `${process.env.APP_URL}/payment-success`,
        };

        console.log("Calling Duitku with payload:", payload);
        
        // In real scenario: 
        // const response = await axios.post('https://passport.duitku.com/webapi/api/merchant/v2/inquiry', payload);
        // const qrUrl = response.data.qrString; // or paymentUrl
        
        const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=DUITKU-${transactionId}`;
        
        transactions[transactionId] = {
          id: transactionId,
          customerId,
          product,
          method,
          status: "PENDING",
          qrUrl: mockQrUrl,
        };

        return res.json({
          success: true,
          transactionId,
          qrUrl: mockQrUrl,
        });
      } catch (error) {
        console.error("Duitku Error:", error);
        return res.status(500).json({ success: false, message: "Gagal membuat transaksi Duitku" });
      }
    } else {
      // CASH
      transactions[transactionId] = {
        id: transactionId,
        customerId,
        product,
        method,
        status: "PENDING",
      };
      return res.json({ success: true, transactionId });
    }
  });

  // 2. Execute Order (Supplier API - Digiflazz)
  app.post("/api/supplier/order", async (req, res) => {
    const { transactionId } = req.body;
    const transaction = transactions[transactionId];

    if (!transaction) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

    try {
      const username = process.env.DIGIFLAZZ_USERNAME;
      const apiKey = process.env.DIGIFLAZZ_API_KEY;
      const refId = transactionId;
      
      // Digiflazz Signature: md5(username + api_key + ref_id)
      const sign = crypto.createHash('md5').update(`${username}${apiKey}${refId}`).digest('hex');

      const payload = {
        username,
        buyer_sku_code: transaction.product.id,
        customer_no: transaction.customerId,
        ref_id: refId,
        sign: sign
      };

      console.log("Calling Digiflazz with:", payload);
      // In real scenario: await axios.post('https://api.digiflazz.com/v1/transaction', payload);

      transaction.status = "SUCCESS";
      return res.json({ success: true, message: "Produk berhasil dikirim" });
    } catch (error) {
      console.error("Digiflazz Error:", error);
      transaction.status = "FAILED";
      return res.status(500).json({ success: false, message: "Gagal mengirim produk" });
    }
  });

  // 3. Duitku Webhook
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

  // 4. Polling Status (For frontend)
  app.get("/api/transactions/status/:id", (req, res) => {
    const transaction = transactions[req.params.id];
    if (!transaction) return res.status(404).json({ message: "Not found" });
    res.json({ status: transaction.status });
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
