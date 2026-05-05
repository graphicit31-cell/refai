import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-4">
      <p className="text-white text-sm">Sign up page loaded</p>

      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
        appearance={{
          elements: {
            rootBox: "w-full flex justify-center",
            cardBox: "shadow-2xl",
          },
        }}
      />
    </main>
  );
}