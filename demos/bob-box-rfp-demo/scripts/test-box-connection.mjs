import { getBoxAccessToken } from './box-auth.mjs';

let token = '';
try {
  token = await getBoxAccessToken();
} catch (err) {
  console.error('❌ Authentication failed:', err.message);
  process.exit(1);
}

if (!token) {
  console.error('❌ Error: No Box credentials found in .env. Configure BOX_CLIENT_ID & BOX_CLIENT_SECRET or BOX_DEV_TOKEN.');
  process.exit(1);
}

console.log('🔍 Testing Box API connection with your credentials...');

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
