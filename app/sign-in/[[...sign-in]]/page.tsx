import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-4">
      <p>Sign in page loaded</p>

      <ClerkLoading>
        <p className="text-yellow-400">Clerk is loading...</p>
      </ClerkLoading>

      <ClerkLoaded>
        <p className="text-green-400">Clerk loaded</p>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </ClerkLoaded>
    </main>
  );
}