"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function DatePicker({ value, onChange, placeholder = "DD/MM/AAAA", className, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span>{selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto rounded-2xl p-1 shadow-xl">
        <Calendar
          mode="single"
          selected={selected}
          {...(selected ? { defaultMonth: selected } : {})}
          locale={ptBR}
          showOutsideDays={false}
          className="rounded-2xl p-3 [--cell-size:2.35rem]"
          classNames={{
            month_caption: "flex h-9 w-full items-center justify-center px-10",
            caption_label: "select-none text-sm font-bold capitalize",
            button_previous: "h-9 w-9 rounded-xl",
            button_next: "h-9 w-9 rounded-xl",
            weekday: "text-muted-foreground flex-1 select-none text-[0.72rem] font-semibold uppercase",
            week: "mt-1.5 flex w-full",
            today: "rounded-full bg-primary/10 text-primary",
            day: "group/day relative aspect-square h-full w-full select-none p-0 text-center",
          }}
          formatters={{ formatCaption: (date) => format(date, "MMMM yyyy", { locale: ptBR }) }}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
