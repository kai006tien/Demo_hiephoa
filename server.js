require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const BCRYPT_ROUNDS = 12;

// ============================================
// IN-MEMORY SESSION STORE
// ============================================
const activeSessions = new Map();
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 phút

function createSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}
// Dọn session hết hạn mỗi 5 phút
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. Helmet - Bảo vệ HTTP headers (XSS, clickjacking, MIME sniffing...)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'self'", "data:", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. CORS - Chỉ cho phép domain tin cậy
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:10000', 'http://127.0.0.1:10000',
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:3000', 'http://127.0.0.1:3000'
  );
}

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép requests không có origin (curl, mobile, server-to-server)
    // HOẶC same-origin requests (origin === undefined khi cùng domain)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));

// 3. Rate Limiting tổng quát - 200 requests / 15 phút / IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', generalLimiter);

// 4. Rate Limiting đăng nhập - 30 lần / 15 phút / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false
});

// 5. Chống NoSQL Injection
app.use(mongoSanitize());

// 6. Chống HTTP Parameter Pollution
app.use(hpp());

// 7. Body parser với giới hạn kích thước (25MB để hỗ trợ base64 encode file 10MB)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// 8. CHẶN truy cập file nhạy cảm trước khi serve static
app.use((req, res, next) => {
  const blockedPaths = [
    '/server.js', '/.env', '/db.json',
    '/package.json', '/package-lock.json',
    '/.gitignore', '/.git'
  ];
  const lowerPath = req.path.toLowerCase();

  if (blockedPaths.some(bp => lowerPath === bp) ||
      lowerPath.startsWith('/node_modules') ||
      lowerPath.startsWith('/.git/') ||
      lowerPath.startsWith('/.env')) {
    return res.status(403).json({ error: 'Truy cập bị từ chối.' });
  }
  next();
});

// 9. Serve static files
app.use(express.static(__dirname, {
  dotfiles: 'deny', // Từ chối truy cập file ẩn (.env, .git, etc.)
  index: 'index.html'
}));

// ============================================
// DATABASE CONNECTION & MODEL SCHEMAS
// ============================================
let isMongoConnected = false;

const AccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: String,
  role: String,
  position: String,
  email: String,
  phone: String,
  active: Boolean,
  createdAt: String
}, { strict: false, id: false, collection: 'accounts' });

const DocumentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  description: String,
  fileName: String,
  fileSize: Number,
  downloadUrl: String,
  status: String,
  permissions: mongoose.Schema.Types.Mixed,
  createdBy: String,
  createdAt: String,
  publishedAt: String,
  finalizedAt: String
}, { strict: false, id: false, collection: 'documents' });

const VoteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  description: String,
  status: String,
  voters: [mongoose.Schema.Types.Mixed],
  createdBy: String,
  createdAt: String,
  closedAt: String
}, { strict: false, id: false, collection: 'votes' });

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  content: String,
  priority: String,
  readBy: [String],
  createdBy: String,
  createdAt: String
}, { strict: false, id: false, collection: 'notifications' });

const FileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fileName: String,
  fileSize: Number,
  uploadedBy: String,
  description: String,
  createdAt: String,
  downloadUrl: String,
  fileData: String
}, { strict: false, id: false, collection: 'files' });

const SuggestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderId: String,
  senderName: String,
  receiverId: String,
  receiverName: String,
  title: String,
  content: String,
  isAnonymous: Boolean,
  createdAt: String
}, { strict: false, id: false, collection: 'suggestions' });

const SessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: String,
  name: String,
  order: Number,
  documents: [mongoose.Schema.Types.Mixed],
  resolutions: [mongoose.Schema.Types.Mixed],
  createdBy: String,
  createdAt: String,
  updatedAt: String
}, { strict: false, id: false, collection: 'sessions' });

