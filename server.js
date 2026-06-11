require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'HiepHoaSecret2026';

// Middleware to parse large JSON bodies (essential for file uploads)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Serve static files from root directory
app.use(express.static(__dirname));

// ============================================
// DATABASE CONNECTION & MODEL SCHEMAS
// ============================================
let isMongoConnected = false;

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && !MONGODB_URI.includes('<password>')) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('💚 Connected to MongoDB Atlas successfully.');
      isMongoConnected = true;
    })
    .catch((err) => {
      console.error('❤️ MongoDB connection error:', err.message);
      console.log('⚠️ Running in local JSON storage fallback mode.');
    });
} else {
  console.log('⚠️ MONGODB_URI environment variable is empty or not configured. Running in local JSON storage fallback mode.');
}

// Schemas (Using strict: false to ensure flexibility with frontend properties)
const AccountSchema = new mongoose.Schema({}, { strict: false, collection: 'accounts' });
const DocumentSchema = new mongoose.Schema({}, { strict: false, collection: 'documents' });
const VoteSchema = new mongoose.Schema({}, { strict: false, collection: 'votes' });
const NotificationSchema = new mongoose.Schema({}, { strict: false, collection: 'notifications' });
const FileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fileName: String,
  fileSize: Number,
  uploadedBy: String,
  description: String,
  createdAt: String,
  downloadUrl: String,
  fileData: String // Large base64 Data URL string
}, { strict: false, collection: 'files' });

const AccountModel = mongoose.model('Account', AccountSchema);
const DocumentModel = mongoose.model('Document', DocumentSchema);
const VoteModel = mongoose.model('Vote', VoteSchema);
const NotificationModel = mongoose.model('Notification', NotificationSchema);
const FileModel = mongoose.model('File', FileSchema);

// Local JSON File DB Fallback helpers
const DB_FILE = path.join(__dirname, 'db.json');

function readLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { accounts: [], documents: [], votes: [], notifications: [], files: [] };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { accounts: [], documents: [], votes: [], notifications: [], files: [] };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing local DB file:', e);
    return false;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Authenticate helper
function checkToken(req, res, next) {
  // Token might be in body (POST) or in query (GET)
  const token = req.method === 'POST' ? req.body.token : req.query.token;
  if (token !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Sai mã bảo mật truy cập.' });
  }
  next();
}

