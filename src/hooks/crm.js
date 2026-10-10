import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/client";

export function useCollection(entityName, query, options) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const qKey = JSON.stringify(query || {});
  const oKey = JSON.stringify(options || {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.entities[entityName].filter(query || {}, options || { limit: 100 });
      setItems(res.items || []);
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