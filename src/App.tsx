import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Barcode, Boxes, Filter, Package, Plus, Search, ShieldCheck, Trash2, TrendingUp, Warehouse, Wrench } from 'lucide-react';

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  reorder_level: number;
  unit_cost: number;
  barcode: string;
  status: string;
  created_at: string;
};

type InventoryForm = {
  sku: string;
  name: string;
  category: string;
  location: string;
  quantity: string;
  reorder_level: string;
  unit_cost: string;
  barcode: string;
};

type SortKey = 'name' | 'quantity' | 'unit_cost' | 'category' | 'location' | 'status';

const initialForm: InventoryForm = {
  sku: '',
  name: '',
  category: '',
  location: '',
  quantity: '',
  reorder_level: '',
  unit_cost: '',
  barcode: '',
};

function createBarcodePattern(barcode: string) {
  const digits = barcode.replace(/\D/g, '') || '123456789012';
  const parts = digits.split('');
  const segments = parts.map((digit, index) => {
    const width = 1 + ((Number(digit) + index) % 4);
    const gap = 1 + ((Number(digit) * 2 + index) % 3);
    return `#f4f4f5 0 ${width}px, transparent ${width}px ${width + gap}px`;
  });
  return `repeating-linear-gradient(90deg, ${segments.join(', ')})`;
}

