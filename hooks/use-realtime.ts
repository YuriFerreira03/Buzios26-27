"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Reexecuta `onChange` sempre que qualquer uma das tabelas mudar.
 * Mantem uma unica subscription por conjunto de tabelas.
 */
export function useRealtime(tables: string[], onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`rt:${key}`);

    key.split(",").forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        cb.current(),
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [key]);
}
