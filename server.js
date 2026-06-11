const express = require('express');
const path = require('path');
const app = express();

// Render uses port 10000 by default, or falls back to standard env port
const PORT = process.env.PORT || 10000;

// Phục vụ các file tĩnh trực tiếp từ thư mục gốc
app.use(express.static(__dirname));

// Nếu truy cập sai đường dẫn, trả về index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
