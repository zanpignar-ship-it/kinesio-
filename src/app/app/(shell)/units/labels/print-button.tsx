"use client";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
export function PrintButton() {
  return <Button onClick={() => window.print()}><Icon name="printer" className="size-4" />Natisni</Button>;
}
