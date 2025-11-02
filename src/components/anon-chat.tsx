"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send, Users, ArrowRight, LogOut, BrainCircuit, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types";
import { filterMessageAction, getChatResponseAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type GameState = "idle" | "searching" | "playing" | "guessing" | "result";
type PartnerType = "ai" | "human";

const humanResponses = [
  "Hey! How's it going?",
  "Hi there. What's on your mind?",
  "Hello! Nice to meet you.",
  "What are you up to?",
  "Tell me something interesting.",
  "lol",
  "That's cool.",
  "Really? Tell me more.",
  "idk what to say",
  "brb",
];

export default function AnonChat() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [partnerType, setPartnerType] = useState<PartnerType>("human");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [guessResult, setGuessResult] = useState<{ correct: boolean; choice: PartnerType } | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (gameState === 'playing' && timer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer <= 0 && gameState === 'playing') {
      setGameState('guessing');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameState, timer]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const startGame = () => {
    setGameState("searching");
    setTimeout(() => {
      setMessages([]);
      setTimer(60);
      setGuessResult(null);
      const newPartnerType = Math.random() < 0.5 ? "ai" : "human";
      setPartnerType(newPartnerType);
      setGameState("playing");

      const welcomeMessage: Message = {
        id: crypto.randomUUID(),
        text: "You are now connected. You have 60 seconds to guess if you're talking to a human or an AI.",
        sender: "system",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);
    }, 2000 + Math.random() * 1000);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const messageText = formData.get("message") as string;

    if (!messageText.trim() || isSending || gameState !== 'playing') return;

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

      const conversationHistory = [...messages, { ...userMessage, text: filteredText }];
      
      setTimeout(async () => {
        let partnerText = "";
        if (partnerType === 'ai') {
            partnerText = await getChatResponseAction(conversationHistory.map(m => `${m.sender}: ${m.text}`).join('\n'));
        } else {
            partnerText = humanResponses[Math.floor(Math.random() * humanResponses.length)];
        }

        const partnerMessage: Message = {
          id: crypto.randomUUID(),
          text: partnerText,
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

  const handleGuess = (guess: PartnerType) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const correct = guess === partnerType;
    setGuessResult({ correct, choice: guess });
    setGameState('result');
  };

  const resetGame = () => {
    setGameState('idle');
    setMessages([]);
    setTimer(60);
    setGuessResult(null);
  };

  const renderResultDialog = () => (
    <AlertDialog open={gameState === 'result'}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {guessResult?.correct ? "You guessed correctly!" : "You guessed wrong!"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            You were talking to a {partnerType}.
            {guessResult?.correct ? " Nice job!" : ` You thought it was a ${guessResult?.choice}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={startGame}>Play Again</AlertDialogAction>
          <Button variant="outline" onClick={resetGame}>Main Menu</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (gameState === "idle") {
    return (
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95 shadow-2xl z-10">
        <CardHeader className="text-center p-8">
          <CardTitle className="font-headline text-4xl mb-2">Human or AI?</CardTitle>
          <CardDescription>Can you tell the difference? Chat with a partner and make your guess before the time runs out.</CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <Button variant="default" className="w-full" size="lg" onClick={startGame}>
            <Users className="mr-2 h-5 w-5" />
            Start Game
          </Button>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center p-8 pt-4">
          <p>You'll have 60 seconds to decide.</p>
        </CardFooter>
      </Card>
    );
  }

  if (gameState === "searching") {
    return (
      <Card className="w-full max-w-md animate-in fade-in-0 zoom-in-95 z-10 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Finding a Partner...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Connecting you...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
    {renderResultDialog()}
    <Card className={cn(
        "w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col transition-all duration-300 shadow-2xl overflow-hidden z-10",
        gameState === 'result' ? 'animate-out fade-out-0 zoom-out-95' : 'animate-in fade-in-0 zoom-in-95'
    )}>
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center gap-3">
            <Avatar className="border-2 border-primary">
                <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-bold">Stranger</p>
                <p className="text-xs text-chart-2 font-semibold">Online</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-primary tabular-nums">
                0:{timer.toString().padStart(2, '0')}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setGameState('guessing')} aria-label="End Chat and Guess">
                <LogOut className="h-5 w-5 text-destructive" />
            </Button>
        </div>
      </CardHeader>
      <Separator/>
      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn(
                  "flex items-end gap-2", 
                  msg.sender === 'user' ? 'justify-end' : 'justify-start',
                  msg.sender === 'system' && 'justify-center'
                )}>
                {msg.sender === 'partner' && <Avatar className="h-8 w-8"><AvatarFallback>?</AvatarFallback></Avatar>}
                 {msg.sender === 'system' ? (
                     <div className="text-xs text-muted-foreground italic text-center p-2 bg-muted/50 rounded-lg">{msg.text}</div>
                 ) : (
                    <div className={cn("max-w-[75%] rounded-lg px-3 py-2 shadow-md", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                        <p className="text-sm break-words">{msg.text}</p>
                        <p className={cn("text-xs mt-1", msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-secondary-foreground/70 text-left')}>{msg.timestamp}</p>
                    </div>
                 )}
                {msg.sender === 'user' && <Avatar className="h-8 w-8"><AvatarFallback>Y</AvatarFallback></Avatar>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t bg-background/50">
        {gameState === 'playing' ? (
            <form ref={formRef} onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
            <Input name="message" placeholder="Type a message..." autoComplete="off" disabled={isSending} className="flex-1"/>
            <Button type="submit" size="icon" disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
            </Button>
            </form>
        ) : (
            <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold">Time's up! Make your guess.</p>
                <div className="flex gap-4">
                    <Button onClick={() => handleGuess('ai')} size="lg"><BrainCircuit className="mr-2"/> AI</Button>
                    <Button onClick={() => handleGuess('human')} size="lg"><User className="mr-2"/> Human</Button>
                </div>
            </div>
        )}
      </CardFooter>
    </Card>
    </>
  );
}
