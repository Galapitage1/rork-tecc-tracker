import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef, ReactNode, createContext, useContext } from 'react';
import { Product, StockCheck, StockCount, ProductRequest, Outlet, ProductConversion, InventoryStock, SalesDeduction, SalesReconciliationHistory } from '@/types';
import { syncWithServer } from '@/utils/trpcSyncManager';

const STORAGE_KEYS = {
  PRODUCTS: '@stock_app_products',
  STOCK_CHECKS: '@stock_app_stock_checks',
  REQUESTS: '@stock_app_requests',
  OUTLETS: '@stock_app_outlets',
  SHOW_PRODUCT_LIST: '@stock_app_show_product_list',
  PRODUCT_CONVERSIONS: '@stock_app_product_conversions',
  INVENTORY_STOCKS: '@stock_app_inventory_stocks',
  SALES_DEDUCTIONS: '@stock_app_sales_deductions',
  VIEW_MODE: '@stock_app_view_mode',
  RECONCILE_HISTORY: '@stock_app_reconcile_history',
  SYNC_PAUSED: '@stock_app_sync_paused',
};

type StockContextType = {
  products: Product[];
  stockChecks: StockCheck[];
  requests: ProductRequest[];
  outlets: Outlet[];
  productConversions: ProductConversion[];
  inventoryStocks: InventoryStock[];
  salesDeductions: SalesDeduction[];
  reconcileHistory: SalesReconciliationHistory[];
  isLoading: boolean;
  currentStockCounts: Map<string, number>;
  showProductList: boolean;
  isSyncing: boolean;
  lastSyncTime: number;
  viewMode: 'search' | 'button';
  isSyncPaused: boolean;
  toggleSyncPause: () => Promise<void>;
  importProducts: (newProducts: Product[]) => Promise<number>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveStockCheck: (stockCheck: StockCheck, skipInventoryUpdate?: boolean) => Promise<void>;
  deleteStockCheck: (checkId: string) => Promise<void>;
  updateStockCheck: (checkId: string, newCounts: StockCount[], newOutlet?: string, outletChanged?: boolean) => Promise<void>;
  addRequest: (request: ProductRequest) => Promise<void>;
  updateRequestStatus: (requestId: string, status: ProductRequest['status']) => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;
  updateRequest: (requestId: string, updates: Partial<ProductRequest>) => Promise<void>;
  addRequestsToDate: (date: string, newRequests: ProductRequest[]) => Promise<void>;
  importOutlets: (newOutlets: Outlet[]) => Promise<number>;
  addOutlet: (outlet: Outlet) => Promise<void>;
  updateOutlet: (outletId: string, updates: Partial<Outlet>) => Promise<void>;
  deleteOutlet: (outletId: string) => Promise<void>;
  addProductConversion: (conversion: ProductConversion) => Promise<void>;
  importProductConversions: (conversions: ProductConversion[]) => Promise<number>;
  updateProductConversion: (conversionId: string, updates: Partial<ProductConversion>) => Promise<void>;
  deleteProductConversion: (conversionId: string) => Promise<void>;
  clearAllConversions: () => Promise<void>;
  getConversionFactor: (fromProductId: string, toProductId: string) => number | null;
  updateInventoryStock: (productId: string, updates: Partial<InventoryStock>) => Promise<void>;
  addInventoryStock: (stock: InventoryStock) => Promise<void>;
  deductInventoryFromApproval: (request: ProductRequest) => Promise<{ success: boolean; message?: string }>;
  deductInventoryFromSales: (outletName: string, productId: string, salesDate: string, wholeDeducted: number, slicesDeducted: number) => Promise<void>;
  addReconcileHistory: (history: SalesReconciliationHistory) => Promise<void>;
  deleteReconcileHistory: (historyId: string) => Promise<void>;
  clearAllReconcileHistory: () => Promise<void>;
  clearAllInventory: () => Promise<void>;
  getLowStockItems: () => { product: Product; currentStock: number; minStock: number; }[];
  getTodayStockCheck: () => StockCheck | undefined;
  clearAllData: () => Promise<void>;
  clearAllProducts: () => Promise<void>;
  clearAllOutlets: () => Promise<void>;
  deleteUserStockChecks: (userId: string) => Promise<void>;
  deleteAllStockChecks: () => Promise<void>;
  deleteAllRequests: () => Promise<void>;
  toggleShowProductList: (value: boolean) => Promise<void>;
  setViewMode: (mode: 'search' | 'button') => Promise<void>;
  syncAll: (silent?: boolean, forceDownload?: boolean) => Promise<void>;
};

