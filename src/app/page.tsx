import AnonChat from '@/components/anon-chat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-body">
      <div className="absolute top-0 left-0 right-0 h-48 bg-primary -skew-y-6"></div>
      <AnonChat />
    </main>
  );
}
