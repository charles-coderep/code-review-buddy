import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white">
            Code Review Buddy
          </div>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI Code Reviews That{" "}
            <span className="text-blue-400">Teach You Why</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Not just what to fix, but why it matters. Personalized feedback that
            adapts to your skill level and remembers your learning journey.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-slate-500 text-white text-lg font-semibold rounded-lg hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
          </div>
          <p className="text-slate-400 mt-4">
            5 free reviews per month. No credit card required.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Teaches, Not Just Fixes
            </h3>
            <p className="text-slate-400">
              First-principles explanations tailored to your experience level.
              Understand the why behind every suggestion.
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Remembers Your Journey
            </h3>
            <p className="text-slate-400">
              Tracks your progress across sessions. Skips what you know, dives
              deep where you struggle.
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="text-3xl mb-4">📈</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Adapts As You Learn
            </h3>
            <p className="text-slate-400">
              Feedback evolves as you master concepts. Special handling when
              you&apos;re stuck on something.
            </p>
          </div>
        </div>

        {/* Pricing Preview */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Simple Pricing
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-xl font-semibold text-white">Free</h3>
              <p className="text-4xl font-bold text-white my-4">£0</p>
              <ul className="text-slate-400 space-y-2 text-left">
                <li>5 reviews per month</li>
                <li>Basic feedback</li>
                <li>JavaScript & React</li>
              </ul>
            </div>
            <div className="bg-blue-600/20 p-6 rounded-xl border border-blue-500">
              <h3 className="text-xl font-semibold text-white">Pro</h3>
              <p className="text-4xl font-bold text-white my-4">
                £9<span className="text-lg font-normal">/month</span>
              </p>
              <ul className="text-slate-300 space-y-2 text-left">
                <li>Unlimited reviews</li>
                <li>Full learning memory</li>
                <li>Pattern library access</li>
                <li>Progress tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-slate-800">
        <p className="text-center text-slate-500">
          Built for junior to intermediate JavaScript/React developers
        </p>
      </footer>
    </div>
  );
}
