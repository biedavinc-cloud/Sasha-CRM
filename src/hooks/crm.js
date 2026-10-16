import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/client";

const PAGE = 500;
// A large `limit` is fetched in pages so lists never silently stop at the server's per-request maximum.
async function fetchPaged(entityName, query, options) {
  const wanted = options.limit ?? 100;
  const entity = api.entities[entityName];
  if (wanted <= PAGE) return (await entity.filter(query, options)).items || [];
  const out = [];
  while (out.length < wanted) {
    const size = Math.min(PAGE, wanted - out.length);
    const batch = (await entity.filter(query, { ...options, limit: size, skip: out.length })).items || [];
    out.push(...batch);
    if (batch.length < size) break;
  }
  return out;
}

export function useCollection(entityName, query, options) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const qKey = JSON.stringify(query || {});
  const oKey = JSON.stringify(options || {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPaged(entityName, query || {}, options || { limit: 100 }));
      setError(null);
    } catch (e) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName, qKey, oKey]);

  useEffect(() => { load(); }, [load]);
  return { items, loading, error, reload: load };
}

export function useCount(entityName, query) {
  const [count, setCount] = useState(null);
  const qKey = JSON.stringify(query || {});
  useEffect(() => {
    api.entities[entityName].count(query || {})
      .then((c) => setCount(c))
      .catch(() => setCount(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName, qKey]);
  return count;
}

export function useAggregate(entityName, opts) {
  const [rows, setRows] = useState([]);
  const oKey = JSON.stringify(opts || {});
  useEffect(() => {
    api.entities[entityName].aggregate(opts)
      .then((r) => setRows(r.rows || []))
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName, oKey]);
  return rows;
}

export function useRecord(entityName, id) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    api.entities[entityName].get(id)
      .then((r) => setRecord(r))
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [entityName, id]);
  return { record, loading, setRecord };
}