import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useStock } from '@/contexts/StockContext';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, ArrowLeft, Download, Upload, Search, Trash } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ProductConversion } from '@/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportConversionsToExcel } from '@/utils/conversionsExporter';
import { parseConversionsExcel } from '@/utils/conversionsParser';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function ProductConversionsScreen() {
  const router = useRouter();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { products, productConversions, addProductConversion, importProductConversions, updateProductConversion, deleteProductConversion, clearAllConversions } = useStock();
  const [showConversionModal, setShowConversionModal] = useState<boolean>(false);
  const [editingConversion, setEditingConversion] = useState<ProductConversion | null>(null);
  const [conversionFromProductId, setConversionFromProductId] = useState<string>('');
  const [conversionToProductId, setConversionToProductId] = useState<string>('');
  const [conversionFactor, setConversionFactor] = useState<string>('');
  const [searchFromProduct, setSearchFromProduct] = useState<string>('');
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    destructive?: boolean;
    onConfirm: () => Promise<void> | void;
    testID: string;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) {
      Alert.alert('Access Denied', 'Only admins can access this page.');
      router.replace('/(tabs)/settings');
    }
  }, [isAdmin, isSuperAdmin, router]);

  if (!isAdmin && !isSuperAdmin) {
    return null;
  }

  const handleOpenConversionModal = (conversion?: ProductConversion) => {
    if (conversion) {
      setEditingConversion(conversion);
      setConversionFromProductId(conversion.fromProductId);
      setConversionToProductId(conversion.toProductId);
      setConversionFactor(conversion.conversionFactor.toString());
    } else {
      setEditingConversion(null);
      setConversionFromProductId('');
      setConversionToProductId('');
      setConversionFactor('');
    }
    setShowConversionModal(true);
  };

  const handleCloseConversionModal = () => {
    setShowConversionModal(false);
    setEditingConversion(null);
    setConversionFromProductId('');
    setConversionToProductId('');
    setConversionFactor('');
    setSearchFromProduct('');
  };

  const resetConversionForm = () => {
    setEditingConversion(null);
    setConversionFromProductId('');
    setConversionToProductId('');
    setConversionFactor('');
    setSearchFromProduct('');
  };

  const getSortedProducts = () => {
    return [...products].sort((a, b) => {
      const unitA = a.unit.toLowerCase();
      const unitB = b.unit.toLowerCase();
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      
      if (unitA !== unitB) {
        return unitA.localeCompare(unitB);
      }
      
      return nameA.localeCompare(nameB);
    });
  };

  const handleSaveConversion = async () => {
    if (!conversionFromProductId || !conversionToProductId) {
      Alert.alert('Error', 'Please select both products.');
      return;
    }

    if (!conversionFactor.trim() || isNaN(parseFloat(conversionFactor)) || parseFloat(conversionFactor) <= 0) {
      Alert.alert('Error', 'Please enter a valid conversion factor.');
      return;
    }

    const fromProduct = products.find(p => p.id === conversionFromProductId);
    const toProduct = products.find(p => p.id === conversionToProductId);

    if (!fromProduct || !toProduct) {
      Alert.alert('Error', 'Selected products not found.');
      return;
    }

    if (fromProduct.name.toLowerCase() !== toProduct.name.toLowerCase()) {
      Alert.alert('Error', 'Products must have the same name but different units.');
      return;
    }

    if (fromProduct.unit.toLowerCase() === toProduct.unit.toLowerCase()) {
      Alert.alert('Error', 'Products must have different units.');
      return;
    }

    const existingConversion = productConversions.find(c => 
      c.fromProductId === conversionFromProductId && c.toProductId === conversionToProductId &&
      (!editingConversion || c.id !== editingConversion.id)
    );

    if (existingConversion) {
      Alert.alert('Error', 'A conversion for these products already exists.');
      return;
    }

    try {
      if (editingConversion) {
        await updateProductConversion(editingConversion.id, {
          fromProductId: conversionFromProductId,
          toProductId: conversionToProductId,
          conversionFactor: parseFloat(conversionFactor),
        });
        Alert.alert('Success', 'Product conversion updated successfully.');
        handleCloseConversionModal();
      } else {
        const newConversion: ProductConversion = {
          id: Date.now().toString(),
          fromProductId: conversionFromProductId,
          toProductId: conversionToProductId,
          conversionFactor: parseFloat(conversionFactor),
          createdAt: Date.now(),
        };
        await addProductConversion(newConversion);
        Alert.alert('Success', 'Product conversion added successfully.');
        resetConversionForm();
      }
    } catch {
      Alert.alert('Error', 'Failed to save product conversion.');
    }
  };

  const openConfirm = (cfg: { title: string; message: string; destructive?: boolean; onConfirm: () => Promise<void> | void; testID: string }) => {
    setConfirmState(cfg);
    setConfirmVisible(true);
  };

  const handleDeleteConversion = (conversion: ProductConversion) => {
    const fromProduct = products.find(p => p.id === conversion.fromProductId);
    const toProduct = products.find(p => p.id === conversion.toProductId);
    const message = fromProduct && toProduct 
      ? `Are you sure you want to delete the conversion from ${fromProduct.name} (${fromProduct.unit}) to ${toProduct.name} (${toProduct.unit})?`
      : 'Are you sure you want to delete this conversion?';

    openConfirm({
      title: 'Delete Conversion',
      message,
      destructive: true,
      testID: 'confirm-delete-conversion',
      onConfirm: async () => {
        try {
          await deleteProductConversion(conversion.id);
          Alert.alert('Success', 'Product conversion deleted successfully.');
        } catch {
          Alert.alert('Error', 'Failed to delete product conversion.');
        }
      },
    });
  };

  const handleClearAllConversions = () => {
    if (productConversions.length === 0) {
      Alert.alert('No Data', 'There are no product conversions to delete.');
      return;
    }

    openConfirm({
      title: 'Clear All Conversions',
      message: `Are you sure you want to delete all ${productConversions.length} product conversions? This action cannot be undone.`,
      destructive: true,
      testID: 'confirm-clear-all-conversions',
      onConfirm: async () => {
        try {
          if (typeof clearAllConversions === 'function') {
            await clearAllConversions();
            Alert.alert('Success', `Deleted all ${productConversions.length} product conversions.`);
          } else {
            const conversionIds = productConversions.map(c => c.id);
            let deletedCount = 0;
            for (const conversionId of conversionIds) {
              await deleteProductConversion(conversionId);
              deletedCount++;
            }
            Alert.alert('Success', `Deleted ${deletedCount} product conversions.`);
          }
        } catch (error) {
          console.error('Clear all error:', error);
          Alert.alert('Error', 'Failed to delete some conversions.');
        }
      },
    });
  };

  const handleExportConversions = async () => {
    if (productConversions.length === 0) {
      Alert.alert('No Data', 'There are no product conversions to export.');
      return;
    }

    try {
      await exportConversionsToExcel(productConversions, products);
      Alert.alert('Success', `Exported ${productConversions.length} product conversions.`);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', `Failed to export conversions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportConversions = async () => {
    try {
      let fileContent: string = '';
      let fileType: 'excel' | 'json' = 'excel';
      
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.json';
        
        await new Promise<void>((resolve, reject) => {
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) {
              reject(new Error('No file selected'));
              return;
            }

            try {
              fileType = file.name.toLowerCase().endsWith('.json') ? 'json' : 'excel';
              
              if (fileType === 'json') {
                const text = await file.text();
                fileContent = text;
              } else {
                const arrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                fileContent = btoa(binary);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          input.click();
        });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets?.[0]?.uri) {
          return;
        }

        const fileName = result.assets[0].name || '';
        fileType = fileName.toLowerCase().endsWith('.json') ? 'json' : 'excel';

        if (fileType === 'json') {
          fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: 'utf8',
          });
        } else {
          fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: 'base64',
          });
        }
      }

      if (!fileContent) {
        return;
      }

      let parsedConversions: ProductConversion[] = [];
      let parseErrors: string[] = [];

      if (fileType === 'json') {
        console.log('[JSON IMPORT] Starting JSON import...');
        try {
          console.log('[JSON IMPORT] File content length:', fileContent.length);
          console.log('[JSON IMPORT] First 200 chars:', fileContent.substring(0, 200));
          
          const jsonData = JSON.parse(fileContent);
          console.log('[JSON IMPORT] Parsed JSON data:', jsonData);
          console.log('[JSON IMPORT] Is array:', Array.isArray(jsonData));
          
          const conversionsArray = Array.isArray(jsonData) 
            ? jsonData 
            : (jsonData.conversions && Array.isArray(jsonData.conversions) ? jsonData.conversions : []);
          console.log('[JSON IMPORT] Conversions array length:', conversionsArray.length);
          
          for (let i = 0; i < conversionsArray.length; i++) {
            const item = conversionsArray[i];
            console.log(`[JSON IMPORT] Processing item ${i + 1}:`, item);
            
            if (!item.fromProductId || !item.toProductId || !item.conversionFactor) {
              console.log(`[JSON IMPORT] Item ${i + 1} missing required fields`);
              parseErrors.push(`Invalid conversion at index ${i + 1}: missing required fields`);
              continue;
            }

            const existingConversion = productConversions.find(c => 
              c.fromProductId === item.fromProductId && c.toProductId === item.toProductId
            );

            if (existingConversion) {
              console.log(`[JSON IMPORT] Item ${i + 1} already exists, skipping`);
              continue;
            }

            const newConversion: ProductConversion = {
              id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              fromProductId: item.fromProductId,
              toProductId: item.toProductId,
              conversionFactor: Number(item.conversionFactor),
              createdAt: item.createdAt || Date.now(),
            };

            console.log(`[JSON IMPORT] Adding conversion ${i + 1}:`, newConversion);
            parsedConversions.push(newConversion);
          }
          
          console.log('[JSON IMPORT] Total conversions parsed:', parsedConversions.length);
          console.log('[JSON IMPORT] Converting to Excel and downloading...');
          
          try {
            await exportConversionsToExcel(parsedConversions, products);
            console.log('[JSON IMPORT] Excel export completed');
          } catch (exportErr) {
            console.error('[JSON IMPORT] Excel export error:', exportErr);
          }
        } catch (err) {
          console.error('[JSON IMPORT] Parse error:', err);
          parseErrors.push(`Failed to parse JSON file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        const result = parseConversionsExcel(fileContent, products, productConversions);
        parsedConversions = result.conversions;
        parseErrors = result.errors;
      }

      if (parseErrors.length > 0) {
        console.warn('Parse errors:', parseErrors);
      }

      if (parsedConversions.length === 0) {
        Alert.alert(
          'Import Complete',
          parseErrors.length > 0 
            ? `No conversions imported:\n${parseErrors.join('\n')}`
            : 'No new conversions found in the file.'
        );
        return;
      }

      console.log('[IMPORT] About to bulk import conversions...');
      console.log('[IMPORT] Parsed conversions:', parsedConversions);
      
      try {
        const importedCount = await importProductConversions(parsedConversions);
        console.log('[IMPORT] Bulk import complete, imported', importedCount, 'conversions');
        
        let message = `Import complete:\n• Imported: ${importedCount}`;
        if (parsedConversions.length - importedCount > 0) {
          message += `\n• Skipped (already exist): ${parsedConversions.length - importedCount}`;
        }
        if (parseErrors.length > 0) {
          message += `\n• Warnings: ${parseErrors.length}`;
        }

        Alert.alert('Import Complete', message);
      } catch (error) {
        console.error('[IMPORT] Error importing conversions:', error);
        Alert.alert('Error', `Failed to import conversions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', `Failed to import conversions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Product Unit Conversions',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>About Product Unit Conversions</Text>
            <Text style={styles.infoText}>
              Set up conversions for products sold in different units. For example: 1 Chocolate Cake (Whole) = 10 Chocolate Cake (Slice).
            </Text>
            <Text style={[styles.infoText, { marginTop: 8 }]}>
              This information is used when calculating stock check vs sales discrepancies in the Sales tab.
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => handleOpenConversionModal()}
            >
              <Plus size={20} color={Colors.light.card} />
              <Text style={styles.buttonText}>Add Unit Conversion</Text>
            </TouchableOpacity>

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, styles.halfButton]}
                onPress={handleExportConversions}
              >
                <Download size={18} color={Colors.light.tint} />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Export</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, styles.halfButton]}
                onPress={handleImportConversions}
              >
                <Upload size={18} color={Colors.light.tint} />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Import</Text>
              </TouchableOpacity>
            </View>

            {productConversions.length > 0 && (
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleClearAllConversions}
              >
                <Trash size={18} color={Colors.light.card} />
                <Text style={styles.buttonText}>Clear All Conversions</Text>
              </TouchableOpacity>
            )}
          </View>

          {productConversions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No product conversions added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add a conversion to link products with the same name but different units
              </Text>
            </View>
          ) : (
            <View style={styles.conversionsList}>
              {productConversions.map((conversion) => {
                const fromProduct = products.find(p => p.id === conversion.fromProductId);
                const toProduct = products.find(p => p.id === conversion.toProductId);
                
                return (
                  <View key={conversion.id} style={styles.conversionCard}>
                    <View style={styles.conversionInfo}>
                      <Text style={styles.conversionTitle}>
                        {fromProduct ? fromProduct.name : 'Unknown Product'}
                      </Text>
                      <Text style={styles.conversionDetails}>
                        1 {fromProduct?.unit || 'unit'} = {conversion.conversionFactor}x {toProduct?.unit || 'unit'}
                      </Text>
                      {!fromProduct || !toProduct ? (
                        <Text style={styles.conversionWarning}>
                          ⚠️ Product not found
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.conversionActions}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleOpenConversionModal(conversion)}
                      >
                        <Edit2 size={18} color={Colors.light.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeleteConversion(conversion)}
                      >
                        <Trash2 size={18} color={Colors.light.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={!!confirmVisible}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        destructive={!!confirmState?.destructive}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={async () => {
          try {
            await confirmState?.onConfirm?.();
          } finally {
            setConfirmVisible(false);
          }
        }}
        testID={confirmState?.testID}
      />

      <Modal
        visible={showConversionModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseConversionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingConversion ? 'Edit Product Conversion' : 'Add Product Conversion'}
              </Text>
              <TouchableOpacity onPress={handleCloseConversionModal}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>From Product (Base Unit) *</Text>
                <View style={styles.searchInputContainer}>
                  <Search size={18} color={Colors.light.muted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchFromProduct}
                    onChangeText={setSearchFromProduct}
                    placeholder="Search products..."
                    placeholderTextColor={Colors.light.muted}
                  />
                </View>
                <View style={styles.pickerContainer}>
                  {Platform.OS === 'web' ? (
                    <select
                      value={conversionFromProductId}
                      onChange={(e: any) => setConversionFromProductId(e.target.value)}
                      style={{
                        backgroundColor: Colors.light.background,
                        borderWidth: 1,
                        borderColor: Colors.light.border,
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 16,
                        color: Colors.light.text,
                        width: '100%',
                      }}
                    >
                      <option value="">Select product...</option>
                      {getSortedProducts()
                        .filter(p => {
                          if (!searchFromProduct.trim()) return true;
                          const searchLower = searchFromProduct.toLowerCase();
                          return p.name.toLowerCase().includes(searchLower) || p.unit.toLowerCase().includes(searchLower);
                        })
                        .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => {
                        const filteredProducts = getSortedProducts().filter(p => {
                          if (!searchFromProduct.trim()) return true;
                          const searchLower = searchFromProduct.toLowerCase();
                          return p.name.toLowerCase().includes(searchLower) || p.unit.toLowerCase().includes(searchLower);
                        });
                        
                        Alert.alert(
                          'Select From Product',
                          '',
                          [
                            ...filteredProducts.map(p => ({
                              text: `${p.name} (${p.unit})`,
                              onPress: () => setConversionFromProductId(p.id),
                            })),
                            { text: 'Cancel', style: 'cancel' as const }
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: conversionFromProductId ? Colors.light.text : Colors.light.muted }}>
                        {conversionFromProductId 
                          ? products.find(p => p.id === conversionFromProductId)?.name + ' (' + products.find(p => p.id === conversionFromProductId)?.unit + ')'
                          : 'Select product...'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Conversion Factor *</Text>
                <TextInput
                  style={styles.input}
                  value={conversionFactor}
                  onChangeText={setConversionFactor}
                  placeholder="e.g., 10"
                  placeholderTextColor={Colors.light.muted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.conversionHint}>
                  1 unit of the base product equals how many units of the converted product?
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>To Product (Converted Unit) *</Text>
                <View style={styles.pickerContainer}>
                  {Platform.OS === 'web' ? (
                    <select
                      value={conversionToProductId}
                      onChange={(e: any) => setConversionToProductId(e.target.value)}
                      style={{
                        backgroundColor: Colors.light.background,
                        borderWidth: 1,
                        borderColor: Colors.light.border,
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 16,
                        color: Colors.light.text,
                        width: '100%',
                      }}
                    >
                      <option value="">Select product...</option>
                      {getSortedProducts()
                        .filter(p => {
                          if (!conversionFromProductId) return true;
                          const fromProduct = products.find(prod => prod.id === conversionFromProductId);
                          return fromProduct && p.name.toLowerCase() === fromProduct.name.toLowerCase() && p.unit !== fromProduct.unit;
                        })
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => {
                        const filteredProducts = getSortedProducts().filter(p => {
                          if (!conversionFromProductId) return true;
                          const fromProduct = products.find(prod => prod.id === conversionFromProductId);
                          return fromProduct && p.name.toLowerCase() === fromProduct.name.toLowerCase() && p.unit !== fromProduct.unit;
                        });
                        
                        Alert.alert(
                          'Select To Product',
                          '',
                          [
                            ...filteredProducts.map(p => ({
                              text: `${p.name} (${p.unit})`,
                              onPress: () => setConversionToProductId(p.id),
                            })),
                            { text: 'Cancel', style: 'cancel' as const }
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: conversionToProductId ? Colors.light.text : Colors.light.muted }}>
                        {conversionToProductId 
                          ? products.find(p => p.id === conversionToProductId)?.name + ' (' + products.find(p => p.id === conversionToProductId)?.unit + ')'
                          : 'Select product...'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.conversionExample}>
                <Text style={styles.conversionExampleTitle}>Example:</Text>
                <Text style={styles.conversionExampleText}>
                  If 1 Chocolate Cake (Whole) = 10 Chocolate Cake (Slice):{`\n`}• From Product: Chocolate Cake (Whole){`\n`}• Conversion Factor: 10{`\n`}• To Product: Chocolate Cake (Slice)
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, styles.modalButton]}
                onPress={handleCloseConversionModal}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, styles.modalButton]}
                onPress={handleSaveConversion}
              >
                <Text style={styles.buttonText}>{editingConversion ? 'Update' : 'Add Conversion'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.muted,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
  },
  secondaryButton: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dangerButton: {
    backgroundColor: Colors.light.danger,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.card,
  },
  secondaryButtonText: {
    color: Colors.light.tint,
  },
  emptyState: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.muted,
    textAlign: 'center' as const,
  },
  conversionsList: {
    gap: 12,
  },
  conversionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  conversionInfo: {
    flex: 1,
  },
  conversionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  conversionDetails: {
    fontSize: 14,
    color: Colors.light.muted,
  },
  conversionWarning: {
    fontSize: 12,
    color: Colors.light.warning || '#F59E0B',
    marginTop: 4,
  },
  conversionActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  modalButton: {
    flex: 1,
    marginBottom: 0,
  },
  pickerContainer: {
    width: '100%',
  },
  conversionHint: {
    fontSize: 12,
    color: Colors.light.muted,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  conversionExample: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  conversionExampleTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  conversionExampleText: {
    fontSize: 12,
    color: Colors.light.muted,
    lineHeight: 18,
  },
  actionButtons: {
    marginBottom: 12,
  },
  rowButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
});
