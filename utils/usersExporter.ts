import * as XLSX from 'xlsx';
import { writeAsStringAsync, getInfoAsync } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { User, UserRole } from '@/types';

export async function exportUsersToExcel(users: User[]): Promise<void> {
  console.log('=== USERS EXPORT START ===');
  console.log('Platform:', Platform.OS);
  console.log('Users:', users.length);
  
  try {
    if (!users || users.length === 0) {
      throw new Error('No users to export');
    }

    const usersData = users.map(user => ({
      'Username': user.username,
      'Role': user.role,
      'Created At': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
      'Last Updated': user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '',
    }));
    
    console.log('Users data prepared:', usersData.length, 'rows');

    console.log('Creating workbook...');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');
    
    const usersWs = XLSX.utils.json_to_sheet(usersData);
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
        
        console.log('=== WEB EXPORT COMPLETED ===');
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
          dialogTitle: 'Save Users List',
          UTI: 'com.microsoft.excel.xlsx',
        });
        console.log('=== MOBILE EXPORT COMPLETED ===');
      } catch (mobileError) {
        console.error('Mobile export error:', mobileError);
        throw new Error(`Mobile export failed: ${mobileError instanceof Error ? mobileError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('=== EXPORT FAILED ===');
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export interface ParsedUsersData {
  users: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: string[];
}

export function parseUsersExcel(base64Data: string): ParsedUsersData {
  const errors: string[] = [];
  const users: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  try {
    const workbook = XLSX.read(base64Data, { type: 'base64' });
    
    if (workbook.SheetNames.length === 0) {
      errors.push('Excel file has no sheets');
      return { users, errors };
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      errors.push('No data rows found in Excel file');
      return { users, errors };
    }

    const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
    const usernameIndex = headers.findIndex((h: string) => h.includes('username') || h === 'name');
    const roleIndex = headers.findIndex((h: string) => h.includes('role'));

    if (usernameIndex === -1) {
      errors.push('Missing required "Username" column');
      return { users, errors };
    }

    if (roleIndex === -1) {
      errors.push('Missing required "Role" column');
      return { users, errors };
    }

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const username = row[usernameIndex];
      const roleValue = row[roleIndex];
      
      if (!username || String(username).trim() === '') continue;
      if (!roleValue || String(roleValue).trim() === '') continue;

      const roleStr = String(roleValue).toLowerCase().trim();
      let role: UserRole = 'user';
      if (roleStr === 'admin') {
        role = 'admin';
      } else if (roleStr === 'superadmin' || roleStr === 'super admin') {
        role = 'superadmin';
      }

      const user = {
        username: String(username).trim(),
        role,
      };

      users.push(user);
    }

    if (users.length === 0) {
      errors.push('No valid users found in Excel file');
    }

  } catch (error) {
    errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { users, errors };
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