const AccountModel = mongoose.model('Account', AccountSchema);
const DocumentModel = mongoose.model('Document', DocumentSchema);
const VoteModel = mongoose.model('Vote', VoteSchema);
const NotificationModel = mongoose.model('Notification', NotificationSchema);
const FileModel = mongoose.model('File', FileSchema);
const SuggestionModel = mongoose.model('Suggestion', SuggestionSchema);
const SessionModel = mongoose.model('Session', SessionSchema);

// ============================================
// PASSWORD MIGRATION: Base64 → bcrypt (with repair logic)
// ============================================
async function migratePasswordsToBcrypt() {
  try {
    const accounts = await AccountModel.find({});
    let migratedCount = 0;
    let repairedCount = 0;

    const defaultPasswords = {
      'admin': 'admin123',
      'nguyenvana': '123456',
      'tranthib': '123456',
      'levanc': '123456'
    };

    for (const account of accounts) {
      if (!account.password) continue;

      // 1. Sửa lỗi nếu các tài khoản mặc định bị hash nhầm từ chuỗi rác
      if (account.password.startsWith('$2a$') || account.password.startsWith('$2b$')) {
        const defaultPassword = defaultPasswords[account.username];
        if (defaultPassword) {
          const isCorrect = await bcrypt.compare(defaultPassword, account.password);
          if (!isCorrect) {
            const newHashed = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);
            await AccountModel.findOneAndUpdate(
              { id: account.id },
              { $set: { password: newHashed } }
            );
            repairedCount++;
          }
        }
        continue;
      }

      // 2. Chuyển đổi an toàn từ Base64 hoặc Plain text sang bcrypt
      let plainPassword = account.password;
      try {
        const decoded = Buffer.from(account.password, 'base64').toString('utf8');
        const isPrintable = /^[\x20-\x7E]+$/.test(decoded);
        const reEncoded = Buffer.from(decoded).toString('base64');
        if (isPrintable && (reEncoded === account.password || reEncoded.replace(/=/g, '') === account.password.replace(/=/g, ''))) {
          plainPassword = decoded;
        }
      } catch (e) {
        // Giữ nguyên plainPassword
      }

      const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
      await AccountModel.findOneAndUpdate(
        { id: account.id },
        { $set: { password: hashedPassword } }
      );
      migratedCount++;
    }

    if (repairedCount > 0) {
      console.log(`🔧 Đã sửa lỗi hash cho ${repairedCount} tài khoản mặc định.`);
    }
    if (migratedCount > 0) {
      console.log(`🔐 Đã chuyển đổi ${migratedCount} mật khẩu sang bcrypt.`);
    } else {
      console.log('🔐 Tất cả mật khẩu đã ở định dạng bcrypt.');
    }
  } catch (err) {
    console.error('❌ Lỗi khi chuyển đổi mật khẩu:', err.message);
  }
}

// ============================================
// AUTO-SEED DEFAULT DATA (chỉ khi DB trống)
// ============================================
// AUTO-SEED DEFAULT DATA (chỉ khi DB trống - Chỉ tạo Admin)
// ============================================
async function initializeMongoDbData() {
  try {
    const accountCount = await AccountModel.countDocuments();
    if (accountCount > 0) {
      console.log('💚 Database already has data. Skipping auto-seeding.');
      return;
    }

    console.log('🌱 Database is empty. Seeding default data to MongoDB...');

    // Default accounts - mật khẩu đã hash bằng bcrypt (Chỉ tạo Admin)
    const adminPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);

    const defaultAccounts = [
      {
        id: 'admin_001',
        username: 'admin',
        password: adminPassword,
        fullName: 'Quản trị viên',
        role: 'admin',
        position: 'Quản trị hệ thống',
        email: 'admin@hiephoa.gov.vn',
        phone: '0987654321',
        active: true,
        createdAt: new Date(2024, 0, 1).toISOString()
      }
    ];
    await AccountModel.insertMany(defaultAccounts);

    console.log('✅ MongoDB database auto-seeded successfully with Admin account only.');
  } catch (err) {
    console.error('❌ Error during auto-seeding:', err.message);
  }
}