// GET /api/sync - Reads all data (Action: readAll)
app.get('/api/sync', checkToken, async (req, res) => {
  const action = req.query.action || 'readAll';
  const sheet = req.query.sheet;

  try {
    if (isMongoConnected) {
      if (action === 'read' && sheet) {
        let data = [];
        if (sheet === 'Accounts') data = await AccountModel.find({});
        else if (sheet === 'Documents') data = await DocumentModel.find({});
        else if (sheet === 'Votes') data = await VoteModel.find({});
        else if (sheet === 'Notifications') data = await NotificationModel.find({});
        else if (sheet === 'Files') data = await FileModel.find({}, { fileData: 0 }); // Hide base64 content
        
        return res.json({ data });
      }

      // Default action: readAll
      const accounts = await AccountModel.find({});
      const documents = await DocumentModel.find({});
      const votes = await VoteModel.find({});
      const notifications = await NotificationModel.find({});
      const files = await FileModel.find({}, { fileData: 0 }); // Hide base64 content for speed

      return res.json({
        data: {
          Accounts: accounts,
          Documents: documents,
          Votes: votes,
          Notifications: notifications,
          Files: files
        }
      });
    } else {
      // Local DB Fallback
      const db = readLocalDB();
      if (action === 'read' && sheet) {
        const key = sheet.toLowerCase();
        let list = db[key] || [];
        if (key === 'files') {
          list = list.map(({ fileData, ...meta }) => meta); // Hide base64 content
        }
        return res.json({ data: list });
      }

      // readAll
      const filesMetadataOnly = (db.files || []).map(({ fileData, ...meta }) => meta);
      return res.json({
        data: {
          Accounts: db.accounts || [],
          Documents: db.documents || [],
          Votes: db.votes || [],
          Notifications: db.notifications || [],
          Files: filesMetadataOnly
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync - Handles sync, syncAll, and uploadFile actions
app.post('/api/sync', checkToken, async (req, res) => {
  const { action, sheet, rows, data, fileName, mimeType, base64, uploadedBy, description } = req.body;

  try {
    if (isMongoConnected) {
      if (action === 'sync') {
        if (sheet === 'Accounts') {
          await AccountModel.deleteMany({});
          if (rows && rows.length > 0) await AccountModel.insertMany(rows);
        } else if (sheet === 'Documents') {
          await DocumentModel.deleteMany({});
          if (rows && rows.length > 0) await DocumentModel.insertMany(rows);
        } else if (sheet === 'Votes') {
          await VoteModel.deleteMany({});
          if (rows && rows.length > 0) await VoteModel.insertMany(rows);
        } else if (sheet === 'Notifications') {
          await NotificationModel.deleteMany({});
          if (rows && rows.length > 0) await NotificationModel.insertMany(rows);
        } else if (sheet === 'Files') {
          // Pre-fetch and map existing fileData contents so we don't lose the base64 contents
          const existingFiles = await FileModel.find({ fileData: { $ne: null } });
          const fileDataMap = {};
          existingFiles.forEach(f => { fileDataMap[f.id] = f.fileData; });

          const rowsToSave = (rows || []).map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });

          await FileModel.deleteMany({});
          if (rowsToSave.length > 0) await FileModel.insertMany(rowsToSave);
        }
        return res.json({ success: true, message: `Synced sheet ${sheet}` });
      }

      if (action === 'syncAll' && data) {
        if (data.accounts) {
          await AccountModel.deleteMany({});
          if (data.accounts.length > 0) await AccountModel.insertMany(data.accounts);
        }
        if (data.documents) {
          await DocumentModel.deleteMany({});
          if (data.documents.length > 0) await DocumentModel.insertMany(data.documents);
        }
        if (data.votes) {
          await VoteModel.deleteMany({});
          if (data.votes.length > 0) await VoteModel.insertMany(data.votes);
        }
        if (data.notifications) {
          await NotificationModel.deleteMany({});
          if (data.notifications.length > 0) await NotificationModel.insertMany(data.notifications);
        }
        if (data.files) {
          const existingFiles = await FileModel.find({ fileData: { $ne: null } });
          const fileDataMap = {};
          existingFiles.forEach(f => { fileDataMap[f.id] = f.fileData; });

          const filesToSave = data.files.map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });

          await FileModel.deleteMany({});
          if (filesToSave.length > 0) await FileModel.insertMany(filesToSave);
        }
        return res.json({ success: true, message: 'Synced all collections' });
      }
    } else {
      // Local DB Fallback
      const db = readLocalDB();

      if (action === 'sync') {
        const key = sheet.toLowerCase();
        if (key === 'files') {
          // Preserve base64
          const fileDataMap = {};
          (db.files || []).forEach(f => { if (f.fileData) fileDataMap[f.id] = f.fileData; });

          db.files = (rows || []).map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });
        } else {
          db[key] = rows || [];
        }
        writeLocalDB(db);
        return res.json({ success: true, message: `Synced local sheet ${sheet}` });
      }

      if (action === 'syncAll' && data) {
        if (data.accounts) db.accounts = data.accounts;
        if (data.documents) db.documents = data.documents;
        if (data.votes) db.votes = data.votes;
        if (data.notifications) db.notifications = data.notifications;
        if (data.files) {
          // Preserve base64
          const fileDataMap = {};
          (db.files || []).forEach(f => { if (f.fileData) fileDataMap[f.id] = f.fileData; });

          db.files = data.files.map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });
        }
        writeLocalDB(db);
        return res.json({ success: true, message: 'Synced all local data' });
      }
    }

    res.status(400).json({ error: 'Unknown or unsupported action' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/uploadFile - Upload file directly to db
app.post('/api/uploadFile', checkToken, async (req, res) => {
  const { fileName, mimeType, base64, uploadedBy, description } = req.body;

  if (!fileName || !base64) {
    return res.status(400).json({ success: false, error: 'Thiếu tên file hoặc dữ liệu base64.' });
  }

  // Generate unique ID
  const fileId = 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  
  // Make sure base64 starts with the correct prefix
  let fullDataUrl = base64;
  if (!base64.startsWith('data:')) {
    fullDataUrl = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
  }

  try {
    const downloadUrl = `/api/download/${fileId}`;

    if (isMongoConnected) {
      const newFile = new FileModel({
        id: fileId,
        fileName,
        fileSize: Buffer.from(base64.split(',')[1] || base64, 'base64').length,
        uploadedBy: uploadedBy || 'Không xác định',
        description: description || '',
        createdAt: new Date().toISOString(),
        downloadUrl,
        fileData: fullDataUrl
      });
      await newFile.save();
    } else {
      // Local fallback
      const db = readLocalDB();
      const newFile = {
        id: fileId,
        fileName,
        fileSize: Buffer.from(base64.split(',')[1] || base64, 'base64').length,
        uploadedBy: uploadedBy || 'Không xác định',
        description: description || '',
        createdAt: new Date().toISOString(),
        downloadUrl,
        fileData: fullDataUrl
      };
      db.files = db.files || [];
      db.files.unshift(newFile);
      writeLocalDB(db);
    }

    res.json({
      success: true,
      downloadUrl,
      fileId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/download/:id - Direct download link serving raw binary content
app.get('/api/download/:id', async (req, res) => {
  const fileId = req.params.id;

  try {
    let fileRecord = null;

    if (isMongoConnected) {
      fileRecord = await FileModel.findOne({ id: fileId });
    } else {
      const db = readLocalDB();
      fileRecord = (db.files || []).find(f => f.id === fileId);
    }

    if (!fileRecord || !fileRecord.fileData) {
      return res.status(404).send('Không tìm thấy tệp tin hoặc tệp tin chưa được tải lên.');
    }

    // Split base64 payload from data url prefix: "data:mimeType;base64,payload"
    const matches = fileRecord.fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(500).send('Dữ liệu tệp tin bị hỏng hoặc không đúng định dạng.');
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Content-Type', contentType);
    
    // Use proper RFC5987 URL encoding format for Vietnamese characters in filename
    const encodedFileName = encodeURIComponent(fileRecord.fileName).replace(/'/g, "%27");
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    
    res.send(fileBuffer);
  } catch (error) {
    res.status(500).send(`Lỗi máy chủ khi tải file: ${error.message}`);
  }
});

// If wrong path, serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
