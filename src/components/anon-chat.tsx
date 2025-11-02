"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send, Users, ArrowRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types";
import { filterMessageAction } from "@/app/actions";
import { cn } from "@/lib/utils";

type Status = "idle" | "searching" | "connected" | "disconnected";

const partnerResponses = [
  "Hey! How's it going?",
  "Hi there. What's on your mind?",
  "Hello! Nice to meet you.",
  "What are you up to?",
  "Tell me something interesting.",
  "lol",
  "That's cool.",
  "Really? Tell me more.",
];

export default function AnonChat() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleFindPartner = () => {
    setStatus("searching");
    setTimeout(() => {
      setMessages([]);
      setStatus("connected");
      
      setTimeout(() => {
        const welcomeMessage: Message = {
          id: crypto.randomUUID(),
          text: "You are now connected to a stranger. Say hi!",
          sender: "partner",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([welcomeMessage]);
      }, 500);

    }, 2000 + Math.random() * 1000);
  };

  const handleNextPartner = () => {
    setStatus("disconnected");
    setTimeout(() => {
      handleFindPartner();
    }, 500);
  };
  
  const handleLeave = () => {
    setStatus("disconnected");
    setTimeout(() => {
      setMessages([]);
      setStatus("idle");
    }, 500);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const messageText = formData.get("message") as string;

    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    formRef.current?.reset();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: messageText,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const { filteredText } = await filterMessageAction(messageText);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, text: filteredText } : msg
        )
      );
      
      setTimeout(() => {
        const partnerMessage: Message = {
          id: crypto.randomUUID(),
          text: partnerResponses[Math.floor(Math.random() * partnerResponses.length)],
          sender: "partner",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, partnerMessage]);
      }, 1500 + Math.random() * 1000);

    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not send message. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (status === "idle") {
    return (
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95">
        <CardHeader className="text-center p-8">
          <CardTitle className="font-headline text-4xl mb-2">AnonChat</CardTitle>
          <CardDescription>Talk to random strangers anonymously.</CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <Button variant="default" className="w-full" size="lg" onClick={handleFindPartner}>
            <Users className="mr-2 h-5 w-5" />
            Find a Partner
          </Button>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center p-8 pt-4">
          <p>You'll be paired for a one-on-one chat.</p>
        </CardFooter>
      </Card>
    );
  }

  if (status === "searching") {
    return (
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Searching...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Connecting you with a stranger...</p>sonic-spinner
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn(
        "w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col transition-all duration-300 shadow-2xl overflow-hidden",
        status === 'disconnected' ? 'animate-out fade-out-0 zoom-out-95' : 'animate-in fade-in-0 zoom-in-95'
    )}>
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center gap-3">
            <Avatar className="border-2 border-primary">
                <AvatarFallback>S</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-bold">Stranger</p>
                <p className="text-xs text-chart-2 font-semibold">Online</p>
            </div>
        </div>
        <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleNextPartner} aria-label="Find next partner">
                <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Leave chat">
                <LogOut className="h-5 w-5 text-destructive" />
            </Button>
        </div>
      </CardHeader>
      <Separator/>
      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex items-end gap-2", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.sender === 'partner' && <Avatar className="h-8 w-8"><AvatarFallback>S</AvatarFallback></Avatar>}
                <div className={cn("max-w-[75%] rounded-lg px-3 py-2 shadow-md", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                    <p className="text-sm break-words">{msg.text}</p>
                    <p className={cn("text-xs mt-1", msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-secondary-foreground/70 text-left')}>{msg.timestamp}</p>
                </div>
                {msg.sender === 'user' && <Avatar className="h-8 w-8"><AvatarFallback>Y</AvatarFallback></Avatar>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t bg-background/50">
        <form ref={formRef} onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input name="message" placeholder="Type a message..." autoComplete="off" disabled={isSending} className="flex-1"/>
          <Button type="submit" size="icon" disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
