"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { postFreelancerReplyAction, postClientMessageAction } from "@/actions/messages";
import type { InvoiceMessage } from "@/types";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Sending…" : "Send"}
    </Button>
  );
}

interface MessageThreadProps {
  messages: InvoiceMessage[];
  viewerRole: "client" | "freelancer";
  invoiceId?: string; // required when viewerRole === "freelancer"
  token?: string; // required when viewerRole === "client"
}

export function MessageThread({ messages, viewerRole, invoiceId, token }: MessageThreadProps) {
  async function handleSubmit(formData: FormData) {
    const result =
      viewerRole === "freelancer"
        ? await postFreelancerReplyAction(invoiceId!, formData)
        : await postClientMessageAction(token!, formData);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageCircle className="h-4 w-4" />
        Messages
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((message) => {
            const isOwnVoice =
              (viewerRole === "freelancer" && message.sender === "freelancer") ||
              (viewerRole === "client" && message.sender === "client");
            return (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  isOwnVoice ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary"
                )}
              >
                <p>{message.body}</p>
                <p className={cn("mt-1 text-[10px]", isOwnVoice ? "opacity-70" : "text-muted-foreground")}>
                  {message.sender === "freelancer" ? "You" : "Client"} ·{" "}
                  {new Date(message.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <form action={handleSubmit} className="flex flex-col gap-2">
        <Textarea name="body" rows={2} placeholder="Write a message…" required maxLength={2000} />
        <SendButton />
      </form>
    </div>
  );
}
