
import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('backend/migrations/sql');
const destDir = path.resolve('supabase/migrations');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Clear existing migrations in supabase/migrations to avoid duplicates/confusion
// fs.rmSync(destDir, { recursive: true, force: true });
// fs.mkdirSync(destDir);
// Actually, let's keep it safe. If there are files, we might be running this twice. 
// Ideally we should check if they exist. But since we just init-ed, it should be empty or have only config.toml (which is in parent).

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.sql'));
files.sort((a, b) => {
    // Extract number
    const numA = parseInt(a.split('_')[0], 10);
    const numB = parseInt(b.split('_')[0], 10);
    return numA - numB;
});

// Base date: 2024-01-01 00:00:00
let baseDate = new Date('2024-01-01T00:00:00Z');

files.forEach((file, index) => {
    // Increment by 1 minute per file
    // Format: YYYYMMDDHHMMSS
    const date = new Date(baseDate.getTime() + index * 60000);
    const timestamp = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const newName = `${timestamp}_${file}`;
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, newName);

    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} -> ${newName}`);
});

console.log('Done copying migrations.');
