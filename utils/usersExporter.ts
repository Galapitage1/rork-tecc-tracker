import * as XLSX from 'xlsx';
import { writeAsStringAsync, getInfoAsync } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { User, UserRole } from '@/types';

export async function exportUsersToExcel(users: User[]): Promise<void> {
  console.log('=== USERS EXPORT START ===');
  console.log('Platform:', Platform.OS);
  console.log('Users count:', users.length);
  
  try {
    if (!users || users.length === 0) {
      throw new Error('No users to export');
    }

    const userData = users.map(user => ({
      'Username': user.username,
      'Role': user.role,
      'Created At': new Date(user.createdAt).toLocaleString(),
      'Updated At': user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '',
    }));
    console.log('User data prepared:', userData.length, 'rows');

    const summaryData = [
      { Field: 'Total Users', Value: users.length },
      { Field: 'Super Admins', Value: users.filter(u => u.role === 'superadmin').length },
      { Field: 'Admins', Value: users.filter(u => u.role === 'admin').length },
      { Field: 'Users', Value: users.filter(u => u.role === 'user').length },
      { Field: 'Report Generated', Value: new Date().toLocaleString() },
    ];

    console.log('Creating workbook...');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    console.log('Summary sheet added');
    
    const usersWs = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(wb, usersWs, 'Users');
    console.log('Users sheet added');

    console.log('Writing workbook...');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    console.log('Workbook written, size:', wbout.length, 'chars');
    
    const fileName = `users_${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log('File name:', fileName);
    
    if (Platform.OS === 'web') {
      console.log('Starting web export...');
      try {
        const blob = base64ToBlob(wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        console.log('Blob created, size:', blob.size);
        
        const url = URL.createObjectURL(blob);
        console.log('Object URL created:', url);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        console.log('Link added to DOM');
        
        link.click();
        console.log('Link clicked');
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Cleanup completed');
        }, 100);
        
        console.log('=== WEB USERS EXPORT COMPLETED ===');
      } catch (webError) {
        console.error('Web export error:', webError);
        throw new Error(`Web export failed: ${webError instanceof Error ? webError.message : 'Unknown error'}`);
      }
    } else {
      console.log('Starting mobile export...');
      try {
        if (!(FileSystem as any).documentDirectory) {
          throw new Error('Document directory not available');
        }
        
        const fileUri = `${(FileSystem as any).documentDirectory}${fileName}`;
        console.log('File URI:', fileUri);
        
        await writeAsStringAsync(fileUri, wbout, {
          encoding: 'base64',
        });
        console.log('File written successfully');
        
        const fileInfo = await getInfoAsync(fileUri);
        console.log('File info:', fileInfo);
        
        const canShare = await Sharing.isAvailableAsync();
        console.log('Sharing available:', canShare);
        
        if (!canShare) {
          throw new Error('Sharing is not available on this device');
        }
        
        console.log('Starting share dialog...');
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save Users Export',
          UTI: 'com.microsoft.excel.xlsx',
        });
        console.log('=== MOBILE USERS EXPORT COMPLETED ===');
      } catch (mobileError) {
        console.error('Mobile export error:', mobileError);
        throw new Error(`Mobile export failed: ${mobileError instanceof Error ? mobileError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('=== USERS EXPORT FAILED ===');
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export async function parseUsersExcel(base64Data: string): Promise<{ data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[]; errors: string[] }> {
  try {
    const wb = XLSX.read(base64Data, { type: 'base64' });
    const sheetName = wb.SheetNames.find(name => name === 'Users') || wb.SheetNames[0];
    
    if (!sheetName) {
      return { data: [], errors: ['No sheet found in Excel file'] };
    }
    
    const ws = wb.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    
    const users: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];
    
    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      
      if (!row['Username'] || typeof row['Username'] !== 'string') {
        errors.push(`Row ${rowNum}: Invalid or missing username`);
        return;
      }
      
      if (!row['Role'] || typeof row['Role'] !== 'string') {
        errors.push(`Row ${rowNum}: Invalid or missing role`);
        return;
      }
      
      const roleLower = row['Role'].toLowerCase().trim();
      let role: UserRole;
      if (roleLower === 'superadmin') {
        role = 'superadmin';
      } else if (roleLower === 'admin') {
        role = 'admin';
      } else if (roleLower === 'user') {
        role = 'user';
      } else {
        errors.push(`Row ${rowNum}: Invalid role "${row['Role']}" (must be superadmin, admin, or user)`);
        return;
      }
      
      users.push({
        username: row['Username'].trim(),
        role,
      });
    });
    
    return { data: users, errors };
  } catch (error) {
    return { data: [], errors: ['Failed to parse Excel file: ' + (error instanceof Error ? error.message : 'Unknown error')] };
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
