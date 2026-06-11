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

// Auto-seed function to initialize the database with default data if empty
async function initializeMongoDbData() {
  try {
    const accountCount = await AccountModel.countDocuments();
    if (accountCount > 0) {
      console.log('💚 Database already has data. Skipping auto-seeding.');
      return;
    }

    console.log('🌱 Database is empty. Seeding default data to MongoDB...');

    // Default accounts
    const defaultAccounts = [
      {
        id: 'admin_001',
        username: 'admin',
        password: Buffer.from(encodeURIComponent('admin123')).toString('base64'),
        fullName: 'Quản trị viên',
        role: 'admin',
        position: 'Quản trị hệ thống',
        email: 'admin@hiephoa.gov.vn',
        phone: '0987654321',
        active: true,
        createdAt: new Date(2024, 0, 1).toISOString()
      },
      {
        id: 'user_001',
        username: 'nguyenvana',
        password: Buffer.from(encodeURIComponent('123456')).toString('base64'),
        fullName: 'Nguyễn Văn A',
        role: 'user',
        position: 'Phó phòng Hành chính',
        email: 'nguyenvana@hiephoa.gov.vn',
        phone: '0912345678',
        active: true,
        createdAt: new Date(2024, 1, 15).toISOString()
      },
      {
        id: 'user_002',
        username: 'tranthib',
        password: Buffer.from(encodeURIComponent('123456')).toString('base64'),
        fullName: 'Trần Thị B',
        role: 'user',
        position: 'Chuyên viên Tổng hợp',
        email: 'tranthib@hiephoa.gov.vn',
        phone: '0923456789',
        active: true,
        createdAt: new Date(2024, 2, 20).toISOString()
      },
      {
        id: 'user_003',
        username: 'levanc',
        password: Buffer.from(encodeURIComponent('123456')).toString('base64'),
        fullName: 'Lê Văn C',
        role: 'user',
        position: 'Trưởng phòng Kế hoạch',
        email: 'levanc@hiephoa.gov.vn',
        phone: '0934567890',
        active: true,
        createdAt: new Date(2024, 3, 10).toISOString()
      }
    ];
    await AccountModel.insertMany(defaultAccounts);

    // Default documents
    const defaultDocuments = [
      {
        id: 'doc_001',
        title: 'Kế hoạch công tác năm 2026',
        description: 'Kế hoạch triển khai các nhiệm vụ trọng tâm năm 2026 của đơn vị',
        fileName: 'Ke_hoach_cong_tac_2026.docx',
        fileSize: 245760,
        status: 'published',
        permissions: {
          'user_001': 'view',
          'user_002': 'edit',
          'user_003': 'view'
        },
        createdBy: 'admin_001',
        createdAt: new Date(2026, 0, 15).toISOString(),
        publishedAt: new Date(2026, 0, 16).toISOString()
      },
      {
        id: 'doc_002',
        title: 'Quy chế chi tiêu nội bộ',
        description: 'Quy chế quản lý và sử dụng ngân sách nội bộ đơn vị',
        fileName: 'Quy_che_chi_tieu_noi_bo.docx',
        fileSize: 189440,
        status: 'finalized',
        permissions: {
          'user_001': 'view',
          'user_002': 'view',
          'user_003': 'view'
        },
        createdBy: 'admin_001',
        createdAt: new Date(2025, 11, 1).toISOString(),
        publishedAt: new Date(2025, 11, 5).toISOString(),
        finalizedAt: new Date(2025, 11, 10).toISOString()
      },
      {
        id: 'doc_003',
        title: 'Dự thảo báo cáo tổng kết quý II/2026',
        description: 'Dự thảo báo cáo kết quả hoạt động quý II năm 2026',
        fileName: 'Du_thao_bao_cao_Q2_2026.docx',
        fileSize: 156672,
        status: 'draft',
        permissions: {},
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 1).toISOString()
      }
    ];
    await DocumentModel.insertMany(defaultDocuments);

    // Default votes
    const defaultVotes = [
      {
        id: 'vote_001',
        title: 'Phê duyệt kế hoạch tổ chức Hội nghị tổng kết 2025',
        description: 'Biểu quyết thông qua kế hoạch tổ chức Hội nghị tổng kết năm 2025, dự kiến tổ chức vào ngày 20/01/2026 tại Hội trường lớn.',
        status: 'active',
        voters: [
          { userId: 'user_001', vote: 'agree', comment: 'Đồng ý với kế hoạch', votedAt: new Date(2026, 5, 10, 9, 30).toISOString() },
          { userId: 'user_002', vote: 'agree', comment: '', votedAt: new Date(2026, 5, 10, 10, 15).toISOString() }
        ],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 10, 8, 0).toISOString()
      },
      {
        id: 'vote_002',
        title: 'Điều chỉnh quy chế làm việc ngoài giờ',
        description: 'Biểu quyết về việc sửa đổi quy chế làm thêm giờ, bổ sung chế độ phụ cấp cho nhân viên làm việc ngoài giờ hành chính.',
        status: 'closed',
        voters: [
          { userId: 'user_001', vote: 'agree', comment: 'Rất cần thiết', votedAt: new Date(2026, 4, 20, 14, 30).toISOString() },
          { userId: 'user_002', vote: 'disagree', comment: 'Cần xem lại mức phụ cấp', votedAt: new Date(2026, 4, 20, 15, 0).toISOString() },
          { userId: 'user_003', vote: 'agree', comment: '', votedAt: new Date(2026, 4, 21, 8, 30).toISOString() }
        ],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 4, 20, 8, 0).toISOString(),
        closedAt: new Date(2026, 4, 22, 17, 0).toISOString()
      }
    ];
    await VoteModel.insertMany(defaultVotes);

    // Default notifications
    const defaultNotifs = [
      {
        id: 'notif_001',
        title: 'Thông báo lịch họp giao ban tháng 6/2026',
        content: 'Kính mời các đồng chí tham dự cuộc họp giao ban định kỳ tháng 6/2026 vào lúc 8h00 ngày 15/06/2026 tại Phòng họp số 1.',
        priority: 'important',
        readBy: ['user_001'],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 10, 7, 0).toISOString()
      },
      {
        id: 'notif_002',
        title: 'Cập nhật hệ thống phần mềm',
        content: 'Hệ thống sẽ được bảo trì và nâng cấp vào ngày 20/06/2026 từ 22h00 đến 06h00 ngày hôm sau. Trong thời gian này, hệ thống sẽ tạm ngừng hoạt động.',
        priority: 'normal',
        readBy: [],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 9, 15, 0).toISOString()
      },
      {
        id: 'notif_003',
        title: 'Yêu cầu nộp báo cáo quý II/2026',
        content: 'Đề nghị các phòng ban hoàn thành và nộp báo cáo kết quả hoạt động quý II/2026 trước ngày 25/06/2026. File báo cáo gửi qua hệ thống.',
        priority: 'urgent',
        readBy: [],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 8, 9, 0).toISOString()
      }
    ];
    await NotificationModel.insertMany(defaultNotifs);

    // Default files
    const defaultFiles = [
      {
        id: 'file_001',
        fileName: 'Bao_cao_thang_5.docx',
        fileSize: 102400,
        uploadedBy: 'user_001',
        description: 'Báo cáo kết quả tháng 5/2026 - Phòng Hành chính',
        createdAt: new Date(2026, 5, 5, 14, 30).toISOString()
      },
      {
        id: 'file_002',
        fileName: 'De_xuat_ngan_sach_Q3.xlsx',
        fileSize: 87040,
        uploadedBy: 'user_003',
        description: 'Đề xuất ngân sách hoạt động quý III/2026',
        createdAt: new Date(2026, 5, 6, 10, 0).toISOString()
      }
    ];
    await FileModel.insertMany(defaultFiles);

    console.log('✅ MongoDB database auto-seeded successfully.');
  } catch (err) {
    console.error('❌ Error during auto-seeding:', err.message);
  }
}

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && !MONGODB_URI.includes('<password>')) {
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log('💚 Connected to MongoDB Atlas successfully.');
      isMongoConnected = true;
      await initializeMongoDbData();
    })
    .catch((err) => {
      console.error('❤️ MongoDB connection error:', err.message);
      console.log('⚠️ Running in local JSON storage fallback mode.');
    });
} else {
  console.log('⚠️ MONGODB_URI environment variable is empty or not configured. Running in local JSON storage fallback mode.');
}


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
  const { action, sheet, rows, data, fileName, mimeType, base64, uploadedBy, description, mutationType, item } = req.body;

  try {
    if (isMongoConnected) {
      if (action === 'mutation') {
        let Model;
        if (sheet === 'Accounts') Model = AccountModel;
        else if (sheet === 'Documents') Model = DocumentModel;
        else if (sheet === 'Votes') Model = VoteModel;
        else if (sheet === 'Notifications') Model = NotificationModel;
        else if (sheet === 'Files') Model = FileModel;

        if (!Model) {
          return res.status(400).json({ error: 'Mô hình dữ liệu không hợp lệ.' });
        }

        if (mutationType === 'upsert') {
          if (!item) {
            return res.status(400).json({ error: 'Thiếu dữ liệu.' });
          }
          const items = Array.isArray(item) ? item : [item];
          for (const it of items) {
            if (it.id) {
              // Preserve fileData for files if client sends empty fileData
              if (sheet === 'Files' && !it.fileData) {
                const existing = await FileModel.findOne({ id: it.id });
                if (existing && existing.fileData) {
                  it.fileData = existing.fileData;
                }
              }
              await Model.findOneAndUpdate(
                { id: it.id },
                { $set: it },
                { upsert: true, new: true }
              );
            }
          }
          return res.json({ success: true, message: `Upserted item(s) in ${sheet}` });
        } else if (mutationType === 'delete') {
          if (!item) {
            return res.status(400).json({ error: 'Thiếu dữ liệu cần xóa.' });
          }
          const items = Array.isArray(item) ? item : [item];
          const ids = items.map(it => it.id).filter(Boolean);
          if (ids.length > 0) {
            await Model.deleteMany({ id: { $in: ids } });
          }
          return res.json({ success: true, message: `Deleted item(s) in ${sheet}` });
        }
      }

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
          // Sync files list from client, preserving existing fileData without querying it!
          const ids = (rows || []).map(r => r.id);
          await FileModel.deleteMany({ id: { $nin: ids } });
          
          if (rows && rows.length > 0) {
            for (const row of rows) {
              const updateDoc = { ...row };
              if (!updateDoc.fileData) {
                delete updateDoc.fileData;
              }
              await FileModel.findOneAndUpdate(
                { id: row.id },
                { $set: updateDoc },
                { upsert: true }
              );
            }
          }
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
          // Sync files list from client, preserving existing fileData without querying it!
          const ids = data.files.map(f => f.id);
          await FileModel.deleteMany({ id: { $nin: ids } });

          for (const row of data.files) {
            const updateDoc = { ...row };
            if (!updateDoc.fileData) {
              delete updateDoc.fileData;
            }
            await FileModel.findOneAndUpdate(
              { id: row.id },
              { $set: updateDoc },
              { upsert: true }
            );
          }
        }
        return res.json({ success: true, message: 'Synced all collections' });
      }
    } else {
      // Local DB Fallback
      const db = readLocalDB();
      const key = sheet ? sheet.toLowerCase() : '';

      if (action === 'mutation') {
        if (!db[key]) db[key] = [];
        const items = Array.isArray(item) ? item : [item];

        if (mutationType === 'upsert') {
          if (!item) {
            return res.status(400).json({ error: 'Thiếu dữ liệu.' });
          }
          for (const it of items) {
            if (!it.id) continue;
            const idx = db[key].findIndex(x => x.id === it.id);
            if (idx !== -1) {
              if (key === 'files' && !it.fileData && db[key][idx].fileData) {
                it.fileData = db[key][idx].fileData;
              }
              db[key][idx] = { ...db[key][idx], ...it };
            } else {
              if (key === 'files') {
                db[key].unshift(it);
              } else {
                db[key].push(it);
              }
            }
          }
          writeLocalDB(db);
          return res.json({ success: true, message: `Upserted local item(s) in ${sheet}` });
        } else if (mutationType === 'delete') {
          if (!item) {
            return res.status(400).json({ error: 'Thiếu dữ liệu cần xóa.' });
          }
          const ids = items.map(it => it.id).filter(Boolean);
          if (ids.length > 0) {
            db[key] = db[key].filter(x => !ids.includes(x.id));
            writeLocalDB(db);
          }
          return res.json({ success: true, message: `Deleted local item(s) in ${sheet}` });
        }
      }

      if (action === 'sync') {
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
  const { id, fileName, mimeType, base64, uploadedBy, description } = req.body;

  if (!fileName || !base64) {
    return res.status(400).json({ success: false, error: 'Thiếu tên file hoặc dữ liệu base64.' });
  }

  // Generate unique ID if not provided by the client
  const fileId = id || 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  
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

    // Split base64 payload from data url prefix: "data:mimeType;base64,payload" using a safe split/trim method
    if (!fileRecord.fileData.startsWith('data:')) {
      return res.status(500).send('Dữ liệu tệp tin bị hỏng hoặc không đúng định dạng.');
    }

    const parts = fileRecord.fileData.split(';base64,');
    if (parts.length !== 2) {
      return res.status(500).send('Dữ liệu tệp tin bị hỏng hoặc không đúng định dạng.');
    }

    const contentType = parts[0].substring(5); // Remove 'data:'
    const base64Data = parts[1].trim(); // Trim trailing/leading whitespace or newlines
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
