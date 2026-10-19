"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { refreshCatalog } from "@/lib/actions";

// The Refresh catalog button
export function RefreshLegoCatalogButton() {
  const [isOpen, setIsOpen] = useState(false);

  async function downloadCatalog() {
    const result = await refreshCatalog();
    if (result.error) {
      toast.error(`Could not download the catalog: ${result.error}`);
    } else {
      toast.success(
        `Catalog refreshed: ${result.importedCount?.toLocaleString()} sets`,
      );
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Download />
        Refresh catalog
      </Button>
      <FormDialog
        title="Refresh the LEGO catalog"
        description={
          <>
            This downloads all LEGO set and theme data again from Rebrickable (
            <span className="break-all">
              https://cdn.rebrickable.com/media/downloads
            </span>
            ) and updates the catalog. It can take a while. Existing inventory
            is not changed.
          </>
        }
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        action={downloadCatalog}
        submitText="Download again"
        pendingText="Downloading…"
      />
    </>
  );
}
