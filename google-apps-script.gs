/**
 * ============================================
 * GOOGLE APPS SCRIPT - Backend cho Google Sheets
 * ============================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 
 * 1. Truy cập https://sheets.google.com và tạo Google Sheet mới
 *    - Đặt tên: "HiepHoa_Admin_Data"
 *    - Tạo 5 sheet (tab) với tên CHÍNH XÁC:
 *      + Accounts
 *      + Documents
 *      + Votes
 *      + Notifications
 *      + Files
 * 
 * 2. Truy cập https://script.google.com
 *    - Tạo project mới
 *    - Xóa nội dung mặc định, dán TOÀN BỘ code bên dưới
 *    - Sửa SPREADSHEET_ID thành ID của Google Sheet bạn vừa tạo
 *      (ID nằm trong URL: https://docs.google.com/spreadsheets/d/{ID}/edit)
 * 
 * 3. Deploy:
 *    - Nhấn "Deploy" → "New deployment"
 *    - Type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 *    - Nhấn "Deploy"
 *    - Copy URL Web App
 * 
 * 4. Dán URL vào phần cài đặt Google Sheets trong ứng dụng
 */

// ========== CẤU HÌNH ==========
// Thay bằng ID Google Sheet của bạn
const SPREADSHEET_ID = '1oXzK7wvFkVBI0dcPo5xYQJGxApI1iuU-jxUqFDnuEmA';

// Mã token bí mật để xác thực quyền truy cập từ website
const SECRET_TOKEN = 'HiepHoaSecret2026';

// Tên các sheet
const SHEET_NAMES = {
  ACCOUNTS: 'Accounts',
  DOCUMENTS: 'Documents',
  VOTES: 'Votes',
  NOTIFICATIONS: 'Notifications',
  FILES: 'Files'
};

// ========== HANDLER CHÍNH ==========

function doGet(e) {
  try {
    const token = e.parameter.token;
    if (token !== SECRET_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized: Sai mã bảo mật truy cập.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = e.parameter.action;
    const sheet = e.parameter.sheet;
    
    let result;
    
    switch(action) {
      case 'read':
        result = readSheet(sheet);
        break;
      case 'readAll':
        result = readAllSheets();
        break;
      case 'export':
        result = exportData(sheet);
        break;
      default:
        result = { error: 'Unknown action' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = data.token;
    if (token !== SECRET_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized: Sai mã bảo mật truy cập.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = data.action;
    
    let result;
    
    switch(action) {
      case 'sync':
        result = syncData(data.sheet, data.rows);
        break;
      case 'syncAll':
        result = syncAllData(data.data);
        break;
      case 'uploadFile':
        result = uploadFileToDrive(data.fileName, data.base64, data.mimeType);
        break;
      case 'append':
        result = appendRow(data.sheet, data.row);
        break;
      case 'update':
        result = updateRow(data.sheet, data.id, data.row);
        break;
      case 'delete':
        result = deleteRow(data.sheet, data.id);
        break;
      default:
        result = { error: 'Unknown action' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== ĐỌC DỮ LIỆU ==========

function readSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { error: `Sheet "${sheetName}" not found` };
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { data: [] };
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let val = data[i][j];
      // Parse JSON strings
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      row[headers[j]] = val;
    }
    rows.push(row);
  }
  
  return { data: rows };
}

function readAllSheets() {
  const result = {};
  Object.values(SHEET_NAMES).forEach(name => {
    const sheetData = readSheet(name);
    result[name] = sheetData.data || [];
  });
  return { data: result };
}

// ========== GHI DỮ LIỆU ==========

function syncData(sheetName, rows) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Clear existing data
  sheet.clear();
  
  if (!rows || rows.length === 0) {
    return { success: true, message: `Sheet "${sheetName}" cleared` };
  }
  
  // Get all unique headers
  const headerSet = new Set();
  rows.forEach(row => {
    Object.keys(row).forEach(key => headerSet.add(key));
  });
  const headers = Array.from(headerSet);
  
  // Write headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a3a5c');
  headerRange.setFontColor('#ffffff');
  
  // Write data rows
  const dataRows = rows.map(row => {
    return headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });
  });
  
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
  }
  
  // Auto-resize columns
  headers.forEach((_, i) => {
    sheet.autoResizeColumn(i + 1);
  });
  
  return { success: true, message: `Synced ${rows.length} rows to "${sheetName}"` };
}

function syncAllData(data) {
  const results = {};
  
  if (data.accounts) results.accounts = syncData(SHEET_NAMES.ACCOUNTS, data.accounts);
  if (data.documents) results.documents = syncData(SHEET_NAMES.DOCUMENTS, data.documents);
  if (data.votes) results.votes = syncData(SHEET_NAMES.VOTES, data.votes);
  if (data.notifications) results.notifications = syncData(SHEET_NAMES.NOTIFICATIONS, data.notifications);
  if (data.files) results.files = syncData(SHEET_NAMES.FILES, data.files);
  
  return { success: true, results };
}

function appendRow(sheetName, rowData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = Object.keys(rowData);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    const val = rowData[header];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });
  
  sheet.appendRow(newRow);
  
  return { success: true, message: 'Row appended' };
}

function updateRow(sheetName, id, rowData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { error: `Sheet "${sheetName}" not found` };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  
  if (idCol === -1) return { error: 'No id column found' };
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      const updatedRow = headers.map(header => {
        if (rowData.hasOwnProperty(header)) {
          const val = rowData[header];
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        }
        return data[i][headers.indexOf(header)];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
      return { success: true, message: 'Row updated' };
    }
  }
  
  return { error: 'Row not found' };
}

function deleteRow(sheetName, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { error: `Sheet "${sheetName}" not found` };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  
  if (idCol === -1) return { error: 'No id column found' };
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Row deleted' };
    }
  }
  
  return { error: 'Row not found' };
}

// ========== XUẤT DỮ LIỆU ==========

function exportData(sheetName) {
  if (sheetName) {
    return readSheet(sheetName);
  }
  return readAllSheets();
}

// ========== TẢI FILE LÊN GOOGLE DRIVE ==========

function uploadFileToDrive(fileName, base64Data, mimeType) {
  try {
    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = DriveApp.createFile(blob);
    
    // Thiết lập quyền chia sẻ công khai cho bất kỳ ai có link đều xem/tải được
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      downloadUrl: file.getDownloadUrl(),
      viewUrl: file.getUrl()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
