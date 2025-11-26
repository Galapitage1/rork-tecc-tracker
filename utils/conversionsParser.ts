import * as XLSX from 'xlsx';
import { ProductConversion, Product } from '@/types';

export interface ParsedConversionsData {
  conversions: ProductConversion[];
  errors: string[];
}

export function parseConversionsExcel(base64Data: string, products: Product[], existingConversions: ProductConversion[]): ParsedConversionsData {
  const errors: string[] = [];
  const conversions: ProductConversion[] = [];

  try {
    const workbook = XLSX.read(base64Data, { type: 'base64' });
    
    const conversionSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('conversion')
    );
    
    if (!conversionSheetName) {
      errors.push('No "Conversions" sheet found in the Excel file');
      return { conversions: [], errors };
    }

    const worksheet = workbook.Sheets[conversionSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      errors.push('Conversions sheet has no data rows');
      return { conversions: [], errors };
    }

    const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
    console.log('[ConversionsParser] Headers:', headers);
    
    const productNameIndex = headers.findIndex((h: string) => 
      h.includes('product') && h.includes('name')
    );
    const fromUnitIndex = headers.findIndex((h: string) => 
      h.includes('from') && h.includes('unit')
    );
    const conversionFactorIndex = headers.findIndex((h: string) => 
      h.includes('conversion') && h.includes('factor')
    );
    const toUnitIndex = headers.findIndex((h: string) => 
      h.includes('to') && h.includes('unit')
    );
    const fromProductIdIndex = headers.findIndex((h: string) => 
      h.includes('from') && h.includes('product') && h.includes('id')
    );
    const toProductIdIndex = headers.findIndex((h: string) => 
      h.includes('to') && h.includes('product') && h.includes('id')
    );

    console.log('[ConversionsParser] Column indices:', {
      productNameIndex,
      fromUnitIndex,
      conversionFactorIndex,
      toUnitIndex,
      fromProductIdIndex,
      toProductIdIndex
    });

    if (productNameIndex === -1 || fromUnitIndex === -1 || conversionFactorIndex === -1 || toUnitIndex === -1) {
      errors.push('Conversions sheet missing required columns: Product Name, From Unit, Conversion Factor, To Unit');
      return { conversions: [], errors };
    }

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const productName = row[productNameIndex];
      
      if (!productName || String(productName).trim() === '') {
        console.log(`[ConversionsParser] Skipping row ${i} - empty product name`);
        continue;
      }

      const fromUnit = row[fromUnitIndex];
      const toUnit = row[toUnitIndex];
      const conversionFactor = row[conversionFactorIndex];

      if (!fromUnit || !toUnit || !conversionFactor) {
        errors.push(`Row ${i + 1}: Missing required data (Product: ${productName})`);
        continue;
      }

      const parsedProductName = String(productName).trim().toLowerCase();
      const parsedFromUnit = String(fromUnit).trim().toLowerCase();
      const parsedToUnit = String(toUnit).trim().toLowerCase();
      const parsedConversionFactor = Number(conversionFactor);

      if (isNaN(parsedConversionFactor) || parsedConversionFactor <= 0) {
        errors.push(`Row ${i + 1}: Invalid conversion factor (${conversionFactor})`);
        continue;
      }

      let fromProduct: Product | undefined;
      let toProduct: Product | undefined;

      if (fromProductIdIndex !== -1 && row[fromProductIdIndex]) {
        fromProduct = products.find(p => p.id === String(row[fromProductIdIndex]));
      }
      
      if (toProductIdIndex !== -1 && row[toProductIdIndex]) {
        toProduct = products.find(p => p.id === String(row[toProductIdIndex]));
      }

      if (!fromProduct) {
        fromProduct = products.find(p => 
          p.name.toLowerCase().trim() === parsedProductName &&
          p.unit.toLowerCase().trim() === parsedFromUnit
        );
      }

      if (!toProduct) {
        toProduct = products.find(p => 
          p.name.toLowerCase().trim() === parsedProductName &&
          p.unit.toLowerCase().trim() === parsedToUnit
        );
      }

      if (!fromProduct || !toProduct) {
        errors.push(`Row ${i + 1}: Products not found (${productName}: ${fromUnit} -> ${toUnit})`);
        console.log(`[ConversionsParser] Products not found:`, {
          searchName: parsedProductName,
          fromUnit: parsedFromUnit,
          toUnit: parsedToUnit,
          fromProduct: fromProduct?.name,
          toProduct: toProduct?.name
        });
        continue;
      }

      const existingConversion = existingConversions.find(c => 
        c.fromProductId === fromProduct.id && c.toProductId === toProduct.id
      );

      if (existingConversion) {
        console.log(`[ConversionsParser] Skipping row ${i} - conversion already exists`);
        continue;
      }

      const newConversion: ProductConversion = {
        id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        fromProductId: fromProduct.id,
        toProductId: toProduct.id,
        conversionFactor: parsedConversionFactor,
        createdAt: Date.now(),
      };

      conversions.push(newConversion);
      console.log(`[ConversionsParser] Added conversion: ${fromProduct.name} (${fromProduct.unit}) -> ${toProduct.name} (${toProduct.unit}) x${parsedConversionFactor}`);
    }

    if (conversions.length === 0 && errors.length === 0) {
      errors.push('No new conversions found in the Excel file (all may already exist)');
    }

  } catch (error) {
    errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { conversions, errors };
}