// ============================================
// DATABASE REPAIR: Khôi phục ID bị thiếu
// ============================================
async function repairMissingIds() {
  try {
    if (!isMongoConnected) return;
    console.log('🔧 Đang kiểm tra và sửa lỗi ID bị thiếu trong database...');
    
    // Accounts
    const accounts = await AccountModel.find({ id: { $exists: false } });
    for (const doc of accounts) {
      const newId = doc.username === 'admin' ? 'admin_001' : 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      await AccountModel.updateOne({ _id: doc._id }, { $set: { id: newId } });
      console.log(`🔧 Đã bổ sung ID cho tài khoản: ${doc.username} -> ${newId}`);
    }

    // Documents
    const documents = await DocumentModel.find({ id: { $exists: false } });
    for (const doc of documents) {
      const newId = 'doc_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      await DocumentModel.updateOne({ _id: doc._id }, { $set: { id: newId } });
      console.log(`🔧 Đã bổ sung ID cho tài liệu: ${doc.title} -> ${newId}`);
    }

    // Votes
    const votes = await VoteModel.find({ id: { $exists: false } });
    for (const doc of votes) {
      const newId = 'vote_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      await VoteModel.updateOne({ _id: doc._id }, { $set: { id: newId } });
      console.log(`🔧 Đã bổ sung ID cho biểu quyết: ${doc.title} -> ${newId}`);
    }

    // Notifications
    const notifications = await NotificationModel.find({ id: { $exists: false } });
    for (const doc of notifications) {
      const newId = 'notif_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      await NotificationModel.updateOne({ _id: doc._id }, { $set: { id: newId } });
      console.log(`🔧 Đã bổ sung ID cho thông báo: ${doc.title} -> ${newId}`);
    }

    console.log('✅ Hoàn tất sửa lỗi ID.');
  } catch (err) {
    console.error('❌ Lỗi khi sửa ID bị thiếu:', err.message);
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
      await migratePasswordsToBcrypt();
      await repairMissingIds();
    })
    .catch((err) => {
      console.error('❤️ MongoDB connection error:', err.message);
      console.log('⚠️ Running in local JSON storage fallback mode.');
    });
} else {
  console.log('⚠️ MONGODB_URI not configured. Running in local JSON storage fallback mode.');
}

// Local JSON File DB Fallback helpers
const DB_FILE = path.join(__dirname, 'db.json');

function readLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { accounts: [], documents: [], votes: [], notifications: [], files: [], sessions: [] };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { accounts: [], documents: [], votes: [], notifications: [], files: [], sessions: [] };
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
// AUTHENTICATION MIDDLEWARE
// ============================================

// Xác thực session token từ Authorization header
function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Vui lòng đăng nhập.' });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' });
  }

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  // Gia hạn session mỗi lần có request hợp lệ
  session.expiresAt = Date.now() + SESSION_DURATION_MS;
  req.userSession = session;
  next();
}

// ============================================
// API ENDPOINTS
// ============================================

// POST /api/login - Đăng nhập (xác thực phía server)
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  }

  // Sanitize input
  const cleanUsername = String(username).trim().substring(0, 50);

  try {
    let account = null;

    if (isMongoConnected) {
      account = await AccountModel.findOne({ username: cleanUsername });
    } else {
      const db = readLocalDB();
      account = (db.accounts || []).find(a => a.username === cleanUsername);
    }

    if (!account) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (!account.active) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });
    }

    // Kiểm tra mật khẩu bằng bcrypt
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    // Tạo session token
    const sessionToken = createSessionToken();
    const sessionData = {
      userId: account.id,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
      position: account.position,
      loginTime: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_DURATION_MS
    };

    activeSessions.set(sessionToken, sessionData);

    // Trả về token và thông tin user (KHÔNG trả về mật khẩu)
    res.json({
      success: true,
      token: sessionToken,
      session: {
        userId: account.id,
        username: account.username,
        fullName: account.fullName,
        role: account.role,
        position: account.position,
        loginTime: sessionData.loginTime
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// POST /api/logout - Đăng xuất
app.post('/api/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Đã đăng xuất.' });
});

