import * as XLSX from 'xlsx';
import { writeAsStringAsync, getInfoAsync } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Outlet } from '@/types';

export async function exportOutletsToExcel(outlets: Outlet[]): Promise<void> {
  console.log('=== OUTLETS EXPORT START ===');
  console.log('Platform:', Platform.OS);
  console.log('Outlets count:', outlets.length);
  
  try {
    if (!outlets || outlets.length === 0) {
      throw new Error('No outlets to export');
    }

    const outletData = outlets.map(outlet => ({
      'Name': outlet.name,
      'Created At': new Date(outlet.createdAt).toLocaleString(),
      'Updated At': outlet.updatedAt ? new Date(outlet.updatedAt).toLocaleString() : '',
    }));
    console.log('Outlet data prepared:', outletData.length, 'rows');

    const summaryData = [
      { Field: 'Total Outlets', Value: outlets.length },
      { Field: 'Report Generated', Value: new Date().toLocaleString() },
    ];

    console.log('Creating workbook...');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    console.log('Summary sheet added');
    
    const outletsWs = XLSX.utils.json_to_sheet(outletData);
    XLSX.utils.book_append_sheet(wb, outletsWs, 'Outlets');
    console.log('Outlets sheet added');

    console.log('Writing workbook...');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    console.log('Workbook written, size:', wbout.length, 'chars');
    
    const fileName = `outlets_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        
        console.log('=== WEB OUTLETS EXPORT COMPLETED ===');
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
          dialogTitle: 'Save Outlets Export',
          UTI: 'com.microsoft.excel.xlsx',
        });
        console.log('=== MOBILE OUTLETS EXPORT COMPLETED ===');
      } catch (mobileError) {
        console.error('Mobile export error:', mobileError);
        throw new Error(`Mobile export failed: ${mobileError instanceof Error ? mobileError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('=== OUTLETS EXPORT FAILED ===');
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export async function parseOutletsExcel(base64Data: string): Promise<{ data: { name: string }[]; errors: string[] }> {
  try {
    const wb = XLSX.read(base64Data, { type: 'base64' });
    const sheetName = wb.SheetNames.find(name => name === 'Outlets') || wb.SheetNames[0];
    
    if (!sheetName) {
      return { data: [], errors: ['No sheet found in Excel file'] };
    }
    
    const ws = wb.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    
    const outlets: { name: string }[] = [];
    const errors: string[] = [];
    
    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      
      if (!row['Name'] || typeof row['Name'] !== 'string') {
        errors.push(`Row ${rowNum}: Invalid or missing name`);
        return;
      }
      
      outlets.push({
        name: row['Name'].trim(),
      });
    });
    
    return { data: outlets, errors };
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
