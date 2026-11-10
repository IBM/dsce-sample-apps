import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Read .env
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = val;
    }
  }
}

const token = process.env.BOX_DEV_TOKEN;
if (!token) {
  console.error('❌ Error: No BOX_DEV_TOKEN found in .env');
  process.exit(1);
}

console.log('🔍 Testing Box API connection with your token...');

try {
  // Query Box API /users/me
  const userRes = await fetch('https://api.box.com/2.0/users/me', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!userRes.ok) {
    const err = await userRes.json();
    console.error('❌ Box API Error:', err.message || userRes.statusText);
    process.exit(1);
  }

  const user = await userRes.json();
  console.log(`✅ Successfully connected as: ${user.name} (${user.login})`);

  // Query Root Folder items
  const folderRes = await fetch('https://api.box.com/2.0/folders/0/items?limit=20', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (folderRes.ok) {
    const folderData = await folderRes.json();
    console.log(`\n📂 Files & Folders in your Box Root:`);
    if (folderData.entries.length === 0) {
      console.log('   (Root folder is empty)');
    } else {
      folderData.entries.forEach((item) => {
        const icon = item.type === 'folder' ? '📁' : '📄';
        console.log(`   ${icon} [${item.type}] ${item.name} (ID: ${item.id})`);
      });
    }
  }
} catch (error) {
  console.error('❌ Connection error:', error.message);
}