// POST /api/change-password - Đổi mật khẩu
app.post('/api/change-password', checkAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.userSession.userId;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  try {
    let account = null;
    if (isMongoConnected) {
      account = await AccountModel.findOne({ id: userId });
    } else {
      const db = readLocalDB();
      account = (db.accounts || []).find(a => a.id === userId);
    }

    if (!account) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, account.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mật khẩu cũ không đúng.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    if (isMongoConnected) {
      await AccountModel.findOneAndUpdate({ id: userId }, { $set: { password: hashedNewPassword } });
    } else {
      const db = readLocalDB();
      const idx = (db.accounts || []).findIndex(a => a.id === userId);
      if (idx !== -1) {
        db.accounts[idx].password = hashedNewPassword;
        writeLocalDB(db);
      }
    }

    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// POST /api/create-account - Tạo tài khoản mới (chỉ admin, hash mật khẩu server-side)
app.post('/api/create-account', checkAuth, async (req, res) => {
  if (req.userSession.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' });
  }

  const { username, password, fullName, position, email, phone } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  try {
    // Kiểm tra trùng username
    let existingAccount = null;
    if (isMongoConnected) {
      existingAccount = await AccountModel.findOne({ username: String(username).trim() });
    } else {
      const db = readLocalDB();
      existingAccount = (db.accounts || []).find(a => a.username === String(username).trim());
    }

    if (existingAccount) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newAccount = {
      id: 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      username: String(username).trim(),
      password: hashedPassword,
      fullName: String(fullName).trim(),
      role: 'user',
      position: position ? String(position).trim() : '',
      email: email ? String(email).trim() : '',
      phone: phone ? String(phone).trim() : '',
      active: true,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      await AccountModel.create(newAccount);
    } else {
      const db = readLocalDB();
      db.accounts = db.accounts || [];
      db.accounts.push(newAccount);
      writeLocalDB(db);
    }

    // Trả về account KHÔNG có password
    const { password: _, ...safeAccount } = newAccount;
    res.json({ success: true, account: safeAccount });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// POST /api/reset-password - Reset mật khẩu (chỉ admin)
app.post('/api/reset-password', checkAuth, async (req, res) => {
  if (req.userSession.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' });
  }

  const { userId, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu ID tài khoản.' });
  }

  const passwordToSet = newPassword || '123456';
  const hashedPassword = await bcrypt.hash(passwordToSet, BCRYPT_ROUNDS);

  try {
    if (isMongoConnected) {
      await AccountModel.findOneAndUpdate({ id: userId }, { $set: { password: hashedPassword } });
    } else {
      const db = readLocalDB();
      const idx = (db.accounts || []).findIndex(a => a.id === userId);
      if (idx !== -1) {
        db.accounts[idx].password = hashedPassword;
        writeLocalDB(db);
      }
    }
    res.json({ success: true, message: 'Đã đặt lại mật khẩu thành công.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// GET /api/sync - Đọc dữ liệu (yêu cầu xác thực)
app.get('/api/sync', checkAuth, async (req, res) => {
  const action = req.query.action || 'readAll';
  const sheet = req.query.sheet;

  try {
    if (isMongoConnected) {
      if (action === 'read' && sheet) {
        let data = [];
        if (sheet === 'Accounts') {
          // KHÔNG trả về password cho client
          const rawAccounts = await AccountModel.find({});
          data = rawAccounts.map(a => {
            const obj = a.toObject();
            delete obj.password;
            return obj;
          });
        }
        else if (sheet === 'Documents') data = await DocumentModel.find({});
        else if (sheet === 'Votes') data = await VoteModel.find({});
        else if (sheet === 'Notifications') data = await NotificationModel.find({});
        else if (sheet === 'Suggestions') data = await SuggestionModel.find({});
        else if (sheet === 'Files') data = await FileModel.find({}, { fileData: 0 });
        else if (sheet === 'Sessions') data = await SessionModel.find({});

        return res.json({ data });
      }

      // Default: readAll
      const rawAccounts = await AccountModel.find({});
      const accounts = rawAccounts.map(a => {
        const obj = a.toObject();
        delete obj.password;
        return obj;
      });
      const documents = await DocumentModel.find({});
      const votes = await VoteModel.find({});
      const notifications = await NotificationModel.find({});
      const files = await FileModel.find({}, { fileData: 0 });
      const suggestions = await SuggestionModel.find({});
      const sessions = await SessionModel.find({});

      return res.json({
        data: {
          Accounts: accounts,
          Documents: documents,
          Votes: votes,
          Notifications: notifications,
          Files: files,
          Suggestions: suggestions,
          Sessions: sessions
        }
      });
    } else {
      // Local DB Fallback
      const db = readLocalDB();
      if (action === 'read' && sheet) {
        const key = sheet.toLowerCase();
        let list = db[key] || [];
        if (key === 'accounts') {
          list = list.map(({ password, ...rest }) => rest);
        }
        if (key === 'files') {
          list = list.map(({ fileData, ...meta }) => meta);
        }
        return res.json({ data: list });
      }

      // readAll
      const accountsNoPassword = (db.accounts || []).map(({ password, ...rest }) => rest);
      const filesMetadataOnly = (db.files || []).map(({ fileData, ...meta }) => meta);
      return res.json({
        data: {
          Accounts: accountsNoPassword,
          Documents: db.documents || [],
          Votes: db.votes || [],
          Notifications: db.notifications || [],
          Files: filesMetadataOnly,
          Suggestions: db.suggestions || [],
          Sessions: db.sessions || []
        }
      });
    }
  } catch (error) {
    console.error('Sync read error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// POST /api/sync - Xử lý sync, syncAll, mutation
app.post('/api/sync', checkAuth, async (req, res) => {
  const { action, sheet, rows, data, mutationType, item } = req.body;

  try {
    if (isMongoConnected) {
      if (action === 'mutation') {
        let Model;
        if (sheet === 'Accounts') Model = AccountModel;
        else if (sheet === 'Documents') Model = DocumentModel;
        else if (sheet === 'Votes') Model = VoteModel;
        else if (sheet === 'Notifications') Model = NotificationModel;
        else if (sheet === 'Files') Model = FileModel;
        else if (sheet === 'Suggestions') Model = SuggestionModel;
        else if (sheet === 'Sessions') Model = SessionModel;

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
              // Ngăn chặn cập nhật password qua sync (phải dùng API riêng)
              if (sheet === 'Accounts') {
                delete it.password;
              }
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
          // Sync accounts nhưng KHÔNG ghi đè password
          if (rows && rows.length > 0) {
            for (const row of rows) {
              delete row.password; // Không cho client ghi password
              await AccountModel.findOneAndUpdate(
                { id: row.id },
                { $set: row },
                { upsert: false } // Không tạo mới qua sync
              );
            }
          }
        } else if (sheet === 'Documents') {
          await DocumentModel.deleteMany({});
          if (rows && rows.length > 0) await DocumentModel.insertMany(rows);
        } else if (sheet === 'Votes') {
          await VoteModel.deleteMany({});
          if (rows && rows.length > 0) await VoteModel.insertMany(rows);
        } else if (sheet === 'Notifications') {
          await NotificationModel.deleteMany({});
          if (rows && rows.length > 0) await NotificationModel.insertMany(rows);
        } else if (sheet === 'Suggestions') {
          await SuggestionModel.deleteMany({});
          if (rows && rows.length > 0) await SuggestionModel.insertMany(rows);
        } else if (sheet === 'Files') {
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
        // Sync tất cả collections NGOẠI TRỪ accounts (không sync password)
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
        if (data.suggestions) {
          await SuggestionModel.deleteMany({});
          if (data.suggestions.length > 0) await SuggestionModel.insertMany(data.suggestions);
        }
        if (data.files) {
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
        // Sync accounts metadata only (not passwords)
        if (data.accounts) {
          for (const acc of data.accounts) {
            delete acc.password;
            await AccountModel.findOneAndUpdate(
              { id: acc.id },
              { $set: acc },
              { upsert: false }
            );
          }
        }
        if (data.sessions) {
          await SessionModel.deleteMany({});
          if (data.sessions.length > 0) await SessionModel.insertMany(data.sessions);
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
            if (key === 'accounts') delete it.password;
            const idx = db[key].findIndex(x => x.id === it.id);
            if (idx !== -1) {
              if (key === 'files' && !it.fileData && db[key][idx].fileData) {
                it.fileData = db[key][idx].fileData;
              }
              db[key][idx] = { ...db[key][idx], ...it };
            } else {
              if (key === 'files') {
                db[key].unshift(it);
              } else if (key !== 'accounts') {
                // Không cho tạo account mới qua sync
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
          const fileDataMap = {};
          (db.files || []).forEach(f => { if (f.fileData) fileDataMap[f.id] = f.fileData; });
          db.files = (rows || []).map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });
        } else if (key === 'accounts') {
          // Không sync password từ client
          for (const row of (rows || [])) {
            delete row.password;
            const idx = (db.accounts || []).findIndex(a => a.id === row.id);
            if (idx !== -1) {
              db.accounts[idx] = { ...db.accounts[idx], ...row };
            }
          }
        } else {
          db[key] = rows || [];
        }
        writeLocalDB(db);
        return res.json({ success: true, message: `Synced local sheet ${sheet}` });
      }

      if (action === 'syncAll' && data) {
        if (data.documents) db.documents = data.documents;
        if (data.votes) db.votes = data.votes;
        if (data.notifications) db.notifications = data.notifications;
        if (data.suggestions) db.suggestions = data.suggestions;
        if (data.files) {
          const fileDataMap = {};
          (db.files || []).forEach(f => { if (f.fileData) fileDataMap[f.id] = f.fileData; });
          db.files = data.files.map(row => {
            if (!row.fileData && fileDataMap[row.id]) {
              row.fileData = fileDataMap[row.id];
            }
            return row;
          });
        }
        if (data.accounts) {
          for (const acc of data.accounts) {
            delete acc.password;
            const idx = (db.accounts || []).findIndex(a => a.id === acc.id);
            if (idx !== -1) {
              db.accounts[idx] = { ...db.accounts[idx], ...acc };
            }
          }
        }
        if (data.sessions) db.sessions = data.sessions;
        writeLocalDB(db);
        return res.json({ success: true, message: 'Synced all local data' });
      }
    }

    res.status(400).json({ error: 'Unknown or unsupported action' });
  } catch (error) {
    console.error('Sync write error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

// Helper: Detect MIME type từ file extension
function detectMimeType(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const mimeMap = {
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pdf': 'application/pdf',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// POST /api/uploadFile - Upload file (yêu cầu xác thực)
app.post('/api/uploadFile', checkAuth, async (req, res) => {
  try {
    const { id, fileName, mimeType, base64, uploadedBy, description } = req.body;

    if (!fileName || !base64) {
      return res.status(400).json({ success: false, error: 'Thiếu tên file hoặc dữ liệu base64.' });
    }

    // Lấy phần base64 thuần (bỏ prefix data:...;base64, nếu có)
    const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    if (!rawBase64 || rawBase64.length < 10) {
      return res.status(400).json({ success: false, error: 'Dữ liệu file trống hoặc không hợp lệ.' });
    }

    const fileId = id || 'file_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    // Detect MIME type: ưu tiên từ data URL prefix > request body > file extension
    let resolvedMimeType;
    if (base64.startsWith('data:') && base64.includes(';base64,')) {
      // Đã có data URL đầy đủ - trích xuất MIME type từ đó
      resolvedMimeType = base64.substring(5, base64.indexOf(';base64,'));
    } else if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== '') {
      resolvedMimeType = mimeType;
    } else {
      // Detect từ file extension
      resolvedMimeType = detectMimeType(fileName);
    }

    // Tạo data URL đầy đủ
    let fullDataUrl;
    if (base64.startsWith('data:')) {
      fullDataUrl = base64;
    } else {
      fullDataUrl = `data:${resolvedMimeType};base64,${rawBase64}`;
    }

    const calculatedSize = Buffer.from(rawBase64, 'base64').length;
    const downloadUrl = `/api/download/${fileId}`;

    console.log(`Upload: file="${fileName}", mime=${resolvedMimeType}, size=${calculatedSize} bytes, id=${fileId}`);

    // Kiểm tra giới hạn kích thước (MongoDB giới hạn 16MB/document)
    if (fullDataUrl.length > 15 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.' });
    }

    const fileDoc = {
      id: fileId,
      fileName,
      fileSize: calculatedSize,
      uploadedBy: uploadedBy || 'admin',
      description: description || '',
      createdAt: new Date().toISOString(),
      downloadUrl,
      fileData: fullDataUrl
    };

    if (isMongoConnected) {
      await new FileModel(fileDoc).save();
      console.log(`Upload: Lưu MongoDB OK, id=${fileId}`);
    } else {
      const db = readLocalDB();
      db.files = db.files || [];
      db.files.unshift(fileDoc);
      writeLocalDB(db);
      console.log(`Upload: Lưu db.json OK, id=${fileId}`);
    }

    return res.json({ success: true, downloadUrl, fileId });
  } catch (error) {
    console.error('Upload error:', error.message || error);
    if (error.message && error.message.includes('document is larger')) {
      return res.status(413).json({ success: false, error: 'File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.' });
    }
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + (error.message || 'Không xác định') });
  }
});

// GET /api/download/:id - Tải file (yêu cầu xác thực)
app.get('/api/download/:id', checkAuth, async (req, res) => {
  const fileId = req.params.id;

  try {
    let fileRecord = null;

    if (isMongoConnected) {
      fileRecord = await FileModel.findOne({ id: fileId });
    } else {
      const db = readLocalDB();
      fileRecord = (db.files || []).find(f => f.id === fileId);
    }

    if (!fileRecord) {
      console.error(`Download: File record không tồn tại cho id=${fileId}`);
      return res.status(404).json({ error: 'Không tìm thấy tệp tin.' });
    }

    if (!fileRecord.fileData) {
      console.error(`Download: File record tồn tại nhưng không có fileData, id=${fileId}`);
      return res.status(404).json({ error: 'Tệp tin chưa được tải lên hoặc dữ liệu đã bị mất.' });
    }

    if (!fileRecord.fileData.startsWith('data:')) {
      console.error(`Download: fileData không bắt đầu bằng "data:", id=${fileId}`);
      return res.status(500).json({ error: 'Dữ liệu tệp tin bị hỏng.' });
    }

    const parts = fileRecord.fileData.split(';base64,');
    if (parts.length !== 2) {
      console.error(`Download: fileData không đúng format base64, id=${fileId}`);
      return res.status(500).json({ error: 'Dữ liệu tệp tin bị hỏng.' });
    }

    const contentType = parts[0].substring(5);
    const base64Data = parts[1].trim();
    const fileBuffer = Buffer.from(base64Data, 'base64');

    if (fileBuffer.length === 0) {
      console.error(`Download: File buffer trống sau khi decode base64, id=${fileId}`);
      return res.status(500).json({ error: 'Dữ liệu tệp tin bị trống.' });
    }

    console.log(`Download: Đang gửi file "${fileRecord.fileName}" (${fileBuffer.length} bytes), id=${fileId}`);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileBuffer.length);

    const encodedFileName = encodeURIComponent(fileRecord.fileName).replace(/'/g, "%27");
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);

    res.send(fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});



// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler - ẩn thông tin lỗi chi tiết
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔒 Security hardened: Helmet, Rate-Limit, CORS, bcrypt, mongo-sanitize enabled`);
});
