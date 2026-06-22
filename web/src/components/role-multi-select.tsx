"use client";

import type { Option } from "@/lib/discord";
import { Label } from "@/components/ui/label";

/** Lista de cargos com checkboxes; submete vários valores no mesmo `name` (FormData.getAll). */
export function RoleMultiSelect({
  name,
  label,
  hint,
  roles,
  selected,
}: {
  name: string;
  label: string;
  hint?: string;
  roles: Option[];
  selected: string[];
}) {
  const set = new Set(selected);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="border-input max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-2">
        {roles.length === 0 ? (
          <p className="text-muted-foreground p-1 text-xs">No roles available.</p>
        ) : (
          roles.map((r) => (
            <label
              key={r.id}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm"
            >
              <input
                type="checkbox"
                name={name}
                value={r.id}
                defaultChecked={set.has(r.id)}
                className="accent-primary size-4"
              />
              <span className="truncate">@ {r.name}</span>
            </label>
          ))
        )}
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
