"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Archive, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveClientAction, deleteClientAction } from "@/actions/clients";
import type { Client } from "@/types";

export function ClientsTable({ clients }: { clients: Client[] }) {
  const router = useRouter();

  if (clients.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No clients yet.{" "}
        <Link href="/clients/new" className="text-primary hover:underline">
          Add your first one
        </Link>
        .
      </p>
    );
  }

  async function handleArchive(id: string) {
    const result = await archiveClientAction(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Client archived");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this client? This can't be undone.")) return;
    const result = await deleteClientAction(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Client deleted");
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Payment terms</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell>
              <Link href={`/clients/${client.id}`} className="font-medium hover:text-primary">
                {client.name}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{client.company_name || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{client.email || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{client.payment_terms_days} days</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/clients/${client.id}`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(client.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(client.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
