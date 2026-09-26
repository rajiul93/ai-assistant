"use client";

import { useId, useState, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function SortableItem({ id, className, children }: { id: string; className?: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Only the grip starts a drag, so scrolling the page on a phone never moves anything by accident.
  const handle = <button
    type="button"
    ref={setActivatorNodeRef}
    {...attributes}
    {...listeners}
    aria-label="Drag to reorder"
    title="Drag to reorder"
    className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
  ><GripVertical className="size-4" /></button>;
  return <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(className, isDragging && "relative z-30 rounded-2xl bg-white opacity-95 shadow-xl ring-1 ring-zinc-200")}>
    {children(handle)}
  </li>;
}

/**
 * A list the user can reorder by dragging each item's grip (mouse, touch or keyboard). The new order
 * shows at once and is saved with `onReorder`; if saving fails it snaps back.
 */
export function SortableList<T extends { id: string }>({ items, onReorder, className, itemClassName, children, enabled = true }: {
  items: T[];
  onReorder: (ids: string[]) => Promise<unknown>;
  className?: string;
  itemClassName?: string;
  children: (item: T, handle: ReactNode) => ReactNode;
  /** false renders the same list without grips (e.g. while the list is sorted another way). */
  enabled?: boolean;
}) {
  const id = useId();
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = items.map((item) => item.id);
  // Use the dragged order only while it still covers exactly these items (not after one was added or deleted).
  const shown = order && order.length === ids.length && order.every((item) => ids.includes(item))
    ? order.map((item) => items.find((candidate) => candidate.id === item)!)
    : items;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const current = shown.map((item) => item.id);
    const next = arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id)));
    setOrder(next);
    onReorder(next).catch((error: unknown) => {
      setOrder(null);
      toast.error(error instanceof Error ? error.message : "Couldn't save the new order.");
    });
  };
  if (!enabled) return <ul className={className}>{items.map((item) => <li key={item.id} className={itemClassName}>{children(item, null)}</li>)}</ul>;
  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
    <SortableContext items={shown.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <ul className={className}>
        {shown.map((item) => <SortableItem key={item.id} id={item.id} className={itemClassName}>{(handle) => children(item, handle)}</SortableItem>)}
      </ul>
    </SortableContext>
  </DndContext>;
}

