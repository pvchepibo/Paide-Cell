import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
try {
  console.log("Initializing Firebase Admin with Project ID:", firebaseConfig.projectId);
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  db = getFirestore(firebaseConfig.firestoreDatabaseId);
  console.log("Firestore DB initialized successfully with ID:", firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.error("Firebase Admin Initialization Error:", e);
  process.exit(1);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(res: express.Response, error: any, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return res.status(500).json({ success: false, message: "Database error", ...errInfo });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // 1. CASH Transaction (Direct to Digiflazz)
  app.post("/api/transaction/cash", async (req, res) => {
    const { customerId, product } = req.body;
    const transactionId = `CASH-${Date.now()}`;

    try {
      // Get Settings from Firestore
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};
      
      const username = settings?.digiflazzUsername || process.env.DIGIFLAZZ_USERNAME || "dummy_sementara";
      const apiKey = settings?.digiflazzApiKey || process.env.DIGIFLAZZ_API_KEY || "dummy_sementara";
      
      // Digiflazz Signature: md5(username + api_key + ref_id)
      const sign = crypto.createHash('md5').update(`${username}${apiKey}${transactionId}`).digest('hex');

      const payload = {
        username,
        buyer_sku_code: product.sku || product.id,
        customer_no: customerId,
        ref_id: transactionId,
        sign: sign
      };

      console.log("Calling Digiflazz (CASH) with:", payload);
      
      // In real scenario: 
      // const response = await axios.post('https://api.digiflazz.com/v1/transaction', payload);
      // if (response.data.data.status === 'Gagal') throw new Error(response.data.data.message);

      const transactionRecord = {
        id: transactionId,
        customerId,
        productName: product.name,
        sku: product.sku || product.id,
        amount: product.amount || 0,
        costPrice: product.costPrice || 0,
        sellingPrice: product.price || product.sellingPrice,
        profit: (product.price || product.sellingPrice) - (product.costPrice || 0),
        method: "CASH",
        status: "SUCCESS",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('transactions').doc(transactionId).set(transactionRecord);

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
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};

      const merchantCode = settings?.duitkuMerchantCode || process.env.DUITKU_MERCHANT_CODE || "DS29393";
      const apiKey = settings?.duitkuApiKey || process.env.DUITKU_API_KEY || "9b9b83b59d344945500389e2759bc010";
      const amount = product.price || product.sellingPrice;
      
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
      
      const transactionRecord = {
        id: transactionId,
        customerId,
        productName: product.name,
        sku: product.sku || product.id,
        amount: product.amount || 0,
        costPrice: product.costPrice || 0,
        sellingPrice: amount,
        profit: amount - (product.costPrice || 0),
        method: "QRIS",
        status: "PENDING",
        qrString: mockQrString,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('transactions').doc(transactionId).set(transactionRecord);

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
    try {
      const docRef = db.collection('transactions').doc(transactionId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ message: "Transaksi tidak ditemukan" });
      }

      const transaction = docSnap.data();

      // If already success, just return
      if (transaction?.status === "SUCCESS") return res.json({ status: "SUCCESS" });

      // For Demo: Simulate payment success after 15 seconds
      const timestamp = transaction?.timestamp?.toDate?.()?.getTime() || Date.now();
      const elapsed = (Date.now() - timestamp) / 1000;
      
      if (elapsed > 15 && transaction?.status === "PENDING") {
        console.log(`Auto-Simulating Payment success for ${transactionId} after 15s`);
        await docRef.update({ status: "SUCCESS" });
        return res.json({ status: "SUCCESS" });
      }

      res.json({ status: transaction?.status });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.GET, `transactions/${transactionId}`);
    }
  });

  // 4. Force Success (For Testing)
  app.post("/api/transaction/simulate-success/:id", async (req, res) => {
    const transactionId = req.params.id;
    try {
      const docRef = db.collection('transactions').doc(transactionId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) return res.status(404).json({ message: "Not found" });

      console.log(`Manual Simulation: Forcing SUCCESS for ${transactionId}`);
      await docRef.update({ status: "SUCCESS" });
      res.json({ success: true, status: "SUCCESS" });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.UPDATE, `transactions/${transactionId}`);
    }
  });

  // 5. Digiflazz Balance
  app.get("/api/supplier/balance", async (req, res) => {
    try {
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};

      const username = settings?.digiflazzUsername || process.env.DIGIFLAZZ_USERNAME || "dummy_sementara";
      const apiKey = settings?.digiflazzApiKey || process.env.DIGIFLAZZ_API_KEY || "dummy_sementara";
      const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');

      const payload = {
        username,
        key: apiKey,
        sign: sign
      };

      console.log("Checking Digiflazz Balance with:", payload);
      return res.json({ success: true, balance: 1250000 }); // Mock balance
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.GET, 'settings/config');
    }
  });

  // 6. Inventory Management
  app.get("/api/inventory", async (req, res) => {
    try {
      const snapshot = await db.collection('inventory').get();
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If empty, seed with mock data for first time
      if (products.length === 0) {
        const mockProducts = [
          { sku: 'PULSA5', name: 'Pulsa 5.000', category: 'PULSA', costPrice: 5100, sellingPrice: 7000, isActive: true },
          { sku: 'PULSA10', name: 'Pulsa 10.000', category: 'PULSA', costPrice: 10100, sellingPrice: 12000, isActive: true },
          { sku: 'DATA1GB', name: 'Data 1GB', category: 'DATA', costPrice: 15000, sellingPrice: 18000, isActive: true },
          { sku: 'TOKEN20', name: 'Token PLN 20rb', category: 'TOKEN', costPrice: 20000, sellingPrice: 22000, isActive: true },
          { sku: 'GAME50', name: 'Diamond FF 50', category: 'GAME', costPrice: 7500, sellingPrice: 10000, isActive: true },
        ];
        
        for (const p of mockProducts) {
          await db.collection('inventory').doc(p.sku).set(p);
        }
        return res.json(mockProducts);
      }
      
      return res.json(products);
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.LIST, 'inventory');
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const product = req.body;
      await db.collection('inventory').doc(product.sku).set(product);
      res.json({ success: true });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.CREATE, 'inventory');
    }
  });

  app.put("/api/inventory/:sku", async (req, res) => {
    try {
      const sku = req.params.sku;
      const updates = req.body;
      await db.collection('inventory').doc(sku).update(updates);
      res.json({ success: true });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.UPDATE, `inventory/${sku}`);
    }
  });

  app.delete("/api/inventory/:sku", async (req, res) => {
    try {
      const sku = req.params.sku;
      await db.collection('inventory').doc(sku).delete();
      res.json({ success: true });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.DELETE, `inventory/${sku}`);
    }
  });

  // 7. Settings Management
  app.get("/api/settings", async (req, res) => {
    try {
      const docSnap = await db.collection('settings').doc('config').get();
      if (!docSnap.exists) {
        const defaultSettings = {
          storeName: 'GPDPB Marturia Abasi',
          logoUrl: 'https://picsum.photos/seed/store/200',
          duitkuMerchantCode: 'DS29393',
          duitkuApiKey: '9b9b83b59d344945500389e2759bc010',
          digiflazzUsername: '',
          digiflazzApiKey: ''
        };
        await db.collection('settings').doc('config').set(defaultSettings);
        return res.json(defaultSettings);
      }
      res.json(docSnap.data());
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.GET, 'settings/config');
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settings = req.body;
      await db.collection('settings').doc('config').set(settings, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.WRITE, 'settings/config');
    }
  });

  // 8. Reports Data
  app.get("/api/reports", async (req, res) => {
    try {
      const snapshot = await db.collection('transactions').orderBy('timestamp', 'desc').get();
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          time: (data.timestamp && typeof data.timestamp.toDate === 'function') 
            ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : '-'
        };
      });
      
      const summary = {
        totalRevenue: (transactions as any[]).filter(t => t.status === 'SUCCESS').reduce((sum, t) => sum + (t.sellingPrice || 0), 0),
        grossProfit: (transactions as any[]).filter(t => t.status === 'SUCCESS').reduce((sum, t) => sum + (t.profit || 0), 0),
        successfulTx: (transactions as any[]).filter(t => t.status === 'SUCCESS').length,
        totalTx: transactions.length
      };
      
      res.json({ summary, transactions });
    } catch (error: any) {
      handleFirestoreError(res, error, OperationType.LIST, 'transactions');
    }
  });

  // 9. Duitku Webhook (Real-world use)
  app.post("/api/webhooks/duitku", async (req, res) => {
    const { merchantCode, amount, merchantOrderId, signature, resultCode } = req.body;
    
    try {
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};
      const apiKey = settings?.duitkuApiKey || process.env.DUITKU_API_KEY || "9b9b83b59d344945500389e2759bc010";

      // Verify signature: md5(merchantCode + amount + merchantOrderId + apiKey)
      const calcSignature = crypto
        .createHash("md5")
        .update(merchantCode + amount + merchantOrderId + apiKey)
        .digest("hex");

      if (signature === calcSignature && resultCode === "00") {
        const docRef = db.collection('transactions').doc(merchantOrderId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists && docSnap.data()?.status === "PENDING") {
          console.log(`Duitku Payment received for ${merchantOrderId}. Executing order...`);
          await docRef.update({ status: "PAID" });
          
          // Simulate calling Digiflazz
          setTimeout(async () => {
             await docRef.update({ status: "SUCCESS" });
          }, 2000);
        }
      }
      res.send("OK");
    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).send("Error");
    }
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