function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('quantity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [compactView, setCompactView] = useState(false);
  const [form, setForm] = useState<InventoryForm>(initialForm);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category));
    return ['All', ...Array.from(unique)];
  }, [items]);

  const locations = useMemo(() => {
    const unique = new Set(items.map((item) => item.location));
    return ['All', ...Array.from(unique)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const matchesQuery = [item.name, item.sku, item.location, item.barcode]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
      return matchesQuery && matchesCategory && matchesStatus && matchesLocation;
    });

    return filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const getValue = (item: InventoryItem) => item[sortKey];
      const first = getValue(a);
      const second = getValue(b);
      if (typeof first === 'number' && typeof second === 'number') return (first - second) * direction;
      return String(first).localeCompare(String(second)) * direction;
    });
  }, [items, query, categoryFilter, statusFilter, locationFilter, sortKey, sortDirection]);

  const metrics = useMemo(() => {
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const inventoryValue = items.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost), 0);
    const lowStock = items.filter((item) => item.quantity <= item.reorder_level).length;
    const categoriesCount = new Set(items.map((item) => item.category)).size;
    const criticalCount = items.filter((item) => item.status === 'Critical').length;
    const averageUnitCost = items.length ? inventoryValue / totalUnits || 0 : 0;
    return { totalUnits, inventoryValue, lowStock, categoriesCount, criticalCount, averageUnitCost };
  }, [items]);

  const topRiskItems = useMemo(() => {
    return [...items]
      .filter((item) => item.quantity <= item.reorder_level)
      .sort((a, b) => (a.quantity - a.reorder_level) - (b.quantity - b.reorder_level))
      .slice(0, 4);
  }, [items]);

  const categoryBreakdown = useMemo(() => {
    return categories
      .filter((category) => category !== 'All')
      .map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        const units = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
        return { category, units, count: categoryItems.length };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [categories, items]);

  const handleChange = (field: keyof InventoryForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          category: form.category,
          location: form.location,
          quantity: Number(form.quantity),
          reorder_level: Number(form.reorder_level),
          unit_cost: Number(form.unit_cost),
          barcode: form.barcode,
        }),
      });
      if (res.ok) {
        setForm(initialForm);
        await fetchItems();
      }
    } catch (err) {
      console.error('Create error:', err);
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (id: number, quantity: number) => {
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity }),
    });
    if (res.ok) fetchItems();
  };

  const deleteItem = async (id: number) => {
    const res = await fetch('/api/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchItems();
  };

  const fillDemoBarcode = () => {
    const generated = `84${Date.now().toString().slice(-10)}`;
    setForm((current) => ({ ...current, barcode: generated }));
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0f14] text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_40%)]" />
      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex items-center gap-3 px-1 sm:mb-6 sm:gap-4">
          <img src="/favicon.svg" alt="Barventory logo" className="h-8 w-8 object-contain sm:h-10 sm:w-10" />
          <span className="text-2xl font-black tracking-tight text-white sm:text-3xl">Barventory</span>
        </div>

        <header className="mb-6 rounded-3xl border border-orange-500/20 bg-zinc-950/80 p-4 shadow-2xl shadow-orange-950/20 backdrop-blur sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="max-w-4xl text-2xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Industrial inventory control with barcode intelligence</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                A refined warehouse dashboard for production teams, maintenance stores, and distribution floors. Track stock, barcode IDs, reorder risk, and location flow in one steel-toned workspace.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard icon={Boxes} label="Units on hand" value={metrics.totalUnits.toLocaleString()} />
              <MetricCard icon={TrendingUp} label="Inventory value" value={`$${metrics.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <MetricCard icon={AlertTriangle} label="Low stock" value={String(metrics.lowStock)} accent="text-amber-300" />
              <MetricCard icon={Warehouse} label="Categories" value={String(metrics.categoriesCount)} />
              <MetricCard icon={ShieldCheck} label="Critical" value={String(metrics.criticalCount)} accent="text-red-300" />
              <MetricCard icon={Wrench} label="Avg unit cost" value={`$${metrics.averageUnitCost.toFixed(1)}`} />
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 backdrop-blur sm:p-5">
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">Stock registry</h2>
                <p className="text-sm text-zinc-400">Search by SKU, product, location, or barcode.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
                <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 sm:col-span-2 xl:min-w-[220px]">
                  <Search className="h-4 w-4 text-orange-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search inventory"
                    className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                  />
                </label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none">
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none">
                  <option>All</option>
                  <option>In Stock</option>
                  <option>Low</option>
                  <option>Critical</option>
                </select>
                <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none">
                  {locations.map((location) => (
                    <option key={location}>{location}</option>
                  ))}
                </select>
                <div className="flex gap-3 sm:col-span-2 xl:col-span-1">
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none">
                    <option value="quantity">Sort: Quantity</option>
                    <option value="name">Sort: Name</option>
                    <option value="unit_cost">Sort: Unit Cost</option>
                    <option value="category">Sort: Category</option>
                    <option value="location">Sort: Location</option>
                    <option value="status">Sort: Status</option>
                  </select>
                  <button onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-300 transition hover:border-orange-500/40 hover:text-orange-300" type="button">
                    <ArrowDownUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCompactView((current) => !current)} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 transition hover:border-orange-500/40 hover:text-orange-300" type="button">
                    {compactView ? 'Spacious' : 'Compact'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <InfoPanel icon={Filter} title="Active filters" value={`${filteredItems.length} visible items`} description={`${categoryFilter} · ${statusFilter} · ${locationFilter}`} />
              <InfoPanel icon={Barcode} title="Barcode coverage" value={`${items.length} / ${items.length} tagged`} description="Every item includes a scannable code reference." />
              <InfoPanel icon={Warehouse} title="Storage footprint" value={`${locations.length - 1} active zones`} description="Location-aware filtering for racks, bins, and aisles." />
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-zinc-800 lg:block">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-zinc-900/90 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 xl:text-xs">
                <span>Item</span>
                <span>SKU</span>
                <span>Location</span>
                <span>Qty</span>
                <span>Status</span>
                <span>Barcode</span>
                <span>Actions</span>
              </div>
              {loading ? (
                <div className="space-y-3 bg-zinc-950 p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-2xl bg-zinc-900" />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-zinc-800 bg-zinc-950">
                  {filteredItems.map((item) => (
                    <div key={item.id} className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 text-sm text-zinc-300 transition hover:bg-zinc-900/60 ${compactView ? 'py-3' : 'py-4'}`}>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-zinc-500">{item.category} · ${Number(item.unit_cost).toFixed(2)} each</div>
                      </div>
                      <div className="truncate font-mono text-xs text-orange-300">{item.sku}</div>
                      <div className="truncate">{item.location}</div>
                      <div className="font-bold text-white">{item.quantity}</div>
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(item.status)}`}>{item.status}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-zinc-300">
                          <Barcode className="h-4 w-4 text-orange-400" />
                          <span className="truncate">{item.barcode}</span>
                        </div>
                        <div className="mt-1 h-8 rounded opacity-80" style={{ backgroundImage: createBarcodePattern(item.barcode) }} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => adjustStock(item.id, item.quantity + 1)} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20">+1</button>
                        <button onClick={() => adjustStock(item.id, Math.max(0, item.quantity - 1))} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20">-1</button>
                        <button onClick={() => deleteItem(item.id)} className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {!filteredItems.length && <div className="px-4 py-10 text-center text-sm text-zinc-500">No inventory matches the current filters.</div>}
                </div>
              )}
            </div>

            <div className="space-y-3 lg:hidden">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-zinc-900" />)
              ) : (
                filteredItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-lg shadow-black/20">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white sm:text-base">{item.name}</h3>
                        <p className="truncate text-xs text-zinc-500">{item.category} · {item.location}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${badgeClass(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400 sm:text-sm">
                      <MobileStat label="SKU" value={item.sku} mono />
                      <MobileStat label="Quantity" value={String(item.quantity)} />
                      <MobileStat label="Unit cost" value={`$${Number(item.unit_cost).toFixed(2)}`} />
                      <MobileStat label="Reorder" value={String(item.reorder_level)} />
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-zinc-300 sm:text-xs">
                        <Barcode className="h-4 w-4 text-orange-400" />
                        <span className="truncate">{item.barcode}</span>
                      </div>
                      <div className="h-10 rounded opacity-80" style={{ backgroundImage: createBarcodePattern(item.barcode) }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => adjustStock(item.id, item.quantity + 1)} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20">Increase</button>
                      <button onClick={() => adjustStock(item.id, Math.max(0, item.quantity - 1))} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20">Decrease</button>
                      <button onClick={() => deleteItem(item.id)} className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                ))
              )}
              {!loading && !filteredItems.length && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-10 text-center text-sm text-zinc-500">No inventory matches the current filters.</div>}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-zinc-950 to-zinc-900 p-4 shadow-xl shadow-black/30 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-300"><Plus className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-bold text-white sm:text-xl">Add stock item</h2>
                  <p className="text-sm text-zinc-400">Register a new part, component, or finished good.</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="SKU" value={form.sku} onChange={(value) => handleChange('sku', value)} />
                  <div>
                    <Input label="Barcode" value={form.barcode} onChange={(value) => handleChange('barcode', value)} />
                    <button type="button" onClick={fillDemoBarcode} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-orange-500/40 hover:text-orange-300">Generate barcode</button>
                  </div>
                </div>
                <Input label="Item name" value={form.name} onChange={(value) => handleChange('name', value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Category" value={form.category} onChange={(value) => handleChange('category', value)} />
                  <Input label="Location" value={form.location} onChange={(value) => handleChange('location', value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Quantity" type="number" value={form.quantity} onChange={(value) => handleChange('quantity', value)} />
                  <Input label="Reorder level" type="number" value={form.reorder_level} onChange={(value) => handleChange('reorder_level', value)} />
                  <Input label="Unit cost" type="number" step="0.01" value={form.unit_cost} onChange={(value) => handleChange('unit_cost', value)} />
                </div>
                <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">
                  <Package className="h-4 w-4" /> {saving ? 'Saving...' : 'Create inventory item'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 sm:p-5">
              <h3 className="mb-4 text-base font-bold text-white sm:text-lg">Operational notes</h3>
              <div className="space-y-3 text-sm text-zinc-400">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-1 font-semibold text-zinc-200">Barcode-ready workflow</div>
                  <p>Each item stores a barcode string and renders a visual barcode strip for quick floor-side verification.</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-1 font-semibold text-zinc-200">Reorder protection</div>
                  <p>Status updates automatically based on quantity versus reorder level, highlighting low and critical stock.</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-1 font-semibold text-zinc-200">Warehouse visibility</div>
                  <p>Searchable locations, category filters, and live inventory value make the dashboard useful for industrial operations.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 sm:p-5">
              <h3 className="mb-4 text-base font-bold text-white sm:text-lg">Restock watchlist</h3>
              <div className="space-y-3">
                {topRiskItems.length ? topRiskItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-100">{item.name}</div>
                        <div className="truncate text-xs text-zinc-500">{item.location} · {item.category}</div>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClass(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                      <span>On hand: <span className="font-semibold text-zinc-200">{item.quantity}</span></span>
                      <span>Target: <span className="font-semibold text-zinc-200">{item.reorder_level}</span></span>
                    </div>
                  </div>
                )) : <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">No items currently need restocking.</div>}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 sm:p-5">
              <h3 className="mb-4 text-base font-bold text-white sm:text-lg">Category throughput</h3>
              <div className="space-y-3">
                {categoryBreakdown.map((entry) => {
                  const width = metrics.totalUnits ? Math.max(8, (entry.units / metrics.totalUnits) * 100) : 0;
                  return (
                    <div key={entry.category}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-400 sm:text-sm">
                        <span className="truncate text-zinc-200">{entry.category}</span>
                        <span>{entry.units} units</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-300" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent = 'text-orange-300' }: { icon: React.ElementType; label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="pr-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:text-xs">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="truncate text-lg font-black text-white sm:text-2xl">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', step }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <input
        required
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-orange-500/60"
      />
    </label>
  );
}

function InfoPanel({ icon: Icon, title, value, description }: { icon: React.ElementType; title: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/10 p-2 text-orange-300"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</div>
          <div className="truncate text-sm font-semibold text-white sm:text-base">{value}</div>
        </div>
      </div>
      <p className="text-xs leading-5 text-zinc-400 sm:text-sm">{description}</p>
    </div>
  );
}

function MobileStat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={`truncate text-sm font-semibold text-zinc-100 ${mono ? 'font-mono text-orange-300' : ''}`}>{value}</div>
    </div>
  );
}

function badgeClass(status: string) {
  if (status === 'Critical') return 'bg-red-500/10 text-red-300 border border-red-500/20';
  if (status === 'Low') return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
  return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
}

export default App;