const StockContext = createContext<StockContextType | null>(null);

export function useStock() {
  const context = useContext(StockContext);
  if (!context) {
    throw new Error('useStock must be used within StockProvider');
  }
  return context;
}

export function StockProvider({ children, currentUser }: { children: ReactNode; currentUser: { id: string; username?: string; role?: 'superadmin' | 'admin' | 'user' } | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockChecks, setStockChecks] = useState<StockCheck[]>([]);
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [productConversions, setProductConversions] = useState<ProductConversion[]>([]);
  const [inventoryStocks, setInventoryStocks] = useState<InventoryStock[]>([]);
  const [salesDeductions, setSalesDeductions] = useState<SalesDeduction[]>([]);
  const [reconcileHistory, setReconcileHistory] = useState<SalesReconciliationHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showProductList, setShowProductList] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [viewMode, setViewModeState] = useState<'search' | 'button'>('search');
  const [isSyncPaused, setIsSyncPaused] = useState<boolean>(false);
  const syncInProgressRef = useRef(false);

  const currentStockCounts = useMemo(() => {
    const map = new Map<string, number>();
    inventoryStocks.forEach(stock => {
      const totalWhole = stock.productionWhole + (stock.prodsWhole || 0);
      const totalSlices = stock.productionSlices + (stock.prodsSlices || 0);
      map.set(stock.productId, totalWhole + totalSlices);
    });
    return map;
  }, [inventoryStocks]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, stockChecksData, requestsData, outletsData, showListData, conversionsData, inventoryData, salesData, viewModeData, reconcileData, syncPausedData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS),
          AsyncStorage.getItem(STORAGE_KEYS.STOCK_CHECKS),
          AsyncStorage.getItem(STORAGE_KEYS.REQUESTS),
          AsyncStorage.getItem(STORAGE_KEYS.OUTLETS),
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PRODUCT_LIST),
          AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_CONVERSIONS),
          AsyncStorage.getItem(STORAGE_KEYS.INVENTORY_STOCKS),
          AsyncStorage.getItem(STORAGE_KEYS.SALES_DEDUCTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.VIEW_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.RECONCILE_HISTORY),
          AsyncStorage.getItem(STORAGE_KEYS.SYNC_PAUSED),
        ]);

        if (productsData) setProducts(JSON.parse(productsData));
        if (stockChecksData) setStockChecks(JSON.parse(stockChecksData));
        if (requestsData) setRequests(JSON.parse(requestsData));
        if (outletsData) setOutlets(JSON.parse(outletsData));
        if (showListData) setShowProductList(JSON.parse(showListData));
        if (conversionsData) setProductConversions(JSON.parse(conversionsData));
        if (inventoryData) setInventoryStocks(JSON.parse(inventoryData));
        if (salesData) setSalesDeductions(JSON.parse(salesData));
        if (viewModeData) setViewModeState(JSON.parse(viewModeData));
        if (reconcileData) setReconcileHistory(JSON.parse(reconcileData));
        if (syncPausedData) setIsSyncPaused(JSON.parse(syncPausedData));
      } catch (error) {
        console.error('Failed to load stock data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleSyncPause = useCallback(async () => {
    const newValue = !isSyncPaused;
    setIsSyncPaused(newValue);
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_PAUSED, JSON.stringify(newValue));
  }, [isSyncPaused]);

  const importProducts = useCallback(async (newProducts: Product[]): Promise<number> => {
    const existingIds = new Set(products.map(p => p.id));
    const uniqueProducts = newProducts.filter(p => !existingIds.has(p.id));
    const updated = [...products, ...uniqueProducts];
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    setProducts(updated);
    return uniqueProducts.length;
  }, [products]);

  const addProduct = useCallback(async (product: Product) => {
    const productWithTimestamp = { ...product, updatedAt: Date.now() };
    const updated = [...products, productWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    setProducts(updated);
  }, [products]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    const updated = products.map(p => p.id === productId ? { ...p, ...updates, updatedAt: Date.now() } : p);
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    setProducts(updated);
  }, [products]);

  const deleteProduct = useCallback(async (productId: string) => {
    const updated = products.map(p => p.id === productId ? { ...p, deleted: true, updatedAt: Date.now() } : p);
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
    setProducts(updated.filter(p => !p.deleted));
  }, [products]);

  const saveStockCheck = useCallback(async (stockCheck: StockCheck, skipInventoryUpdate?: boolean) => {
    const checkWithTimestamp = { ...stockCheck, updatedAt: Date.now() };
    const updated = [...stockChecks, checkWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.STOCK_CHECKS, JSON.stringify(updated));
    setStockChecks(updated);
  }, [stockChecks]);

  const deleteStockCheck = useCallback(async (checkId: string) => {
    const updated = stockChecks.filter(c => c.id !== checkId);
    await AsyncStorage.setItem(STORAGE_KEYS.STOCK_CHECKS, JSON.stringify(updated));
    setStockChecks(updated);
  }, [stockChecks]);

  const updateStockCheck = useCallback(async (checkId: string, newCounts: StockCount[], newOutlet?: string, outletChanged?: boolean) => {
    const updated = stockChecks.map(c => c.id === checkId ? { ...c, counts: newCounts, outlet: newOutlet || c.outlet, updatedAt: Date.now() } : c);
    await AsyncStorage.setItem(STORAGE_KEYS.STOCK_CHECKS, JSON.stringify(updated));
    setStockChecks(updated);
  }, [stockChecks]);

  const addRequest = useCallback(async (request: ProductRequest) => {
    const requestWithTimestamp = { ...request, updatedAt: Date.now() };
    const updated = [...requests, requestWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
    setRequests(updated);
  }, [requests]);

  const updateRequestStatus = useCallback(async (requestId: string, status: ProductRequest['status']) => {
    const updated = requests.map(r => r.id === requestId ? { ...r, status, updatedAt: Date.now() } : r);
    await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
    setRequests(updated);
  }, [requests]);

  const deleteRequest = useCallback(async (requestId: string) => {
    const updated = requests.filter(r => r.id !== requestId);
    await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
    setRequests(updated);
  }, [requests]);

  const updateRequest = useCallback(async (requestId: string, updates: Partial<ProductRequest>) => {
    const updated = requests.map(r => r.id === requestId ? { ...r, ...updates, updatedAt: Date.now() } : r);
    await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
    setRequests(updated);
  }, [requests]);

  const addRequestsToDate = useCallback(async (date: string, newRequests: ProductRequest[]) => {
    const updated = [...requests, ...newRequests];
    await AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(updated));
    setRequests(updated);
  }, [requests]);

  const importOutlets = useCallback(async (newOutlets: Outlet[]): Promise<number> => {
    console.log('[importOutlets] Starting import of', newOutlets.length, 'outlets');
    const existingNames = new Set(outlets.map(o => o.name.toLowerCase().trim()));
    const uniqueOutlets = newOutlets.filter(o => !existingNames.has(o.name.toLowerCase().trim()));
    console.log('[importOutlets] Unique outlets to add:', uniqueOutlets.length);
    const updated = [...outlets, ...uniqueOutlets];
    await AsyncStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(updated));
    setOutlets(updated);
    console.log('[importOutlets] Import complete');
    return uniqueOutlets.length;
  }, [outlets]);

  const addOutlet = useCallback(async (outlet: Outlet) => {
    const outletWithTimestamp = { ...outlet, updatedAt: Date.now() };
    const updated = [...outlets, outletWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(updated));
    setOutlets(updated);
  }, [outlets]);

  const updateOutlet = useCallback(async (outletId: string, updates: Partial<Outlet>) => {
    const updated = outlets.map(o => o.id === outletId ? { ...o, ...updates, updatedAt: Date.now() } : o);
    await AsyncStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(updated));
    setOutlets(updated);
  }, [outlets]);

  const deleteOutlet = useCallback(async (outletId: string) => {
    const updated = outlets.filter(o => o.id !== outletId);
    await AsyncStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(updated));
    setOutlets(updated);
  }, [outlets]);

  const addProductConversion = useCallback(async (conversion: ProductConversion) => {
    const conversionWithTimestamp = { ...conversion, updatedAt: Date.now() };
    const updated = [...productConversions, conversionWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify(updated));
    setProductConversions(updated);
  }, [productConversions]);

  const importProductConversions = useCallback(async (conversions: ProductConversion[]): Promise<number> => {
    console.log('[importProductConversions] Starting import of', conversions.length, 'conversions');
    const existingKeys = new Set(productConversions.map(c => `${c.fromProductId}-${c.toProductId}`));
    const uniqueConversions = conversions.filter(c => !existingKeys.has(`${c.fromProductId}-${c.toProductId}`));
    console.log('[importProductConversions] Unique conversions to add:', uniqueConversions.length);
    const updated = [...productConversions, ...uniqueConversions];
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify(updated));
    setProductConversions(updated);
    console.log('[importProductConversions] Import complete');
    return uniqueConversions.length;
  }, [productConversions]);

  const updateProductConversion = useCallback(async (conversionId: string, updates: Partial<ProductConversion>) => {
    const updated = productConversions.map(c => c.id === conversionId ? { ...c, ...updates, updatedAt: Date.now() } : c);
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify(updated));
    setProductConversions(updated);
  }, [productConversions]);

  const deleteProductConversion = useCallback(async (conversionId: string) => {
    const updated = productConversions.filter(c => c.id !== conversionId);
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify(updated));
    setProductConversions(updated);
  }, [productConversions]);

  const clearAllConversions = useCallback(async () => {
    try {
      console.log('clearAllConversions: Starting...');
      await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify([]));
      setProductConversions([]);
      console.log('clearAllConversions: Complete');
    } catch (error) {
      console.error('Failed to clear all conversions:', error);
      throw error;
    }
  }, []);

  const getConversionFactor = useCallback((fromProductId: string, toProductId: string): number | null => {
    const conversion = productConversions.find(c => c.fromProductId === fromProductId && c.toProductId === toProductId);
    return conversion ? conversion.conversionFactor : null;
  }, [productConversions]);

  const updateInventoryStock = useCallback(async (productId: string, updates: Partial<InventoryStock>) => {
    const updated = inventoryStocks.map(s => s.productId === productId ? { ...s, ...updates, updatedAt: Date.now() } : s);
    await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY_STOCKS, JSON.stringify(updated));
    setInventoryStocks(updated);
  }, [inventoryStocks]);

  const addInventoryStock = useCallback(async (stock: InventoryStock) => {
    const stockWithTimestamp = { ...stock, updatedAt: Date.now() };
    const updated = [...inventoryStocks, stockWithTimestamp];
    await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY_STOCKS, JSON.stringify(updated));
    setInventoryStocks(updated);
  }, [inventoryStocks]);

  const deductInventoryFromApproval = useCallback(async (request: ProductRequest): Promise<{ success: boolean; message?: string }> => {
    return { success: true };
  }, []);

  const deductInventoryFromSales = useCallback(async (outletName: string, productId: string, salesDate: string, wholeDeducted: number, slicesDeducted: number) => {
    const deduction: SalesDeduction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      outletName,
      productId,
      salesDate,
      loadDate: salesDate,
      wholeDeducted,
      slicesDeducted,
      updatedAt: Date.now(),
    };
    const updated = [...salesDeductions, deduction];
    await AsyncStorage.setItem(STORAGE_KEYS.SALES_DEDUCTIONS, JSON.stringify(updated));
    setSalesDeductions(updated);
  }, [salesDeductions]);

  const addReconcileHistory = useCallback(async (history: SalesReconciliationHistory) => {
    const updated = [...reconcileHistory, history];
    await AsyncStorage.setItem(STORAGE_KEYS.RECONCILE_HISTORY, JSON.stringify(updated));
    setReconcileHistory(updated);
  }, [reconcileHistory]);

  const deleteReconcileHistory = useCallback(async (historyId: string) => {
    const updated = reconcileHistory.filter(h => h.id !== historyId);
    await AsyncStorage.setItem(STORAGE_KEYS.RECONCILE_HISTORY, JSON.stringify(updated));
    setReconcileHistory(updated);
  }, [reconcileHistory]);

  const clearAllReconcileHistory = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.RECONCILE_HISTORY, JSON.stringify([]));
    setReconcileHistory([]);
  }, []);

  const clearAllInventory = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY_STOCKS, JSON.stringify([]));
    setInventoryStocks([]);
  }, []);

  const getLowStockItems = useCallback(() => {
    const lowStock: { product: Product; currentStock: number; minStock: number; }[] = [];
    products.forEach(product => {
      const stock = inventoryStocks.find(s => s.productId === product.id);
      if (stock && product.minStock) {
        const currentStock = stock.productionWhole + (stock.prodsWhole || 0) + stock.productionSlices + (stock.prodsSlices || 0);
        if (currentStock < product.minStock) {
          lowStock.push({ product, currentStock, minStock: product.minStock });
        }
      }
    });
    return lowStock;
  }, [products, inventoryStocks]);

  const getTodayStockCheck = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return stockChecks.find(c => c.date === today);
  }, [stockChecks]);

  const clearAllData = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS),
      AsyncStorage.removeItem(STORAGE_KEYS.STOCK_CHECKS),
      AsyncStorage.removeItem(STORAGE_KEYS.REQUESTS),
      AsyncStorage.removeItem(STORAGE_KEYS.OUTLETS),
      AsyncStorage.removeItem(STORAGE_KEYS.PRODUCT_CONVERSIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.INVENTORY_STOCKS),
      AsyncStorage.removeItem(STORAGE_KEYS.SALES_DEDUCTIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.RECONCILE_HISTORY),
    ]);
    setProducts([]);
    setStockChecks([]);
    setRequests([]);
    setOutlets([]);
    setProductConversions([]);
    setInventoryStocks([]);
    setSalesDeductions([]);
    setReconcileHistory([]);
  }, []);

  const clearAllProducts = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    setProducts([]);
  }, []);

  const clearAllOutlets = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.OUTLETS);
    setOutlets([]);
  }, []);

  const deleteUserStockChecks = useCallback(async (userId: string) => {
    const updated = stockChecks.filter(c => c.completedBy !== userId);
    await AsyncStorage.setItem(STORAGE_KEYS.STOCK_CHECKS, JSON.stringify(updated));
    setStockChecks(updated);
  }, [stockChecks]);

  const deleteAllStockChecks = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.STOCK_CHECKS);
    setStockChecks([]);
  }, []);

  const deleteAllRequests = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.REQUESTS);
    setRequests([]);
  }, []);

  const toggleShowProductList = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(STORAGE_KEYS.SHOW_PRODUCT_LIST, JSON.stringify(value));
    setShowProductList(value);
  }, []);

  const setViewMode = useCallback(async (mode: 'search' | 'button') => {
    await AsyncStorage.setItem(STORAGE_KEYS.VIEW_MODE, JSON.stringify(mode));
    setViewModeState(mode);
  }, []);

  const syncAll = useCallback(async (silent: boolean = false, forceDownload: boolean = false) => {
    if (!currentUser?.id) return;
    if (syncInProgressRef.current) return;
    if (isSyncPaused && !forceDownload) return;

    try {
      syncInProgressRef.current = true;
      if (!silent) setIsSyncing(true);

      console.log('[StockContext] Starting sync...');

      const [syncedProducts, syncedStockChecks, syncedRequests, syncedOutlets, syncedConversions, syncedInventory] = await Promise.all([
        syncWithServer<Product>('products', products, { forceDownload }),
        syncWithServer<StockCheck>('stock_checks', stockChecks, { forceDownload }),
        syncWithServer<ProductRequest>('requests', requests, { forceDownload }),
        syncWithServer<Outlet>('outlets', outlets, { forceDownload }),
        syncWithServer<ProductConversion>('product_conversions', productConversions, { forceDownload }),
        syncWithServer<InventoryStock>('inventory_stocks', inventoryStocks, { forceDownload }),
      ]);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(syncedProducts)),
        AsyncStorage.setItem(STORAGE_KEYS.STOCK_CHECKS, JSON.stringify(syncedStockChecks)),
        AsyncStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(syncedRequests)),
        AsyncStorage.setItem(STORAGE_KEYS.OUTLETS, JSON.stringify(syncedOutlets)),
        AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CONVERSIONS, JSON.stringify(syncedConversions)),
        AsyncStorage.setItem(STORAGE_KEYS.INVENTORY_STOCKS, JSON.stringify(syncedInventory)),
      ]);

      setProducts(syncedProducts);
      setStockChecks(syncedStockChecks);
      setRequests(syncedRequests);
      setOutlets(syncedOutlets);
      setProductConversions(syncedConversions);
      setInventoryStocks(syncedInventory);
      setLastSyncTime(Date.now());
      
      console.log('[StockContext] ✓ Sync complete');
    } catch (error) {
      console.error('StockContext syncAll failed:', error);
      if (!silent) throw error;
    } finally {
      syncInProgressRef.current = false;
      if (!silent) setIsSyncing(false);
    }
  }, [currentUser, isSyncPaused, products, stockChecks, requests, outlets, productConversions, inventoryStocks]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (currentUser && !isSyncPaused) {
      interval = setInterval(() => {
        syncAll(true).catch(err => console.log('Stock auto-sync error', err));
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentUser, isSyncPaused, syncAll]);

  const value = useMemo(() => ({
    products,
    stockChecks,
    requests,
    outlets,
    productConversions,
    inventoryStocks,
    salesDeductions,
    reconcileHistory,
    isLoading,
    currentStockCounts,
    showProductList,
    isSyncing,
    lastSyncTime,
    viewMode,
    isSyncPaused,
    toggleSyncPause,
    importProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    saveStockCheck,
    deleteStockCheck,
    updateStockCheck,
    addRequest,
    updateRequestStatus,
    deleteRequest,
    updateRequest,
    addRequestsToDate,
    importOutlets,
    addOutlet,
    updateOutlet,
    deleteOutlet,
    addProductConversion,
    importProductConversions,
    updateProductConversion,
    deleteProductConversion,
    clearAllConversions,
    getConversionFactor,
    updateInventoryStock,
    addInventoryStock,
    deductInventoryFromApproval,
    deductInventoryFromSales,
    addReconcileHistory,
    deleteReconcileHistory,
    clearAllReconcileHistory,
    clearAllInventory,
    getLowStockItems,
    getTodayStockCheck,
    clearAllData,
    clearAllProducts,
    clearAllOutlets,
    deleteUserStockChecks,
    deleteAllStockChecks,
    deleteAllRequests,
    toggleShowProductList,
    setViewMode,
    syncAll,
  }), [
    products,
    stockChecks,
    requests,
    outlets,
    productConversions,
    inventoryStocks,
    salesDeductions,
    reconcileHistory,
    isLoading,
    currentStockCounts,
    showProductList,
    isSyncing,
    lastSyncTime,
    viewMode,
    isSyncPaused,
    toggleSyncPause,
    importProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    saveStockCheck,
    deleteStockCheck,
    updateStockCheck,
    addRequest,
    updateRequestStatus,
    deleteRequest,
    updateRequest,
    addRequestsToDate,
    importOutlets,
    addOutlet,
    updateOutlet,
    deleteOutlet,
    addProductConversion,
    importProductConversions,
    updateProductConversion,
    deleteProductConversion,
    clearAllConversions,
    getConversionFactor,
    updateInventoryStock,
    addInventoryStock,
    deductInventoryFromApproval,
    deductInventoryFromSales,
    addReconcileHistory,
    deleteReconcileHistory,
    clearAllReconcileHistory,
    clearAllInventory,
    getLowStockItems,
    getTodayStockCheck,
    clearAllData,
    clearAllProducts,
    clearAllOutlets,
    deleteUserStockChecks,
    deleteAllStockChecks,
    deleteAllRequests,
    toggleShowProductList,
    setViewMode,
    syncAll,
  ]);

  return (
    <StockContext.Provider value={value}>
      {children}
    </StockContext.Provider>
  );
}
