import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </main>
  );
}