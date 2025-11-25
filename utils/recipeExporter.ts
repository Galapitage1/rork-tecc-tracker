import { writeAsStringAsync } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Recipe, Product } from '@/types';
import { Platform } from 'react-native';

export async function exportRecipesToExcel(
  recipes: Recipe[], 
  products: Product[]
): Promise<void> {
  try {
    const XLSX = await import('xlsx');

    const productsMap = new Map(products.map(p => [p.id, p]));

    const worksheetData: any[][] = [];

    recipes.forEach((recipe, recipeIndex) => {
      const menuProduct = productsMap.get(recipe.menuProductId);
      if (!menuProduct) return;

      if (recipeIndex > 0) {
        worksheetData.push([]);
      }

      worksheetData.push([
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
        menuProduct.name, '', '', '', '', '', ''
      ]);
      worksheetData.push([
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
        '', '', '', '', '', '', ''
      ]);
      worksheetData.push([
        '', '', '', '', '', 
        `1${menuProduct.unit}`, '', '', '', '', '', '', '', '', '', 
        '', '', '', '', '', '', ''
      ]);
      worksheetData.push([
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
        '', '', '', '', '', '', ''
      ]);
      worksheetData.push([
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
        '', '', '', '', '', '', ''
      ]);

      recipe.components.forEach(component => {
        const rawProduct = productsMap.get(component.rawProductId);
        if (!rawProduct) return;

        worksheetData.push([
          '', '', '', '', '', '', '', '', 
          rawProduct.name, '', '', '', '', '', 
          `1${rawProduct.unit}`, '', '', 
          component.quantityPerUnit, '', '', '', ''
        ]);
      });
    });

    const headerRow = [
      '', '', '', '', '', 'Product Unit', '', '', 
      'Raw Material Name', '', '', '', '', '', 
      'Raw Material Unit', '', '', 
      'Quantity', '', '', '', ''
    ];

    const finalData = [headerRow, ...worksheetData];

    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    const columnWidths = Array(22).fill({ wch: 12 });
    columnWidths[5] = { wch: 15 };
    columnWidths[8] = { wch: 20 };
    columnWidths[14] = { wch: 15 };
    columnWidths[15] = { wch: 15 };
    columnWidths[17] = { wch: 10 };
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recipes');

    const wbout = XLSX.write(workbook, {
      type: 'base64',
      bookType: 'xlsx',
    });

    const filename = `recipes_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (Platform.OS === 'web') {
      const blob = base64ToBlob(wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const docDir = (FileSystem as any).documentDirectory;
      if (!docDir) throw new Error('Document directory not available');
      const fileUri = docDir + filename;
      await writeAsStringAsync(fileUri, wbout, {
        encoding: 'base64',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Recipes',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        console.log('Sharing is not available on this device');
      }
    }
  } catch (error) {
    console.error('Error exporting recipes to Excel:', error);
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
