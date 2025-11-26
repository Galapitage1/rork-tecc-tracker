import * as XLSX from 'xlsx';
import { writeAsStringAsync, getInfoAsync } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ProductConversion, Product } from '@/types';

export async function exportConversionsToExcel(
  conversions: ProductConversion[],
  products: Product[]
): Promise<void> {
  console.log('=== CONVERSIONS EXPORT START ===');
  console.log('Platform:', Platform.OS);
  console.log('Conversions:', conversions.length);
  
  try {
    if (!conversions || conversions.length === 0) {
      throw new Error('No conversions to export');
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    console.log('Product map created with', productMap.size, 'products');
    
    const conversionData = conversions.map(conversion => {
      const fromProduct = productMap.get(conversion.fromProductId);
      const toProduct = productMap.get(conversion.toProductId);
      
      return {
        'Product Name': fromProduct?.name || 'Unknown',
        'From Unit': fromProduct?.unit || 'Unknown',
        'Conversion Factor': conversion.conversionFactor,
        'To Unit': toProduct?.unit || 'Unknown',
        'From Product ID': conversion.fromProductId,
        'To Product ID': conversion.toProductId,
        'Created At': conversion.createdAt ? new Date(conversion.createdAt).toLocaleString() : '',
      };
    });
    console.log('Conversion data prepared:', conversionData.length, 'rows');

    const summaryData = [
      { Field: 'Total Conversions', Value: conversions.length },
      { Field: 'Export Date', Value: new Date().toLocaleString() },
    ];

    console.log('Creating workbook...');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    console.log('Summary sheet added');
    
    const conversionsWs = XLSX.utils.json_to_sheet(conversionData);
    XLSX.utils.book_append_sheet(wb, conversionsWs, 'Conversions');
    console.log('Conversions sheet added');

    console.log('Writing workbook...');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    console.log('Workbook written, size:', wbout.length, 'chars');
    
    const fileName = `product_conversions_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        
        console.log('=== WEB CONVERSIONS EXPORT COMPLETED ===');
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
          dialogTitle: 'Save Product Conversions',
          UTI: 'com.microsoft.excel.xlsx',
        });
        console.log('=== MOBILE CONVERSIONS EXPORT COMPLETED ===');
      } catch (mobileError) {
        console.error('Mobile export error:', mobileError);
        throw new Error(`Mobile export failed: ${mobileError instanceof Error ? mobileError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('=== CONVERSIONS EXPORT FAILED ===');
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
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
