"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send, Users, LogOut, BrainCircuit, User as UserIcon } from "lucide-react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Message, PartnerType, ChatSession } from "@/lib/types";
import { filterMessageAction, getChatResponseAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";


type GameState = "authenticating" | "idle" | "searching" | "playing" | "guessing" | "result";

const AI_FALLBACK_TIME = 5000; // 5 seconds

export default function AnonChat() {
  const [gameState, setGameState] = useState<GameState>("authenticating");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [guessResult, setGuessResult] = useState<{ correct: boolean; choice: PartnerType; actual: PartnerType } | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState<PartnerType>('ai');

  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const activeSessionRef = useMemoFirebase(() => activeSessionId ? doc(firestore, "chat_sessions", activeSessionId) : null, [firestore, activeSessionId]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
    if (!isUserLoading && user) {
        setGameState("idle");
    }
  }, [user, isUserLoading, auth]);

  // Game timer logic
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

  // Auto-scroll chat
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // Listen for session updates
  useEffect(() => {
    if (!activeSessionRef) return;
    
    const unsubscribe = onSnapshot(activeSessionRef, (snapshot) => {
        const sessionData = snapshot.data() as ChatSession;
        if(sessionData?.messages) {
            const formattedMessages = sessionData.messages.map(msg => ({
                ...msg,
                timestamp: (msg.timestamp as Timestamp)?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));

            // Determine sender type
            const finalMessages = formattedMessages.map(msg => {
                if (msg.sender === 'system') return msg;
                return {
                    ...msg,
                    sender: msg.sender === user?.uid ? 'user' : 'partner'
                }
            })
            
            setMessages(finalMessages);
        }
        if (sessionData?.status === 'active' && gameState === 'searching') {
            setGameState('playing');
            setTimer(60);
            setPartnerType(sessionData.partnerType);
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        }
        if (sessionData?.status === 'guessing') {
            setGameState('guessing');
        }
    });

    return () => unsubscribe();
}, [activeSessionRef, user?.uid, gameState]);


const findMatchOrCreateSession = async () => {
    if (!user) return;
    setGameState("searching");

    const waitingPoolRef = collection(firestore, "waiting_pool");
    const q = query(waitingPoolRef, where("status", "==", "waiting"));
    
    const querySnapshot = await getDocs(q);
    const waitingPlayers = querySnapshot.docs.filter(doc => doc.data().userId !== user.uid);


    if (waitingPlayers.length > 0) {
        // Human match found
        const partnerDoc = waitingPlayers[0];
        const partnerId = partnerDoc.data().userId;
        const sessionId = partnerDoc.data().sessionId;

        const batch = writeBatch(firestore);
        batch.delete(partnerDoc.ref);
        const sessionRef = doc(firestore, "chat_sessions", sessionId);
        batch.update(sessionRef, { status: "active", user2Id: user.uid });
        await batch.commit();
        
        setActiveSessionId(sessionId);
    } else {
        // No human match, create a waiting session
        const newSession: Omit<ChatSession, 'id'> = {
            user1Id: user.uid,
            user2Id: null,
            startTime: Timestamp.now(),
            endTime: null,
            status: 'waiting',
            partnerType: 'human', // Initially waiting for a human
            messages: [{
                id: crypto.randomUUID(),
                text: "You are now connected. You have 60 seconds to guess if you're talking to a human or an AI.",
                sender: "system",
                timestamp: Timestamp.now(),
            }],
        };
        const sessionRef = await addDoc(collection(firestore, "chat_sessions"), newSession);
        await addDoc(waitingPoolRef, { userId: user.uid, sessionId: sessionRef.id, status: 'waiting', createdAt: Timestamp.now() });

        setActiveSessionId(sessionRef.id);

        // Fallback to AI if no one joins
        searchTimeoutRef.current = setTimeout(() => matchWithAI(sessionRef.id), AI_FALLBACK_TIME);
    }
};

const matchWithAI = async (sessionId: string) => {
    if (gameState !== 'searching') return; // another user might have joined
    
    const sessionRef = doc(firestore, "chat_sessions", sessionId);
    await updateDocumentNonBlocking(sessionRef, { status: "active", partnerType: "ai", user2Id: "ai_partner" });
    
    setActiveSessionId(sessionId);
};

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !activeSessionId) return;

    const formData = new FormData(event.currentTarget);
    const messageText = formData.get("message") as string;

    if (!messageText.trim() || isSending || gameState !== 'playing') return;

    setIsSending(true);
    formRef.current?.reset();

    const { filteredText } = await filterMessageAction(messageText);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: filteredText,
      sender: user.uid,
      timestamp: Timestamp.now(),
    };

    const sessionRef = doc(firestore, "chat_sessions", activeSessionId);
    
    const currentSession = (await getDocs(query(collection(firestore, "chat_sessions"), where("id", "==", activeSessionId)))).docs?.[0]?.data() as ChatSession;
    
    const currentMessages = currentSession?.messages || messages;

    const updatedMessages = [...currentMessages, userMessage];
    
    await updateDocumentNonBlocking(sessionRef, { messages: updatedMessages });

    try {
      if (partnerType === 'ai') {
        setTimeout(async () => {
            const conversationHistory = [...messages, userMessage];
            const aiResponseText = await getChatResponseAction(conversationHistory.map(m => `${m.sender === user.uid ? 'user' : 'partner'}: ${m.text}`).join('\n'));
            
            const partnerMessage: Message = {
                id: crypto.randomUUID(),
                text: aiResponseText,
                sender: "ai_partner",
                timestamp: Timestamp.now(),
            };
            const finalMessages = [...updatedMessages, partnerMessage];
            await updateDocumentNonBlocking(sessionRef, { messages: finalMessages });
        }, 1500 + Math.random() * 1000);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
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
    setGuessResult({ correct, choice: guess, actual: partnerType });
    setGameState('result');
    if(activeSessionId) {
        updateDocumentNonBlocking(doc(firestore, "chat_sessions", activeSessionId), { status: 'finished', endTime: Timestamp.now()});
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    findMatchOrCreateSession();
  }

  const resetGame = () => {
    setGameState('idle');
    setMessages([]);
    setTimer(60);
    setGuessResult(null);
    setActiveSessionId(null);
    setPartnerType('ai');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const renderResultDialog = () => (
    <AlertDialog open={gameState === 'result'}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {guessResult?.correct ? "You guessed correctly!" : "You guessed wrong!"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            You were talking to a {guessResult?.actual}.
            {guessResult?.correct ? " Nice job!" : ` You thought it was a ${guessResult?.choice}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handlePlayAgain}>Play Again</AlertDialogAction>
          <Button variant="outline" onClick={resetGame}>Main Menu</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (gameState === "authenticating" || isUserLoading) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-body">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
    );
  }

  if (gameState === "idle") {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-body overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-48 bg-primary -skew-y-6"></div>
            <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-10 duration-500 ease-out shadow-2xl z-10">
                <CardHeader className="text-center p-8">
                <CardTitle className="font-headline text-4xl mb-2">Human or AI?</CardTitle>
                <CardDescription>Can you tell the difference? Chat with a partner and make your guess before the time runs out.</CardDescription>
                </CardHeader>
                <CardContent className="px-8">
                <Button variant="default" className="w-full" size="lg" onClick={findMatchOrCreateSession}>
                    <Users className="mr-2 h-5 w-5" />
                    Start Game
                </Button>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-center p-8 pt-4">
                <p>You'll have 60 seconds to decide.</p>
                </CardFooter>
            </Card>
      </main>
    );
  }

  if (gameState === "searching") {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-body overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-48 bg-primary -skew-y-6"></div>
            <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-10 duration-500 ease-out z-10 shadow-2xl">
                <CardHeader className="text-center">
                <CardTitle className="font-headline text-3xl">Finding a Partner...</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting you...</p>
                </CardContent>
            </Card>
        </main>
    );
  }
  
  return (
    <>
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-body overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-48 bg-primary -skew-y-6"></div>
      {renderResultDialog()}
      <Card className={cn(
          "w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col shadow-2xl overflow-hidden z-10",
           "transition-all duration-500 ease-out",
          gameState === 'result' ? 'animate-out fade-out-0 scale-95' : 'animate-in fade-in-0 scale-100 slide-in-from-bottom-10'
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
              {messages.map((msg, index) => (
                <div key={msg.id || index} className={cn(
                    "flex items-end gap-2", 
                    msg.sender === 'user' ? 'justify-end' : 'justify-start',
                    msg.sender === 'system' && 'justify-center'
                  )}>
                  {msg.sender === 'partner' && <Avatar className="h-8 w-8"><AvatarFallback>?</AvatarFallback></Avatar>}
                   {msg.sender === 'system' ? (
                       <div className="text-xs text-muted-foreground italic text-center p-2 bg-muted/50 rounded-lg">{msg.text}</div>
                   ) : (
                      <div className={cn("max-w-[75%] rounded-lg px-3 py-2 shadow-md animate-in fade-in-0 zoom-in-95", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                          <p className="text-sm break-words">{msg.text}</p>
                          <p className={cn("text-xs mt-1", msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-secondary-foreground/70 text-left')}>{typeof msg.timestamp === 'string' ? msg.timestamp : ''}</p>
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
                  <p className="text-sm font-semibold">{gameState === 'guessing' ? "Time's up! Make your guess." : "Game Over"}</p>
                  <div className="flex gap-4">
                      <Button onClick={() => handleGuess('ai')} size="lg" disabled={gameState !== 'guessing'}><BrainCircuit className="mr-2"/> AI</Button>
                      <Button onClick={() => handleGuess('human')} size="lg" disabled={gameState !== 'guessing'}><UserIcon className="mr-2"/> Human</Button>
                  </div>
              </div>
          )}
        </CardFooter>
      </Card>
      </main>
    </>
  );
}

    