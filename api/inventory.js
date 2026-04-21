import supabase from './_supabase.js';

function getStatus(quantity, reorderLevel) {
  if (quantity <= Math.max(1, Math.floor(reorderLevel / 2))) return 'Critical';
  if (quantity <= reorderLevel) return 'Low';
  return 'In Stock';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { sku, name, category, location, quantity, reorder_level, unit_cost, barcode } = req.body;
      if (!sku || !name || !category || !location || quantity === undefined || reorder_level === undefined || unit_cost === undefined || !barcode) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const status = getStatus(Number(quantity), Number(reorder_level));
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ sku, name, category, location, quantity, reorder_level, unit_cost, barcode, status })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, quantity } = req.body;
      if (id === undefined || quantity === undefined) {
        return res.status(400).json({ error: 'id and quantity are required' });
      }
      const { data: existing, error: findError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();
      if (findError) throw findError;
      const status = getStatus(Number(quantity), Number(existing.reorder_level));
      const { data, error } = await supabase
        .from('inventory_items')
        .update({ quantity, status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (id === undefined) {
        return res.status(400).json({ error: 'id is required' });
      }
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
